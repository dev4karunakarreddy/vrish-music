export type RepeatMode = 'off' | 'all' | 'one';

export interface Track {
  id: string;
  uri: string;
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  composer?: string;
  artworkUri?: string;
  durationMs: number;
  addedAt: number;
  favorite: boolean;
  playCount: number;
}

export interface Playlist {
  id: string;
  name: string;
  createdAt: number;
  trackCount: number;
  trackIds: string[];
}

export type SongSortMode = 'title' | 'artist' | 'album' | 'duration' | 'addedAt';
export type AlbumSortMode = 'title' | 'artist' | 'trackCount' | 'addedAt';
export type ArtistSortMode = 'name' | 'trackCount';
export type SortDirection = 'asc' | 'desc';

export interface PlaybackState {
  trackId: string | null;
  playing: boolean;
  positionMs: number;
  durationMs: number;
  repeat: RepeatMode;
  shuffle: boolean;
}

export interface AudioEngine {
  load(uri: string): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  setRepeat(mode: RepeatMode): Promise<void>;
  getState(): Promise<PlaybackState>;
}
