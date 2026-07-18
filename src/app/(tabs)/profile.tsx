/**
 * Profile tab
 *
 * Phase 5 (polish) added on top of Phases 2-4: a completion-meter banner
 * (hidden at 100%), scoped only to fields that were never required anywhere
 * else in the app -- see calculateProfileCompletion in use-profile-data.ts
 * for why. Pull-to-refresh and sign-out confirmation were already built in
 * earlier phases; empty states were covered incrementally as each card was
 * built. This closes out the Profile Tab plan's 5 phases.
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { AboutMeCard } from '@/components/profile/about-me-card';
import { BasicInfoCard, type BasicInfoField } from '@/components/profile/basic-info-card';
import { RelationshipPreferencesCard, type RelationshipPreferencesField } from '@/components/profile/relationship-preferences-card';
import { CosmicIdentityCard } from '@/components/profile/cosmic-identity-card';
import { HeroCard } from '@/components/profile/hero-card';
import { MembershipCard } from '@/components/profile/membership-card';
import { PhotoGridCard } from '@/components/profile/photo-grid-card';
import { ProfileCompletionCard } from '@/components/profile/profile-completion-card';
import { PromptsCard } from '@/components/profile/prompts-card';
import { useSubscriptionStatus } from '@/context/subscription';
import { useProfileData } from '@/hooks/use-profile-data';
import { saveOnboardingResponses } from '@/lib/onboarding-responses';
import { saveSection1Height } from '@/lib/section1-responses';
import { saveUserProfile } from '@/lib/user-profile';
import { useAppTheme } from '@/lib/theme-context';
import { uploadUserPhoto, getUserPhotos, setPrimaryPhoto } from '@/lib/user-photos';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { membership } = useSubscriptionStatus();
  const { profile, loading, refreshing, refresh, refetch, completionPercent, error } = useProfileData();
  const isDark = theme === 'dark';
  const [showEditModal, setShowEditModal] = useState(false);

  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const handleSaveBio = async (bio: string) => {
    const result = await saveOnboardingResponses({ about_me: bio });
    if (result.success) await refetch();
    return result;
  };

  const handleSaveBasicInfoField = async (field: BasicInfoField, value: any) => {
    const result =
      field === 'height'
        ? await saveSection1Height(value)
        : await saveOnboardingResponses({ [field]: value });
    if (result.success) await refetch();
    return result;
  };

  const handleSaveRelationshipPreferenceField = async (
    field: RelationshipPreferencesField,
    value: string
  ) => {
    let result;
    if (field === 'sexualOrientation') {
      result = await saveUserProfile({ sexual_orientation: value });
    } else {
      const dbField =
        field === 'haveChildren'
          ? 'have_children'
          : field === 'wantChildren'
          ? 'want_children'
          : 'relationship_style';
      result = await saveOnboardingResponses({ [dbField]: value });
    }
    if (result.success) await refetch();
    return result;
  };

  const handlePickAndUploadPrimary = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'AstroDate needs gallery access to upload photos.');
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
      if (!asset.base64) {
        Alert.alert('Error', 'Could not read image file data');
        return;
      }

      // Check max photos limit
      const existing = await getUserPhotos();
      if (existing.success && (existing.data?.length ?? 0) >= 6) {
        Alert.alert('Limit Reached', 'You can have at most 6 photos in your gallery. Remove one first.');
        return;
      }

      // Get next display order
      const usedOrders = new Set((existing.data ?? []).map((p) => p.display_order));
      const nextOrder = [0, 1, 2, 3, 4, 5].find((i) => !usedOrders.has(i)) ?? 0;

      const result = await uploadUserPhoto({
        uri: asset.uri,
        base64: asset.base64,
        displayOrder: nextOrder,
      });

      if (!result.success) {
        Alert.alert('Upload Failed', result.error || 'An error occurred during upload.');
        return;
      }

      // Set the newly uploaded photo as the primary profile photo
      const updated = await getUserPhotos();
      if (updated.success && updated.data) {
        const newPhoto = updated.data.find((p) => p.display_order === nextOrder);
        if (newPhoto) {
          await setPrimaryPhoto(newPhoto.id);
        }
      }

      await refetch();
      Alert.alert('Success', 'Profile photo updated successfully!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'An unexpected error occurred while uploading.');
    }
  };

  const handleEditPhoto = () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option to edit your profile picture',
      [
        {
          text: 'Upload Photo',
          onPress: handlePickAndUploadPrimary,
        },
        {
          text: 'Manage Gallery',
          onPress: () => {
            router.push('/upload-photos');
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#7C7796' : '#6B7280',
  };

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={10} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#A855F7"
            colors={['#A855F7', '#7C3AED']}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: T.text }]}>Profile</Text>
          <Pressable
            id="btn-profile-settings"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [
              styles.settingsBtn,
              { backgroundColor: T.card, borderColor: T.border },
              pressed && styles.pressed,
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(248, 113, 113, 0.10)' : 'rgba(248, 113, 113, 0.08)' }]}>
            <Text style={styles.errorText}>Couldn&apos;t load some profile data. Pull down to try again.</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#A855F7" />
          </View>
        ) : (
          <>
            <HeroCard
              profile={profile}
              membership={membership}
              isDark={isDark}
              onGetVerified={() => router.push('/verification')}
              onEditPhoto={() => setShowEditModal(true)}
            />
            {completionPercent < 100 ? (
              <ProfileCompletionCard percent={completionPercent} isDark={isDark} />
            ) : null}
            <MembershipCard membership={membership} isDark={isDark} />
            <CosmicIdentityCard profile={profile} />
          </>
        )}
      </ScrollView>

      {/* ── EDIT PROFILE MODAL ── */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={{ flex: 1, paddingTop: insets.top }}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => setShowEditModal(false)}
                style={styles.closeBtn}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close edit profile"
              >
                <Text style={[styles.closeBtnText, { color: T.text }]}>✕</Text>
              </Pressable>
              <Text style={[styles.modalTitle, { color: T.text }]}>Edit Profile</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24 }}
              showsVerticalScrollIndicator={false}
            >
              {/* 6 Image Grid */}
              <PhotoGridCard photos={profile.photos} isDark={isDark} onChanged={refetch} />

              {/* About Me / Bio */}
              <AboutMeCard bio={profile.bio} isDark={isDark} onSave={handleSaveBio} />

              {/* Prompts */}
              <PromptsCard
                prompts={profile.prompts}
                isDark={isDark}
                onEdit={() => {
                  setShowEditModal(false);
                  router.push('/edit-prompts');
                }}
              />

              {/* Basic Info */}
              <BasicInfoCard
                values={{
                  height: profile.height,
                  education: profile.education,
                  drinking: profile.drinking,
                  smoking: profile.smoking,
                  weed: profile.weed,
                  religion: profile.religion,
                  workout: profile.workout,
                  diet: profile.diet,
                  pets: profile.pets,
                  languages: profile.languages,
                  travel: profile.travel,
                }}
                isDark={isDark}
                onSaveField={handleSaveBasicInfoField}
              />

              {/* Relationship Preferences */}
              <RelationshipPreferencesCard
                values={{
                  sexualOrientation: profile.sexualOrientation,
                  haveChildren: profile.haveChildren,
                  wantChildren: profile.wantChildren,
                  relationshipStyle: profile.relationshipStyle,
                }}
                isDark={isDark}
                onSaveField={handleSaveRelationshipPreferenceField}
              />
            </ScrollView>
          </View>
        </ImageBackground>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%' },
  scrollContent: { paddingHorizontal: 20, flexGrow: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontSize: 26, fontWeight: '700' },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 18 },
  pressed: { opacity: 0.85 },

  loaderWrap: { paddingVertical: 60, alignItems: 'center' },

  errorBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.30)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { color: '#F87171', fontSize: 12.5, fontWeight: '600' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 20,
    fontWeight: '300',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
});
