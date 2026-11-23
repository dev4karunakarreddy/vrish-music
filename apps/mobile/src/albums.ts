import type { Track } from '@noir/types';

const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const titleKey = (value: string) =>
  normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const missingAlbum = (value: string) => ['', 'imported music', 'unknown album'].includes(normalize(value));

/** Similarity ratio based on edit distance; used only for album titles. */
function titleSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 1;
  // Quick length filter: if lengths differ by more than 20%, similarity is guaranteed < 0.8
  if (Math.abs(left.length - right.length) / maxLen > 0.2) return 0;

  const a = Array.from(left);
  const b = Array.from(right);
  if (Math.min(a.length, b.length) < 4) return left === right ? 1 : 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

/** Prefer the album-level artist. Per-track singers must not split one album. */
export function albumGroupKey(track: Track): string {
  const album = titleKey(track.album) || 'unknown album';
  const albumArtist = normalize(track.albumArtist ?? '');
  const identity = albumArtist || normalize(track.artist);
  return JSON.stringify([album, identity]);
}

export interface AlbumGroup {
  key: string;
  album: string;
  artist: string;
  composer: string;
  tracks: Track[];
  artwork?: string;
  addedAt: number;
}

const titleCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function groupAlbums(tracks: Track[]): AlbumGroup[] {
  type Cluster = { key: string; identity: string; normalizedTitle: string; tracks: Track[] };
  const clusters: Cluster[] = [];
  const exactMap = new Map<string, Cluster>();
  const identityClusters = new Map<string, Cluster[]>();

  for (const track of tracks) {
    const normalizedTitle = titleKey(track.album) || 'unknown album';
    const albumArtist = normalize(track.albumArtist ?? '');
    const identity = albumArtist || normalize(track.artist);
    const exactKey = `${identity}:::${normalizedTitle}`;

    // Fast path: O(1) exact match lookup
    const exactMatch = exactMap.get(exactKey);
    if (exactMatch) {
      exactMatch.tracks.push(track);
      continue;
    }

    // Narrow candidate search to the same artist identity
    const siblings = identityClusters.get(identity);
    let matchedCluster: Cluster | undefined;
    if (siblings) {
      for (const sibling of siblings) {
        if (titleSimilarity(sibling.normalizedTitle, normalizedTitle) >= 0.8) {
          matchedCluster = sibling;
          break;
        }
      }
    }

    if (matchedCluster) {
      matchedCluster.tracks.push(track);
      exactMap.set(exactKey, matchedCluster);
    } else {
      const newCluster: Cluster = {
        key: JSON.stringify([normalizedTitle, identity]),
        identity,
        normalizedTitle,
        tracks: [track],
      };
      clusters.push(newCluster);
      exactMap.set(exactKey, newCluster);
      if (siblings) {
        siblings.push(newCluster);
      } else {
        identityClusters.set(identity, [newCluster]);
      }
    }
  }

  return clusters.map(({ key, tracks: items }) => {
    let groupArtist: string | undefined;
    let composer = '';
    let artwork: string | undefined;
    let maxAddedAt = 0;
    const artistSet = new Set<string>();

    for (const t of items) {
      if (!groupArtist && t.albumArtist?.trim()) groupArtist = t.albumArtist.trim();
      if (!composer && t.composer?.trim()) composer = t.composer.trim();
      if (!artwork && t.artworkUri) artwork = t.artworkUri;
      if (t.addedAt > maxAddedAt) maxAddedAt = t.addedAt;
      const a = t.artist?.trim();
      if (a) artistSet.add(a);
    }

    const distinctArtists = Array.from(artistSet);
    const sorted = [...items].sort((a, b) => titleCollator.compare(a.title, b.title));
    return {
      key,
      album: items[0].album.trim() || 'Unknown Album',
      artist: groupArtist || (distinctArtists.length > 1 ? 'Various Artists' : distinctArtists[0] || 'Unknown Artist'),
      composer,
      tracks: sorted,
      artwork,
      addedAt: maxAddedAt,
    };
  });
}
