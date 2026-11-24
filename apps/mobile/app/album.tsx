import React, { useState, useMemo } from 'react';
import { FlatList, Pressable, Text, View, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@noir/theme';
import { groupAlbums, cleanAlbumTitle } from '../src/albums';
import {
  Artwork,
  Empty,
  TrackRow,
  TrackMenuModal,
  TrackInfoModal,
  PlaylistPickerModal,
  CreatePlaylistModal,
  ToastBanner,
  formatTotalDuration,
} from '../src/ui';
import { playTrack, toggleShuffle } from '../src/audio';
import { useMusic } from '../src/store';
import type { Track } from '@noir/types';

export default function Album() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { group = '' } = useLocalSearchParams<{ group?: string }>();
  const tracks = useMusic((s) => s.tracks);
  const shuffle = useMusic((s) => s.shuffle);

  const album = useMemo(() => {
    const list = groupAlbums(tracks);
    const decoded = decodeURIComponent(group);
    return list.find(
      (item) =>
        item.key === group ||
        decodeURIComponent(item.key) === decoded ||
        item.key === decoded ||
        cleanAlbumTitle(item.album) === cleanAlbumTitle(decoded),
    );
  }, [tracks, group]);
  const items = album?.tracks ?? [];
  const cover = items[0];

  const totalDuration = useMemo(
    () => items.reduce((acc, t) => acc + (t.durationMs || 0), 0),
    [items],
  );

  // Modals
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  const openTrackMenu = (track: Track) => {
    setSelectedTrack(track);
    setMenuVisible(true);
  };

  const handlePlayAlbum = (shouldShuffle = false) => {
    if (items.length === 0) return;
    if (shouldShuffle) {
      const randomTrack = items[Math.floor(Math.random() * items.length)];
      if (!shuffle) toggleShuffle();
      void playTrack(randomTrack, items);
    } else {
      void playTrack(items[0], items);
    }
  };

  const header = (
    <View style={{ paddingBottom: 24 }}>
      <Pressable
        onPress={() => router.back()}
        accessibilityLabel="Back to library"
        hitSlop={8}
        style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
      >
        <Ionicons name="chevron-back" color="white" size={22} />
        <Text style={{ color: colors.secondary, fontSize: 15, marginLeft: 4 }}>Library</Text>
      </Pressable>

      {album && cover && (
        <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 24 }}>
          <Artwork track={cover} size={210} />
          <Text
            numberOfLines={2}
            style={{ color: 'white', fontSize: 24, fontWeight: '700', textAlign: 'center', marginTop: 18 }}
          >
            {album.album}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 15, marginTop: 6 }}>
            {album.artist}
          </Text>
          {album.composer ? (
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Composer · {album.composer}
            </Text>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1.5, marginTop: 10 }}>
            {items.length} {items.length === 1 ? 'TRACK' : 'TRACKS'} · {formatTotalDuration(totalDuration).toUpperCase()}
          </Text>

          {/* Play & Shuffle buttons */}
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 22 }}>
            <TouchableOpacity
              onPress={() => handlePlayAlbum(false)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'white',
                paddingVertical: 10,
                paddingHorizontal: 24,
                borderRadius: 24,
              }}
            >
              <Ionicons name="play" size={17} color="black" style={{ marginRight: 6 }} />
              <Text style={{ color: 'black', fontWeight: '700', fontSize: 14 }}>Play</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handlePlayAlbum(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.elevated,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 10,
                paddingHorizontal: 22,
                borderRadius: 24,
              }}
            >
              <Ionicons name="shuffle" size={17} color="white" style={{ marginRight: 6 }} />
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Shuffle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, marginBottom: 4, fontWeight: '600' }}>
        TRACK LIST
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ToastBanner />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 60 }}
        data={items}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            index={index}
            onPress={() => void playTrack(item, items)}
            onOptionsPress={() => openTrackMenu(item)}
          />
        )}
        ListEmptyComponent={
          <Empty title="Album not found" detail="This album may have been removed from your library." />
        }
      />

      {/* Modals */}
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

      <TrackInfoModal track={selectedTrack} visible={infoVisible} onClose={() => setInfoVisible(false)} />

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
