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
  useWindowDimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = 'Baskerville-Old-Face';

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
  const { width: screenW, height: screenH } = useWindowDimensions();
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

  useEffect(() => {
    loadUserPhotos();
  }, []);

  const loadUserPhotos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', user.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      if (data) setPhotos(data);
    } catch (e: any) {
      console.warn('Failed to load user photos:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (index: number) => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'AstroDate needs gallery access to upload photos.');
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
        return;
      }

      setUploadingIdx(index);
      const selectedUri = pickerResult.assets[0].uri;

      // 1. Upload to Supabase Storage
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      const response = await fetch(selectedUri);
      const blob = await response.blob();
      const fileExt = selectedUri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}_${index}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-photos')
        .upload(filePath, blob, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
        });

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-photos')
        .getPublicUrl(filePath);

      // 3. Insert metadata record in database
      const { error: dbError } = await supabase.from('user_photos').insert({
        user_id: user.id,
        photo_url: publicUrl,
        storage_path: filePath,
        display_order: index,
        is_primary: index === 0,
      });

      if (dbError) throw dbError;

      // 4. Reload local photos state
      await loadUserPhotos();
    } catch (err: any) {
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
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
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
            style={[
              styles.actionButton,
              !isContinueEnabled && {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#D1D5DB',
                opacity: 0.8,
              },
            ]}
            disabled={!isContinueEnabled || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={[
                  styles.actionText,
                  !isContinueEnabled && { color: isDark ? '#5A5478' : '#9CA3AF' },
                ]}
              >
                {isContinueEnabled ? 'Continue' : `Add ${neededMore} More`}
              </Text>
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
    backgroundColor: '#7C3AED',
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
