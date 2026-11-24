import { describe, it, expect } from 'vitest';
import { sortSongs, sortAlbums, sortArtists } from '../sort';
import { groupArtists } from '../artists';
import { groupAlbums } from '../albums';
import { formatDuration, formatTotalDuration } from '../format';
import type { Track } from '@noir/types';

const mockTracks: Track[] = [
  {
    id: '1',
    uri: 'file:///path/song1.mp3',
    title: 'Bravo',
    artist: 'Artist B',
    album: 'Album 2',
    durationMs: 180000,
    addedAt: 1000,
    favorite: false,
    playCount: 1,
  },
  {
    id: '2',
    uri: 'file:///path/song2.mp3',
    title: 'Alpha',
    artist: 'Artist A',
    album: 'Album 1',
    durationMs: 120000,
    addedAt: 2000,
    favorite: true,
    playCount: 5,
  },
  {
    id: '3',
    uri: 'file:///path/song3.mp3',
    title: 'Charlie',
    artist: 'Artist A',
    album: 'Album 1',
    durationMs: 240000,
    addedAt: 1500,
    favorite: false,
    playCount: 2,
  },
];

describe('Duration formatting', () => {
  it('formats track duration mm:ss', () => {
    expect(formatDuration(0)).toBe('--:--');
    expect(formatDuration(65000)).toBe('1:05');
    expect(formatDuration(180000)).toBe('3:00');
  });

  it('formats total duration', () => {
    expect(formatTotalDuration(0)).toBe('0 min');
    expect(formatTotalDuration(180000)).toBe('3 min');
    expect(formatTotalDuration(3660000)).toBe('1 hr 1 min');
  });
});

describe('Sorting logic', () => {
  it('sorts tracks by title ascending and descending', () => {
    const asc = sortSongs(mockTracks, 'title', 'asc');
    expect(asc.map((t) => t.title)).toEqual(['Alpha', 'Bravo', 'Charlie']);

    const desc = sortSongs(mockTracks, 'title', 'desc');
    expect(desc.map((t) => t.title)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('sorts tracks by duration', () => {
    const asc = sortSongs(mockTracks, 'duration', 'asc');
    expect(asc.map((t) => t.durationMs)).toEqual([120000, 180000, 240000]);

    const desc = sortSongs(mockTracks, 'duration', 'desc');
    expect(desc.map((t) => t.durationMs)).toEqual([240000, 180000, 120000]);
  });

  it('sorts tracks by date added', () => {
    const asc = sortSongs(mockTracks, 'addedAt', 'asc');
    expect(asc.map((t) => t.addedAt)).toEqual([1000, 1500, 2000]);

    const desc = sortSongs(mockTracks, 'addedAt', 'desc');
    expect(desc.map((t) => t.addedAt)).toEqual([2000, 1500, 1000]);
  });
});

describe('Grouping logic', () => {
  it('groups albums and artists correctly', () => {
    const albums = groupAlbums(mockTracks);
    expect(albums.length).toBeGreaterThanOrEqual(2);

    const artists = groupArtists(mockTracks);
    expect(artists.length).toBe(2);
    const artistA = artists.find((a) => a.name === 'Artist A');
    expect(artistA).toBeDefined();
    expect(artistA?.tracks.length).toBe(2);
  });

  it('keeps tracks in different albums even when track titles are identical', () => {
    const tracksWithSameTitle: Track[] = [
      {
        id: 'track-album-1',
        uri: 'file:///Music/Album_A/Intro.mp3',
        title: 'Intro',
        artist: 'Daft Punk',
        album: 'Homework',
        durationMs: 120000,
        addedAt: 1000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'track-album-2',
        uri: 'file:///Music/Album_B/Intro.mp3',
        title: 'Intro',
        artist: 'Daft Punk',
        album: 'Discovery',
        durationMs: 140000,
        addedAt: 2000,
        favorite: false,
        playCount: 0,
      },
    ];

    const albums = groupAlbums(tracksWithSameTitle);
    expect(albums.length).toBe(2);

    const homework = albums.find((a) => a.album === 'Homework');
    const discovery = albums.find((a) => a.album === 'Discovery');

    expect(homework).toBeDefined();
    expect(discovery).toBeDefined();

    expect(homework?.tracks).toHaveLength(1);
    expect(homework?.tracks[0].id).toBe('track-album-1');
    expect(homework?.tracks[0].title).toBe('Intro');

    expect(discovery?.tracks).toHaveLength(1);
    expect(discovery?.tracks[0].id).toBe('track-album-2');
    expect(discovery?.tracks[0].title).toBe('Intro');
  });

  it('keeps multi-part and numbered albums separate and does not merge them', () => {
    const multiPartTracks: Track[] = [
      {
        id: 'vol-1-track',
        uri: 'file:///Music/vol1/song1.mp3',
        title: 'Track 1',
        artist: 'Artist',
        album: 'Volume 1',
        durationMs: 180000,
        addedAt: 1000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'vol-2-track',
        uri: 'file:///Music/vol2/song1.mp3',
        title: 'Track 1',
        artist: 'Artist',
        album: 'Volume 2',
        durationMs: 190000,
        addedAt: 2000,
        favorite: false,
        playCount: 0,
      },
    ];

    const albums = groupAlbums(multiPartTracks);
    expect(albums.length).toBe(2);
    expect(albums.map((a) => a.album).sort()).toEqual(['Volume 1', 'Volume 2']);
  });

  it('merges album tracks with 60-70% similarity and bracketed years', () => {
    const tracksWithYearVariants: Track[] = [
      {
        id: 't-1',
        uri: 'file:///music/song1.mp3',
        title: 'Ninnu Kori',
        artist: 'Gopi Sundar',
        album: 'Ninnu Kori (2017)',
        durationMs: 200000,
        addedAt: 1000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 't-2',
        uri: 'file:///music/song2.mp3',
        title: 'Unnatundi Gundey',
        artist: 'Karthik, Chinmayi Sripaada',
        album: 'Ninnu Kori',
        durationMs: 220000,
        addedAt: 2000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 't-3',
        uri: 'file:///music/song3.mp3',
        title: 'Endaro',
        artist: 'Runeka Arun',
        album: 'Bale Bale Magadivoy',
        durationMs: 210000,
        addedAt: 3000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 't-4',
        uri: 'file:///music/song4.mp3',
        title: 'Motta Modatisari',
        artist: 'Sachin Warrier',
        album: 'Bale Bale Magadivoy (2015)',
        durationMs: 230000,
        addedAt: 4000,
        favorite: false,
        playCount: 0,
      },
    ];

    const albums = groupAlbums(tracksWithYearVariants);
    expect(albums.length).toBe(2);

    const ninnuKori = albums.find((a) => a.album.toLowerCase().includes('ninnu kori'));
    const baleBale = albums.find((a) => a.album.toLowerCase().includes('bale bale'));

    expect(ninnuKori).toBeDefined();
    expect(ninnuKori?.tracks).toHaveLength(2);
    expect(ninnuKori?.tracks.map((t) => t.id).sort()).toEqual(['t-1', 't-2']);

    expect(baleBale).toBeDefined();
    expect(baleBale?.tracks).toHaveLength(2);
    expect(baleBale?.tracks.map((t) => t.id).sort()).toEqual(['t-3', 't-4']);
  });

  it('merges soundtrack songs with different singers into the single shared album', () => {
    const soundtrackTracks: Track[] = [
      {
        id: 'hr-1',
        uri: 'file:///music/darshana.mp3',
        title: 'Darshana',
        artist: 'Hesham Abdul Wahab, Darshana Rajendran',
        album: 'Hridayam',
        durationMs: 210000,
        addedAt: 1000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'hr-2',
        uri: 'file:///music/manasse.mp3',
        title: 'Manasse Manasse',
        artist: 'Vineeth Sreenivasan',
        album: 'Hridayam',
        durationMs: 220000,
        addedAt: 2000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'hr-3',
        uri: 'file:///music/puthiyoru.mp3',
        title: 'Puthiyoru Lokam',
        artist: 'Hesham Abdul Wahab, Vimal Roy',
        album: 'Hridayam',
        durationMs: 230000,
        addedAt: 3000,
        favorite: false,
        playCount: 0,
      },
    ];

    const albums = groupAlbums(soundtrackTracks);
    expect(albums.length).toBe(1);
    expect(albums[0].album).toBe('Hridayam');
    expect(albums[0].tracks).toHaveLength(3);
    expect(albums[0].artist).toBe('Hesham Abdul Wahab');
  });

  it('correctly merges Hrudayam Murali and DC albums from user library', () => {
    const userTracks: Track[] = [
      {
        id: 'hm-1',
        uri: 'file:///music/hrudayame.mp3',
        title: 'Hrudayame',
        artist: 'Manojna',
        album: 'Hrudayam Murali',
        durationMs: 200000,
        addedAt: 1000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'hm-2',
        uri: 'file:///music/raamma.mp3',
        title: 'Raamma Raamma',
        artist: 'D Dheeraj',
        album: 'Hrudayam Murali',
        durationMs: 210000,
        addedAt: 2000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'hm-3',
        uri: 'file:///music/kalalenno.mp3',
        title: 'Kalalenno',
        artist: 'Tushar Sambhara',
        album: 'Hrudayam Murali',
        durationMs: 195000,
        addedAt: 3000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'hm-4',
        uri: 'file:///music/manasa.mp3',
        title: 'Manasa',
        artist: 'Madduri Hemant',
        album: 'Hrudayam Murali',
        durationMs: 180000,
        addedAt: 4000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'dc-1',
        uri: 'file:///music/raga.mp3',
        title: 'Raga of Revenge :: SenSongsMp3.Com',
        artist: 'Anirudh Ravichander',
        album: 'DC (2026)',
        albumArtist: 'Lokesh Kankaraj',
        durationMs: 240000,
        addedAt: 5000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'dc-2',
        uri: 'file:///music/namaste.mp3',
        title: 'Namaste :: SenSongsMp3.Com',
        artist: 'Anirudh Ravichander',
        album: 'DC (2026)',
        albumArtist: 'Lokesh Kanakaraj',
        durationMs: 250000,
        addedAt: 6000,
        favorite: false,
        playCount: 0,
      },
      {
        id: 'dc-3',
        uri: 'file:///music/hangova.mp3',
        title: 'Hangova :: SenSongsMp3.Com',
        artist: 'Anirudh Ravichander',
        album: 'DC',
        albumArtist: 'Lokesh Kanakaraj',
        durationMs: 220000,
        addedAt: 7000,
        favorite: false,
        playCount: 0,
      },
    ];

    const albums = groupAlbums(userTracks);
    expect(albums.length).toBe(2);

    const hrudayam = albums.find((a) => a.album.includes('Hrudayam Murali'));
    expect(hrudayam).toBeDefined();
    expect(hrudayam?.tracks).toHaveLength(4);

    const dc = albums.find((a) => a.album.includes('DC'));
    expect(dc).toBeDefined();
    expect(dc?.tracks).toHaveLength(3);
  });
});
