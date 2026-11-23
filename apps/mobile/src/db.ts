import * as SQLite from 'expo-sqlite';
import type { Track, Playlist, RepeatMode } from '@noir/types';

const db = SQLite.openDatabaseSync('noir.db');
db.execSync(`PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  uri TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  artwork_uri TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  play_count INTEGER NOT NULL DEFAULT 0
);`);

try { db.execSync('ALTER TABLE tracks ADD COLUMN composer TEXT'); } catch { /* already migrated */ }
try { db.execSync('ALTER TABLE tracks ADD COLUMN album_artist TEXT'); } catch { /* already migrated */ }
db.execSync('CREATE TABLE IF NOT EXISTS playback_session (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
db.execSync('CREATE TABLE IF NOT EXISTS track_fingerprints (track_id TEXT PRIMARY KEY, sha256 TEXT NOT NULL UNIQUE);');
db.execSync('CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);');
db.execSync('CREATE TABLE IF NOT EXISTS track_sources (source_uri TEXT PRIMARY KEY, track_id TEXT NOT NULL);');

db.execSync(`
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  track_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks (playlist_id, position);
`);

type Row = {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  album_artist: string | null;
  composer: string | null;
  artwork_uri: string | null;
  duration_ms: number;
  added_at: number;
  favorite: number;
  play_count: number;
};

const map = (r: Row): Track => ({
  id: r.id,
  uri: r.uri,
  title: r.title,
  artist: r.artist,
  album: r.album,
  albumArtist: r.album_artist ?? undefined,
  composer: r.composer ?? undefined,
  artworkUri: r.artwork_uri ?? undefined,
  durationMs: r.duration_ms,
  addedAt: r.added_at,
  favorite: !!r.favorite,
  playCount: r.play_count,
});

export function getTracks(): Track[] {
  return db.getAllSync<Row>('SELECT * FROM tracks ORDER BY added_at DESC').map(map);
}

export function saveTrack(t: Track): void {
  db.runSync(
    'INSERT OR REPLACE INTO tracks (id,uri,title,artist,album,album_artist,composer,artwork_uri,duration_ms,added_at,favorite,play_count) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    t.id,
    t.uri,
    t.title,
    t.artist,
    t.album,
    t.albumArtist ?? null,
    t.composer ?? null,
    t.artworkUri ?? null,
    t.durationMs,
    t.addedAt,
    +t.favorite,
    t.playCount,
  );
}

export function setFavorite(id: string, value: boolean): void {
  db.runSync('UPDATE tracks SET favorite=? WHERE id=?', +value, id);
}

export function incrementPlayCount(id: string): void {
  db.runSync('UPDATE tracks SET play_count=play_count+1 WHERE id=?', id);
}

export interface SessionData {
  trackId: string;
  positionMs: number;
  queue?: string[];
  shuffle?: boolean;
  repeat?: RepeatMode;
}

export function saveSession(
  trackId: string,
  positionMs: number,
  queue?: string[],
  shuffle?: boolean,
  repeat?: RepeatMode,
): void {
  const current = getSession();
  const data: SessionData = {
    trackId,
    positionMs,
    queue: queue ?? current?.queue,
    shuffle: shuffle !== undefined ? shuffle : current?.shuffle,
    repeat: repeat ?? current?.repeat,
  };
  db.runSync('INSERT OR REPLACE INTO playback_session (key,value) VALUES (?,?)', 'last', JSON.stringify(data));
}

export function getSession(): SessionData | null {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM playback_session WHERE key=?', 'last');
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}

export function findTrackByFingerprint(hash: string): string | null {
  return db.getFirstSync<{ track_id: string }>('SELECT track_id FROM track_fingerprints WHERE sha256=?', hash)?.track_id ?? null;
}

export function saveTrackFingerprint(id: string, hash: string): void {
  db.runSync('INSERT OR IGNORE INTO track_fingerprints (track_id,sha256) VALUES (?,?)', id, hash);
}

export function findTrackBySource(uri: string): string | null {
  return db.getFirstSync<{ track_id: string }>('SELECT track_id FROM track_sources WHERE source_uri=?', uri)?.track_id ?? null;
}

export function saveTrackSource(id: string, uri: string): void {
  db.runSync('INSERT OR REPLACE INTO track_sources (source_uri,track_id) VALUES (?,?)', uri, id);
}

export function tracksWithoutFingerprint(): Track[] {
  return db.getAllSync<Row>(
    'SELECT tracks.* FROM tracks LEFT JOIN track_fingerprints ON tracks.id=track_fingerprints.track_id WHERE track_fingerprints.track_id IS NULL',
  ).map(map);
}

export function getSetting(key: string): string | null {
  return db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key=?', key)?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO app_settings (key,value) VALUES (?,?)', key, value);
}

export function deleteTrack(id: string): void {
  db.runSync('DELETE FROM track_fingerprints WHERE track_id=?', id);
  db.runSync('DELETE FROM track_sources WHERE track_id=?', id);
  db.runSync('DELETE FROM playlist_tracks WHERE track_id=?', id);
  db.runSync('DELETE FROM tracks WHERE id=?', id);
}

export function getTrackFingerprint(id: string): string | null {
  return db.getFirstSync<{ sha256: string }>('SELECT sha256 FROM track_fingerprints WHERE track_id=?', id)?.sha256 ?? null;
}

// --- PLAYLIST FUNCTIONS ---

export function getPlaylists(): Playlist[] {
  const rows = db.getAllSync<{ id: string; name: string; created_at: number }>('SELECT * FROM playlists ORDER BY created_at DESC');
  return rows.map((p) => {
    const trackRows = db.getAllSync<{ track_id: string }>(
      'SELECT track_id FROM playlist_tracks WHERE playlist_id=? ORDER BY position ASC',
      p.id,
    );
    return {
      id: p.id,
      name: p.name,
      createdAt: p.created_at,
      trackCount: trackRows.length,
      trackIds: trackRows.map((tr) => tr.track_id),
    };
  });
}

export function createPlaylist(name: string): Playlist {
  const id = `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = Date.now();
  db.runSync('INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)', id, name.trim() || 'New Playlist', now);
  return { id, name: name.trim() || 'New Playlist', createdAt: now, trackCount: 0, trackIds: [] };
}

export function renamePlaylist(id: string, name: string): void {
  db.runSync('UPDATE playlists SET name=? WHERE id=?', name.trim() || 'Untitled Playlist', id);
}

export function deletePlaylist(id: string): void {
  db.runSync('DELETE FROM playlist_tracks WHERE playlist_id=?', id);
  db.runSync('DELETE FROM playlists WHERE id=?', id);
}

export function getPlaylistTracks(playlistId: string): Track[] {
  const rows = db.getAllSync<Row>(
    `SELECT tracks.* FROM playlist_tracks
     JOIN tracks ON playlist_tracks.track_id = tracks.id
     WHERE playlist_tracks.playlist_id = ?
     ORDER BY playlist_tracks.position ASC`,
    playlistId,
  );
  return rows.map(map);
}

export function addTrackToPlaylist(playlistId: string, trackId: string): boolean {
  const maxPosRow = db.getFirstSync<{ max_pos: number | null }>(
    'SELECT MAX(position) as max_pos FROM playlist_tracks WHERE playlist_id=?',
    playlistId,
  );
  const nextPos = (maxPosRow?.max_pos ?? -1) + 1;
  const id = `pt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.runSync(
    'INSERT INTO playlist_tracks (id, playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?, ?)',
    id,
    playlistId,
    trackId,
    nextPos,
    Date.now(),
  );
  return true;
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string, position?: number): void {
  if (position !== undefined) {
    db.runSync('DELETE FROM playlist_tracks WHERE playlist_id=? AND track_id=? AND position=?', playlistId, trackId, position);
  } else {
    // Delete first occurrence
    const first = db.getFirstSync<{ id: string }>(
      'SELECT id FROM playlist_tracks WHERE playlist_id=? AND track_id=? ORDER BY position ASC LIMIT 1',
      playlistId,
      trackId,
    );
    if (first) {
      db.runSync('DELETE FROM playlist_tracks WHERE id=?', first.id);
    }
  }
}
