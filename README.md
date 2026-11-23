# VRISH MUSIC

VRISH MUSIC is an offline mobile music player built with Expo, React Native, TypeScript, Expo Audio, and SQLite. It plays audio stored on the device and keeps the library and playback state locally.

## Features

- Import individual audio files on Android and iOS.
- Index audio from Android's Music and Downloads folders.
- Browse songs, albums, artists, favorites, and custom playlists.
- Search and sort the library, including by composer.
- Play, pause, seek, skip, shuffle, repeat, and manage the queue.
- Show embedded artwork and metadata in the player and Android media controls.

## Project layout

- `apps/mobile`: Expo app and Android native project.
- `packages/types`: shared playback and library types.
- `packages/theme`: shared design tokens.

## Development

Install Node.js 22 and enable Corepack, then run:

```sh
corepack pnpm install
corepack pnpm --filter @noir/mobile android
```

On macOS with Xcode, use `corepack pnpm --filter @noir/mobile ios`. For an Expo preview, run `corepack pnpm mobile`. Native background audio and system media controls require a native build.

## Checks

```sh
corepack pnpm typecheck
corepack pnpm test
corepack pnpm export:android
```

## Status

Android playback has been exercised on a device. iOS native playback and system media controls still need device validation. Release APKs are built by the GitHub Actions workflow; its current Android release configuration uses the development signing key and is intended for testing.

See [REPOLOG.md](REPOLOG.md) for repository history and [Expo Audio documentation](https://docs.expo.dev/versions/latest/sdk/audio/) for the audio API.
