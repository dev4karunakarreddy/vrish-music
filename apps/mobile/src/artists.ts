import type { Track } from '@noir/types';
import { groupAlbums, type AlbumGroup } from './albums';

export interface ArtistGroup {
  name: string;
  tracks: Track[];
  albums: AlbumGroup[];
}

const artistCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function groupArtists(tracks: Track[]): ArtistGroup[] {
  const artistMap = new Map<string, Track[]>();

  for (const track of tracks) {
    const artist = (track.albumArtist?.trim() || track.artist?.trim() || 'Unknown Artist');
    const existing = artistMap.get(artist);
    if (existing) {
      existing.push(track);
    } else {
      artistMap.set(artist, [track]);
    }
  }

  const allAlbums = groupAlbums(tracks);
  const albumsByArtist = new Map<string, AlbumGroup[]>();

  for (const album of allAlbums) {
    const mainArtist = album.artist.toLowerCase();
    const existing = albumsByArtist.get(mainArtist) ?? [];
    existing.push(album);
    albumsByArtist.set(mainArtist, existing);

    for (const t of album.tracks) {
      const trackArtist = t.artist.trim().toLowerCase();
      if (trackArtist !== mainArtist) {
        const list = albumsByArtist.get(trackArtist) ?? [];
        if (!list.includes(album)) {
          list.push(album);
          albumsByArtist.set(trackArtist, list);
        }
      }
    }
  }

  return Array.from(artistMap.entries()).map(([name, artistTracks]) => {
    const albums = albumsByArtist.get(name.toLowerCase()) ?? [];
    const sortedTracks = [...artistTracks].sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
    return {
      name,
      tracks: sortedTracks,
      albums,
    };
  });
}
