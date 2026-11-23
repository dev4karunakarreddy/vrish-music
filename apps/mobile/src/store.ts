import { create } from 'zustand';
import type { Track, RepeatMode, Playlist } from '@noir/types';
import { getTracks, setFavorite, getSession, getPlaylists } from './db';

interface State {
  tracks: Track[];
  playlists: Playlist[];
  currentId: string | null;
  queue: string[];
  originalQueue: string[];
  playing: boolean;
  positionMs: number;
  durationMs: number;
  shuffle: boolean;
  repeat: RepeatMode;
  error: string | null;
  toast: string | null;
  refresh: () => void;
  setQueue: (queue: string[], originalQueue?: string[]) => void;
  setCurrent: (id: string | null) => void;
  setRepeat: (mode: RepeatMode) => void;
  setShuffle: (shuffle: boolean) => void;
  setPlaying: (value: boolean) => void;
  setProgress: (positionMs: number, durationMs: number) => void;
  toggleFavorite: (id: string) => void;
  setError: (error: string | null) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
}

const restored = getSession();
const allTracks = getTracks();
const initialQueue = restored?.queue && restored.queue.length > 0
  ? restored.queue.filter((id) => allTracks.some((t) => t.id === id))
  : allTracks.map((t) => t.id);

export const useMusic = create<State>((set, get) => ({
  tracks: allTracks,
  playlists: getPlaylists(),
  currentId: restored?.trackId ?? null,
  queue: initialQueue,
  originalQueue: initialQueue,
  playing: false,
  positionMs: restored?.positionMs ?? 0,
  durationMs: 0,
  shuffle: restored?.shuffle ?? false,
  repeat: restored?.repeat ?? 'off',
  error: null,
  toast: null,

  refresh: () => {
    const updatedTracks = getTracks();
    const updatedPlaylists = getPlaylists();
    const trackIds = new Set(updatedTracks.map((track) => track.id));
    set((s) => ({
      tracks: updatedTracks,
      playlists: updatedPlaylists,
      queue: s.queue.filter((id) => trackIds.has(id)),
    }));
  },

  setQueue: (queue, originalQueue) => set((s) => ({
    queue,
    originalQueue: originalQueue ?? (s.shuffle ? s.originalQueue : queue),
  })),

  setCurrent: (id) => set({ currentId: id, positionMs: 0 }),
  setRepeat: (repeat) => set({ repeat }),
  setShuffle: (shuffle) => set({ shuffle }),
  setPlaying: (playing) => set({ playing }),
  setProgress: (positionMs, durationMs) => set({ positionMs, durationMs }),

  toggleFavorite: (id) => {
    const track = get().tracks.find((t) => t.id === id);
    if (!track) return;
    setFavorite(id, !track.favorite);
    set({ tracks: getTracks(), playlists: getPlaylists() });
  },

  setError: (error) => set({ error }),

  showToast: (toast) => {
    set({ toast });
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2400);
  },

  clearToast: () => set({ toast: null }),
}));
