import React, { useState, useMemo } from 'react';
import {
  View,
  TextInput,
  FlatList,
  Text,
  Pressable,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@noir/theme';
import {
  Artwork,
  Empty,
  Heading,
  TrackRow,
  TrackMenuModal,
  TrackInfoModal,
  PlaylistPickerModal,
  CreatePlaylistModal,
  ToastBanner,
  useTopInset,
} from '../../src/ui';
import { useMusic } from '../../src/store';
import { playTrack } from '../../src/audio';
import { groupAlbums } from '../../src/albums';
import { groupArtists } from '../../src/artists';
import type { Track } from '@noir/types';

export default function Search() {
  const topInset = useTopInset();
  const router = useRouter();
  const tracks = useMusic((s) => s.tracks);
  const [query, setQuery] = useState('');

  // Modals
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);

  const cleanQuery = query.trim().toLowerCase();

  const allAlbums = useMemo(() => groupAlbums(tracks), [tracks]);
  const allArtists = useMemo(() => groupArtists(tracks), [tracks]);

  const matchingSongs = useMemo(() => {
    if (!cleanQuery) return [];
    return tracks.filter((t) =>
      `${t.title} ${t.artist} ${t.album} ${t.composer ?? ''}`.toLowerCase().includes(cleanQuery),
    );
  }, [tracks, cleanQuery]);

  const matchingAlbums = useMemo(() => {
    if (!cleanQuery) return [];
    return allAlbums.filter((a) =>
      `${a.album} ${a.artist} ${a.composer}`.toLowerCase().includes(cleanQuery),
    );
  }, [allAlbums, cleanQuery]);

  const matchingArtists = useMemo(() => {
    if (!cleanQuery) return [];
    return allArtists.filter((art) => art.name.toLowerCase().includes(cleanQuery));
  }, [allArtists, cleanQuery]);

  const hasResults = matchingSongs.length > 0 || matchingAlbums.length > 0 || matchingArtists.length > 0;

  const openTrackMenu = (track: Track) => {
    setSelectedTrack(track);
    setMenuVisible(true);
  };

  const header = (
    <View style={{ marginBottom: 18 }}>
      <Heading eyebrow="FIND YOUR SOUND" title="Search" />

      {/* Search Input Bar with Clear button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.elevated,
          borderRadius: 12,
          paddingHorizontal: 14,
          height: 52,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Ionicons name="search" size={20} color={colors.secondary} style={{ marginRight: 10 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Songs, artists, albums, composers"
          placeholderTextColor={colors.muted}
          accessibilityLabel="Search music"
          style={{ flex: 1, color: 'white', fontSize: 15 }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={19} color={colors.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Matching Artists Section */}
      {matchingArtists.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 12 }}>
            ARTISTS ({matchingArtists.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, paddingHorizontal: 24 }}>
            {matchingArtists.map((art) => (
              <Pressable
                key={art.name}
                onPress={() => {
                  if (art.tracks.length > 0) void playTrack(art.tracks[0], art.tracks);
                }}
                style={{
                  alignItems: 'center',
                  width: 90,
                  marginRight: 16,
                }}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    backgroundColor: '#1E1E1E',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Ionicons name="person" size={30} color={colors.secondary} />
                </View>
                <Text numberOfLines={1} style={{ color: 'white', fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' }}>
                  {art.name}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 10, marginTop: 2 }}>{art.tracks.length} tracks</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Matching Albums Section */}
      {matchingAlbums.length > 0 && (
        <View style={{ marginBottom: 24 }}>
          <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 12 }}>
            ALBUMS ({matchingAlbums.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, paddingHorizontal: 24 }}>
            {matchingAlbums.map((alb) => (
              <Pressable
                key={alb.key}
                onPress={() => router.push({ pathname: '/album', params: { group: alb.key } } as never)}
                style={{ width: 120, marginRight: 14 }}
              >
                <Artwork track={alb.tracks[0]} size={120} />
                <Text numberOfLines={1} style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 8 }}>
                  {alb.album}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                  {alb.artist}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {cleanQuery.length > 0 && matchingSongs.length > 0 && (
        <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, fontWeight: '700', marginBottom: 4 }}>
          SONGS ({matchingSongs.length})
        </Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ToastBanner />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: topInset + 20, paddingBottom: 130 }}
        data={cleanQuery ? matchingSongs : []}
        keyExtractor={(t) => t.id}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <TrackRow
            track={item}
            onPress={() => void playTrack(item, matchingSongs)}
            onOptionsPress={() => openTrackMenu(item)}
          />
        )}
        ListEmptyComponent={
          cleanQuery ? (
            !hasResults ? (
              <Empty title="Nothing found" detail="Try a different title, artist, or album." />
            ) : undefined
          ) : (
            <Empty title="Search your library" detail="Your local music is one search away." />
          )
        }
      />

      {/* Modals */}
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

      <TrackInfoModal track={selectedTrack} visible={infoVisible} onClose={() => setInfoVisible(false)} />

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
