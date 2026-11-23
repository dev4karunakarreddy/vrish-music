import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
} from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@noir/theme';
import type { Track } from '@noir/types';

interface PlayerArtworkProps {
  track: Track;
  size: number;
  playing: boolean;
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
}

export function PlayerArtwork({
  track,
  size,
  playing,
  onSwipeNext,
  onSwipePrev,
}: PlayerArtworkProps) {
  // Gesture & physics shared values
  const translateX = useSharedValue(0);
  const dragActive = useSharedValue(false);

  // Entrance & playback physics
  const enterScale = useSharedValue(0.91);
  const enterTranslateY = useSharedValue(18);
  const enterOpacity = useSharedValue(0);

  // Play/pause scale & elevation
  const playScale = useSharedValue(playing ? 1 : 0.95);

  // Specular sheen sweep driver (0 -> 1)
  const sheen = useSharedValue(0);

  // Ambient underglow breathing
  const auraScale = useSharedValue(1);
  const auraOpacity = useSharedValue(0.12);

  // Tap compression
  const tapScale = useSharedValue(1);

  // Trigger entrance & sheen whenever track changes
  useEffect(() => {
    // Reset entrance
    enterScale.value = 0.91;
    enterTranslateY.value = 18;
    enterOpacity.value = 0;
    sheen.value = 0;
    translateX.value = 0;

    // Smooth spring entrance
    enterScale.value = withSpring(1, { damping: 16, stiffness: 120, mass: 0.8 });
    enterTranslateY.value = withSpring(0, { damping: 18, stiffness: 130 });
    enterOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.quad) });

    // Specular sheen light sweep (GSAP-like angled sheen)
    sheen.value = withDelay(
      140,
      withTiming(1, {
        duration: 650,
        easing: Easing.inOut(Easing.cubic),
      })
    );
  }, [track.id, enterScale, enterTranslateY, enterOpacity, sheen, translateX]);

  // Handle play/pause dynamic changes
  useEffect(() => {
    playScale.value = withSpring(playing ? 1 : 0.95, {
      damping: 18,
      stiffness: 110,
    });

    if (playing) {
      auraOpacity.value = withTiming(0.24, { duration: 600 });
      auraScale.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.97, { duration: 2200, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    } else {
      auraOpacity.value = withTiming(0.06, { duration: 500 });
      auraScale.value = withTiming(0.96, { duration: 500 });
    }
  }, [playing, playScale, auraOpacity, auraScale]);

  // Swipe gesture for skipping tracks
  const panGesture = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-24, 24])
    .onBegin(() => {
      dragActive.value = true;
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      dragActive.value = false;
      const swipeDistance = event.translationX;
      const velocity = event.velocityX;

      if (swipeDistance < -70 || velocity < -550) {
        // Swipe Left -> Next Track
        translateX.value = withTiming(-size * 1.1, { duration: 160 }, () => {
          translateX.value = 0;
          if (onSwipeNext) runOnJS(onSwipeNext)();
        });
      } else if (swipeDistance > 70 || velocity > 550) {
        // Swipe Right -> Prev Track
        translateX.value = withTiming(size * 1.1, { duration: 160 }, () => {
          translateX.value = 0;
          if (onSwipePrev) runOnJS(onSwipePrev)();
        });
      } else {
        // Snap back to center
        translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    });

  const handleTap = () => {
    tapScale.value = withSequence(
      withTiming(0.96, { duration: 90 }),
      withSpring(1, { damping: 14, stiffness: 200 })
    );
  };

  // Animated cover art transform
  const cardStyle = useAnimatedStyle(() => {
    const rotZ = interpolate(translateX.value, [-size, size], [-10, 10]);
    const dragScaleFactor = interpolate(
      Math.abs(translateX.value),
      [0, size],
      [1, 0.94]
    );

    return {
      opacity: enterOpacity.value,
      transform: [
        { translateX: translateX.value },
        { translateY: enterTranslateY.value },
        { scale: enterScale.value * playScale.value * tapScale.value * dragScaleFactor },
        { rotateZ: `${rotZ}deg` },
      ],
    };
  });

  // Animated ambient aura glow
  const auraStyle = useAnimatedStyle(() => ({
    opacity: auraOpacity.value * enterOpacity.value,
    transform: [{ scale: auraScale.value }],
  }));

  // Animated specular sheen sweep
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(sheen.value, [0, 1], [-size * 1.2, size * 1.4]),
      },
    ],
    opacity: interpolate(sheen.value, [0, 0.2, 0.7, 1], [0, 0.55, 0.55, 0]),
  }));

  const borderRadius = Math.round(size * 0.05);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      {/* 1. Ambient Underglow Aura (Backlight Bloom) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.aura,
          {
            width: size * 1.22,
            height: size * 1.22,
            borderRadius: (size * 1.22) / 2,
          },
          auraStyle,
        ]}
      >
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="backlight" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.32" />
              <Stop offset="50%" stopColor="#A3A3A3" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill="url(#backlight)" />
        </Svg>
      </Animated.View>

      {/* 2. Interactive Gesture Card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.card,
            {
              width: size,
              height: size,
              borderRadius,
              shadowOpacity: playing ? 0.35 : 0.12,
              shadowRadius: playing ? 28 : 14,
              elevation: playing ? 16 : 6,
            },
            cardStyle,
          ]}
        >
          <Pressable onPress={handleTap} style={{ flex: 1, borderRadius, overflow: 'hidden' }}>
            {track.artworkUri ? (
              <Image
                source={{ uri: track.artworkUri }}
                style={{ width: size, height: size, borderRadius }}
                resizeMode="cover"
                accessibilityLabel={`${track.title} album cover`}
              />
            ) : (
              /* Fallback Vinyl Disc Graphic in Noir Monochrome */
              <View
                style={[
                  styles.fallbackContainer,
                  { width: size, height: size, borderRadius },
                ]}
              >
                <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 100 100">
                  <Defs>
                    <RadialGradient id="vinylGrad" cx="50%" cy="50%" r="50%">
                      <Stop offset="0%" stopColor="#262626" />
                      <Stop offset="40%" stopColor="#121212" />
                      <Stop offset="80%" stopColor="#1E1E1E" />
                      <Stop offset="100%" stopColor="#0A0A0A" />
                    </RadialGradient>
                  </Defs>
                  {/* Outer Vinyl Disc */}
                  <Circle cx="50" cy="50" r="48" fill="url(#vinylGrad)" stroke="#333333" strokeWidth="1" />
                  {/* Groove Rings */}
                  <Circle cx="50" cy="50" r="40" fill="none" stroke="#2B2B2B" strokeWidth="0.8" />
                  <Circle cx="50" cy="50" r="32" fill="none" stroke="#262626" strokeWidth="0.8" />
                  <Circle cx="50" cy="50" r="24" fill="none" stroke="#333333" strokeWidth="0.8" />
                  {/* Center Label */}
                  <Circle cx="50" cy="50" r="16" fill="#000000" stroke="#FFFFFF" strokeWidth="1" />
                  {/* Spindle hole */}
                  <Circle cx="50" cy="50" r="3.5" fill="#FFFFFF" />
                </Svg>
              </View>
            )}

            {/* Specular Glare / Sheen Ribbon Sweep */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.sheenRibbon,
                {
                  height: size * 1.6,
                  width: Math.max(70, Math.round(size * 0.28)),
                  transform: [{ rotate: '25deg' }],
                },
                sheenStyle,
              ]}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="coverSheen" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                    <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.45" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#coverSheen)" />
              </Svg>
            </Animated.View>

            {/* Subtle Inner Bevel Border */}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  borderRadius,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                },
              ]}
            />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aura: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#121212',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 10 },
  },
  fallbackContainer: {
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheenRibbon: {
    position: 'absolute',
    top: -40,
    left: 0,
  },
});
