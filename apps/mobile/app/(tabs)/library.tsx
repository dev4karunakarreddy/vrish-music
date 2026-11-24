import React, { useMemo, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Pressable,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@noir/theme';
import { groupAlbums, type AlbumGroup } from '../../src/albums';
import { groupArtists, type ArtistGroup } from '../../src/artists';
import { sortSongs, sortAlbums, sortArtists } from '../../src/sort';
import {
  Artwork,
  Empty,
  Heading,
  TrackRow,
  SortModal,
  TrackMenuModal,
  TrackInfoModal,
  PlaylistPickerModal,
  CreatePlaylistModal,
  ToastBanner,
} from '../../src/ui';
import { useMusic } from '../../src/store';
import { importAudioFiles, removeShortImportedTracks, syncMusicFolders, checkFileExists } from '../../src/library';
import { refreshMissingMetadata } from '../../src/metadata';
import { playTrack, toggleShuffle } from '../../src/audio';
import type { Track, SongSortMode, AlbumSortMode, ArtistSortMode, SortDirection } from '@noir/types';

export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const tracks = useMusic((s) => s.tracks);
  const refresh = useMusic((s) => s.refresh);
  const error = useMusic((s) => s.error);
  const setError = useMusic((s) => s.setError);
  const shuffle = useMusic((s) => s.shuffle);

  const [view, setView] = useState<'Songs' | 'Albums' | 'Artists'>('Songs');
  const [busy, setBusy] = useState(false);

  // Sorting state
  const [songSortMode, setSongSortMode] = useState<SongSortMode>('title');
  const [songSortDirection, setSongSortDirection] = useState<SortDirection>('asc');

  const [albumSortMode, setAlbumSortMode] = useState<AlbumSortMode>('title');
  const [albumSortDirection, setAlbumSortDirection] = useState<SortDirection>('asc');

  const [artistSortMode, setArtistSortMode] = useState<ArtistSortMode>('name');
  const [artistSortDirection, setArtistSortDirection] = useState<SortDirection>('asc');

  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Modals
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  // Filtered & sorted data
  const sortedTracks = useMemo(
    () => sortSongs(tracks, songSortMode, songSortDirection),
    [tracks, songSortMode, songSortDirection],
  );

  const rawAlbums = useMemo(() => groupAlbums(tracks), [tracks]);
  const sortedAlbums = useMemo(
    () => sortAlbums(rawAlbums, albumSortMode, albumSortDirection),
    [rawAlbums, albumSortMode, albumSortDirection],
  );

  const rawArtists = useMemo(() => groupArtists(tracks), [tracks]);
  const sortedArtists = useMemo(
    () => sortArtists(rawArtists, artistSortMode, artistSortDirection),
    [rawArtists, artistSortMode, artistSortDirection],
  );

  const missingIds = useMemo(
    () => new Set(tracks.filter((t) => !checkFileExists(t.uri)).map((t) => t.id)),
    [tracks],
  );
  const missing = missingIds.size;

  const add = async () => {
    setBusy(true);
    try {
      await importAudioFiles();
      refresh();
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const rescan = async () => {
    setBusy(true);
    try {
      await refreshMissingMetadata();
      removeShortImportedTracks();
      const sync = await syncMusicFolders(true, true);
      refresh();
      const count = useMusic.getState().tracks.filter((t) => !checkFileExists(t.uri)).length;
      const details = sync.permissionDenied
        ? 'Allow Music and audio access in Android settings to sync your folders.'
        : `${sync.imported} new track${sync.imported === 1 ? '' : 's'} added${
            sync.short ? ` · ${sync.short} track${sync.short === 1 ? '' : 's'} skipped (33s or shorter)` : ''
          }`;
      Alert.alert(
        'Library sync complete',
        count ? `${details}. ${count} imported file${count === 1 ? ' is' : 's are'} missing.` : details,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleShuffleSongs = () => {
    if (sortedTracks.length === 0) return;
    const randomTrack = sortedTracks[Math.floor(Math.random() * sortedTracks.length)];
    if (!shuffle) toggleShuffle();
    void playTrack(randomTrack, sortedTracks);
  };

  const openTrackMenu = (track: Track) => {
    setSelectedTrack(track);
    setMenuVisible(true);
  };

  const sortButtonLabel = useMemo(() => {
    if (view === 'Songs') {
      const modeNames: Record<SongSortMode, string> = {
        title: 'Title',
        artist: 'Artist',
        album: 'Album',
        duration: 'Duration',
        addedAt: 'Date added',
      };
      return `${modeNames[songSortMode]} (${songSortDirection === 'asc' ? 'A-Z' : 'Z-A'})`;
    }
    if (view === 'Albums') {
      const modeNames: Record<AlbumSortMode, string> = {
        title: 'Title',
        artist: 'Artist',
        trackCount: 'Tracks',
        addedAt: 'Date added',
      };
      return `${modeNames[albumSortMode]}`;
    }
    const modeNames: Record<ArtistSortMode, string> = {
      name: 'Name',
      trackCount: 'Songs',
    };
    return `${modeNames[artistSortMode]}`;
  }, [view, songSortMode, songSortDirection, albumSortMode, artistSortMode]);

  const header = (
    <View style={{ marginBottom: 16 }}>
      {/* Top Title & Actions */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Heading eyebrow="YOUR COLLECTION" title="Library" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable
            disabled={busy}
            onPress={() => void rescan()}
            accessibilityLabel="Sync Music and Downloads folders"
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="sync-outline" size={20} color={colors.secondary} />
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={() => void add()}
            accessibilityLabel="Import audio files"
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={26} color="white" />
          </Pressable>
        </View>
      </View>

      {/* Tabs: Songs, Albums, Artists */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        {(['Songs', 'Albums', 'Artists'] as const).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              marginRight: 8,
              borderRadius: 20,
              backgroundColor: view === v ? colors.elevated : 'transparent',
              borderWidth: 1,
              borderColor: view === v ? colors.border : 'transparent',
            }}
          >
            <Text style={{ color: view === v ? 'white' : colors.secondary, fontWeight: '600', fontSize: 13 }}>{v}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text style={{ color: 'white', marginBottom: 12 }}>{error}</Text>}

      {/* Sort & Quick Filter Bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.secondary, fontSize: 11, letterSpacing: 1.5, fontWeight: '600' }}>
          {view === 'Songs' && `${tracks.length} TRACKS${missing ? ` · ${missing} MISSING` : ''}`}
          {view === 'Albums' && `${sortedAlbums.length} ALBUMS`}
          {view === 'Artists' && `${sortedArtists.length} ARTISTS`}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {view === 'Songs' && tracks.length > 0 && (
            <TouchableOpacity
              onPress={handleShuffleSongs}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 14,
                backgroundColor: '#161616',
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Ionicons name="shuffle" size={13} color="white" style={{ marginRight: 4 }} />
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>Shuffle</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setSortModalVisible(true)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 14,
              backgroundColor: '#161616',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="filter-outline" size={13} color={colors.secondary} style={{ marginRight: 4 }} />
            <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '600' }}>{sortButtonLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ToastBanner />

      {view === 'Songs' && (
        <FlatList
          key="songs"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: 130 }}
          data={sortedTracks}
          keyExtractor={(t) => t.id}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          getItemLayout={(data, index) => ({ length: 68, offset: 68 * index, index })}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <View>
              <TrackRow
                track={item}
                onPress={() => void playTrack(item, sortedTracks)}
                onOptionsPress={() => openTrackMenu(item)}
              />
              {missingIds.has(item.id) && (
                <Text style={{ color: colors.secondary, fontSize: 11, marginLeft: 64, marginTop: -6, marginBottom: 8 }}>
                  FILE MISSING
                </Text>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Empty
              title="No tracks yet"
              detail="Choose audio files from your device to begin listening."
              action="Import music"
              onAction={() => void add()}
            />
          }
        />
      )}

      {view === 'Albums' && (
        <FlatList
          key="albums"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: 130 }}
          data={sortedAlbums}
          keyExtractor={(a) => a.key}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between', gap: 14 }}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/album', params: { group: item.key } } as never)}
              style={{ width: '48%', marginBottom: 24 }}
              accessibilityRole="button"
              accessibilityLabel={`Open album ${item.album} by ${item.artist}`}
            >
              <Artwork track={item.tracks[0]} size={160} />
              <Text numberOfLines={1} style={{ color: 'white', fontSize: 15, fontWeight: '600', marginTop: 10 }}>
                {item.album}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                {item.artist}
                {item.composer ? ` · ${item.composer}` : ''}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>
                {item.tracks.length} {item.tracks.length === 1 ? 'track' : 'tracks'}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <Empty
              title="No albums yet"
              detail="Import music with album tags to see albums here."
              action="Import music"
              onAction={() => void add()}
            />
          }
        />
      )}

      {view === 'Artists' && (
        <FlatList
          key="artists"
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 16, paddingBottom: 130 }}
          data={sortedArtists}
          keyExtractor={(a) => a.name}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                // Play all songs by this artist
                if (item.tracks.length > 0) {
                  void playTrack(item.tracks[0], item.tracks);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
              accessibilityRole="button"
              accessibilityLabel={`Artist ${item.name}`}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: colors.elevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="person" size={22} color={colors.secondary} />
              </View>
              <View style={{ flex: 1, marginLeft: 16 }}>
                <Text numberOfLines={1} style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                  {item.name}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                  {item.albums.length} {item.albums.length === 1 ? 'album' : 'albums'} · {item.tracks.length}{' '}
                  {item.tracks.length === 1 ? 'track' : 'tracks'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (item.tracks.length > 0) {
                    const randomTrack = item.tracks[Math.floor(Math.random() * item.tracks.length)];
                    if (!shuffle) toggleShuffle();
                    void playTrack(randomTrack, item.tracks);
                  }
                }}
                hitSlop={8}
                style={{ padding: 10 }}
              >
                <Ionicons name="shuffle" size={18} color={colors.secondary} />
              </TouchableOpacity>
            </Pressable>
          )}
          ListEmptyComponent={
            <Empty
              title="No artists yet"
              detail="Import music with artist tags to see artists here."
              action="Import music"
              onAction={() => void add()}
            />
          }
        />
      )}

      {/* Sort Dialog */}
      {view === 'Songs' && (
        <SortModal<SongSortMode>
          visible={sortModalVisible}
          onClose={() => setSortModalVisible(false)}
          title="Sort Tracks"
          modes={[
            { key: 'title', label: 'Song title' },
            { key: 'artist', label: 'Artist name' },
            { key: 'album', label: 'Album name' },
            { key: 'duration', label: 'Duration' },
            { key: 'addedAt', label: 'Date added' },
          ]}
          currentMode={songSortMode}
          direction={songSortDirection}
          onSelect={(mode, dir) => {
            setSongSortMode(mode);
            setSongSortDirection(dir);
          }}
        />
      )}

      {view === 'Albums' && (
        <SortModal<AlbumSortMode>
          visible={sortModalVisible}
          onClose={() => setSortModalVisible(false)}
          title="Sort Albums"
          modes={[
            { key: 'title', label: 'Album title' },
            { key: 'artist', label: 'Artist name' },
            { key: 'trackCount', label: 'Number of tracks' },
            { key: 'addedAt', label: 'Date added' },
          ]}
          currentMode={albumSortMode}
          direction={albumSortDirection}
          onSelect={(mode, dir) => {
            setAlbumSortMode(mode);
            setAlbumSortDirection(dir);
          }}
        />
      )}

      {view === 'Artists' && (
        <SortModal<ArtistSortMode>
          visible={sortModalVisible}
          onClose={() => setSortModalVisible(false)}
          title="Sort Artists"
          modes={[
            { key: 'name', label: 'Artist name' },
            { key: 'trackCount', label: 'Number of tracks' },
          ]}
          currentMode={artistSortMode}
          direction={artistSortDirection}
          onSelect={(mode, dir) => {
            setArtistSortMode(mode);
            setArtistSortDirection(dir);
          }}
        />
      )}

      {/* Track Modals */}
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

      <TrackInfoModal
        track={selectedTrack}
        visible={infoVisible}
        onClose={() => setInfoVisible(false)}
      />

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
