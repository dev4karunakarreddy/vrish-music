import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@noir/theme';
import {
  Artwork,
  Empty,
  TrackMenuModal,
  TrackInfoModal,
  PlaylistPickerModal,
  CreatePlaylistModal,
  ToastBanner,
  TopGradientFade,
  useTopInset,
  formatDuration,
  formatTotalDuration,
} from '../src/ui';
import { useMusic } from '../src/store';
import {
  playTrack,
  removeFromQueue,
  reorderQueue,
  clearUpcomingQueue,
  toggleShuffle,
} from '../src/audio';
import type { Track } from '@noir/types';

export default function Queue() {
  const topInset = useTopInset();
  const router = useRouter();
  const tracks = useMusic((s) => s.tracks);
  const currentId = useMusic((s) => s.currentId);
  const queue = useMusic((s) => s.queue);
  const shuffle = useMusic((s) => s.shuffle);

  const items = useMemo(
    () => queue.map((id) => tracks.find((t) => t.id === id)).filter((t): t is Track => !!t),
    [queue, tracks],
  );

  const totalDuration = useMemo(
    () => items.reduce((acc, t) => acc + (t.durationMs || 0), 0),
    [items],
  );

  const currentIndex = items.findIndex((t) => t.id === currentId);

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

  const handleClearUpcoming = () => {
    if (currentIndex >= items.length - 1) return;
    Alert.alert('Clear Upcoming', 'Remove all upcoming songs from this queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: clearUpcomingQueue,
      },
    ]);
  };

  const header = (
    <View style={{ marginBottom: 16 }}>
      {/* Back button and title */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" color="white" size={26} />
        </Pressable>

        <Text style={{ color: 'white', fontSize: 22, fontWeight: '700' }}>Playing Queue</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            onPress={toggleShuffle}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="shuffle" size={18} color={shuffle ? 'white' : colors.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClearUpcoming}
            disabled={currentIndex >= items.length - 1}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: currentIndex >= items.length - 1 ? 0.3 : 1,
            }}
          >
            <Ionicons name="trash-outline" size={17} color={colors.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ color: colors.secondary, fontSize: 12, marginBottom: 8 }}>
        {items.length} {items.length === 1 ? 'TRACK' : 'TRACKS'} · {formatTotalDuration(totalDuration).toUpperCase()}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ToastBanner />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: topInset + 16, paddingBottom: 60 }}
        data={items}
        keyExtractor={(t, idx) => `${t.id}-${idx}`}
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => {
          const isCurrent = item.id === currentId && index === currentIndex;
          return (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                backgroundColor: isCurrent ? '#141414' : 'transparent',
                borderRadius: isCurrent ? 8 : 0,
                paddingHorizontal: isCurrent ? 10 : 0,
                marginBottom: isCurrent ? 6 : 0,
              }}
            >
              {/* Position / Index indicator */}
              <Text
                style={{
                  width: 26,
                  color: isCurrent ? 'white' : colors.muted,
                  fontSize: 12,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </Text>

              {/* Tap track to play */}
              <Pressable
                onPress={() => void playTrack(item, items)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
              >
                <Artwork track={item} size={46} />
                <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                  <Text numberOfLines={1} style={{ color: 'white', fontSize: 15, fontWeight: isCurrent ? '700' : '500' }}>
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 12, marginTop: 3 }}>
                    {item.artist} · {formatDuration(item.durationMs)}
                  </Text>
                  {isCurrent && (
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 9,
                        letterSpacing: 1.5,
                        fontWeight: '800',
                        marginTop: 4,
                      }}
                    >
                      NOW PLAYING
                    </Text>
                  )}
                </View>
              </Pressable>

              {/* Reordering Up & Down */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                {index > 0 && (
                  <TouchableOpacity
                    onPress={() => reorderQueue(index, index - 1)}
                    hitSlop={6}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="chevron-up" size={17} color={colors.secondary} />
                  </TouchableOpacity>
                )}

                {index < items.length - 1 && (
                  <TouchableOpacity
                    onPress={() => reorderQueue(index, index + 1)}
                    hitSlop={6}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="chevron-down" size={17} color={colors.secondary} />
                  </TouchableOpacity>
                )}

                {/* Remove from queue button */}
                <TouchableOpacity
                  onPress={() => removeFromQueue(index)}
                  hitSlop={6}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="close" size={18} color={colors.secondary} />
                </TouchableOpacity>

                {/* More options menu */}
                <TouchableOpacity
                  onPress={() => openTrackMenu(item)}
                  hitSlop={6}
                  style={{ padding: 6 }}
                >
                  <Ionicons name="ellipsis-vertical" size={16} color={colors.secondary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Empty title="Queue is empty" detail="Choose a song from your collection to start listening." />
        }
      />
      <TopGradientFade />

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
