import { File } from 'expo-file-system';

const fileExistsCache = new Map<string, { exists: boolean; expires: number }>();

export function checkFileExists(uri: string): boolean {
  if (!uri) return false;
  if (uri.startsWith('content://')) return true;

  const now = Date.now();
  const cached = fileExistsCache.get(uri);
  if (cached && cached.expires > now) {
    return cached.exists;
  }

  try {
    const exists = new File(uri).exists;
    fileExistsCache.set(uri, { exists, expires: now + 60_000 });
    return exists;
  } catch {
    return true;
  }
}

export function invalidateFileCache(uri?: string): void {
  if (uri) fileExistsCache.delete(uri);
  else fileExistsCache.clear();
}
