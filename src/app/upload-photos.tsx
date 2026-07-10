import React, { useState, useEffect } from 'react';
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
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

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

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) {
    lookup[chars.charCodeAt(i)] = i;
  }

  let bufferLength = base64.length * 0.75;
  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const arrayBuffer = new ArrayBuffer(bufferLength);
  const bytes = new Uint8Array(arrayBuffer);

  let p = 0;
  for (let i = 0; i < base64.length; i += 4) {
    const encoded1 = lookup[base64.charCodeAt(i)];
    const encoded2 = lookup[base64.charCodeAt(i + 1)];
    const encoded3 = lookup[base64.charCodeAt(i + 2)];
    const encoded4 = lookup[base64.charCodeAt(i + 3)];

    const bytes1 = (encoded1 << 2) | (encoded2 >> 4);
    const bytes2 = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    const bytes3 = ((encoded3 & 3) << 6) | (encoded4 & 63);

    bytes[p++] = bytes1;
    if (p < bufferLength) bytes[p++] = bytes2;
    if (p < bufferLength) bytes[p++] = bytes3;
  }

  return arrayBuffer;
}


interface PhotoItem {
  id: string;
  photo_url: string;
  storage_path: string;
  display_order: number;
  is_primary: boolean;
}

export default function UploadPhotosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Background asset based on theme
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const loadUserPhotos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[loadUserPhotos] No authenticated user found.');
        return;
      }

      console.log('[loadUserPhotos] Fetching photos for user:', user.id);
      const { data, error } = await supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('[loadUserPhotos] Database fetch error:', error);
        throw error;
      }
      console.log('[loadUserPhotos] Retrieved photos from database:', data);

      if (data && data.length > 0) {
        // The bucket is public (20260710120000_make_user_photos_bucket_public.sql)
        // and every stored photo_url is already a public URL, so this signed-URL
        // round trip is no longer required to make images load -- kept as-is since
        // it's harmless and still correctly resolves to a working URL either way.
        const paths = data.map(p => p.storage_path);
        console.log('[loadUserPhotos] Generating signed URLs for paths:', paths);
        const { data: signedData, error: signedError } = await supabase.storage
          .from('user-photos')
          .createSignedUrls(paths, 86400); // 24 hours expiry

        if (signedError) {
          console.error('[loadUserPhotos] Error generating signed URLs:', signedError);
          throw signedError;
        }

        const photosWithSignedUrls = data.map(photo => {
          const signedItem = signedData?.find(s => s.path === photo.storage_path);
          return {
            ...photo,
            photo_url: signedItem?.signedUrl || photo.photo_url,
          };
        });

        console.log('[loadUserPhotos] Finished mapping photos with signed URLs:', photosWithSignedUrls);
        setPhotos(photosWithSignedUrls);
      } else {
        setPhotos([]);
      }
    } catch (e: any) {
      console.warn('Failed to load user photos:', e.message);
    } finally {
      setLoading(false);
    }
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        console.log('[handlePickImage] Image picking cancelled.');
        return;
      }

      setUploadingIdx(index);
      const selectedUri = pickerResult.assets[0].uri;
      const base64Data = pickerResult.assets[0].base64;

      if (!base64Data) throw new Error('Could not read image file data');

      console.log('[handlePickImage] Image picked. Converting base64 to ArrayBuffer...');
      const arrayBuffer = base64ToArrayBuffer(base64Data);

      // 1. Upload to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const fileExt = selectedUri.split('.').pop() || 'jpg';
      // Date.now() here runs inside an onPress handler, not during render.
      // eslint-disable-next-line react-hooks/purity
      const fileName = `${Date.now()}_${index}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      console.log('[handlePickImage] Uploading to storage path:', filePath);
      const { error: uploadError } = await supabase.storage
        .from('user-photos')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        });

      if (uploadError) {
        console.error('[handlePickImage] Storage upload error:', uploadError);
        throw uploadError;
      }
      console.log('[handlePickImage] Storage upload successful. Getting public URL...');

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      console.log('[handlePickImage] Public URL obtained:', publicUrl);

      // 3. Insert metadata record in database
      // Primary is whichever photo lands first, not whichever fills slot 0 --
      // otherwise a user who fills slots 1-3 before slot 0 ends up with zero
      // primary photos, and slot 0 filled after another upload already
      // finished would create a second one.
      const isFirstPhoto = !photos.some((p) => p.is_primary);
      console.log('[handlePickImage] Inserting metadata into database...');
      const { data: insertData, error: dbError } = await supabase
        .from('user_photos')
        .insert({
          user_id: user.id,
          photo_url: publicUrl,
          storage_path: filePath,
          display_order: index,
          is_primary: isFirstPhoto,
        })
        .select();

      if (dbError) {
        console.error('[handlePickImage] Database insert error:', dbError);
        // The storage object already succeeded -- remove it so it doesn't
        // become a permanently orphaned file with no DB row pointing to it.
        await supabase.storage.from('user-photos').remove([filePath]).catch((cleanupErr) => {
          console.error('[handlePickImage] Failed to clean up orphaned storage object:', cleanupErr);
        });
        throw dbError;
      }
      console.log('[handlePickImage] Database insertion successful:', insertData);

      // 4. Reload local photos state
      await loadUserPhotos();
    } catch (err: any) {
      console.error('[handlePickImage] Error:', err);
      Alert.alert('Upload Failed', err.message || 'An error occurred during image upload.');
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleDeletePhoto = (photo: PhotoItem) => {
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to delete this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // Delete from storage
              await supabase.storage.from('user-photos').remove([photo.storage_path]);
              // Delete from database
              await supabase.from('user_photos').delete().eq('id', photo.id);
              // Reload local list
              await loadUserPhotos();
            } catch (err: any) {
              Alert.alert('Error deleting photo', err.message);
            } finally {
              setLoading(false);
            }
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
