import * as DocumentPicker from 'expo-document-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import type { Track } from '@noir/types';
import {
  deleteTrack,
  findTrackByFingerprint,
  findTrackBySource,
  getSetting,
  getTracks,
  saveTrack,
  saveTrackFingerprint,
  saveTrackSource,
  setSetting,
} from './db';
import { fingerprintFile, readTrackMetadata } from './metadata';
import { useMusic } from './store';

const supported = /\.(mp3|m4a|aac|wav|flac|ogg|opus)$/i;
export const MIN_TRACK_DURATION_MS = 33_000;
let importing = false;

export { checkFileExists, invalidateFileCache } from './fileCheck';

async function importAudioSource(
  uri: string,
  name: string,
  durationHintMs = 0,
  addedAt = Date.now(),
): Promise<'imported' | 'duplicate' | 'short' | 'unsupported'> {
  if (!supported.test(name)) return 'unsupported';
  if (durationHintMs > 0 && durationHintMs <= MIN_TRACK_DURATION_MS) return 'short';

  if (!uri.startsWith('content://')) {
    try {
      const source = new File(uri);
      if (!source.exists) return 'unsupported';
    } catch {}
  }

  const known = findTrackBySource(uri);
  if (known) return 'duplicate';

  const fingerprint = await fingerprintFile(uri);
  if (fingerprint) {
    const duplicate = findTrackByFingerprint(fingerprint);
    if (duplicate) {
      saveTrackSource(duplicate, uri);
      return 'duplicate';
    }
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // DIRECT IMPORT: Do not copy the audio file! Keep the original path directly to save storage space.
  const title = name.replace(supported, '').replace(/[_-]+/g, ' ').trim();
  const draft: Track = {
    id,
    uri,
    title: title || 'Untitled',
    artist: 'Unknown Artist',
    album: 'Imported Music',
    durationMs: durationHintMs,
    addedAt,
    favorite: false,
    playCount: 0,
  };

  const track = await readTrackMetadata(draft);
  if (track.durationMs > 0 && track.durationMs <= MIN_TRACK_DURATION_MS) {
    return 'short';
  }

  saveTrack(track);
  if (fingerprint) saveTrackFingerprint(id, fingerprint);
  saveTrackSource(id, uri);
  return 'imported';
}

export async function importAudioFiles():Promise<Track[]> {
  // Do not copy files into cache directory; use original URIs directly
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    multiple: true,
    copyToCacheDirectory: false,
  });
  if (result.canceled) return getTracks();
  for (const asset of result.assets) {
    await importAudioSource(asset.uri, asset.name);
  }
  return getTracks();
}

export interface FolderSyncResult {
  imported: number;
  short: number;
  permissionDenied: boolean;
}

/** Indexes Android MediaStore audio directly from original Music and Download folders without copying files. */
export async function syncMusicFolders(
  requestPermission = false,
  forcePermission = false,
): Promise<FolderSyncResult> {
  if (Platform.OS !== 'android') return { imported: 0, short: 0, permissionDenied: false };
  if (importing) return { imported: 0, short: 0, permissionDenied: false };
  importing = true;
  try {
    let permission = await MediaLibrary.getPermissionsAsync(false, ['audio']);
    if (!permission.granted && requestPermission && (forcePermission || getSetting('audio_permission_prompted') !== 'audio-v2')) {
      permission = await MediaLibrary.requestPermissionsAsync(false, ['audio']);
      setSetting('audio_permission_prompted', 'audio-v2');
    }
    if (!permission.granted) return { imported: 0, short: 0, permissionDenied: true };

    let after: string | undefined;
    let imported = 0, short = 0;
    do {
      const page = await MediaLibrary.getAssetsAsync({ mediaType: MediaLibrary.MediaType.audio, first: 100, after });
      for (const asset of page.assets) {
        if (!supported.test(asset.filename)) continue;
        let path = '';
        try {
          path = decodeURIComponent(asset.uri).toLocaleLowerCase();
        } catch {
          path = asset.uri.toLocaleLowerCase();
        }
        if (!/(?:^|\/)(?:music|downloads?)(?:\/|$)/i.test(path)) continue;
        const result = await importAudioSource(
          asset.uri,
          asset.filename,
          Math.round(asset.duration * 1000),
          asset.creationTime || Date.now(),
        );
        if (result === 'imported') imported++;
        if (result === 'short') short++;
      }
      after = page.hasNextPage ? page.endCursor : undefined;
    } while (after);

    useMusic.getState().refresh();
    return { imported, short, permissionDenied: false };
  } finally {
    importing = false;
  }
}

/** Purges already-imported short tracks. Only deletes internal copies if previously stored in app sandbox. */
export function removeShortImportedTracks(): number {
  const shortTracks = getTracks().filter((track) => track.durationMs > 0 && track.durationMs <= MIN_TRACK_DURATION_MS);
  for (const track of shortTracks) {
    if (track.uri.includes(Paths.document.uri)) {
      try {
        new File(track.uri).delete();
      } catch {}
    }
    deleteTrack(track.id);
  }
  if (shortTracks.length) useMusic.getState().refresh();
  return shortTracks.length;
}
