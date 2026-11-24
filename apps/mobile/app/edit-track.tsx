import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { colors } from '@noir/theme';
import { useMusic } from '../src/store';
import { pickArtworkImage, saveTrackEdits, revertTrackEdits } from '../src/tagEditor';
import { formatDuration } from '../src/format';
import { confirmDeleteTrack, useTopInset } from '../src/ui';

export default function EditTrackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const { trackId } = useLocalSearchParams<{ trackId: string }>();

  const tracks = useMusic((s) => s.tracks);
  const track = useMemo(() => tracks.find((t) => t.id === trackId), [tracks, trackId]);

  // Form states
  const [title, setTitle] = useState(track?.title ?? '');
  const [artist, setArtist] = useState(track?.artist ?? '');
  const [album, setAlbum] = useState(track?.album ?? '');
  const [albumArtist, setAlbumArtist] = useState(track?.albumArtist ?? '');
  const [composer, setComposer] = useState(track?.composer ?? '');
  const [year, setYear] = useState(track?.year ?? '');
  const [genre, setGenre] = useState(track?.genre ?? '');
  const [artworkUri, setArtworkUri] = useState<string | undefined>(track?.artworkUri);

  const [saving, setSaving] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);
  const [activeInput, setActiveInput] = useState<string | null>(null);

  // Reanimated press physics for save button
  const saveScale = useSharedValue(1);
  const saveAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: saveScale.value }],
  }));

  const handlePickArtwork = useCallback(async () => {
    if (!track) return;
    setPickingImage(true);
    try {
      const picked = await pickArtworkImage(track.id);
      if (picked) {
        setArtworkUri(picked);
      }
    } finally {
      setPickingImage(false);
    }
  }, [track]);

  const handleRemoveArtwork = useCallback(() => {
    setArtworkUri(undefined);
  }, []);

  const handleRevert = useCallback(() => {
    if (!track) return;
    Alert.alert(
      'Revert Metadata',
      'Reset this track back to its original audio file tags?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset to Original',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const restored = await revertTrackEdits(track.id);
              if (restored) {
                setTitle(restored.title);
                setArtist(restored.artist);
                setAlbum(restored.album);
                setAlbumArtist(restored.albumArtist ?? '');
                setComposer(restored.composer ?? '');
                setYear(restored.year ?? '');
                setGenre(restored.genre ?? '');
                setArtworkUri(restored.artworkUri);
              }
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  }, [track]);

  const handleSave = useCallback(async () => {
    if (!track) return;
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please enter a song title.');
      return;
    }

    setSaving(true);
    try {
      await saveTrackEdits(track.id, {
        title,
        artist,
        album,
        albumArtist,
        composer,
        year,
        genre,
        artworkUri,
      });
      router.back();
    } catch (e) {
      Alert.alert('Save Error', 'Could not save track metadata.');
    } finally {
      setSaving(false);
    }
  }, [track, title, artist, album, albumArtist, composer, year, genre, artworkUri, router]);

  if (!track) {
    return (
      <View style={[styles.container, { paddingTop: topInset + 20 }]}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="white" />
        </Pressable>
        <View style={styles.centerBox}>
          <Text style={{ color: colors.secondary, fontSize: 16 }}>Track not found</Text>
        </View>
      </View>
    );
  }

  const fileName = track.uri.split('/').pop() || 'Unknown File';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { paddingTop: topInset + 8 }]}
    >
      {/* Top Header Bar */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityLabel="Cancel editing"
        >
          <Ionicons name="close" size={24} color="white" />
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerSubtitle}>VRISH STUDIO TAGGER</Text>
          <Text style={styles.headerTitle}>Edit Track Details</Text>
        </View>

        <Pressable
          onPress={handleRevert}
          hitSlop={12}
          style={styles.revertBtn}
          accessibilityLabel="Revert to original tags"
        >
          <Ionicons name="refresh-outline" size={22} color={colors.secondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 90 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cover Photo Studio Hero */}
        <View style={styles.artworkSection}>
          <View style={styles.artworkWrapper}>
            {artworkUri ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.artworkCard}>
                <Image
                  source={{ uri: artworkUri }}
                  style={styles.artworkImage}
                  resizeMode="cover"
                />
                <View style={styles.artworkSheen} pointerEvents="none" />
              </Animated.View>
            ) : (
              <View style={[styles.artworkCard, styles.vinylFallback]}>
                <Svg width={180} height={180} viewBox="0 0 180 180">
                  <Defs>
                    <LinearGradient id="vinylGloss" x1="0" y1="0" x2="1" y2="1">
                      <Stop offset="0" stopColor="#333333" />
                      <Stop offset="0.5" stopColor="#141414" />
                      <Stop offset="1" stopColor="#080808" />
                    </LinearGradient>
                  </Defs>
                  <Rect width="180" height="180" rx="20" fill="url(#vinylGloss)" />
                  <Circle cx="90" cy="90" r="76" stroke="#222222" strokeWidth="2" fill="none" />
                  <Circle cx="90" cy="90" r="62" stroke="#1A1A1A" strokeWidth="2" fill="none" />
                  <Circle cx="90" cy="90" r="48" stroke="#262626" strokeWidth="1.5" fill="none" />
                  <Circle cx="90" cy="90" r="28" fill="#111111" stroke="#444444" strokeWidth="1.5" />
                  <Circle cx="90" cy="90" r="8" fill="#000000" stroke="#666666" strokeWidth="1" />
                </Svg>
                <View style={styles.fallbackIconBadge}>
                  <Ionicons name="image-outline" size={28} color="rgba(255,255,255,0.7)" />
                </View>
              </View>
            )}

            {/* Specular border glow */}
            <View style={styles.artworkBorderGlow} pointerEvents="none" />
          </View>

          {/* Action buttons for artwork */}
          <View style={styles.artworkActions}>
            <Pressable
              onPress={handlePickArtwork}
              disabled={pickingImage}
              style={[styles.pillBtn, styles.pillBtnPrimary]}
            >
              {pickingImage ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Ionicons name="image" size={15} color="#000000" style={{ marginRight: 6 }} />
                  <Text style={styles.pillBtnTextPrimary}>
                    {artworkUri ? 'Change Cover' : 'Choose Cover'}
                  </Text>
                </>
              )}
            </Pressable>

            {artworkUri && (
              <Pressable
                onPress={handleRemoveArtwork}
                style={[styles.pillBtn, styles.pillBtnDanger]}
              >
                <Ionicons name="trash-outline" size={15} color="#FF6666" style={{ marginRight: 5 }} />
                <Text style={styles.pillBtnTextDanger}>Remove</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.artworkHint}>
            JPG, PNG, or WEBP · High-res album artwork recommended
          </Text>
        </View>

        {/* Section: Core Information */}
        <View style={styles.formGroup}>
          <Text style={styles.groupHeader}>ESSENTIAL TAGS</Text>

          {/* Title Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>TRACK TITLE *</Text>
            <View
              style={[
                styles.inputWrapper,
                activeInput === 'title' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Song Title"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                onFocus={() => setActiveInput('title')}
                onBlur={() => setActiveInput(null)}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {title.length > 0 && (
                <Pressable onPress={() => setTitle('')} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.secondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Artist Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>ARTIST / PERFORMER</Text>
            <View
              style={[
                styles.inputWrapper,
                activeInput === 'artist' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                value={artist}
                onChangeText={setArtist}
                placeholder="Artist name"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                onFocus={() => setActiveInput('artist')}
                onBlur={() => setActiveInput(null)}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {artist.length > 0 && (
                <Pressable onPress={() => setArtist('')} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.secondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Album Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>ALBUM NAME</Text>
            <View
              style={[
                styles.inputWrapper,
                activeInput === 'album' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                value={album}
                onChangeText={setAlbum}
                placeholder="Album title"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                onFocus={() => setActiveInput('album')}
                onBlur={() => setActiveInput(null)}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {album.length > 0 && (
                <Pressable onPress={() => setAlbum('')} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.secondary} />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Section: Extended Metadata */}
        <View style={styles.formGroup}>
          <Text style={styles.groupHeader}>EXTENDED METADATA</Text>

          {/* Album Artist Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>ALBUM ARTIST</Text>
            <View
              style={[
                styles.inputWrapper,
                activeInput === 'albumArtist' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                value={albumArtist}
                onChangeText={setAlbumArtist}
                placeholder="e.g. Various Artists or Band"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                onFocus={() => setActiveInput('albumArtist')}
                onBlur={() => setActiveInput(null)}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {albumArtist.length > 0 && (
                <Pressable onPress={() => setAlbumArtist('')} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.secondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Composer Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>COMPOSER / WRITER</Text>
            <View
              style={[
                styles.inputWrapper,
                activeInput === 'composer' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                value={composer}
                onChangeText={setComposer}
                placeholder="Songwriter or composer"
                placeholderTextColor={colors.muted}
                style={styles.textInput}
                onFocus={() => setActiveInput('composer')}
                onBlur={() => setActiveInput(null)}
                autoCapitalize="words"
                returnKeyType="next"
              />
              {composer.length > 0 && (
                <Pressable onPress={() => setComposer('')} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color={colors.secondary} />
                </Pressable>
              )}
            </View>
          </View>

          {/* Two-Column: Year & Genre */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>YEAR</Text>
              <View
                style={[
                  styles.inputWrapper,
                  activeInput === 'year' && styles.inputWrapperFocused,
                ]}
              >
                <TextInput
                  value={year}
                  onChangeText={setYear}
                  placeholder="2026"
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                  onFocus={() => setActiveInput('year')}
                  onBlur={() => setActiveInput(null)}
                  keyboardType="numeric"
                  maxLength={4}
                  returnKeyType="done"
                />
                {year.length > 0 && (
                  <Pressable onPress={() => setYear('')} hitSlop={8} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={16} color={colors.secondary} />
                  </Pressable>
                )}
              </View>
            </View>

            <View style={[styles.fieldContainer, { flex: 1.5 }]}>
              <Text style={styles.fieldLabel}>GENRE</Text>
              <View
                style={[
                  styles.inputWrapper,
                  activeInput === 'genre' && styles.inputWrapperFocused,
                ]}
              >
                <TextInput
                  value={genre}
                  onChangeText={setGenre}
                  placeholder="e.g. Synthwave"
                  placeholderTextColor={colors.muted}
                  style={styles.textInput}
                  onFocus={() => setActiveInput('genre')}
                  onBlur={() => setActiveInput(null)}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
                {genre.length > 0 && (
                  <Pressable onPress={() => setGenre('')} hitSlop={8} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={16} color={colors.secondary} />
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Section: Audio File Details */}
        <View style={styles.fileDetailsCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="document-text-outline" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
            <Text style={styles.groupHeader}>SOURCE FILE</Text>
          </View>
          <Text style={styles.fileNameText} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={styles.filePathText} numberOfLines={2}>
            {track.uri}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.fileMetaBadge}>
              {track.durationMs > 0 ? formatDuration(track.durationMs) : 'Unknown Duration'}
            </Text>
            {track.userEdited && (
              <Text style={[styles.fileMetaBadge, styles.customBadge]}>
                Custom Edited Tags
              </Text>
            )}
          </View>
        </View>

        {/* Section: Delete Track */}
        <View style={styles.dangerZoneCard}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.dangerTitle}>Delete Song</Text>
            <Text style={styles.dangerDesc}>
              Remove from library or delete permanently from device storage.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              confirmDeleteTrack(track, () => {
                router.back();
              });
            }}
            style={styles.deleteTrackBtn}
          >
            <Ionicons name="trash-outline" size={15} color="#FF6666" style={{ marginRight: 6 }} />
            <Text style={styles.deleteTrackText}>Delete</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Floating Bottom Action Dock */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Animated.View style={[{ flex: 1 }, saveAnimatedStyle]}>
          <Pressable
            onPress={handleSave}
            onPressIn={() => (saveScale.value = withSpring(0.97))}
            onPressOut={() => (saveScale.value = withSpring(1))}
            disabled={saving}
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <View style={styles.saveBtnContent}>
                <Ionicons name="checkmark-sharp" size={18} color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Save Changes</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: colors.secondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.2,
    marginBottom: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#161616',
  },
  revertBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#161616',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Cover photo
  artworkSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  artworkWrapper: {
    width: 180,
    height: 180,
    position: 'relative',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  artworkCard: {
    width: 180,
    height: 180,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#121212',
    position: 'relative',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  artworkSheen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  vinylFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C0C0C',
  },
  fallbackIconBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkBorderGlow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  artworkActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  pillBtnPrimary: {
    backgroundColor: '#FFFFFF',
  },
  pillBtnTextPrimary: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  pillBtnDanger: {
    backgroundColor: 'rgba(255, 70, 70, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 70, 70, 0.25)',
  },
  pillBtnTextDanger: {
    color: '#FF6666',
    fontSize: 12,
    fontWeight: '600',
  },
  artworkHint: {
    color: colors.secondary,
    fontSize: 11,
    marginTop: 10,
    letterSpacing: 0.2,
  },

  // Form
  formGroup: {
    backgroundColor: '#121212',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    marginBottom: 20,
  },
  groupHeader: {
    color: colors.secondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  fieldContainer: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: '#8A8A8A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    height: 46,
  },
  inputWrapperFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#1E1E1E',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
    marginLeft: 6,
  },

  // Source info
  fileDetailsCard: {
    backgroundColor: '#101010',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  fileNameText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  filePathText: {
    color: colors.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  fileMetaBadge: {
    color: colors.secondary,
    fontSize: 10,
    backgroundColor: '#181818',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: 'hidden',
  },
  customBadge: {
    color: '#90EE90',
    backgroundColor: 'rgba(144, 238, 144, 0.12)',
  },
  dangerZoneCard: {
    marginHorizontal: 16,
    marginBottom: 28,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#140A0A',
    borderWidth: 1,
    borderColor: '#381616',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6666',
    marginBottom: 3,
  },
  dangerDesc: {
    fontSize: 12,
    color: '#AA7777',
    lineHeight: 16,
  },
  deleteTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#260E0E',
    borderWidth: 1,
    borderColor: '#4A1C1C',
  },
  deleteTrackText: {
    color: '#FF6666',
    fontWeight: '700',
    fontSize: 13,
  },

  // Bottom dock
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(8, 8, 8, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  saveBtn: {
    backgroundColor: '#FFFFFF',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
