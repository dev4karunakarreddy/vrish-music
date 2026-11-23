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
});
