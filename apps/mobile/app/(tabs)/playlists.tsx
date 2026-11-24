import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@noir/theme';
import {
  Empty,
  Heading,
  TrackRow,
  Artwork,
  TrackMenuModal,
  TrackInfoModal,
  PlaylistPickerModal,
  CreatePlaylistModal,
  ToastBanner,
  formatTotalDuration,
} from '../../src/ui';
import { useMusic } from '../../src/store';
import { playTrack, toggleShuffle } from '../../src/audio';
import { deletePlaylist, getPlaylistTracks, removeTrackFromPlaylist, renamePlaylist } from '../../src/db';
import type { Playlist, Track } from '@noir/types';

export default function Playlists() {
  const insets = useSafeAreaInsets();
  const tracks = useMusic((s) => s.tracks);
  const playlists = useMusic((s) => s.playlists);
  const refresh = useMusic((s) => s.refresh);
  const shuffle = useMusic((s) => s.shuffle);

  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null); // null = playlist list view, 'favorites' = favorites view, id = custom playlist view
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Playlist | null>(null);
  const [renameText, setRenameText] = useState('');

  // Modals
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [infoVisible, setInfoVisible] = useState(false);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);

  const favoriteTracks = useMemo(() => tracks.filter((t) => t.favorite), [tracks]);
  const favoriteDuration = useMemo(
    () => favoriteTracks.reduce((acc, t) => acc + (t.durationMs || 0), 0),
    [favoriteTracks],
  );

  const activePlaylist = useMemo(
    () => (activePlaylistId && activePlaylistId !== 'favorites' ? playlists.find((p) => p.id === activePlaylistId) : null),
    [activePlaylistId, playlists],
  );

  const activeTracks = useMemo(() => {
    if (activePlaylistId === 'favorites') return favoriteTracks;
    if (activePlaylist) return getPlaylistTracks(activePlaylist.id);
    return [];
  }, [activePlaylistId, activePlaylist, favoriteTracks]);

  const activeDuration = useMemo(
    () => activeTracks.reduce((acc, t) => acc + (t.durationMs || 0), 0),
    [activeTracks],
  );

  const handlePlayPlaylist = (tracksToPlay: Track[], shouldShuffle = false) => {
    if (tracksToPlay.length === 0) return;
    if (shouldShuffle) {
      const randomTrack = tracksToPlay[Math.floor(Math.random() * tracksToPlay.length)];
      if (!shuffle) toggleShuffle();
      void playTrack(randomTrack, tracksToPlay);
    } else {
      void playTrack(tracksToPlay[0], tracksToPlay);
    }
  };

  const handleDeletePlaylist = (playlist: Playlist) => {
    Alert.alert('Delete Playlist', `Are you sure you want to delete "${playlist.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deletePlaylist(playlist.id);
          refresh();
          if (activePlaylistId === playlist.id) setActivePlaylistId(null);
        },
      },
    ]);
  };

  const handleRenamePlaylist = () => {
    if (!renameTarget || !renameText.trim()) return;
    renamePlaylist(renameTarget.id, renameText.trim());
    refresh();
    setRenameTarget(null);
    setRenameText('');
  };

  const handleRemoveTrackFromActive = (track: Track) => {
    if (!activePlaylist) return;
    removeTrackFromPlaylist(activePlaylist.id, track.id);
    refresh();
  };

  // If viewing a specific playlist or favorites
  if (activePlaylistId) {
    const isFav = activePlaylistId === 'favorites';
    const title = isFav ? 'Favorites' : activePlaylist?.name ?? 'Playlist';
    const firstTrack = activeTracks[0];

    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
        <ToastBanner />
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 130 }}
          data={activeTracks}
          keyExtractor={(t, idx) => `${t.id}-${idx}`}
          ListHeaderComponent={
            <View style={{ marginBottom: 20 }}>
              <Pressable
                onPress={() => setActivePlaylistId(null)}
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={24} color="white" />
                <Text style={{ color: colors.secondary, fontSize: 15, marginLeft: 4 }}>Playlists</Text>
              </Pressable>

              <View style={{ alignItems: 'center', marginBottom: 24 }}>
                {isFav ? (
                  <View
                    style={{
                      width: 140,
                      height: 140,
                      borderRadius: 16,
                      backgroundColor: '#1E1E1E',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Ionicons name="heart" size={60} color="white" />
                  </View>
                ) : (
                  <Artwork track={firstTrack} size={140} />
                )}
                <Text style={{ color: 'white', fontSize: 26, fontWeight: '700', marginTop: 16, textAlign: 'center' }}>
                  {title}
                </Text>
                <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 6 }}>
                  {activeTracks.length} {activeTracks.length === 1 ? 'track' : 'tracks'} · {formatTotalDuration(activeDuration)}
                </Text>

                {/* Play and Shuffle Controls */}
                {activeTracks.length > 0 && (
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 20 }}>
                    <TouchableOpacity
                      onPress={() => handlePlayPlaylist(activeTracks, false)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: 'white',
                        paddingVertical: 10,
                        paddingHorizontal: 22,
                        borderRadius: 24,
                      }}
                    >
                      <Ionicons name="play" size={18} color="black" style={{ marginRight: 6 }} />
                      <Text style={{ color: 'black', fontWeight: '700', fontSize: 14 }}>Play</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handlePlayPlaylist(activeTracks, true)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: colors.elevated,
                        borderWidth: 1,
                        borderColor: colors.border,
                        paddingVertical: 10,
                        paddingHorizontal: 20,
                        borderRadius: 24,
                      }}
                    >
                      <Ionicons name="shuffle" size={18} color="white" style={{ marginRight: 6 }} />
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Shuffle</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 8 }}>
                TRACK LIST
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TrackRow
                  track={item}
                  index={index}
                  onPress={() => void playTrack(item, activeTracks)}
                  onOptionsPress={() => {
                    setSelectedTrack(item);
                    setMenuVisible(true);
                  }}
                />
              </View>
              {!isFav && (
                <TouchableOpacity
                  onPress={() => handleRemoveTrackFromActive(item)}
                  hitSlop={8}
                  style={{ padding: 10, marginLeft: 4 }}
                  accessibilityLabel="Remove from playlist"
                >
                  <Ionicons name="remove-circle-outline" size={20} color={colors.secondary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          ListEmptyComponent={
            <Empty
              title={isFav ? 'No favorites yet' : 'Empty playlist'}
              detail={
                isFav
                  ? 'Tap the heart icon beside any track to add it here.'
                  : 'Add songs to this playlist from any song menu.'
              }
            />
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
          onCreateNew={() => setCreateModalVisible(true)}
        />
      </View>
    );
  }

  // Playlist list overview
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <ToastBanner />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Heading eyebrow="YOUR MUSIC" title="Playlists" />
          <TouchableOpacity
            onPress={() => setCreateModalVisible(true)}
            hitSlop={8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.elevated,
              borderWidth: 1,
              borderColor: colors.border,
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 20,
            }}
          >
            <Ionicons name="add" size={18} color="white" style={{ marginRight: 4 }} />
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Pinned Favorites Card */}
        <Pressable
          onPress={() => setActivePlaylistId('favorites')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#121212',
            borderRadius: 14,
            padding: 16,
            marginBottom: 24,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 10,
              backgroundColor: '#222222',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="heart" size={28} color="white" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '700' }}>Favorites</Text>
            <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>
              {favoriteTracks.length} {favoriteTracks.length === 1 ? 'track' : 'tracks'}
              {favoriteTracks.length > 0 ? ` · ${formatTotalDuration(favoriteDuration)}` : ''}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              handlePlayPlaylist(favoriteTracks, false);
            }}
            hitSlop={8}
            style={{ padding: 10 }}
          >
            <Ionicons name="play-circle" size={36} color="white" />
          </TouchableOpacity>
        </Pressable>

        <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, fontWeight: '600', marginBottom: 14 }}>
          CUSTOM PLAYLISTS ({playlists.length})
        </Text>

        {playlists.length === 0 ? (
          <Empty
            title="Create your first playlist"
            detail="Group your favorite songs together into custom playlists."
            action="Create playlist"
            onAction={() => setCreateModalVisible(true)}
          />
        ) : (
          playlists.map((pl) => {
            const plTracks = getPlaylistTracks(pl.id);
            const coverTrack = plTracks[0];
            return (
              <Pressable
                key={pl.id}
                onPress={() => setActivePlaylistId(pl.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Artwork track={coverTrack} size={54} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text numberOfLines={1} style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                    {pl.name}
                  </Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
                    {pl.trackCount} {pl.trackCount === 1 ? 'track' : 'tracks'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setRenameTarget(pl);
                    setRenameText(pl.name);
                  }}
                  hitSlop={8}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="pencil-outline" size={17} color={colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeletePlaylist(pl)}
                  hitSlop={8}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handlePlayPlaylist(plTracks, false)}
                  hitSlop={8}
                  style={{ padding: 8 }}
                >
                  <Ionicons name="play" size={18} color="white" />
                </TouchableOpacity>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Create Modal */}
      <CreatePlaylistModal visible={createModalVisible} onClose={() => setCreateModalVisible(false)} />

      {/* Rename Modal */}
      <Modal visible={!!renameTarget} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center' }} onPress={() => setRenameTarget(null)}>
          <Pressable
            style={{
              backgroundColor: '#111111',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 22,
              margin: 20,
              alignSelf: 'center',
              width: '90%',
              maxWidth: 420,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Rename Playlist</Text>
            <TextInput
              placeholder="Playlist name"
              placeholderTextColor={colors.muted}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              style={{
                height: 48,
                backgroundColor: '#1A1A1A',
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 8,
                color: 'white',
                paddingHorizontal: 14,
                fontSize: 15,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
              <Pressable onPress={() => setRenameTarget(null)} style={{ paddingVertical: 10, paddingHorizontal: 18 }}>
                <Text style={{ color: colors.secondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleRenamePlaylist}
                disabled={!renameText.trim()}
                style={{
                  backgroundColor: renameText.trim() ? 'white' : '#2A2A2A',
                  paddingVertical: 10,
                  paddingHorizontal: 18,
                  borderRadius: 20,
                }}
              >
                <Text style={{ color: renameText.trim() ? 'black' : '#666', fontWeight: '700' }}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
