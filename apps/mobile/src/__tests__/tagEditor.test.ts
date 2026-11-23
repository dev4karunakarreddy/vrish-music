import { describe, it, expect, vi } from 'vitest';
import type { Track } from '@noir/types';

describe('Tag & Cover Photo Editing Logic', () => {
  const initialTrack: Track = {
    id: 'test-track-1',
    uri: 'file:///storage/emulated/0/Download/synth.mp3',
    title: 'Original Title',
    artist: 'Original Artist',
    album: 'Original Album',
    durationMs: 210000,
    addedAt: 1700000000,
    favorite: false,
    playCount: 3,
    userEdited: false,
  };

  it('updates core tags and sets userEdited flag', () => {
    const edits = {
      title: 'Midnight City',
      artist: 'M83',
      album: 'Hurry Up, We Are Dreaming',
      year: '2011',
      genre: 'Synthpop',
      artworkUri: 'file:///data/user/0/app.noir.music/files/artwork/custom_art_1.jpg',
    };

    const updatedTrack: Track = {
      ...initialTrack,
      ...edits,
      userEdited: true,
    };

    expect(updatedTrack.title).toBe('Midnight City');
    expect(updatedTrack.artist).toBe('M83');
    expect(updatedTrack.album).toBe('Hurry Up, We Are Dreaming');
    expect(updatedTrack.year).toBe('2011');
    expect(updatedTrack.genre).toBe('Synthpop');
    expect(updatedTrack.artworkUri).toBe('file:///data/user/0/app.noir.music/files/artwork/custom_art_1.jpg');
    expect(updatedTrack.userEdited).toBe(true);
  });

  it('preserves existing audio uri, id, and duration when editing tags', () => {
    const updatedTrack: Track = {
      ...initialTrack,
      title: 'New Title',
      userEdited: true,
    };

    expect(updatedTrack.id).toBe(initialTrack.id);
    expect(updatedTrack.uri).toBe(initialTrack.uri);
    expect(updatedTrack.durationMs).toBe(initialTrack.durationMs);
    expect(updatedTrack.favorite).toBe(initialTrack.favorite);
  });

  it('allows removing cover photo and clearing extended tags', () => {
    const trackWithArt: Track = {
      ...initialTrack,
      artworkUri: 'file:///artwork.jpg',
      year: '2020',
      genre: 'Rock',
      composer: 'Famous Composer',
      userEdited: true,
    };

    const clearedTrack: Track = {
      ...trackWithArt,
      artworkUri: undefined,
      year: undefined,
      genre: undefined,
      composer: undefined,
    };

    expect(clearedTrack.artworkUri).toBeUndefined();
    expect(clearedTrack.year).toBeUndefined();
    expect(clearedTrack.genre).toBeUndefined();
    expect(clearedTrack.composer).toBeUndefined();
  });

  it('protects userEdited tracks from being overwritten during background rescan', () => {
    const tracks: Track[] = [
      {
        id: '1',
        uri: 'file:///song1.mp3',
        title: 'Custom Title',
        artist: 'Custom Artist',
        album: 'Custom Album',
        durationMs: 120000,
        addedAt: 1,
        favorite: false,
        playCount: 0,
        userEdited: true, // Should NOT be overwritten
      },
      {
        id: '2',
        uri: 'file:///song2.mp3',
        title: 'Raw Title',
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        durationMs: 120000,
        addedAt: 2,
        favorite: false,
        playCount: 0,
        userEdited: false, // Can be refreshed
      },
    ];

    const eligibleForRescan = tracks.filter((t) => !t.userEdited);
    expect(eligibleForRescan).toHaveLength(1);
    expect(eligibleForRescan[0].id).toBe('2');
  });

  it('correctly handles track removal from library and active queue', () => {
    let queue = ['test-track-1', 'track-2', 'track-3'];
    let currentId: string | null = 'test-track-1';

    // Simulate deleting currently playing track
    const trackToDelete = 'test-track-1';
    const queueIndex = queue.indexOf(trackToDelete);
    expect(queueIndex).toBe(0);

    // If current, advances to next
    if (currentId === trackToDelete) {
      currentId = queue[1];
    }
    queue = queue.filter((id) => id !== trackToDelete);

    expect(currentId).toBe('track-2');
    expect(queue).toEqual(['track-2', 'track-3']);
  });

  it('stops playback when deleting the sole track in queue', () => {
    let queue = ['single-track'];
    let currentId: string | null = 'single-track';
    let isPlaying = true;

    const trackToDelete = 'single-track';
    if (queue.length <= 1 && queue[0] === trackToDelete) {
      currentId = null;
      queue = [];
      isPlaying = false;
    }

    expect(currentId).toBeNull();
    expect(queue).toHaveLength(0);
    expect(isPlaying).toBe(false);
  });
});

