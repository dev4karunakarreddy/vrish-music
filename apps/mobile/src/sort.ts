import type { Track, SongSortMode, AlbumSortMode, ArtistSortMode, SortDirection } from '@noir/types';
import type { AlbumGroup } from './albums';
import type { ArtistGroup } from './artists';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

export function sortSongs(tracks: Track[], mode: SongSortMode, direction: SortDirection = 'asc'): Track[] {
  const sorted = [...tracks];
  sorted.sort((a, b) => {
    let diff = 0;
    switch (mode) {
      case 'title':
        diff = collator.compare(a.title, b.title);
        break;
      case 'artist':
        diff = collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title);
        break;
      case 'album':
        diff = collator.compare(a.album, b.album) || collator.compare(a.title, b.title);
        break;
      case 'duration':
        diff = a.durationMs - b.durationMs;
        break;
      case 'addedAt':
        diff = a.addedAt - b.addedAt;
        break;
    }
    return direction === 'asc' ? diff : -diff;
  });
  return sorted;
}

export function sortAlbums(albums: AlbumGroup[], mode: AlbumSortMode, direction: SortDirection = 'asc'): AlbumGroup[] {
  const sorted = [...albums];
  sorted.sort((a, b) => {
    let diff = 0;
    switch (mode) {
      case 'title':
        diff = collator.compare(a.album, b.album);
        break;
      case 'artist':
        diff = collator.compare(a.artist, b.artist) || collator.compare(a.album, b.album);
        break;
      case 'trackCount':
        diff = a.tracks.length - b.tracks.length;
        break;
      case 'addedAt':
        diff = a.addedAt - b.addedAt;
        break;
    }
    return direction === 'asc' ? diff : -diff;
  });
  return sorted;
}

export function sortArtists(artists: ArtistGroup[], mode: ArtistSortMode, direction: SortDirection = 'asc'): ArtistGroup[] {
  const sorted = [...artists];
  sorted.sort((a, b) => {
    let diff = 0;
    switch (mode) {
      case 'name':
        diff = collator.compare(a.name, b.name);
        break;
      case 'trackCount':
        diff = a.tracks.length - b.tracks.length;
        break;
    }
    return direction === 'asc' ? diff : -diff;
  });
  return sorted;
}
