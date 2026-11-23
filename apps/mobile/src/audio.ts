import { createAudioPlaylist, setAudioModeAsync } from 'expo-audio';
import Constants from 'expo-constants';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Track, RepeatMode } from '@noir/types';
import { incrementPlayCount, saveSession } from './db';
import { useMusic } from './store';

import { checkFileExists } from './fileCheck';

let playlist: ReturnType<typeof createAudioPlaylist> | null = null;
let subscription: { remove: () => void } | null = null;
let activeQueue: Track[] = [];
let lastIndex = -1;
let lastSavedSecond = -1;
let playRequest = 0;
let lastPlayTap: { id: string; time: number } | null = null;
let lastToggleTime = 0;
let pendingPlayId: string | null = null;
let audioModeReady: Promise<void> | null = null;

const hasNativeMediaService = Constants.executionEnvironment === 'standalone' || Constants.executionEnvironment === 'bare';

const metadata = (track: Track) => ({
  title: track.title,
  artist: track.artist,
  albumTitle: track.album,
  artworkUrl: track.artworkUri,
});

const source = (track: Track) => {
  if (Platform.OS === 'android') {
    if (track.uri.startsWith('content://')) {
      return { uri: track.uri };
    }
    try {
      return { uri: new File(track.uri).contentUri };
    } catch {
      return { uri: track.uri };
    }
  }
  return { uri: track.uri };
};

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function releasePlaylist() {
  subscription?.remove();
  subscription = null;
  if (playlist) {
    // Expo Audio's destroy removes the native playlist from its registry, but
    // its player can keep running until the shared object is released later.
    playlist.pause();
    playlist.clear();
    playlist.destroy();
  }
  playlist = null;
  activeQueue = [];
  lastIndex = -1;
  lastSavedSecond = -1;
}

function persistCurrentSession(positionMs?: number) {
  const s = useMusic.getState();
  if (!s.currentId) return;
  saveSession(
    s.currentId,
    positionMs ?? s.positionMs,
    s.queue,
    s.shuffle,
    s.repeat,
  );
}

function onStatus(status: { currentIndex: number; currentTime: number; duration: number; playing: boolean }) {
  const track = activeQueue[status.currentIndex];
  if (!track) return;

  if (lastIndex !== status.currentIndex) {
    lastIndex = status.currentIndex;
    useMusic.getState().setCurrent(track.id);
    if (hasNativeMediaService) playlist?.updateLockScreenMetadata(metadata(track));
    persistCurrentSession(0);
    // Keep SQLite reads and writes off the track-selection call stack.
    setTimeout(() => {
      incrementPlayCount(track.id);
      useMusic.getState().refresh();
    }, 0);
  }

  const positionMs = Math.round(status.currentTime * 1000);
  const durationMs = Math.round(status.duration * 1000) || track.durationMs;
  useMusic.getState().setProgress(positionMs, durationMs);
  useMusic.getState().setPlaying(status.playing);

  const second = Math.floor(positionMs / 1000);
  if (second !== lastSavedSecond && second % 5 === 0) {
    lastSavedSecond = second;
    persistCurrentSession(positionMs);
  }
}

function buildPlaylist(tracks: Track[], startIndex: number, resumePositionMs = 0) {
  releasePlaylist();
  activeQueue = tracks;
  useMusic.getState().setQueue(tracks.map((t) => t.id));

  const repeatMode = useMusic.getState().repeat;
  const loopMode = repeatMode === 'off' ? 'none' : repeatMode === 'one' ? 'single' : 'all';

  playlist = createAudioPlaylist({
    sources: tracks.map(source),
    updateInterval: 500,
    loop: loopMode,
  });

  const currentPlaylist = playlist;
  subscription = playlist.addListener('playlistStatusUpdate', (status) => {
    if (playlist === currentPlaylist) onStatus(status);
  });

  const currentTrack = tracks[startIndex];
  if (hasNativeMediaService && currentTrack) {
    playlist.setActiveForLockScreen(true, metadata(currentTrack), {
      showNextTrack: true,
      showPreviousTrack: true,
    });
  }

  playlist.skipTo(startIndex);
  if (currentTrack) {
    onStatus({
      currentIndex: startIndex,
      currentTime: resumePositionMs / 1000,
      duration: (currentTrack.durationMs || 0) / 1000,
      playing: true,
    });
  }

  if (resumePositionMs > 0) {
    void playlist.seekTo(resumePositionMs / 1000);
  }

  playlist.play();
  persistCurrentSession(resumePositionMs);
}

export async function playTrack(track: Track, contextQueue?: Track[]): Promise<void> {
  const now = Date.now();
  if (pendingPlayId === track.id || (lastPlayTap?.id === track.id && now - lastPlayTap.time < 600)) return;
  lastPlayTap = { id: track.id, time: now };
  const request = ++playRequest;
  pendingPlayId = track.id;
  try {
    if (!checkFileExists(track.uri)) {
      throw new Error(`${track.title} is missing. Import the file again.`);
    }

    // Most track taps keep the same queue. Seek within the native playlist so
    // playback does not wait for file scans or a new ExoPlayer instance.
    if (playlist && contextQueue && !useMusic.getState().shuffle &&
        contextQueue.length === activeQueue.length &&
        contextQueue.every((item, index) => item.id === activeQueue[index].id && item.uri === activeQueue[index].uri)) {
      const index = activeQueue.findIndex((item) => item.id === track.id);
      if (index >= 0) {
        playlist.skipTo(index);
        playlist.play();
        onStatus({ currentIndex: index, currentTime: 0, duration: track.durationMs / 1000, playing: true });
        return;
      }
    }

    if (!audioModeReady) {
      audioModeReady = setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: hasNativeMediaService,
        interruptionMode: 'doNotMix',
      }).catch((error) => {
        audioModeReady = null;
        throw error;
      });
    }
    await audioModeReady;
    if (request !== playRequest) return;

    const allTracks = useMusic.getState().tracks;
    let queueTracks = contextQueue ? contextQueue.filter((t) => checkFileExists(t.uri)) : allTracks.filter((t) => checkFileExists(t.uri));
    if (queueTracks.length === 0 || !queueTracks.some((t) => t.id === track.id)) {
      queueTracks = allTracks.filter((t) => checkFileExists(t.uri));
    }

    const isShuffle = useMusic.getState().shuffle;
    let finalQueue = [...queueTracks];
    let targetIndex = finalQueue.findIndex((t) => t.id === track.id);
    if (targetIndex < 0) targetIndex = 0;

    if (isShuffle) {
      // Put current track at start, shuffle the rest
      const remaining = finalQueue.filter((t) => t.id !== track.id);
      finalQueue = [track, ...shuffleArray(remaining)];
      targetIndex = 0;
    }

    useMusic.getState().setQueue(finalQueue.map((t) => t.id), queueTracks.map((t) => t.id));

    const resumePosition = !playlist && useMusic.getState().currentId === track.id ? useMusic.getState().positionMs : 0;
    buildPlaylist(finalQueue, targetIndex, resumePosition);
  } catch (e) {
    if (request === playRequest) useMusic.getState().setError(e instanceof Error ? e.message : String(e));
  } finally {
    if (request === playRequest) pendingPlayId = null;
  }
}

export function togglePlayback(): void {
  const now = Date.now();
  if (now - lastToggleTime < 250) return;
  lastToggleTime = now;
  if (!playlist) {
    const s = useMusic.getState();
    const track = s.tracks.find((t) => t.id === s.currentId);
    if (track) {
      const queueTracks = s.queue.map((id) => s.tracks.find((t) => t.id === id)).filter((t): t is Track => !!t);
      void playTrack(track, queueTracks.length > 0 ? queueTracks : undefined);
    }
    return;
  }
  if (useMusic.getState().playing) {
    playlist.pause();
    useMusic.getState().setPlaying(false);
  } else {
    playlist.play();
    useMusic.getState().setPlaying(true);
  }
}

export async function seekTo(positionMs: number): Promise<void> {
  if (playlist) {
    await playlist.seekTo(positionMs / 1000);
  }
  useMusic.getState().setProgress(positionMs, useMusic.getState().durationMs);
  persistCurrentSession(positionMs);
}

export async function skip(direction: 1 | -1): Promise<void> {
  if (!playlist) return;

  const currentPos = useMusic.getState().positionMs;
  // Auxio standard: previous rewinds to beginning if playing > 3 seconds
  if (direction === -1 && currentPos > 3000) {
    await playlist.seekTo(0);
    useMusic.getState().setProgress(0, useMusic.getState().durationMs);
    persistCurrentSession(0);
    return;
  }

  const s = useMusic.getState();
  const currentIndex = activeQueue.findIndex((t) => t.id === s.currentId);

  if (direction === 1) {
    if (currentIndex >= activeQueue.length - 1) {
      if (s.repeat === 'all') {
        playlist.skipTo(0);
      } else {
        // Queue ended
        playlist.pause();
        useMusic.getState().setPlaying(false);
      }
    } else {
      playlist.next();
    }
  } else {
    if (currentIndex <= 0) {
      if (s.repeat === 'all') {
        playlist.skipTo(activeQueue.length - 1);
      } else {
        await playlist.seekTo(0);
      }
    } else {
      playlist.previous();
    }
  }
}

export function setRepeat(mode: RepeatMode): void {
  useMusic.getState().setRepeat(mode);
  if (playlist) {
    playlist.loop = mode === 'off' ? 'none' : mode === 'one' ? 'single' : 'all';
  }
  persistCurrentSession();
}

export function toggleShuffle(): void {
  const s = useMusic.getState();
  const nextShuffle = !s.shuffle;
  useMusic.getState().setShuffle(nextShuffle);

  if (activeQueue.length <= 1) {
    persistCurrentSession();
    return;
  }

  const currentTrack = activeQueue.find((t) => t.id === s.currentId) ?? activeQueue[0];
  const currentPos = s.positionMs;

  let newQueue: Track[] = [];
  if (nextShuffle) {
    // Turning shuffle ON: keep current song at front, shuffle remainder
    const others = activeQueue.filter((t) => t.id !== currentTrack.id);
    newQueue = [currentTrack, ...shuffleArray(others)];
  } else {
    // Turning shuffle OFF: restore original queue
    const original = s.originalQueue
      .map((id) => s.tracks.find((t) => t.id === id))
      .filter((t): t is Track => !!t && checkFileExists(t.uri));
    newQueue = original.length > 0 ? original : activeQueue;
  }

  const newTarget = newQueue.findIndex((t) => t.id === currentTrack.id);
  buildPlaylist(newQueue, Math.max(0, newTarget), currentPos);
  useMusic.getState().showToast(nextShuffle ? 'Shuffle is ON' : 'Shuffle is OFF');
}

export function playNext(tracksInput: Track | Track[]): void {
  const tracksToAdd = (Array.isArray(tracksInput) ? tracksInput : [tracksInput]).filter((t) => checkFileExists(t.uri));
  if (tracksToAdd.length === 0) return;

  const s = useMusic.getState();
  if (!playlist || !s.currentId || activeQueue.length === 0) {
    void playTrack(tracksToAdd[0], tracksToAdd);
    useMusic.getState().showToast('Playing next');
    return;
  }

  const currentIndex = activeQueue.findIndex((t) => t.id === s.currentId);
  const insertIndex = currentIndex >= 0 ? currentIndex + 1 : activeQueue.length;

  for (let i = 0; i < tracksToAdd.length; i++) {
    const t = tracksToAdd[i];
    try {
      playlist.insert(source(t), insertIndex + i);
    } catch {
      // Rebuild if insert is unsupported or throws
      activeQueue.splice(insertIndex + i, 0, t);
    }
  }

  activeQueue.splice(insertIndex, 0, ...tracksToAdd);
  const updatedIds = activeQueue.map((t) => t.id);
  useMusic.getState().setQueue(updatedIds);
  persistCurrentSession();
  useMusic.getState().showToast(tracksToAdd.length === 1 ? `"${tracksToAdd[0].title}" will play next` : `${tracksToAdd.length} tracks will play next`);
}

export function addToQueue(tracksInput: Track | Track[]): void {
  const tracksToAdd = (Array.isArray(tracksInput) ? tracksInput : [tracksInput]).filter((t) => checkFileExists(t.uri));
  if (tracksToAdd.length === 0) return;

  const s = useMusic.getState();
  if (!playlist || !s.currentId || activeQueue.length === 0) {
    void playTrack(tracksToAdd[0], tracksToAdd);
    useMusic.getState().showToast('Added to queue');
    return;
  }

  for (const t of tracksToAdd) {
    try {
      playlist.add(source(t));
    } catch {
      // Handled
    }
    activeQueue.push(t);
  }

  const updatedIds = activeQueue.map((t) => t.id);
  useMusic.getState().setQueue(updatedIds);
  persistCurrentSession();
  useMusic.getState().showToast(tracksToAdd.length === 1 ? `Added "${tracksToAdd[0].title}" to queue` : `Added ${tracksToAdd.length} tracks to queue`);
}

export function removeFromQueue(index: number): void {
  if (index < 0 || index >= activeQueue.length) return;
  const s = useMusic.getState();
  const trackToRemove = activeQueue[index];
  const isCurrent = trackToRemove.id === s.currentId;

  if (activeQueue.length === 1) {
    releasePlaylist();
    useMusic.getState().setCurrent(null);
    useMusic.getState().setQueue([]);
    useMusic.getState().setPlaying(false);
    return;
  }

  if (isCurrent) {
    void skip(1);
  }

  try {
    playlist?.remove(index);
  } catch {
    // Handled
  }

  activeQueue.splice(index, 1);
  useMusic.getState().setQueue(activeQueue.map((t) => t.id));
  persistCurrentSession();
  useMusic.getState().showToast(`Removed from queue`);
}

export function reorderQueue(fromIndex: number, toIndex: number): void {
  if (fromIndex < 0 || fromIndex >= activeQueue.length || toIndex < 0 || toIndex >= activeQueue.length || fromIndex === toIndex) return;

  const s = useMusic.getState();
  const currentPos = s.positionMs;
  const currentTrackId = s.currentId;

  const item = activeQueue.splice(fromIndex, 1)[0];
  activeQueue.splice(toIndex, 0, item);

  const newTarget = activeQueue.findIndex((t) => t.id === currentTrackId);
  buildPlaylist(activeQueue, Math.max(0, newTarget), currentPos);
  persistCurrentSession();
}

export function clearUpcomingQueue(): void {
  const s = useMusic.getState();
  if (!s.currentId || activeQueue.length <= 1) return;

  const currentIndex = activeQueue.findIndex((t) => t.id === s.currentId);
  if (currentIndex < 0) return;

  activeQueue = activeQueue.slice(0, currentIndex + 1);
  const currentPos = s.positionMs;
  buildPlaylist(activeQueue, currentIndex, currentPos);
  useMusic.getState().showToast('Upcoming queue cleared');
}

export function stopPlayback(): void {
  releasePlaylist();
  useMusic.getState().setCurrent(null);
  useMusic.getState().setQueue([]);
  useMusic.getState().setPlaying(false);
  useMusic.getState().setProgress(0, 0);
}

export function handleTrackDeleted(trackId: string): void {
  const s = useMusic.getState();
  const queueIndex = activeQueue.findIndex((t) => t.id === trackId);
  if (queueIndex >= 0) {
    if (activeQueue.length <= 1) {
      stopPlayback();
      return;
    }
    const isCurrent = s.currentId === trackId;
    if (isCurrent) {
      void skip(1);
    }
    try {
      playlist?.remove(queueIndex);
    } catch {}
    activeQueue.splice(queueIndex, 1);
    useMusic.getState().setQueue(activeQueue.map((t) => t.id));
    persistCurrentSession();
  } else if (s.currentId === trackId) {
    stopPlayback();
  }
}

