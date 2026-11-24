import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@noir/theme';
import { refreshMissingMetadata } from '../src/metadata';
import { removeShortImportedTracks, syncMusicFolders } from '../src/library';

export default function Root() {
  useEffect(() => {
    // Run background sync on startup with a slight delay so UI renders instantly
    const t = setTimeout(() => {
      void refreshMissingMetadata().then(() => removeShortImportedTracks());
      setTimeout(() => {
        void syncMusicFolders(true);
      }, 500);
    }, 200);

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncMusicFolders(false);
    });

    return () => {
      clearTimeout(t);
      appState.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
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
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
