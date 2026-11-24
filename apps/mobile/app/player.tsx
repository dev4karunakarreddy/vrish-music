import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { colors } from '@noir/theme';
import { PlayerArtwork } from '../src/PlayerArtwork';
import {
  Artwork,
  Empty,
  TrackMenuModal,
  TrackInfoModal,
  PlaylistPickerModal,
  CreatePlaylistModal,
  ToastBanner,
  useTopInset,
  formatDuration,
} from '../src/ui';
import { useMusic } from '../src/store';
import { togglePlayback, skip, seekTo, setRepeat, toggleShuffle } from '../src/audio';
import { groupAlbums } from '../src/albums';
import type { Track } from '@noir/types';

export default function Player() {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const { tracks, currentId, playing, positionMs, durationMs, repeat, shuffle, queue, toggleFavorite } = useMusic();

  const track = tracks.find((t) => t.id === currentId);

  const [seekWidth, setSeekWidth] = useState(1);
  const [preview, setPreview] = useState<number | null>(null);
  const [showRemaining, setShowRemaining] = useState(false);

  // Modals
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  const nextTrack = useMemo(() => {
    if (!currentId || queue.length === 0) return null;
    const currentIndex = queue.indexOf(currentId);
    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      return tracks.find((t) => t.id === queue[currentIndex + 1]) ?? null;
    }
    if (repeat === 'all' && queue.length > 0) {
      return tracks.find((t) => t.id === queue[0]) ?? null;
    }
    return null;
  }, [currentId, queue, tracks, repeat]);

  const totalDuration = durationMs || track?.durationMs || 0;
  const currentPos = preview ?? positionMs;
  const progressRatio = totalDuration > 0 ? Math.max(0, Math.min(1, currentPos / totalDuration)) : 0;

  const navigateToAlbum = () => {
    if (!track) return;
    const allAlbums = groupAlbums(tracks);
    const matched = allAlbums.find((a) => a.tracks.some((t) => t.id === track.id));
    if (matched) {
      router.back();
      router.push({ pathname: '/album', params: { group: matched.key } } as never);
    }
  };

  const artworkSize = Math.min(width - 56, height * 0.42, 420);

  if (!track) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: topInset + 16 }}>
        <Pressable onPress={() => router.back()} style={{ padding: 10, alignSelf: 'flex-start' }}>
          <Ionicons name="chevron-down" size={28} color="white" />
        </Pressable>
        <Empty title="Nothing playing" detail="Choose a track from your library to start listening." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingHorizontal: 28, paddingTop: topInset + 12, paddingBottom: Math.max(insets.bottom, 24) + 12 }}>
      <ToastBanner />

      {/* Top Header Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close player" hitSlop={10} style={{ padding: 8 }}>
          <Ionicons name="chevron-down" size={26} color="white" />
        </Pressable>

        <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 3, fontWeight: '700' }}>
          VRISH MUSIC · NOW PLAYING
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={() => setMenuVisible(true)}
            accessibilityLabel="Track options"
            hitSlop={10}
            style={{ padding: 8 }}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color="white" />
          </Pressable>

          <Pressable
            onPress={() => toggleFavorite(track.id)}
            accessibilityLabel="Toggle favorite"
            hitSlop={10}
            style={{ padding: 8 }}
          >
            <Ionicons
              name={track.favorite ? 'heart' : 'heart-outline'}
              size={22}
              color={track.favorite ? 'white' : colors.secondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Middle Area with Animated Artwork & Title */}
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <PlayerArtwork
            track={track}
            size={artworkSize}
            playing={playing}
            onSwipeNext={() => void skip(1)}
            onSwipePrev={() => void skip(-1)}
          />
        </View>

        {/* Title & Artist & Album info */}
        <Animated.View key={`meta-${track.id}`} entering={FadeIn.duration(250)} style={{ marginBottom: 20 }}>
          <Text numberOfLines={2} style={{ color: 'white', fontSize: 26, fontWeight: '700', letterSpacing: -0.5 }}>
            {track.title}
          </Text>
          <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 16, marginTop: 6, fontWeight: '500' }}>
            {track.artist}
          </Text>
          <Pressable onPress={navigateToAlbum} hitSlop={6} style={{ alignSelf: 'flex-start' }}>
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>
              {track.album}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Progress / Scrubber Bar */}
      <View style={{ marginBottom: 24 }}>
        <View
          onLayout={(e) => setSeekWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => {
            const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekWidth));
            setPreview(ratio * totalDuration);
          }}
          onResponderMove={(e) => {
            const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekWidth));
            setPreview(ratio * totalDuration);
          }}
          onResponderRelease={(e) => {
            const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / seekWidth));
            const target = ratio * totalDuration;
            setPreview(null);
            if (totalDuration > 0) void seekTo(target);
          }}
          accessibilityRole="adjustable"
          accessibilityLabel="Seek position"
          style={{ height: 36, justifyContent: 'center' }}
        >
          {/* Base track */}
          <View style={{ height: 4, backgroundColor: '#242424', borderRadius: 2, position: 'relative' }}>
            {/* Filled progress */}
            <View style={{ width: `${progressRatio * 100}%`, height: 4, backgroundColor: 'white', borderRadius: 2 }} />
            {/* Scrubber thumb knob */}
            <View
              style={{
                position: 'absolute',
                left: `${progressRatio * 100}%`,
                top: -5,
                marginLeft: -7,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: 'white',
                shadowColor: '#000',
                shadowOpacity: 0.4,
                shadowRadius: 4,
                elevation: 4,
              }}
            />
          </View>
        </View>

        {/* Elapsed & Total/Remaining Time */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 }}>
          <Text style={{ color: colors.secondary, fontSize: 12, fontVariant: ['tabular-nums'] }}>
            {formatDuration(currentPos)}
          </Text>
          <Pressable onPress={() => setShowRemaining(!showRemaining)} hitSlop={8}>
            <Text style={{ color: colors.secondary, fontSize: 12, fontVariant: ['tabular-nums'] }}>
              {showRemaining
                ? `-${formatDuration(Math.max(0, totalDuration - currentPos))}`
                : formatDuration(totalDuration)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Playback Controls: Shuffle, Previous, Play/Pause, Next, Repeat */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        {/* Shuffle Button */}
        <Pressable
          accessibilityLabel={`Shuffle ${shuffle ? 'on' : 'off'}`}
          onPress={toggleShuffle}
          hitSlop={8}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="shuffle" size={24} color={shuffle ? 'white' : '#555555'} />
        </Pressable>

        {/* Previous Button */}
        <Pressable
          accessibilityLabel="Previous track"
          onPress={() => void skip(-1)}
          hitSlop={8}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#0D0D0D',
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="play-skip-back" size={22} color="white" />
        </Pressable>

        {/* Play / Pause Main Button */}
        <Pressable
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          onPress={togglePlayback}
          style={{
            width: 74,
            height: 74,
            borderRadius: 37,
            backgroundColor: 'white',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#fff',
            shadowOpacity: 0.15,
            shadowRadius: 10,
            elevation: 6,
          }}
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={32} color="black" />
        </Pressable>

        {/* Next Button */}
        <Pressable
          accessibilityLabel="Next track"
          onPress={() => void skip(1)}
          hitSlop={8}
          style={{
            width: 52,
            height: 52,
            borderRadius: 26,
            backgroundColor: '#0D0D0D',
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="play-skip-forward" size={22} color="white" />
        </Pressable>

        {/* Repeat Button */}
        <Pressable
          accessibilityLabel={`Repeat mode: ${repeat}`}
          onPress={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')}
          hitSlop={8}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons
              name={repeat === 'one' ? 'repeat' : 'repeat'}
              size={24}
              color={repeat === 'off' ? '#555555' : 'white'}
            />
            {repeat === 'one' && (
              <View
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -5,
                  backgroundColor: 'white',
                  borderRadius: 6,
                  width: 12,
                  height: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'black', fontSize: 8, fontWeight: '900' }}>1</Text>
              </View>
            )}
          </View>
        </Pressable>
      </View>

      {/* Bottom Bar: Queue button and "Up next" preview */}
      <Pressable
        onPress={() => router.push('/queue' as never)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#121212',
          borderRadius: 24,
          paddingVertical: 10,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="list" size={20} color="white" style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
            {nextTrack ? `Up next: ${nextTrack.title}` : `Queue (${queue.length} tracks)`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.secondary} />
      </Pressable>

      {/* Modals */}
      <TrackMenuModal
        track={track}
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        onShowDetails={() => setInfoVisible(true)}
        onShowPlaylistPicker={() => setPlaylistPickerVisible(true)}
      />

      <TrackInfoModal track={track} visible={infoVisible} onClose={() => setInfoVisible(false)} />

      <PlaylistPickerModal
        track={track}
        visible={playlistPickerVisible}
        onClose={() => setPlaylistPickerVisible(false)}
        onCreateNew={() => setCreatePlaylistVisible(true)}
      />

      <CreatePlaylistModal visible={createPlaylistVisible} onClose={() => setCreatePlaylistVisible(false)} initialTrack={track} />
    </View>
  );
}
