import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
  Image,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@noir/theme';
import type { Track, Playlist, SongSortMode, AlbumSortMode, ArtistSortMode, SortDirection } from '@noir/types';
import { playTrack, playNext, addToQueue } from './audio';
import { removeTrack } from './library';
import { useMusic } from './store';
import { addTrackToPlaylist, createPlaylist, deletePlaylist, renamePlaylist } from './db';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDuration, formatTotalDuration } from './format';
export { formatDuration, formatTotalDuration } from './format';

export function Artwork({ track, size = 56 }: { track?: Track; size?: number }) {
  const radius = Math.max(4, Math.round(size * 0.1));
  return track?.artworkUri ? (
    <View style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#1A1A1A' }}>
      <Image
        source={{ uri: track.artworkUri }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFill,
          borderRadius: radius,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      />
    </View>
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: colors.elevated,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Ionicons name="musical-note" size={size * 0.35} color={colors.muted} />
    </View>
  );
}

export const TrackRow = React.memo(function TrackRow({
  track,
  onPress,
  onOptionsPress,
  isPlaying,
  index,
}: {
  track: Track;
  onPress?: () => void;
  onOptionsPress?: () => void;
  isPlaying?: boolean;
  index?: number;
}) {
  const toggleFavorite = useMusic((s) => s.toggleFavorite);
  // Precise selector: evaluates boolean so this row ONLY re-renders if active state toggles for this track
  const active = useMusic((s) => s.currentId === track.id);

  return (
    <Pressable
      onPress={onPress ?? (() => void playTrack(track))}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title} by ${track.artist}`}
      style={[styles.row, active && { backgroundColor: '#141414', marginHorizontal: -12, paddingHorizontal: 12, borderRadius: 8 }]}
    >
      {index !== undefined && (
        <Text style={{ width: 26, color: active ? 'white' : colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] }}>
          {String(index + 1).padStart(2, '0')}
        </Text>
      )}
      <Artwork track={track} size={48} />
      <View style={{ flex: 1, marginLeft: 14, marginRight: 8 }}>
        <Text numberOfLines={1} style={[styles.title, active && { color: '#FFFFFF', fontWeight: '700' }]}>
          {track.title}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {track.artist}
          {track.durationMs > 0 ? ` · ${formatDuration(track.durationMs)}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => toggleFavorite(track.id)}
        accessibilityLabel={track.favorite ? 'Remove from favorites' : 'Add to favorites'}
        hitSlop={8}
        style={{ padding: 8 }}
      >
        <Ionicons name={track.favorite ? 'heart' : 'heart-outline'} size={19} color={track.favorite ? '#FFFFFF' : colors.secondary} />
      </Pressable>
      {onOptionsPress && (
        <Pressable
          onPress={onOptionsPress}
          accessibilityLabel="Track options"
          hitSlop={8}
          style={{ padding: 8, marginRight: -4 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.secondary} />
        </Pressable>
      )}
    </Pressable>
  );
});

export function Empty({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name="musical-notes-outline" size={42} color={colors.muted} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={[styles.meta, { textAlign: 'center', maxWidth: 280 }]}>{detail}</Text>
      {action && (
        <Pressable onPress={onAction} style={styles.action}>
          <Text style={{ color: colors.background, fontWeight: '700', fontSize: 14 }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Heading({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={{ marginBottom: 22 }}>
      {eyebrow && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.heading}>{title}</Text>
    </View>
  );
}

export function ToastBanner() {
  const insets = useSafeAreaInsets();
  const toast = useMusic((s) => s.toast);
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.toastContainer, { top: insets.top + 12 }]}>
      <View style={styles.toast}>
        <Ionicons name="checkmark-circle" size={16} color="white" style={{ marginRight: 8 }} />
        <Text style={styles.toastText} numberOfLines={1}>
          {toast}
        </Text>
      </View>
    </View>
  );
}

export function confirmDeleteTrack(track: Track, onDeleted?: () => void) {
  Alert.alert(
    `Delete "${track.title}"`,
    'Choose whether to remove this song from your library or permanently delete it from your device storage.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Remove from Library',
        onPress: () => {
          void removeTrack(track, false).then((ok) => {
            if (ok && onDeleted) onDeleted();
          });
        },
      },
      {
        text: 'Delete from Storage',
        style: 'destructive',
        onPress: () => {
          void removeTrack(track, true).then((ok) => {
            if (ok && onDeleted) onDeleted();
          });
        },
      },
    ],
    { cancelable: true }
  );
}

// --- AUXIO STYLE TRACK ACTIONS MENU ---
export function TrackMenuModal({
  track,
  visible,
  onClose,
  onShowDetails,
  onShowPlaylistPicker,
}: {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
  onShowDetails: (t: Track) => void;
  onShowPlaylistPicker: (t: Track) => void;
}) {
  const router = useRouter();
  const toggleFavorite = useMusic((s) => s.toggleFavorite);

  if (!track) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Artwork track={track} size={54} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text numberOfLines={1} style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 13, marginTop: 4 }}>
                {track.artist} · {track.album}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 6 }}>
              <Ionicons name="close" size={22} color={colors.secondary} />
            </Pressable>
          </View>

          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              playNext(track);
            }}
          >
            <Ionicons name="play-forward-outline" size={20} color="white" style={styles.menuIcon} />
            <Text style={styles.menuText}>Play next</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              addToQueue(track);
            }}
          >
            <Ionicons name="list-outline" size={20} color="white" style={styles.menuIcon} />
            <Text style={styles.menuText}>Add to queue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onShowPlaylistPicker(track);
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="white" style={styles.menuIcon} />
            <Text style={styles.menuText}>Add to playlist...</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              toggleFavorite(track.id);
            }}
          >
            <Ionicons
              name={track.favorite ? 'heart' : 'heart-outline'}
              size={20}
              color={track.favorite ? '#FFFFFF' : 'white'}
              style={styles.menuIcon}
            />
            <Text style={styles.menuText}>{track.favorite ? 'Remove from favorites' : 'Add to favorites'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              onShowDetails(track);
            }}
          >
            <Ionicons name="information-circle-outline" size={20} color="white" style={styles.menuIcon} />
            <Text style={styles.menuText}>Song details</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              router.push({ pathname: '/edit-track', params: { trackId: track.id } } as never);
            }}
          >
            <Ionicons name="create-outline" size={20} color="white" style={styles.menuIcon} />
            <Text style={styles.menuText}>Edit song & cover art</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose();
              confirmDeleteTrack(track);
            }}
          >
            <Ionicons name="trash-outline" size={20} color="#FF6666" style={styles.menuIcon} />
            <Text style={[styles.menuText, { color: '#FF6666' }]}>Delete song</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- AUXIO STYLE TRACK DETAILS / INFO MODAL ---
export function TrackInfoModal({
  track,
  visible,
  onClose,
}: {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  if (!track) return null;

  const fileName = track.uri.split('/').pop() ?? 'Unknown';
  const properties = [
    { label: 'Title', value: track.title },
    { label: 'Artist', value: track.artist },
    { label: 'Album', value: track.album },
    { label: 'Album Artist', value: track.albumArtist || 'Same as track artist' },
    { label: 'Composer', value: track.composer || 'Unknown' },
    { label: 'Year', value: track.year || 'Not specified' },
    { label: 'Genre', value: track.genre || 'Not specified' },
    { label: 'Duration', value: formatDuration(track.durationMs) },
    { label: 'Play count', value: `${track.playCount} times` },
    { label: 'Tags status', value: track.userEdited ? 'Custom user edited' : 'Original file tags' },
    { label: 'File name', value: fileName },
    { label: 'File path', value: track.uri },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Track Details</Text>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={colors.secondary} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
            {properties.map((prop, idx) => (
              <View key={idx} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#242424' }}>
                <Text style={{ color: colors.secondary, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {prop.label}
                </Text>
                <Text style={{ color: 'white', fontSize: 14, marginTop: 4, lineHeight: 20 }} selectable>
                  {prop.value}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={{ marginTop: 18, gap: 10 }}>
            <Pressable
              onPress={() => {
                onClose();
                router.push({ pathname: '/edit-track', params: { trackId: track.id } } as never);
              }}
              style={[styles.action, { alignSelf: 'stretch', alignItems: 'center', backgroundColor: '#FFFFFF' }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="create-outline" size={17} color="#000000" style={{ marginRight: 6 }} />
                <Text style={{ color: '#000000', fontWeight: '700', fontSize: 14 }}>Edit Song & Artwork</Text>
              </View>
            </Pressable>

            <Pressable onPress={onClose} style={[styles.action, { alignSelf: 'stretch', alignItems: 'center', backgroundColor: '#1E1E1E' }]}>
              <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- AUXIO STYLE PLAYLIST PICKER MODAL ---
export function PlaylistPickerModal({
  track,
  visible,
  onClose,
  onCreateNew,
}: {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
  onCreateNew: () => void;
}) {
  const playlists = useMusic((s) => s.playlists);
  const showToast = useMusic((s) => s.showToast);
  const refresh = useMusic((s) => s.refresh);

  if (!track) return null;

  const handlePick = (playlist: Playlist) => {
    addTrackToPlaylist(playlist.id, track.id);
    refresh();
    showToast(`Added to ${playlist.name}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>Add to Playlist</Text>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={colors.secondary} />
            </Pressable>
          </View>

          <TouchableOpacity
            style={[styles.menuItem, { backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 12, marginBottom: 8 }]}
            onPress={() => {
              onClose();
              onCreateNew();
            }}
          >
            <Ionicons name="add" size={22} color="white" style={styles.menuIcon} />
            <Text style={[styles.menuText, { fontWeight: '700' }]}>Create new playlist...</Text>
          </TouchableOpacity>

          <View style={styles.menuDivider} />

          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            {playlists.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 20, fontSize: 13 }}>
                No custom playlists yet. Create one above!
              </Text>
            ) : (
              playlists.map((pl) => (
                <TouchableOpacity key={pl.id} style={styles.menuItem} onPress={() => handlePick(pl)}>
                  <Ionicons name="musical-notes-outline" size={19} color={colors.secondary} style={styles.menuIcon} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={styles.menuText}>
                      {pl.name}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{pl.trackCount} tracks</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- CREATE PLAYLIST MODAL ---
export function CreatePlaylistModal({
  visible,
  onClose,
  initialTrack,
}: {
  visible: boolean;
  onClose: () => void;
  initialTrack?: Track | null;
}) {
  const [name, setName] = useState('');
  const showToast = useMusic((s) => s.showToast);
  const refresh = useMusic((s) => s.refresh);

  const handleSave = () => {
    if (!name.trim()) return;
    const pl = createPlaylist(name.trim());
    if (initialTrack) {
      addTrackToPlaylist(pl.id, initialTrack.id);
    }
    refresh();
    showToast(`Created "${pl.name}"`);
    setName('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.infoCard} onPress={(e) => e.stopPropagation()}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 16 }}>New Playlist</Text>
          <TextInput
            placeholder="Playlist name"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            autoFocus
            style={styles.textInput}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <Pressable onPress={onClose} style={[styles.modalButton, { backgroundColor: 'transparent' }]}>
              <Text style={{ color: colors.secondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!name.trim()}
              style={[styles.modalButton, { backgroundColor: name.trim() ? 'white' : '#2A2A2A' }]}
            >
              <Text style={{ color: name.trim() ? 'black' : '#666', fontWeight: '700' }}>Create</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// --- AUXIO SORT DIALOG ---
export function SortModal<T extends string>({
  visible,
  onClose,
  title,
  modes,
  currentMode,
  direction,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  modes: { key: T; label: string }[];
  currentMode: T;
  direction: SortDirection;
  onSelect: (mode: T, direction: SortDirection) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.menuSheet} onPress={(e) => e.stopPropagation()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={{ padding: 4 }}>
              <Ionicons name="close" size={22} color={colors.secondary} />
            </Pressable>
          </View>

          <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>SORT BY</Text>
          {modes.map((m) => {
            const isSelected = m.key === currentMode;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.menuItem, isSelected && { backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 10 }]}
                onPress={() => {
                  onSelect(m.key, direction);
                  onClose();
                }}
              >
                <Ionicons
                  name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={19}
                  color={isSelected ? 'white' : colors.muted}
                  style={styles.menuIcon}
                />
                <Text style={[styles.menuText, isSelected && { fontWeight: '700' }]}>{m.label}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.menuDivider} />

          <Text style={{ color: colors.secondary, fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>ORDER</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => {
                onSelect(currentMode, 'asc');
                onClose();
              }}
              style={[
                styles.orderButton,
                direction === 'asc' && { backgroundColor: 'white', borderColor: 'white' },
              ]}
            >
              <Ionicons name="arrow-up" size={16} color={direction === 'asc' ? 'black' : 'white'} />
              <Text style={{ color: direction === 'asc' ? 'black' : 'white', fontWeight: '600', marginLeft: 6 }}>
                Ascending
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onSelect(currentMode, 'desc');
                onClose();
              }}
              style={[
                styles.orderButton,
                direction === 'desc' && { backgroundColor: 'white', borderColor: 'white' },
              ]}
            >
              <Ionicons name="arrow-down" size={16} color={direction === 'desc' ? 'black' : 'white'} />
              <Text style={{ color: direction === 'desc' ? 'black' : 'white', fontWeight: '600', marginLeft: 6 }}>
                Descending
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
    minHeight: 320,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
  },
  action: {
    backgroundColor: colors.text,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 30,
    marginTop: 14,
  },
  eyebrow: {
    color: colors.secondary,
    fontSize: 10,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 8,
  },
  heading: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  toastContainer: {
    position: 'absolute',
    top: 54,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  menuSheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 22,
    paddingBottom: 36,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  menuIcon: {
    width: 32,
  },
  menuText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    margin: 20,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 420,
  },
  textInput: {
    height: 48,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: 'white',
    paddingHorizontal: 14,
    fontSize: 15,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  orderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#1A1A1A',
  },
});
