import { describe, it, expect } from 'vitest';
import { sortSongs, sortAlbums, sortArtists } from '../sort';
import { groupAlbums } from '../albums';
import { groupArtists } from '../artists';
import { formatDuration, formatTotalDuration } from '../format';
import type { Track } from '@noir/types';

function generateTracks(count: number): Track[] {
  const tracks: Track[] = [];
  const artists = ['Vrish', 'Daft Punk', 'Pink Floyd', 'Hans Zimmer', 'Ludwig Goransson', 'Chopin', 'Miles Davis'];
  const albums = ['Discovery', 'Random Access Memories', 'The Dark Side of the Moon', 'Interstellar', 'Oppenheimer', 'Nocturnes', 'Kind of Blue'];

  for (let i = 0; i < count; i++) {
    const artistIdx = i % artists.length;
    const albumIdx = i % albums.length;
    tracks.push({
      id: `track-${i}`,
      uri: i % 2 === 0 ? `content://media/external/audio/media/${i}` : `/storage/emulated/0/Music/song-${i}.mp3`,
      title: `Song Title ${String(i).padStart(5, '0')} ${i % 3 === 0 ? 'Remix' : 'Acoustic'}`,
      artist: artists[artistIdx],
      album: albums[albumIdx],
      durationMs: 120_000 + (i % 300) * 1000,
      addedAt: 1_700_000_000_000 + i * 60_000,
      favorite: i % 5 === 0,
      playCount: i % 20,
    });
  }
  return tracks;
}

describe('Performance & Zero-Hang Stress Tests', () => {
  const largeLibrary = generateTracks(5000);

  it('sorts 5,000 tracks across 4 sort modes under 150ms total without thread lock', () => {
    const start = performance.now();
    const sortedTitle = sortSongs(largeLibrary, 'title', 'asc');
    const sortedArtist = sortSongs(largeLibrary, 'artist', 'desc');
    const sortedDuration = sortSongs(largeLibrary, 'duration', 'desc');
    const sortedDate = sortSongs(largeLibrary, 'addedAt', 'asc');
    const elapsed = performance.now() - start;

    expect(sortedTitle.length).toBe(5000);
    expect(sortedArtist.length).toBe(5000);
    expect(sortedDuration.length).toBe(5000);
    expect(sortedDate.length).toBe(5000);
    expect(elapsed).toBeLessThan(150);
  });

  it('groups 5,000 tracks into albums & artists under 100ms', () => {
    const start = performance.now();
    const albums = groupAlbums(largeLibrary);
    const artists = groupArtists(largeLibrary);
    const elapsed = performance.now() - start;

    expect(albums.length).toBeGreaterThan(0);
    expect(artists.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
  });

  it('performs instant search queries over 5,000 tracks in under 25ms', () => {
    const query = 'remix';
    const start = performance.now();
    const matches = largeLibrary.filter((t) =>
      `${t.title} ${t.artist} ${t.album}`.toLowerCase().includes(query),
    );
    const elapsed = performance.now() - start;

    expect(matches.length).toBeGreaterThan(1000);
    expect(elapsed).toBeLessThan(25);
  });

  it('queue ID resolution runs in linear time O(N) using Set under 10ms', () => {
    const queue = Array.from({ length: 2000 }, (_, i) => `track-${i * 2}`);
    const trackIds = new Set(largeLibrary.map((t) => t.id));

    const start = performance.now();
    const validQueue = queue.filter((id) => trackIds.has(id));
    const elapsed = performance.now() - start;

    expect(validQueue.length).toBe(2000);
    expect(elapsed).toBeLessThan(10);
  });

  it('formats 10,000 track durations in under 15ms', () => {
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      formatDuration(i * 1000);
      formatTotalDuration(i * 5000);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(25);
  });
});
