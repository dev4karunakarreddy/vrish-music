import type { Track } from '@noir/types';

const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const titleKey = (value: string) =>
  normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const isGenericAlbum = (value: string) => ['', 'imported music', 'unknown album'].includes(normalize(value));

function extractFolder(uri: string): string {
  try {
    const parts = decodeURIComponent(uri).split(/[\/\\]+/).filter(Boolean);
    if (parts.length >= 2) {
      const parent = parts[parts.length - 2].trim().toLowerCase();
      if (!['download', 'downloads', 'music', 'audio', 'files', '0', 'emulated', 'storage', 'media', 'raw'].includes(parent)) {
        return parent;
      }
    }
  } catch {}
  return '';
}

/** Prefer the album-level artist. Per-track singers must not split one album. */
export function albumGroupKey(track: Track): string {
  const normAlbum = titleKey(track.album);
  const album = isGenericAlbum(track.album) ? extractFolder(track.uri) || 'unknown album' : normAlbum || 'unknown album';
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
  type Cluster = { key: string; identity: string; albumTitle: string; tracks: Track[] };
  const clusters: Cluster[] = [];
  const exactMap = new Map<string, Cluster>();

  for (const track of tracks) {
    const normAlbum = titleKey(track.album);
    const isGeneric = isGenericAlbum(track.album);
    const folder = isGeneric ? extractFolder(track.uri) : '';
    const albumTitle = isGeneric && folder ? folder : normAlbum || 'unknown album';
    const albumArtist = normalize(track.albumArtist ?? '');
    const identity = albumArtist || normalize(track.artist);
    
    // Strict, reliable grouping: albums are only grouped together if they share the exact
    // album title and artist identity. Different albums (e.g. Vol 1 vs Vol 2, or songs in different albums)
    // are strictly kept separate and never conflated or merged.
    const exactKey = `${identity}:::${albumTitle}`;

    const existing = exactMap.get(exactKey);
    if (existing) {
      existing.tracks.push(track);
    } else {
      const newCluster: Cluster = {
        key: JSON.stringify([albumTitle, identity]),
        identity,
        albumTitle,
        tracks: [track],
      };
      clusters.push(newCluster);
      exactMap.set(exactKey, newCluster);
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
    
    // Determine user-friendly album name
    const displayAlbum = items[0].album?.trim() && !isGenericAlbum(items[0].album)
      ? items[0].album.trim()
      : (extractFolder(items[0].uri) ? extractFolder(items[0].uri).replace(/[_-]+/g, ' ').toUpperCase() : 'Unknown Album');

    return {
      key,
      album: displayAlbum,
      artist: groupArtist || (distinctArtists.length > 1 ? 'Various Artists' : distinctArtists[0] || 'Unknown Artist'),
      composer,
      tracks: sorted,
      artwork,
      addedAt: maxAddedAt,
    };
  });
}
