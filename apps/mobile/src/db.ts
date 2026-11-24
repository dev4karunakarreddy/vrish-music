import { NativeModules, Platform } from 'react-native';
import type { Track, Playlist, RepeatMode } from '@noir/types';

export interface SessionData {
  trackId: string;
  positionMs: number;
  queue?: string[];
  shuffle?: boolean;
  repeat?: RepeatMode;
}

interface StoredPlaylist {
  id: string;
  name: string;
  createdAt: number;
  trackIds: string[];
}

interface StoreSchema {
  version: number;
  tracks: Record<string, Track>;
  fingerprints: Record<string, string>; // sha256 -> track_id
  sources: Record<string, string>; // uri -> track_id
  playlists: Record<string, StoredPlaylist>;
  session: SessionData | null;
  settings: Record<string, string>;
}

const nativeMetadata = NativeModules.VrishMetadata as
  | {
      readStoreSync?(): string;
      writeStoreSync?(json: string): boolean;
      writeStoreAsync?(json: string): Promise<boolean>;
    }
  | undefined;

const store: StoreSchema = {
  version: 1,
  tracks: {},
  fingerprints: {},
  sources: {},
  playlists: {},
  session: null,
  settings: {},
};

const uriToId = new Map<string, string>();
const fingerprintToId = new Map<string, string>();
const idToFingerprint = new Map<string, string>();

let initialized = false;

export function initStore(): void {
  if (initialized) return;
  initialized = true;

  try {
    let raw = '';
    if (Platform.OS === 'android' && nativeMetadata?.readStoreSync) {
      raw = nativeMetadata.readStoreSync();
    }
    if (raw && raw.trim().length > 0) {
      const parsed = JSON.parse(raw) as Partial<StoreSchema>;
      if (parsed.tracks) store.tracks = parsed.tracks;
      if (parsed.fingerprints) store.fingerprints = parsed.fingerprints;
      if (parsed.sources) store.sources = parsed.sources;
      if (parsed.playlists) store.playlists = parsed.playlists;
      if (parsed.session) store.session = parsed.session;
      if (parsed.settings) store.settings = parsed.settings;
    }
  } catch (error) {
    console.warn('Failed to load store from disk:', error);
  }

  rebuildIndexes();
}

function rebuildIndexes(): void {
  uriToId.clear();
  fingerprintToId.clear();
  idToFingerprint.clear();

  for (const [id, track] of Object.entries(store.tracks)) {
    if (track && track.uri) {
      uriToId.set(track.uri, id);
    }
  }
  for (const [hash, trackId] of Object.entries(store.fingerprints)) {
    fingerprintToId.set(hash, trackId);
    idToFingerprint.set(trackId, hash);
  }
}

export function __resetStoreForTesting(initial?: Partial<StoreSchema>): void {
  store.version = initial?.version ?? 1;
  store.tracks = initial?.tracks ? { ...initial.tracks } : {};
  store.fingerprints = initial?.fingerprints ? { ...initial.fingerprints } : {};
  store.sources = initial?.sources ? { ...initial.sources } : {};
  store.playlists = initial?.playlists ? { ...initial.playlists } : {};
  store.session = initial?.session ?? null;
  store.settings = initial?.settings ? { ...initial.settings } : {};
  initialized = true;
  rebuildIndexes();
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function flushStoreSync(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    const json = JSON.stringify(store);
    if (Platform.OS === 'android' && nativeMetadata?.writeStoreSync) {
      nativeMetadata.writeStoreSync(json);
    }
  } catch (e) {
    console.warn('Failed to sync-flush store:', e);
  }
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const json = JSON.stringify(store);
      if (Platform.OS === 'android' && nativeMetadata?.writeStoreAsync) {
        void nativeMetadata.writeStoreAsync(json);
      } else if (Platform.OS === 'android' && nativeMetadata?.writeStoreSync) {
        nativeMetadata.writeStoreSync(json);
      }
    } catch (e) {
      console.warn('Failed to persist store:', e);
    }
  }, 200);
}

export function getTracks(): Track[] {
  initStore();
  return Object.values(store.tracks).sort((a, b) => b.addedAt - a.addedAt);
}

export function getTrackById(id: string): Track | null {
  initStore();
  return store.tracks[id] ?? null;
}

export function findTrackByUri(uri: string): Track | null {
  initStore();
  const id = uriToId.get(uri);
  return id ? (store.tracks[id] ?? null) : null;
}

export function saveTrack(t: Track): void {
  initStore();
  store.tracks[t.id] = t;
  if (t.uri) uriToId.set(t.uri, t.id);
  schedulePersist();
}

export function updateTrack(id: string, updates: Partial<Track>): Track | null {
  initStore();
  const current = store.tracks[id];
  if (!current) return null;
  const merged: Track = {
    ...current,
    ...updates,
    id: current.id,
    uri: updates.uri ?? current.uri,
    userEdited: updates.userEdited !== undefined ? updates.userEdited : true,
  };
  store.tracks[id] = merged;
  if (merged.uri) uriToId.set(merged.uri, id);
  schedulePersist();
  return merged;
}

export function setFavorite(id: string, value: boolean): void {
  initStore();
  const track = store.tracks[id];
  if (track) {
    track.favorite = value;
    schedulePersist();
  }
}

export function incrementPlayCount(id: string): void {
  initStore();
  const track = store.tracks[id];
  if (track) {
    track.playCount = (track.playCount || 0) + 1;
    schedulePersist();
  }
}

export function saveSession(
  trackId: string,
  positionMs: number,
  queue?: string[],
  shuffle?: boolean,
  repeat?: RepeatMode,
): void {
  initStore();
  const current = store.session;
  store.session = {
    trackId,
    positionMs,
    queue: queue ?? current?.queue,
    shuffle: shuffle !== undefined ? shuffle : current?.shuffle,
    repeat: repeat ?? current?.repeat,
  };
  schedulePersist();
}

export function getSession(): SessionData | null {
  initStore();
  return store.session;
}

export function findTrackByFingerprint(hash: string): string | null {
  initStore();
  return fingerprintToId.get(hash) ?? null;
}

export function saveTrackFingerprint(id: string, hash: string): void {
  initStore();
  store.fingerprints[hash] = id;
  fingerprintToId.set(hash, id);
  idToFingerprint.set(id, hash);
  schedulePersist();
}

export function getTrackFingerprint(id: string): string | null {
  initStore();
  return idToFingerprint.get(id) ?? null;
}

export function findTrackBySource(uri: string): string | null {
  initStore();
  return store.sources[uri] ?? null;
}

export function saveTrackSource(id: string, uri: string): void {
  initStore();
  store.sources[uri] = id;
  schedulePersist();
}

export function tracksWithoutFingerprint(): Track[] {
  initStore();
  return Object.values(store.tracks).filter((t) => !idToFingerprint.has(t.id));
}

export function getSetting(key: string): string | null {
  initStore();
  return store.settings[key] ?? null;
}

export function setSetting(key: string, value: string): void {
  initStore();
  store.settings[key] = value;
  schedulePersist();
}

export function deleteTrack(id: string): void {
  initStore();
  const track = store.tracks[id];
  if (track?.uri) uriToId.delete(track.uri);
  const hash = idToFingerprint.get(id);
  if (hash) {
    fingerprintToId.delete(hash);
    delete store.fingerprints[hash];
  }
  idToFingerprint.delete(id);
  delete store.tracks[id];

  for (const [src, tid] of Object.entries(store.sources)) {
    if (tid === id) delete store.sources[src];
  }

  for (const pl of Object.values(store.playlists)) {
    pl.trackIds = pl.trackIds.filter((tId) => tId !== id);
  }

  schedulePersist();
}

export function getPlaylists(): Playlist[] {
  initStore();
  return Object.values(store.playlists)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      trackCount: p.trackIds.length,
      trackIds: [...p.trackIds],
    }));
}

export function createPlaylist(name: string): Playlist {
  initStore();
  const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  const pl: StoredPlaylist = {
    id,
    name: name.trim() || 'New Playlist',
    createdAt: now,
    trackIds: [],
  };
  store.playlists[id] = pl;
  schedulePersist();
  return { id, name: pl.name, createdAt: now, trackCount: 0, trackIds: [] };
}

export function renamePlaylist(id: string, name: string): void {
  initStore();
  const pl = store.playlists[id];
  if (pl) {
    pl.name = name.trim() || 'Untitled Playlist';
    schedulePersist();
  }
}

export function deletePlaylist(id: string): void {
  initStore();
  delete store.playlists[id];
  schedulePersist();
}

export function getPlaylistTracks(playlistId: string): Track[] {
  initStore();
  const pl = store.playlists[playlistId];
  if (!pl) return [];
  return pl.trackIds
    .map((tid) => store.tracks[tid])
    .filter((t): t is Track => !!t);
}

export function addTrackToPlaylist(playlistId: string, trackId: string): boolean {
  initStore();
  const pl = store.playlists[playlistId];
  if (!pl) return false;
  pl.trackIds.push(trackId);
  schedulePersist();
  return true;
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string, position?: number): void {
  initStore();
  const pl = store.playlists[playlistId];
  if (!pl) return;
  if (position !== undefined && position >= 0 && position < pl.trackIds.length) {
    pl.trackIds.splice(position, 1);
  } else {
    const idx = pl.trackIds.indexOf(trackId);
    if (idx >= 0) pl.trackIds.splice(idx, 1);
  }
  schedulePersist();
}
