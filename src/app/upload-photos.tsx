import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteUserPhoto, getUserPhotos, uploadUserPhoto, type UserPhoto } from '@/lib/user-photos';

const SERIF = 'Baskerville-Old-Face';

// expo-image-picker's native module (ExponentImagePicker) can be absent from an
// out-of-date dev client. Load it lazily so this screen still renders and photo
// picking fails with a friendly message instead of crashing the whole bundle.
// The permanent fix is to rebuild the dev client: `npx expo run:android`.
function getImagePicker(): typeof import('expo-image-picker') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

export default function UploadPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [photos, setPhotos] = useState<UserPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Background asset based on theme
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const loadUserPhotos = async () => {
    const result = await getUserPhotos();
    if (result.success) {
      setPhotos(result.data ?? []);
    } else {
      console.warn('Failed to load user photos:', result.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    // Data fetch on mount; the compiler's set-state-in-effect heuristic misreads this
    // (React-doc-sanctioned pattern: https://react.dev/learn/you-might-not-need-an-effect#fetching-data).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUserPhotos();
  }, []);

  const handlePickImage = async (index: number) => {
    try {
      const ImagePicker = getImagePicker();
      if (!ImagePicker) {
        Alert.alert(
          'Photo picker unavailable',
          'This dev build is missing the image-picker module. Rebuild the app (npx expo run:android) to enable photo uploads.'
        );
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'AstroDate needs gallery access to upload photos.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      const asset = pickerResult.assets[0];
      if (!asset.base64) throw new Error('Could not read image file data');

      setUploadingIdx(index);
      const result = await uploadUserPhoto({ uri: asset.uri, base64: asset.base64, displayOrder: index });
      setUploadingIdx(null);

      if (!result.success) {
        Alert.alert('Upload Failed', result.error || 'An error occurred during image upload.');
        return;
      }

      await loadUserPhotos();
    } catch (err: any) {
      setUploadingIdx(null);
      Alert.alert('Upload Failed', err.message || 'An error occurred during image upload.');
    }
  };

  const handleDeletePhoto = (photo: UserPhoto) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const result = await deleteUserPhoto(photo);
            if (!result.success) {
              setLoading(false);
              Alert.alert('Cannot Remove Photo', result.error || 'Failed to remove photo');
              return;
            }
            await loadUserPhotos();
          },
        },
      ]
    );
  };

  const handleContinue = () => {
    if (photos.length < 3) {
      Alert.alert('Photos Required', 'Please upload at least 3 photos to proceed.');
      return;
    }
    router.push('/finish-ques');
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  // Create grid arrays for 6 slots
  const slots = Array.from({ length: 6 }).map((_, idx) => {
    return photos.find(p => p.display_order === idx) || null;
  });

  const photoCount = photos.length;
  const isContinueEnabled = photoCount >= 3;
  const neededMore = 3 - photoCount;

  return (
    <ImageBackground source={bgSource} style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#F5F3FF' }]} resizeMode="cover">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={14} />

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 20, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Add Your Photos</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
              Show your best self! Add at least 3 photos to continue.
            </Text>
          </View>

          {/* Info Banner */}
          <View
            style={[
              styles.infoBanner,
              {
                backgroundColor: isDark ? 'rgba(168, 85, 247, 0.08)' : '#F3ECFF',
                borderColor: isDark ? 'rgba(168, 85, 247, 0.2)' : 'rgba(75, 0, 130, 0.15)',
              },
            ]}
          >
            <Text style={[styles.infoIcon, { color: isDark ? '#B57BFF' : '#4B0082' }]}>ℹ️</Text>
            <Text style={[styles.infoText, { color: isDark ? '#D4B8FF' : '#4B0082' }]}>
              All photos must be of the same person (yourself)
            </Text>
          </View>

          {/* Progress Tracker */}
          <View style={styles.progressContainer}>
            <Text style={[styles.progressText, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>
              {photoCount} / 6 photos
            </Text>
            <View style={[styles.progressBarTrack, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#E5E7EB' }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${(photoCount / 6) * 100}%`,
                    backgroundColor: isDark ? '#A855F7' : '#7C3AED',
                  },
                ]}
              />
            </View>
          </View>

          {/* 3x2 Grid */}
          <View style={styles.grid}>
            {slots.map((photo, idx) => {
              const isPrimary = idx === 0;
              const isUploading = uploadingIdx === idx;

              return (
                <View key={idx} style={styles.gridItemContainer}>
                  {photo ? (
                    <View style={styles.photoWrapper}>
                      <Image source={{ uri: photo.photo_url }} style={styles.photoImage} />
                      {/* Delete Badge */}
                      <Pressable
                        style={styles.deleteBadge}
                        onPress={() => handleDeletePhoto(photo)}
                      >
                        <Text style={styles.deleteBadgeText}>×</Text>
                      </Pressable>
                      {isPrimary && (
                        <View style={styles.primaryBadge}>
                          <Text style={styles.primaryBadgeText}>Primary</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Pressable
                      style={[
                        styles.emptySlot,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#D1D5DB',
                        },
                      ]}
                      onPress={() => !isUploading && handlePickImage(idx)}
                      disabled={loading}
                    >
                      {isUploading ? (
                        <ActivityIndicator color={isDark ? '#A855F7' : '#7C3AED'} />
                      ) : (
                        <>
                          <View style={[styles.plusIconWrap, { borderColor: isDark ? '#A855F7' : '#7C3AED' }]}>
                            <Text style={[styles.plusIconText, { color: isDark ? '#A855F7' : '#7C3AED' }]}>+</Text>
                          </View>
                          <Text style={[styles.emptySlotText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
                            {isPrimary ? 'Add Primary\nPhoto' : 'Add Photo'}
                          </Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {/* Action button */}
          <Pressable
            id="btn-upload-continue"
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.actionButton,
              !isContinueEnabled && {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#D1D5DB',
                experimental_backgroundImage: 'none',
                opacity: 0.8,
              },
              pressed && styles.actionPressed,
            ]}
            disabled={!isContinueEnabled || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.actionButtonContent}>
                <Text
                  style={[
                    styles.actionText,
                    !isContinueEnabled && { color: isDark ? '#5A5478' : '#9CA3AF' },
                  ]}
                >
                  {isContinueEnabled ? 'Continue' : `Add ${neededMore} More`}
                </Text>
                {isContinueEnabled && <Text style={styles.actionArrow}>→</Text>}
              </View>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  scrollStyle: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  container: { flex: 1, paddingHorizontal: 20 },

  // ── Header ──
  header: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 20,
  },
  heading: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: 'normal',
    lineHeight: 36,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },

  // ── Info Banner ──
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
    gap: 10,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },

  // ── Progress Tracker ──
  progressContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // ── 3x2 Grid ──
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 32,
    rowGap: 14,
  },
  gridItemContainer: {
    width: '31%',
    aspectRatio: 0.72, // taller card aspect ratio matching screenshot
  },
  photoWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  deleteBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deleteBadgeText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -2,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(124, 58, 237, 0.85)',
    paddingVertical: 3,
    alignItems: 'center',
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  plusIconText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: -1.5,
  },
  emptySlotText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 14,
  },

  // ── Action Button ──
  actionButton: {
    height: 54,
    width: '100%',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(90deg, #7C3AED, #C026D3)',
    ...Platform.select({
      ios: { shadowColor: '#C026D3', shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 28px 0 rgba(192,38,211,0.55)' } as any,
    }),
  } as any,
  actionPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  actionArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -4,
  },
});
