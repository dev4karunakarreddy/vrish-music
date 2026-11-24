import { NativeModules, Platform } from 'react-native';
import type { Track } from '@noir/types';
import { getTracks, saveTrack, saveTrackFingerprint, tracksWithoutFingerprint } from './db';
import { useMusic } from './store';

type Metadata = {
  title?: string | null;
  artist?: string | null;
  album?: string | null;
  albumArtist?: string | null;
  composer?: string | null;
  artworkUri?: string | null;
  durationMs?: number;
  year?: string | null;
  genre?: string | null;
};

export interface WriteMetadataInput {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  composer?: string;
  year?: string;
  genre?: string;
  artworkUri?: string;
  removeArtwork?: boolean;
}

export interface WriteMetadataResult {
  success: boolean;
  uri?: string;
  realPath?: string;
  error?: string;
  message?: string;
}

const nativeMetadata = NativeModules.VrishMetadata as
  | {
      extract(uri: string, id: string): Promise<Metadata>;
      fingerprint(uri: string): Promise<string>;
      writeMetadata(uri: string, id: string, tags: WriteMetadataInput): Promise<WriteMetadataResult>;
      deleteTrackFile(uri: string): Promise<boolean>;
      hasStoragePermission(): Promise<boolean>;
      requestStoragePermission(): Promise<boolean>;
    }
  | undefined;

export async function hasStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeMetadata?.hasStoragePermission) {
    return true;
  }
  try {
    return await nativeMetadata.hasStoragePermission();
  } catch {
    return false;
  }
}

export async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeMetadata?.requestStoragePermission) {
    return true;
  }
  try {
    return await nativeMetadata.requestStoragePermission();
  } catch {
    return false;
  }
}

export async function fingerprintFile(uri: string): Promise<string | null> {
  try {
    return (await nativeMetadata?.fingerprint(uri)) ?? null;
  } catch {
    return null;
  }
}

export async function writeTrackMetadataToFile(
  uri: string,
  id: string,
  tags: WriteMetadataInput,
): Promise<WriteMetadataResult> {
  if (Platform.OS !== 'android' || !nativeMetadata?.writeMetadata) {
    return { success: false, uri };
  }
  try {
    return await nativeMetadata.writeMetadata(uri, id, tags);
  } catch (error) {
    console.warn('Native writeMetadata error:', error);
    return { success: false, uri };
  }
}

export async function deleteAudioFile(uri: string): Promise<boolean> {
  if (Platform.OS !== 'android' || !nativeMetadata?.deleteTrackFile) {
    return false;
  }
  try {
    return await nativeMetadata.deleteTrackFile(uri);
  } catch (error) {
    console.warn('Native deleteTrackFile error:', error);
    return false;
  }
}

export async function readTrackMetadata(track: Track): Promise<Track> {
  if (Platform.OS !== 'android' || !nativeMetadata) return track;
  try {
    const data = await nativeMetadata.extract(track.uri, track.id);
    return {
      ...track,
      title: data.title?.trim() || track.title,
      artist: data.artist?.trim() || track.artist,
      album: data.album?.trim() || track.album,
      albumArtist: data.albumArtist?.trim() || track.albumArtist,
      composer: data.composer?.trim() || track.composer,
      artworkUri: data.artworkUri || track.artworkUri,
      durationMs: data.durationMs || track.durationMs,
      year: data.year?.trim() || track.year,
      genre: data.genre?.trim() || track.genre,
    };
  } catch {
    return track;
  }
}

export async function refreshMissingMetadata(): Promise<void> {
  let changed = false;
  for (const track of getTracks()) {
    if (track.userEdited) continue; // Respect user customizations
    if (track.composer && track.artworkUri && track.artist !== 'Unknown Artist' && track.durationMs > 0) continue;
    const updated = await readTrackMetadata(track);
    if (updated !== track) {
      saveTrack(updated);
      changed = true;
    }
  }
  if (changed) useMusic.getState().refresh();
  for (const track of tracksWithoutFingerprint()) {
    const hash = await fingerprintFile(track.uri);
    if (hash) saveTrackFingerprint(track.id, hash);
  }
}
