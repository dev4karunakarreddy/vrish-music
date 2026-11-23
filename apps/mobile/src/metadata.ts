import { NativeModules, Platform } from 'react-native';
import type { Track } from '@noir/types';
import { getTracks, saveTrack, saveTrackFingerprint, tracksWithoutFingerprint } from './db';
import { useMusic } from './store';

type Metadata = { title?:string|null; artist?:string|null; album?:string|null; albumArtist?:string|null; composer?:string|null; artworkUri?:string|null; durationMs?:number };
const nativeMetadata = NativeModules.VrishMetadata as {extract(uri:string,id:string):Promise<Metadata>;fingerprint(uri:string):Promise<string>}|undefined;
export async function fingerprintFile(uri:string):Promise<string|null>{try{return await nativeMetadata?.fingerprint(uri)??null}catch{return null}}

export async function readTrackMetadata(track:Track):Promise<Track> {
  if (Platform.OS !== 'android' || !nativeMetadata) return track;
  try {
    const data=await nativeMetadata.extract(track.uri,track.id);
    return {...track,title:data.title?.trim() || track.title,artist:data.artist?.trim() || track.artist,
      album:data.album?.trim() || track.album,albumArtist:data.albumArtist?.trim() || track.albumArtist,composer:data.composer?.trim() || track.composer,artworkUri:data.artworkUri || track.artworkUri,
      durationMs:data.durationMs || track.durationMs};
  } catch { return track; }
}

export async function refreshMissingMetadata():Promise<void> {
  let changed = false;
  for (const track of getTracks()) {
    if (track.composer && track.artworkUri && track.artist !== 'Unknown Artist' && track.durationMs > 0) continue;
    const updated=await readTrackMetadata(track);
    if (updated !== track) {saveTrack(updated);changed = true;}
  }
  if (changed) useMusic.getState().refresh();
  for(const track of tracksWithoutFingerprint()){
    const hash=await fingerprintFile(track.uri);
    if(hash)saveTrackFingerprint(track.id,hash);
  }
}
