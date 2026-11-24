import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {},
  Platform: { OS: 'android' },
}));

import {
  __resetStoreForTesting,
  getTracks,
  getTrackById,
  findTrackByUri,
  saveTrack,
  updateTrack,
  setFavorite,
  incrementPlayCount,
  saveSession,
  getSession,
  findTrackByFingerprint,
  saveTrackFingerprint,
  getTrackFingerprint,
  findTrackBySource,
  saveTrackSource,
  tracksWithoutFingerprint,
  getSetting,
  setSetting,
  deleteTrack,
  getPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  getPlaylistTracks,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
} from '../db';
import type { Track } from '@noir/types';

describe('In-Memory Fast Store (No SQLite)', () => {
  beforeEach(() => {
    __resetStoreForTesting();
  });

  const sampleTrack: Track = {
    id: 't-1',
    uri: 'file:///music/song1.mp3',
    title: 'Starboy',
    artist: 'The Weeknd',
    album: 'Starboy',
    durationMs: 230000,
    addedAt: 1000,
    favorite: false,
    playCount: 0,
  };

  it('saves and retrieves tracks with O(1) lookups', () => {
    saveTrack(sampleTrack);

    expect(getTracks()).toHaveLength(1);
    expect(getTrackById('t-1')).toEqual(sampleTrack);
    expect(findTrackByUri('file:///music/song1.mp3')).toEqual(sampleTrack);
    expect(findTrackByUri('non-existent')).toBeNull();
  });

  it('orders tracks by addedAt descending', () => {
    saveTrack({ ...sampleTrack, id: 't-1', addedAt: 1000 });
    saveTrack({ ...sampleTrack, id: 't-2', addedAt: 3000, uri: 'file:///music/song2.mp3' });
    saveTrack({ ...sampleTrack, id: 't-3', addedAt: 2000, uri: 'file:///music/song3.mp3' });

    const tracks = getTracks();
    expect(tracks.map((t) => t.id)).toEqual(['t-2', 't-3', 't-1']);
  });

  it('updates track tags and marks userEdited', () => {
    saveTrack(sampleTrack);

    const updated = updateTrack('t-1', {
      title: 'Starboy (Remix)',
      artist: 'The Weeknd & Daft Punk',
      year: '2016',
      genre: 'R&B',
    });

    expect(updated).not.toBeNull();
    expect(updated?.title).toBe('Starboy (Remix)');
    expect(updated?.userEdited).toBe(true);

    const retrieved = getTrackById('t-1');
    expect(retrieved?.title).toBe('Starboy (Remix)');
    expect(retrieved?.year).toBe('2016');
  });

  it('toggles favorite and increments play count without delays', () => {
    saveTrack(sampleTrack);

    setFavorite('t-1', true);
    expect(getTrackById('t-1')?.favorite).toBe(true);

    incrementPlayCount('t-1');
    incrementPlayCount('t-1');
    expect(getTrackById('t-1')?.playCount).toBe(2);
  });

  it('saves and restores playback session data', () => {
    expect(getSession()).toBeNull();

    saveSession('t-1', 45000, ['t-1', 't-2'], true, 'all');

    const session = getSession();
    expect(session).toEqual({
      trackId: 't-1',
      positionMs: 45000,
      queue: ['t-1', 't-2'],
      shuffle: true,
      repeat: 'all',
    });
  });

  it('manages playlists and maintains exact track positions', () => {
    saveTrack(sampleTrack);
    saveTrack({ ...sampleTrack, id: 't-2', uri: 'file:///music/song2.mp3', title: 'Song 2' });
    saveTrack({ ...sampleTrack, id: 't-3', uri: 'file:///music/song3.mp3', title: 'Song 3' });

    const pl = createPlaylist('Chill Vibes');
    expect(pl.name).toBe('Chill Vibes');
    expect(getPlaylists()).toHaveLength(1);

    addTrackToPlaylist(pl.id, 't-1');
    addTrackToPlaylist(pl.id, 't-2');
    addTrackToPlaylist(pl.id, 't-3');

    let plTracks = getPlaylistTracks(pl.id);
    expect(plTracks.map((t) => t.id)).toEqual(['t-1', 't-2', 't-3']);

    // Remove middle track
    removeTrackFromPlaylist(pl.id, 't-2', 1);
    plTracks = getPlaylistTracks(pl.id);
    expect(plTracks.map((t) => t.id)).toEqual(['t-1', 't-3']);

    // Rename
    renamePlaylist(pl.id, 'Super Chill');
    expect(getPlaylists()[0].name).toBe('Super Chill');

    // Delete playlist
    deletePlaylist(pl.id);
    expect(getPlaylists()).toHaveLength(0);
  });

  it('deletes track and purges from playlists, fingerprints, and indexes', () => {
    saveTrack(sampleTrack);
    saveTrackFingerprint('t-1', 'sha256-hash-1');
    saveTrackSource('t-1', 'content://media/1');

    const pl = createPlaylist('Favorites');
    addTrackToPlaylist(pl.id, 't-1');

    expect(findTrackByFingerprint('sha256-hash-1')).toBe('t-1');
    expect(findTrackBySource('content://media/1')).toBe('t-1');
    expect(getPlaylistTracks(pl.id)).toHaveLength(1);

    // Delete track
    deleteTrack('t-1');

    expect(getTrackById('t-1')).toBeNull();
    expect(findTrackByUri(sampleTrack.uri)).toBeNull();
    expect(findTrackByFingerprint('sha256-hash-1')).toBeNull();
    expect(findTrackBySource('content://media/1')).toBeNull();
    expect(getPlaylistTracks(pl.id)).toHaveLength(0);
  });

  it('manages settings and fingerprints correctly', () => {
    setSetting('theme', 'obsidian');
    expect(getSetting('theme')).toBe('obsidian');

    saveTrack(sampleTrack);
    expect(tracksWithoutFingerprint()).toHaveLength(1);

    saveTrackFingerprint('t-1', 'hash-123');
    expect(getTrackFingerprint('t-1')).toBe('hash-123');
    expect(tracksWithoutFingerprint()).toHaveLength(0);
  });
});
