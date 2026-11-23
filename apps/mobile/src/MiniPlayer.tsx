import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors } from '@noir/theme';
import { Artwork } from './ui';
import { useMusic } from './store';
import { skip, togglePlayback } from './audio';

// Isolated progress bar: only this micro-component re-renders on positionMs updates (every 250ms),
// preventing the entire MiniPlayer, artwork, and buttons from re-rendering 4 times a second.
function MiniPlayerProgressBar({ trackDuration }: { trackDuration: number }) {
  const positionMs = useMusic((s) => s.positionMs);
  const durationMs = useMusic((s) => s.durationMs);
  const total = durationMs || trackDuration || 0;
  const progress = total > 0 ? Math.min(100, (positionMs / total) * 100) : 0;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#202020' }}>
      <View style={{ width: `${progress}%`, height: 2, backgroundColor: 'white' }} />
    </View>
  );
}

export function MiniPlayer() {
  const router = useRouter();
  const tracks = useMusic((s) => s.tracks);
  const currentId = useMusic((s) => s.currentId);
  const playing = useMusic((s) => s.playing);
  const track = tracks.find((item) => item.id === currentId);

  const artScale = useSharedValue(1);

  useEffect(() => {
    artScale.value = withSpring(playing ? 1 : 0.94, { damping: 16, stiffness: 140 });
  }, [playing, artScale]);

  const artAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: artScale.value }],
  }));

  if (!track) return null;

  return (
    <Pressable
      onPress={() => router.push('/player')}
      accessibilityRole="button"
      accessibilityLabel={`Now playing ${track.title} by ${track.artist}`}
      style={{
        height: 66,
        marginHorizontal: 12,
        overflow: 'hidden',
        backgroundColor: '#0E0E0E',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      {/* Top Progress bar isolated from main player render cycle */}
      <MiniPlayerProgressBar trackDuration={track.durationMs} />

      <Animated.View key={track.id} entering={FadeIn.duration(200)} style={artAnimatedStyle}>
        <Artwork track={track} size={46} />
      </Animated.View>

      <View style={{ flex: 1, minWidth: 0, marginLeft: 12, marginRight: 6 }}>
        <Text numberOfLines={1} style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 12, marginTop: 3 }}>
          {track.artist}
        </Text>
      </View>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          togglePlayback();
        }}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause' : 'Play'}
        hitSlop={6}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: 'white',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        }}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color="black" />
      </Pressable>

      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          void skip(1);
        }}
        accessibilityRole="button"
        accessibilityLabel="Next track"
        hitSlop={6}
        style={{ width: 38, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: 2 }}
      >
        <Ionicons name="play-skip-forward" size={19} color="white" />
      </Pressable>
    </Pressable>
  );
}
