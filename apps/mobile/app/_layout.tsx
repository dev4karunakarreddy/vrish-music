import React, { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@noir/theme';
import { refreshMissingMetadata } from '../src/metadata';
import { removeShortImportedTracks, syncMusicFolders } from '../src/library';
import { LogoSplash } from '../src/LogoSplash';

export default function Root() {
  const [showIntro, setShowIntro] = useState(true);

  const handleIntroFinish = useCallback(() => {
    setShowIntro(false);
    // Defer heavy database & file operations until after the intro is completely done
    setTimeout(() => {
      void refreshMissingMetadata().then(() => removeShortImportedTracks());
      setTimeout(() => {
        void syncMusicFolders(true);
      }, 500);
    }, 120);
  }, []);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncMusicFolders(false);
    });
    return () => {
      appState.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="player" options={{ presentation: 'modal' }} />
        <Stack.Screen name="queue" />
        <Stack.Screen name="album" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-track" options={{ presentation: 'modal' }} />
      </Stack>
      {showIntro && <LogoSplash onFinish={handleIntroFinish} />}
    </GestureHandlerRootView>
  );
}
