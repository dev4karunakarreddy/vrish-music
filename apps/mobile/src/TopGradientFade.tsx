import React from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@noir/theme';

export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  const androidStatus = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  return Math.max(insets.top, androidStatus, 32);
}

interface TopGradientFadeProps {
  height?: number;
}

export function TopGradientFade({ height }: TopGradientFadeProps) {
  const topInset = useTopInset();
  const fadeHeight = height ?? topInset + 36;
  const solidRatio = Math.max(0.1, Math.min(topInset / fadeHeight, 0.7));

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        { height: fadeHeight },
      ]}
    >
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id="topFadeGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} stopOpacity="1" />
            <Stop offset={solidRatio.toFixed(3)} stopColor={colors.background} stopOpacity="1" />
            <Stop offset={Math.min(1, solidRatio + 0.15).toFixed(3)} stopColor={colors.background} stopOpacity="0.75" />
            <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#topFadeGradient)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
  },
});
