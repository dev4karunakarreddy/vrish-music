import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { Track } from '@noir/types';
import { getTrackById, updateTrack, saveTrack } from './db';
import { readTrackMetadata, writeTrackMetadataToFile } from './metadata';
import { useMusic } from './store';

export interface TrackEditInput {
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  composer?: string;
  year?: string;
  genre?: string;
  artworkUri?: string;
}

/**
 * Opens system photo / document selector to pick an album cover image.
 * Safely copies the chosen image into persistent app artwork storage.
 */
export async function pickArtworkImage(trackId?: string): Promise<string | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const picked = result.assets[0];
    if (!picked.uri) return null;

    const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
    const artworkDir = `${baseDir}artwork/`;
    await FileSystem.makeDirectoryAsync(artworkDir, { intermediates: true }).catch(() => {});

    const ext = picked.name?.split('.').pop()?.toLowerCase() || 'jpg';
    const idPrefix = trackId ? `${trackId}_` : '';
    const targetFile = `${artworkDir}custom_${idPrefix}${Date.now()}.${ext}`;

    await FileSystem.copyAsync({
      from: picked.uri,
      to: targetFile,
    });

    return targetFile;
  } catch (error) {
    console.warn('Failed to pick and save artwork:', error);
    return null;
  }
}

/**
 * Commits user metadata and cover art edits to the SQLite database
 * and propagates updates reactively to the entire player and UI.
 */
export async function saveTrackEdits(trackId: string, input: TrackEditInput): Promise<Track | null> {
  const current = getTrackById(trackId);
  if (!current) return null;

  // 1. Replace the existing audio file tags & embedded artwork directly on storage
  const writeRes = await writeTrackMetadataToFile(current.uri, current.id, {
    title: input.title.trim() || current.title,
    artist: input.artist.trim() || 'Unknown Artist',
    album: input.album.trim() || 'Unknown Album',
    albumArtist: input.albumArtist?.trim(),
    composer: input.composer?.trim(),
    year: input.year?.trim(),
    genre: input.genre?.trim(),
    artworkUri: input.artworkUri,
    removeArtwork: !input.artworkUri && !!current.artworkUri,
  });

  const finalUri = writeRes?.uri || current.uri;

  // 2. Clean up previous custom artwork file if replaced or removed
  if (current.artworkUri && current.artworkUri !== input.artworkUri && current.artworkUri.includes('/artwork/custom_')) {
    try {
      await FileSystem.deleteAsync(current.artworkUri, { idempotent: true });
    } catch {}
  }

  // 3. Commit updates to SQLite database
  const updated = updateTrack(trackId, {
    uri: finalUri,
    title: input.title.trim() || current.title,
    artist: input.artist.trim() || 'Unknown Artist',
    album: input.album.trim() || 'Unknown Album',
    albumArtist: input.albumArtist?.trim() || undefined,
    composer: input.composer?.trim() || undefined,
    year: input.year?.trim() || undefined,
    genre: input.genre?.trim() || undefined,
    artworkUri: input.artworkUri || undefined,
    userEdited: true,
  });

  if (updated) {
    useMusic.getState().updateTrackInStore(updated);
    useMusic.getState().showToast('File & audio tags updated');
  }

  return updated;
}

/**
 * Reverts track tags back to the original embedded audio metadata.
 */
export async function revertTrackEdits(trackId: string): Promise<Track | null> {
  const current = getTrackById(trackId);
  if (!current) return null;

  // Clean up any custom artwork file
  if (current.artworkUri && current.artworkUri.includes('/artwork/custom_')) {
    try {
      await FileSystem.deleteAsync(current.artworkUri, { idempotent: true });
    } catch {}
  }

  // Re-read file tags
  const draft: Track = {
    ...current,
    userEdited: false,
    artworkUri: undefined,
  };

  const restored = await readTrackMetadata(draft);
  restored.userEdited = false;
  saveTrack(restored);

  useMusic.getState().updateTrackInStore(restored);
  useMusic.getState().showToast('Restored original tags');
  return restored;
}
