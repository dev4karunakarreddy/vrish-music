import React, { useState, useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '@noir/theme';
import {
  Artwork,
  Empty,
  Heading,
  TrackRow,
  TrackMenuModal,
  TrackInfoModal,
  PlaylistPickerModal,
  CreatePlaylistModal,
  ToastBanner,
} from '../../src/ui';
import { useMusic } from '../../src/store';
import { importAudioFiles } from '../../src/library';
import { playTrack, toggleShuffle } from '../../src/audio';
import type { Track } from '@noir/types';

export default function Home() {
  const router = useRouter();
  const tracks = useMusic((s) => s.tracks);
  const refresh = useMusic((s) => s.refresh);
  const setError = useMusic((s) => s.setError);
  const shuffle = useMusic((s) => s.shuffle);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  const favoriteCount = useMemo(() => tracks.filter((t) => t.favorite).length, [tracks]);
  const recentTracks = useMemo<Track[]>(() => tracks.slice(0, 10), [tracks]);
  const quickTracks = useMemo<Track[]>(() => tracks.slice(0, 8), [tracks]);

  const importFiles = async () => {
    try {
      await importAudioFiles();
      refresh();
    } catch (e) {
      setError(String(e));
    }
  };

  const openTrackMenu = (track: Track) => {
    setSelectedTrack(track);
    setMenuVisible(true);
  };

  const handleShuffleAll = () => {
    if (tracks.length === 0) return;
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    if (!shuffle) toggleShuffle();
    void playTrack(randomTrack, tracks);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ToastBanner />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, paddingTop: 62, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header - Settings icon removed as requested */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }}>
          <Text style={{ color: 'white', letterSpacing: 5, fontWeight: '800', fontSize: 15 }}>VRISH MUSIC</Text>
          {tracks.length > 0 && (
            <Pressable
              onPress={handleShuffleAll}
              accessibilityRole="button"
              accessibilityLabel="Shuffle all music"
              hitSlop={8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 7,
                paddingHorizontal: 13,
                borderRadius: 18,
                backgroundColor: colors.elevated,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="shuffle" size={15} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>Shuffle</Text>
            </Pressable>
          )}
        </View>

        <Heading eyebrow="THE COLLECTION" title="Your Music" />

        {tracks.length === 0 ? (
          <Empty
            title="Make it yours"
            detail="Import music from your device to begin listening."
            action="Import music"
            onAction={() => void importFiles()}
          />
        ) : (
          <>
            {/* Quick Navigation Cards */}
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 32 }}>
              <Pressable
                onPress={() => router.push('/(tabs)/playlists')}
                style={{
                  flex: 1,
                  backgroundColor: '#0E0E0E',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="heart" size={20} color="white" style={{ marginBottom: 10 }} />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Favorites</Text>
                <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3 }}>
                  {favoriteCount} tracks
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.push('/(tabs)/library')}
                style={{
                  flex: 1,
                  backgroundColor: '#0E0E0E',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="library" size={20} color="white" style={{ marginBottom: 10 }} />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>Library</Text>
                <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 3 }}>{tracks.length} tracks</Text>
              </Pressable>
            </View>

            {/* Recently Added Carousel */}
            <Text style={{ color: colors.secondary, fontSize: 11, letterSpacing: 2, marginBottom: 16, fontWeight: '600' }}>
              RECENTLY ADDED
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -24, paddingHorizontal: 24, marginBottom: 38 }}
            >
              {recentTracks.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => void playTrack(t, tracks)}
                  style={{ width: 140, marginRight: 14 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${t.title}`}
                >
                  <Artwork track={t} size={140} />
                  <Text numberOfLines={1} style={{ color: 'white', fontWeight: '600', fontSize: 13, marginTop: 10 }}>
                    {t.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                    {t.artist}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Quick Track List */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: 'white', fontSize: 20, fontWeight: '700' }}>Tracks</Text>
              <Pressable onPress={() => router.push('/(tabs)/library')}>
                <Text style={{ color: colors.secondary, fontSize: 13, fontWeight: '500' }}>See all</Text>
              </Pressable>
            </View>

            {quickTracks.map((t) => (
              <TrackRow
                key={t.id}
                track={t}
                onPress={() => void playTrack(t, tracks)}
                onOptionsPress={() => openTrackMenu(t)}
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Auxio style modals */}
      <TrackMenuModal
        track={selectedTrack}
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onShowDetails={(t) => {
          setSelectedTrack(t);
          setInfoVisible(true);
        }}
        onShowPlaylistPicker={(t) => {
          setSelectedTrack(t);
          setPlaylistPickerVisible(true);
        }}
      />

      <TrackInfoModal
        track={selectedTrack}
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
      />

      <PlaylistPickerModal
        track={selectedTrack}
        visible={playlistPickerVisible}
        onClose={() => setPlaylistPickerVisible(false)}
        onCreateNew={() => setCreatePlaylistVisible(true)}
      />

      <CreatePlaylistModal
        visible={createPlaylistVisible}
        onClose={() => setCreatePlaylistVisible(false)}
        initialTrack={selectedTrack}
      />
    </View>
  );
}
