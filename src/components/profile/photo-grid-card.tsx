/**
 * Profile tab — Photo grid card
 *
 * Up to 6 photos: add, delete, set-primary, reorder. Deleting is floor-
 * enforced by lib/user-photos.ts's deleteUserPhoto (refuses below
 * MIN_REQUIRED_PHOTOS), not re-checked here.
 *
 * Rendering model: `photos` (already sorted ascending by display_order) is
 * drawn in array order as filled tiles, padded out to 6 cells with empty
 * "+" tiles. Reorder swaps two photos' raw display_order values directly --
 * deleteUserPhoto doesn't recompact remaining photos' display_order, so real
 * gaps (e.g. 0, 1, 3, 4 after deleting index 2) are the normal case, not an
 * edge case. Rendering by array position instead of `find(display_order===i)`
 * means gaps never need special-casing, and swapping two arbitrary order
 * values is correct regardless of what those values are.
 */
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
import { alert } from '@/lib/themed-alert';
import { MAX_PHOTOS, MIN_REQUIRED_PHOTOS, deleteUserPhoto, setPrimaryPhoto, swapPhotoOrder, uploadUserPhoto, type UserPhoto } from '@/lib/user-photos';

function getImagePicker(): typeof import('expo-image-picker') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

interface PhotoGridCardProps {
  photos: UserPhoto[];
  isDark: boolean;
  onChanged: () => Promise<void>;
}

export function PhotoGridCard({ photos, isDark, onChanged }: PhotoGridCardProps) {
  const [uploading, setUploading] = useState(false);
  const [busyPhotoId, setBusyPhotoId] = useState<string | null>(null);
  const { width: screenWidth } = Dimensions.get('window');
  const gap = 8;
  const tileWidth = Math.floor((screenWidth - 84 - (2 * gap)) / 3);

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    label: isDark ? '#7C7796' : '#8A7BA0',
    emptyBg: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
    emptyBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : '#D1D5DB',
    accent: isDark ? '#A855F7' : '#7C3AED',
  };

  const handleAddPhoto = async () => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        alert('Photo picker unavailable', 'This dev build is missing the image-picker module. Rebuild the app (npx expo run:ios / npx expo run:android) to enable photo uploads.');
        return;
      }
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        alert('Permission Required', 'AstroDate needs gallery access to upload photos.');
        return;
      }
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: true,
      });
      if (pickerResult.canceled || !pickerResult.assets?.length) return;

      const asset = pickerResult.assets[0];
      if (!asset.base64) throw new Error('Could not read image file data');

      const usedOrders = new Set(photos.map((p) => p.display_order));
      const nextOrder = [0, 1, 2, 3, 4, 5].find((i) => !usedOrders.has(i));
      if (nextOrder === undefined) return; // grid is full; add button shouldn't be reachable here anyway

      setUploading(true);
      const result = await uploadUserPhoto({ uri: asset.uri, base64: asset.base64, displayOrder: nextOrder });
      setUploading(false);

      if (!result.success) {
        alert('Upload Failed', result.error || 'An error occurred during image upload.');
        return;
      }
      await onChanged();
    } catch (err) {
      setUploading(false);
      alert('Upload Failed', err instanceof Error ? err.message : 'An error occurred during image upload.');
    }
  };

  const handleDeletePhoto = (photo: UserPhoto) => {
    alert('Remove Photo', 'Are you sure you want to delete this photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyPhotoId(photo.id);
          const result = await deleteUserPhoto(photo);
          setBusyPhotoId(null);
          if (!result.success) {
            alert('Cannot Remove Photo', result.error || 'Could not delete photo.');
            return;
          }
          await onChanged();
        },
      },
    ]);
  };

  const handleSetPrimary = async (photo: UserPhoto) => {
    if (photo.is_primary) return;
    setBusyPhotoId(photo.id);
    const result = await setPrimaryPhoto(photo.id);
    setBusyPhotoId(null);
    if (!result.success) {
      alert('Error', result.error || 'Could not set primary photo.');
      return;
    }
    await onChanged();
  };

  const handleReorder = async (index: number, direction: -1 | 1) => {
    const other = photos[index + direction];
    const current = photos[index];
    if (!other) return;
    setBusyPhotoId(current.id);
    const result = await swapPhotoOrder(current, other);
    setBusyPhotoId(null);
    if (!result.success) {
      alert('Error', result.error || 'Could not reorder photos.');
      return;
    }
    await onChanged();
  };

  const emptySlotCount = Math.max(0, MAX_PHOTOS - photos.length);

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: T.label }]}>PHOTOS</Text>
        <Text style={[styles.count, { color: T.label }]}>
          {photos.length} / {MAX_PHOTOS} · min {MIN_REQUIRED_PHOTOS}
        </Text>
      </View>

      <View style={[styles.grid, { gap: gap }]}>
        {photos.map((photo, index) => (
          <View key={photo.id} style={[styles.tile, { width: tileWidth }]}>
            <Pressable
              id={`btn-photo-set-primary-${photo.id}`}
              onPress={() => handleSetPrimary(photo)}
              style={styles.photoWrapper}
              accessibilityRole="button"
              accessibilityLabel={photo.is_primary ? 'Primary photo' : 'Set as primary photo'}
            >
              <Image source={{ uri: photo.photo_url }} style={styles.photoImage} />

              {busyPhotoId === photo.id ? (
                <View style={styles.busyOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              ) : null}

              <Pressable
                id={`btn-photo-delete-${photo.id}`}
                onPress={() => handleDeletePhoto(photo)}
                style={styles.deleteBadge}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
              >
                <Text style={styles.deleteBadgeText}>×</Text>
              </Pressable>

              {photo.is_primary ? (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>Primary</Text>
                </View>
              ) : null}

              <View style={styles.reorderRow} pointerEvents="box-none">
                {index > 0 ? (
                  <Pressable
                    id={`btn-photo-move-left-${photo.id}`}
                    onPress={() => handleReorder(index, -1)}
                    style={styles.reorderBtn}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Move photo earlier"
                  >
                    <Text style={styles.reorderText}>‹</Text>
                  </Pressable>
                ) : (
                  <View style={styles.reorderBtn} />
                )}
                {index < photos.length - 1 ? (
                  <Pressable
                    id={`btn-photo-move-right-${photo.id}`}
                    onPress={() => handleReorder(index, 1)}
                    style={styles.reorderBtn}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Move photo later"
                  >
                    <Text style={styles.reorderText}>›</Text>
                  </Pressable>
                ) : (
                  <View style={styles.reorderBtn} />
                )}
              </View>
            </Pressable>
          </View>
        ))}

        {Array.from({ length: emptySlotCount }).map((_, i) => (
          <View key={`empty-${i}`} style={[styles.tile, { width: tileWidth }]}>
            <Pressable
              id={`btn-photo-add-${i}`}
              style={[styles.emptySlot, { backgroundColor: T.emptyBg, borderColor: T.emptyBorder }]}
              onPress={handleAddPhoto}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
            >
              {uploading ? (
                <ActivityIndicator color={T.accent} />
              ) : (
                <>
                  <View style={[styles.plusIconWrap, { borderColor: T.accent }]}>
                    <Text style={[styles.plusIconText, { color: T.accent }]}>+</Text>
                  </View>
                  <Text style={[styles.emptySlotText, { color: T.label }]}>Add Photo</Text>
                </>
              )}
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  header: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  count: { fontSize: 11, fontWeight: '600' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { aspectRatio: 1 },

  photoWrapper: { flex: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deleteBadgeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: -2 },
  primaryBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  primaryBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  reorderRow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reorderBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: -1 },

  emptySlot: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  plusIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  plusIconText: { fontSize: 16, fontWeight: '600', marginTop: -1.5 },
  emptySlotText: { fontSize: 9.5, fontWeight: '600', textAlign: 'center' },
});
