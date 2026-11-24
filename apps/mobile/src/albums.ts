import type { Track } from '@noir/types';

const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export const titleKey = (value: string) =>
  normalize(value)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const isGenericAlbum = (value: string) => ['', 'imported music', 'unknown album'].includes(normalize(value));

export const GENERIC_ALBUMS = new Set([
  'greatest hits',
  'best of',
  'the best of',
  'hits',
  'top hits',
  'anthology',
  'singles',
  'the singles',
  'essential',
  'the essential',
  'the collection',
  'collection',
  'live',
  'unknown album',
  'imported music',
]);

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

const cleanCache = new Map<string, string>();

/**
 * Normalizes album titles by stripping bracketed years, common edition tags,
 * and soundtrack indicators so that variants (e.g. "Ninnu Kori (2017)" vs "Ninnu Kori")
 * canonicalize to the same base title.
 */
export function cleanAlbumTitle(raw: string): string {
  if (!raw) return '';
  const cached = cleanCache.get(raw);
  if (cached !== undefined) return cached;

  const cleaned = raw
    .normalize('NFKC')
    // Remove years in parentheses or brackets: (2017), [2015], (1999), (2023)
    .replace(/\s*[\(\[]\s*(?:19|20)\d{2}\s*[\)\]]/gi, '')
    // Remove standalone year at end of title: e.g. "Ninnu Kori 2017"
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    // Remove common release types & suffixes:
    .replace(/\s*[\(\[]\s*(?:original\s+motion\s+picture\s+soundtrack|original\s+soundtrack|official\s+soundtrack|soundtrack|ost|deluxe\s+edition|deluxe|bonus\s+track\s+edition|bonus\s+tracks?|expanded\s+edition|special\s+edition|remastered|remaster|collector'?s\s+edition|audio|songs?)\s*[\)\]]/gi, '')
    // Remove " - Single", " - EP", " - OST", " - Soundtrack"
    .replace(/\s*[-–—]\s*(?:single|ep|ost|soundtrack)\b/gi, '')
    .trim();

  const res = titleKey(cleaned) || titleKey(raw);
  if (cleanCache.size < 2000) cleanCache.set(raw, res);
  return res;
}

export function getVolumeNumber(str: string): string | null {
  const norm = normalize(str);
  const match = norm.match(/\b(?:vol(?:ume)?|part|pt|disc|cd)\s*(\d+|[ivx]+)\b/i) ||
                norm.match(/\b(\d+)\s*$/);
  return match ? match[1].toLowerCase() : null;
}

function bigrams(str: string): Set<string> {
  const s = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    s.add(str.slice(i, i + 2));
  }
  return s;
}

export function titleSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  if (a.length < 2 || b.length < 2) return a === b ? 1.0 : 0.0;

  // Check token containment / word overlap
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let commonWords = 0;
  for (const w of setA) {
    if (setB.has(w)) commonWords++;
  }
  const minWords = Math.min(wordsA.length, wordsB.length);
  const wordOverlap = minWords > 0 ? commonWords / minWords : 0;
  if (wordOverlap >= 0.75 && minWords >= 2) {
    return 0.85;
  }

  // Dice coefficient on character bigrams
  const bgA = bigrams(a);
  const bgB = bigrams(b);
  let intersection = 0;
  for (const bg of bgA) {
    if (bgB.has(bg)) intersection++;
  }
  return (2.0 * intersection) / (bgA.size + bgB.size);
}

/** Prefer the album-level artist. Per-track singers must not split one album. */
export function albumGroupKey(track: Track): string {
  const rawAlbum = track.album?.trim() || '';
  const isGeneric = isGenericAlbum(rawAlbum);
  const folder = isGeneric ? extractFolder(track.uri) : '';
  const effectiveTitle = isGeneric && folder ? folder : rawAlbum || 'unknown album';
  const canonical = cleanAlbumTitle(effectiveTitle);
  const isGenericTitle = GENERIC_ALBUMS.has(canonical) || isGeneric;
  const albumArtist = normalize(track.albumArtist ?? '');
  const identity = albumArtist || normalize(track.artist);

  if (isGenericTitle) {
    return JSON.stringify([canonical, identity]);
  }
  return canonical;
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
  type Cluster = {
    key: string;
    canonicalTitle: string;
    isGeneric: boolean;
    identity: string;
    tracks: Track[];
    displayTitle: string;
  };

  const clusters: Cluster[] = [];
  const indexMap = new Map<string, Cluster>();

  for (const track of tracks) {
    const rawAlbum = track.album?.trim() || '';
    const isGeneric = isGenericAlbum(rawAlbum);
    const folder = isGeneric ? extractFolder(track.uri) : '';
    const effectiveTitle = isGeneric && folder ? folder : rawAlbum || 'Unknown Album';
    const canonical = cleanAlbumTitle(effectiveTitle);
    const isGenericTitle = GENERIC_ALBUMS.has(canonical) || isGeneric;
    const albumArtist = normalize(track.albumArtist ?? '');
    const identity = albumArtist || normalize(track.artist);
    const vol = getVolumeNumber(effectiveTitle);

    let matchedCluster: Cluster | null = null;

    // Fast-path O(1) index lookup
    if (isGenericTitle) {
      matchedCluster = indexMap.get(`${canonical}:::${identity}`) ?? null;
    } else {
      const direct = indexMap.get(canonical);
      if (direct) {
        const clusterVol = getVolumeNumber(direct.displayTitle);
        if (!vol || !clusterVol || vol === clusterVol) {
          matchedCluster = direct;
        }
      }
    }

    // Secondary pass: fuzzy match if fast-path missed
    if (!matchedCluster && !isGenericTitle) {
      for (const cluster of clusters) {
        if (cluster.isGeneric) continue;
        const clusterVol = getVolumeNumber(cluster.displayTitle);
        if (vol && clusterVol && vol !== clusterVol) continue;

        const sim = titleSimilarity(cluster.canonicalTitle, canonical);
        if (sim >= 0.60) {
          matchedCluster = cluster;
          indexMap.set(canonical, cluster); // memoize for subsequent tracks
          break;
        }
      }
    }

    if (matchedCluster) {
      matchedCluster.tracks.push(track);
      if (
        rawAlbum &&
        !isGenericAlbum(rawAlbum) &&
        rawAlbum.length < matchedCluster.displayTitle.length &&
        !/\b(?:19|20)\d{2}\b/.test(rawAlbum)
      ) {
        matchedCluster.displayTitle = rawAlbum;
      }
    } else {
      const clusterKey = isGenericTitle ? JSON.stringify([canonical, identity]) : canonical;
      const newCluster: Cluster = {
        key: clusterKey,
        canonicalTitle: canonical,
        isGeneric: isGenericTitle,
        identity,
        tracks: [track],
        displayTitle: rawAlbum && !isGenericAlbum(rawAlbum) ? rawAlbum : effectiveTitle,
      };
      clusters.push(newCluster);
      const cacheKey = isGenericTitle ? `${canonical}:::${identity}` : canonical;
      indexMap.set(cacheKey, newCluster);
    }
  }

  return clusters.map((cluster) => {
    const items = cluster.tracks;
    let groupArtist: string | undefined;
    let composer = '';
    let artwork: string | undefined;
    let maxAddedAt = 0;
    const fullArtistCounts = new Map<string, number>();
    const individualCounts = new Map<string, number>();

    for (const t of items) {
      if (!groupArtist && t.albumArtist?.trim()) groupArtist = t.albumArtist.trim();
      if (!composer && t.composer?.trim()) composer = t.composer.trim();
      if (!artwork && t.artworkUri) artwork = t.artworkUri;
      if (t.addedAt > maxAddedAt) maxAddedAt = t.addedAt;

      const full = t.artist?.trim();
      if (full && full !== 'Unknown Artist') {
        fullArtistCounts.set(full, (fullArtistCounts.get(full) || 0) + 1);

        // Split "Artist A, Artist B" or "Artist A feat. Artist B"
        const parts = full
          .split(/[,&/]|(?:\s+feat\.?|\s+ft\.?)\s+/i)
          .map((p) => p.trim())
          .filter(Boolean);
        for (const p of parts) {
          individualCounts.set(p, (individualCounts.get(p) || 0) + 1);
        }
      }
    }

    // Find most prominent individual artist
    let prominentArtist = '';
    let highestCount = 0;
    for (const [art, count] of individualCounts) {
      if (count > highestCount) {
        highestCount = count;
        prominentArtist = art;
      }
    }

    const distinctFullArtists = Array.from(fullArtistCounts.keys());
    const sorted = [...items].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));

    const rawDisplay = cluster.displayTitle.trim();
    const displayAlbum = rawDisplay && !isGenericAlbum(rawDisplay)
      ? rawDisplay
      : (extractFolder(items[0].uri) ? extractFolder(items[0].uri).replace(/[_-]+/g, ' ').toUpperCase() : 'Unknown Album');

    const displayArtist = groupArtist
      ? groupArtist
      : prominentArtist && highestCount >= Math.ceil(items.length / 2)
      ? prominentArtist
      : distinctFullArtists.length > 1
      ? 'Various Artists'
      : distinctFullArtists[0] || 'Unknown Artist';

    return {
      key: cluster.key,
      album: displayAlbum,
      artist: displayArtist,
      composer,
      tracks: sorted,
      artwork,
      addedAt: maxAddedAt,
    };
  });
}
