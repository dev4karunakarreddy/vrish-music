import React from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@noir/theme';
import { MiniPlayer } from '../../src/MiniPlayer';
import { TopGradientFade } from '../../src/TopGradientFade';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabHeight = 60 + insets.bottom;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: tabHeight,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarIconStyle: { marginBottom: 2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: 'Search',
            tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: 'Library',
            tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" color={String(color)} size={size} />,
          }}
        />
        <Tabs.Screen
          name="playlists"
          options={{
            title: 'Playlists',
            tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" color={String(color)} size={size} />,
          }}
        />
      </Tabs>
      <TopGradientFade />
      <View style={{ position: 'absolute', bottom: tabHeight + 8, left: 0, right: 0 }} pointerEvents="box-none">
        <MiniPlayer />
      </View>
    </View>
  );
}
