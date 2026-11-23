import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  useWindowDimensions,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import Svg, {
  Path,
  G,
  Defs,
  RadialGradient,
  LinearGradient,
  Stop,
  Rect,
} from 'react-native-svg';
import { gsap } from 'gsap';

interface LogoSplashProps {
  onFinish: () => void;
}

export function LogoSplash({ onFinish }: LogoSplashProps) {
  const { width } = useWindowDimensions();
  const [motionDisabled, setMotionDisabled] = useState(false);
  const [frame, setFrame] = useState({
    orbits: 0, emblem: 0, letters: 0, image: 0, subtitle: 0,
    aura: 0.2, sheen: 0, exit: 0,
  });
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const finishedRef = useRef(false);

  const triggerFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const dismissImmediately = useCallback(() => {
    timelineRef.current?.kill();
    triggerFinish();
  }, [triggerFinish]);

  useEffect(() => {
    let mounted = true;
    let timeline: gsap.core.Timeline | null = null;
    const values = {
      orbits: 0, emblem: 0, letters: 0, image: 0, subtitle: 0,
      aura: 0.2, sheen: 0, exit: 0,
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!mounted) return;
      if (reduced) {
        setMotionDisabled(true);
        triggerFinish();
        return;
      }

      let rafPending = false;
      timeline = gsap.timeline({
        onUpdate: () => {
          if (!mounted || rafPending) return;
          rafPending = true;
          requestAnimationFrame(() => {
            rafPending = false;
            if (mounted) setFrame({ ...values });
          });
        },
        onComplete: triggerFinish,
      });
      timelineRef.current = timeline;
      timeline
        .to(values, { aura: 0.8, duration: 1, ease: 'power2.out' }, 0)
        .to(values, { orbits: 1, duration: 0.75, ease: 'expo.out' }, 0)
        .to(values, { emblem: 1, duration: 0.7, ease: 'expo.out' }, 0.15)
        .to(values, { letters: 1, duration: 0.65, ease: 'power3.out' }, 0.35)
        .to(values, { subtitle: 1, duration: 0.45, ease: 'power3.out' }, 0.6)
        .to(values, { image: 1, duration: 0.48, ease: 'power2.out' }, 0.78)
        .to(values, { sheen: 1, duration: 0.6, ease: 'power2.inOut' }, 0.82)
        .to(values, { exit: 1, duration: 0.36, ease: 'power2.inOut' }, 1.5);
    });

    return () => {
      mounted = false;
      timeline?.kill();
      timelineRef.current = null;
    };
  }, [triggerFinish]);

  const containerStyle = {
    opacity: 1 - frame.exit,
    transform: [{ scale: 1 + frame.exit * 0.06 }],
  };
  const auraStyle = {
    opacity: frame.aura * (1 - frame.image * 0.5),
    transform: [{ scale: 0.85 + (frame.aura - 0.2) * 0.5 }],
  };
  const imageStyle = {
    opacity: frame.image,
    transform: [{ scale: 0.96 + frame.image * 0.04 }],
  };
  const drawingStyle = { opacity: 1 - frame.image };
  const subtitleStyle = {
    opacity: frame.subtitle,
    transform: [
      { translateY: 8 * (1 - frame.subtitle) },
      { scale: 0.92 + frame.subtitle * 0.08 },
    ],
  };
  const sheenOpacity = frame.sheen < 0.2
    ? frame.sheen * 3.25
    : frame.sheen > 0.8 ? (1 - frame.sheen) * 3.25 : 0.65;
  const sheenStyle = {
    transform: [{ translateX: -260 + frame.sheen * 520 }, { rotate: '25deg' as const }],
    opacity: sheenOpacity,
  };

  if (motionDisabled) return null;

  const logoDimension = Math.min(width * 0.82, 340);

  return (
    <Pressable
      onPress={dismissImmediately}
      accessibilityRole="button"
      accessibilityLabel="Skip intro animation"
      style={StyleSheet.absoluteFill}
    >
      <View style={[styles.root, containerStyle]}>
        {/* Soft Ambient Radial Aura Background */}
        <View style={[styles.auraContainer, auraStyle]}>
          <Svg width={logoDimension * 1.4} height={logoDimension * 1.4} viewBox="0 0 400 400">
            <Defs>
              <RadialGradient id="ambientGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
                <Stop offset="45%" stopColor="#737373" stopOpacity="0.06" />
                <Stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="400" height="400" fill="url(#ambientGlow)" />
          </Svg>
        </View>

        {/* Center Container */}
        <View style={{ width: logoDimension, height: logoDimension + 40, alignItems: 'center', justifyContent: 'center' }}>
          {/* GSAP SVG Stroke Drawing Canvas */}
          <View style={[StyleSheet.absoluteFill, drawingStyle]} pointerEvents="none">
          <Svg
            width={logoDimension}
            height={logoDimension}
            viewBox="0 0 300 300"
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <LinearGradient id="strokeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" />
                <Stop offset="60%" stopColor="#EDEDED" />
                <Stop offset="100%" stopColor="#A3A3A3" />
              </LinearGradient>
              <LinearGradient id="accentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#525252" stopOpacity="0.5" />
              </LinearGradient>
            </Defs>

            {/* 1. Acoustic Orbital Sound Arcs & Equalizer Rays */}
            <G stroke="url(#accentGrad)" strokeWidth={2.2} strokeLinecap="round" fill="none">
              {/* Outer top acoustic arc */}
              <Path
                d="M 45 130 A 110 110 0 0 1 255 130"
                strokeDasharray={400}
                strokeDashoffset={400 * (1 - frame.orbits)}
              />
              {/* Lower counter arc */}
              <Path
                d="M 245 155 A 98 98 0 0 1 55 155"
                strokeDasharray={400}
                strokeDashoffset={400 * (1 - frame.orbits)}
              />
              {/* Left equalizer frequencies */}
              <Path
                d="M 32 115 L 56 115 M 22 130 L 52 130 M 32 145 L 56 145"
                strokeDasharray={400}
                strokeDashoffset={400 * (1 - frame.orbits)}
              />
              {/* Right equalizer frequencies */}
              <Path
                d="M 244 115 L 268 115 M 248 130 L 278 130 M 244 145 L 268 145"
                strokeDasharray={400}
                strokeDashoffset={400 * (1 - frame.orbits)}
              />
            </G>

            {/* 2. Central Dynamic "V" Monogram Crest */}
            <G stroke="url(#strokeGrad)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none">
              {/* Outer V wings */}
              <Path
                d="M 80 82 L 150 200 L 220 82"
                strokeDasharray={350}
                strokeDashoffset={350 * (1 - frame.emblem)}
              />
              {/* Middle inner wing */}
              <Path
                d="M 102 86 L 150 172 L 198 86"
                strokeDasharray={350}
                strokeDashoffset={350 * (1 - frame.emblem)}
              />
              {/* Core prism V */}
              <Path
                d="M 124 90 L 150 142 L 176 90"
                strokeDasharray={350}
                strokeDashoffset={350 * (1 - frame.emblem)}
              />
              {/* Center vertical frequency needle */}
              <Path
                d="M 150 50 L 150 105"
                strokeDasharray={350}
                strokeDashoffset={350 * (1 - frame.emblem)}
              />
            </G>

            {/* 3. Letter Strokes: "VRISH" */}
            <G stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none">
              {/* V */}
              <Path
                d="M 44 232 L 64 274 L 84 232"
                strokeDasharray={200}
                strokeDashoffset={200 * (1 - frame.letters)}
              />
              {/* R */}
              <Path
                d="M 102 274 L 102 232 L 122 232 C 134 232 134 250 122 250 L 102 250 M 116 250 L 132 274"
                strokeDasharray={200}
                strokeDashoffset={200 * (1 - frame.letters)}
              />
              {/* I */}
              <Path
                d="M 150 232 L 150 274 M 142 232 L 158 232 M 142 274 L 158 274"
                strokeDasharray={200}
                strokeDashoffset={200 * (1 - frame.letters)}
              />
              {/* S */}
              <Path
                d="M 194 240 C 190 234 182 232 175 232 C 166 232 162 238 162 244 C 162 254 194 252 194 262 C 194 268 188 274 175 274 C 165 274 160 268 158 262"
                strokeDasharray={200}
                strokeDashoffset={200 * (1 - frame.letters)}
              />
              {/* H */}
              <Path
                d="M 216 232 L 216 274 M 240 232 L 240 274 M 216 253 L 240 253"
                strokeDasharray={200}
                strokeDashoffset={200 * (1 - frame.letters)}
              />
            </G>
          </Svg>
          </View>

          {/* High-Resolution Brand Artwork Cross-fade */}
          <View
            pointerEvents="none"
            style={[
              {
                width: logoDimension,
                height: logoDimension,
                position: 'absolute',
                top: 0,
                alignItems: 'center',
                justifyContent: 'center',
              },
              imageStyle,
            ]}
          >
            <Image
              source={require('../assets/vrish.png')}
              resizeMode="contain"
              style={{ width: logoDimension, height: logoDimension }}
              accessibilityLabel="VRISH MUSIC emblem"
            />

            {/* Specular Light Sweep Sheen */}
            <View
              style={[
                {
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 90,
                },
                sheenStyle,
              ]}
            >
              <Svg width="100%" height="100%">
                <Defs>
                  <LinearGradient id="sheen" x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                    <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.45" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="100%" fill="url(#sheen)" />
              </Svg>
            </View>
          </View>

          {/* Elegant Subtitle Reveal */}
          <View style={[styles.subtitleContainer, subtitleStyle]}>
            <Text style={styles.subtitleText}>M U S I C</Text>
            <View style={styles.subline} />
          </View>
        </View>

        {/* Subtle Bottom Watermark */}
        <View style={styles.bottomBrand}>
          <Text style={styles.bottomText}>PURE LOSSLESS SOUND</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  auraContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitleContainer: {
    position: 'absolute',
    bottom: -8,
    alignItems: 'center',
  },
  subtitleText: {
    color: '#D4D4D4',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 9,
  },
  subline: {
    width: 32,
    height: 1.5,
    backgroundColor: '#FFFFFF',
    marginTop: 6,
    borderRadius: 1,
    opacity: 0.7,
  },
  bottomBrand: {
    position: 'absolute',
    bottom: 42,
    alignItems: 'center',
  },
  bottomText: {
    color: '#525252',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 4,
  },
});
