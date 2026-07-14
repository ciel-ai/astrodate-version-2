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
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { AboutMeCard } from '@/components/profile/about-me-card';
import { BasicInfoCard, type BasicInfoField } from '@/components/profile/basic-info-card';
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
import { useAppTheme } from '@/lib/theme-context';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { membership } = useSubscriptionStatus();
  const { profile, loading, refreshing, refresh, refetch, completionPercent, error } = useProfileData();
  const isDark = theme === 'dark';

  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const handleSaveBio = async (bio: string) => {
    const result = await saveOnboardingResponses({ about_me: bio });
    if (result.success) await refetch();
    return result;
  };

  const handleSaveBasicInfoField = async (field: BasicInfoField, value: string) => {
    const result =
      field === 'height'
        ? await saveSection1Height(value)
        : await saveOnboardingResponses({ [field]: value });
    if (result.success) await refetch();
    return result;
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
            />
            {completionPercent < 100 ? (
              <ProfileCompletionCard percent={completionPercent} isDark={isDark} />
            ) : null}
            <MembershipCard membership={membership} isDark={isDark} />
            <AboutMeCard bio={profile.bio} isDark={isDark} onSave={handleSaveBio} />
            <PromptsCard
              prompts={profile.prompts}
              isDark={isDark}
              onEdit={() => router.push('/edit-prompts')}
            />
            <CosmicIdentityCard profile={profile} />
            <BasicInfoCard
              values={{
                height: profile.height,
                education: profile.education,
                drinking: profile.drinking,
                smoking: profile.smoking,
              }}
              isDark={isDark}
              onSaveField={handleSaveBasicInfoField}
            />
            <PhotoGridCard photos={profile.photos} isDark={isDark} onChanged={refetch} />
          </>
        )}
      </ScrollView>
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
});
