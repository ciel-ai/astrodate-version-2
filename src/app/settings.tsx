/**
 * Settings screen
 *
 * Split from Profile on purpose: Profile is what other users see about you,
 * Settings is how you control your own account and the app. Reached from
 * Profile's header gear icon.
 *
 * Delete account calls the delete-account Edge Function (see
 * supabase/functions/delete-account), which relies on every table's
 * ON DELETE CASCADE to auth.users for DB cleanup and separately purges the
 * user's storage objects. It does not cancel App Store/Play Store billing.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAppTheme } from '@/lib/theme-context';

import Glitters from '@/components/glitters';
import { useAuth } from '@/context/auth';
import { useSubscriptionStatus } from '@/context/subscription';
import { useSubscriptionPayment } from '@/hooks/use-subscription-payment';
import {
  disableLocationSharing,
  hasLocationPermission,
  requestAndSyncLocation,
} from '@/lib/location';
import { supabase } from '@/lib/supabase';

const SERIF = 'Baskerville-Old-Face';
const SUPPORT_EMAIL = 'hello@astrodate.in';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setThemeMode } = useAppTheme();
  const { user, signOut } = useAuth();
  const { membership } = useSubscriptionStatus();
  const { restorePurchases } = useSubscriptionPayment();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Defaults mirror user_notification_preferences' own column defaults
  // (supabase/migrations/20260630120000_baseline_tables.sql,
  // 20260714120000_notification_engagement_tiers.sql) for a user who hasn't
  // had a preferences row created yet.
  const [notifPrefs, setNotifPrefs] = useState({
    new_matches_enabled: true,
    new_messages_enabled: true,
    marketing_enabled: false,
    engagement_enabled: true,
  });
  // Lazy initializer (not an effect) so there's no synchronous setState call
  // to trigger react-hooks/set-state-in-effect: a user already known absent
  // at mount starts non-loading, everyone else starts loading until the
  // fetch below resolves.
  const [notifLoading, setNotifLoading] = useState(() => Boolean(user?.id));

  // Read current permission state on mount
  useEffect(() => {
    hasLocationPermission().then((granted) => {
      setLocationEnabled(granted);
      setLocationLoading(false);
    });
  }, []);

  // Read current notification preferences on mount. RLS
  // ("Users manage own notification preferences", FOR ALL USING auth.uid() =
  // user_id) already lets a signed-in user read their own row directly, no
  // RPC needed for the read side.
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_notification_preferences')
      .select('new_matches_enabled, new_messages_enabled, marketing_enabled, engagement_enabled')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNotifPrefs(data);
        setNotifLoading(false);
      });
  }, [user?.id]);

  const handleNotifToggle = async (
    key: keyof typeof notifPrefs,
    rpcParam: 'p_new_matches_enabled' | 'p_new_messages_enabled' | 'p_marketing_enabled' | 'p_engagement_enabled',
    value: boolean
  ) => {
    const previous = notifPrefs[key];
    setNotifPrefs((prev) => ({ ...prev, [key]: value }));
    const { error } = await supabase.rpc('update_notification_preferences', { [rpcParam]: value });
    if (error) {
      setNotifPrefs((prev) => ({ ...prev, [key]: previous }));
      Alert.alert('Error', 'Could not save that setting. Please try again.');
    }
  };

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const handleLocationToggle = async (value: boolean) => {
    setLocationLoading(true);
    try {
      if (value) {
        // User is turning ON — show OS prompt + sync
        const result = await requestAndSyncLocation();
        if (result === 'denied') {
          Alert.alert(
            'Permission Denied',
            'To enable location, please grant permission in your device Settings.',
          );
          setLocationEnabled(false);
        } else if (result === 'error') {
          Alert.alert('Error', 'Could not save your location. Please try again.');
          setLocationEnabled(false);
        } else {
          setLocationEnabled(true);
        }
      } else {
        // User is turning OFF — delete the stored point from the backend
        const ok = await disableLocationSharing();
        if (!ok) {
          Alert.alert('Error', 'Could not disable location sharing. Please try again.');
        } else {
          setLocationEnabled(false);
        }
      }
    } finally {
      setLocationLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', "You'll need to sign back in to see your matches and chats.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          await signOut();
          router.replace('/create-account');
          setSigningOut(false);
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    const subscriptionNote = membership?.is_active
      ? ' This does not cancel your subscription — cancel it in the App Store/Play Store first, or you may keep being billed.'
      : '';
    Alert.alert(
      'Delete account permanently?',
      `This removes your profile, photos, matches, and messages forever. This can't be undone.${subscriptionNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete my account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { data, error } = await supabase.functions.invoke('delete-account');
            if (error || !data?.success) {
              setDeleting(false);
              Alert.alert(
                'Something went wrong',
                "We couldn't delete your account. Email us and we'll take care of it.",
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Email support', onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Delete my account`) },
                ]
              );
              return;
            }
            await signOut();
            router.replace('/create-account');
            setDeleting(false);
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    setRestoring(true);
    const restored = await restorePurchases();
    setRestoring(false);
    Alert.alert(
      restored ? 'Purchases restored' : 'Nothing to restore',
      restored ? 'Your subscription is up to date.' : "We couldn't find an active purchase for this account."
    );
  };

  const phoneDisplay = user?.phone ? `+${user.phone}` : 'Not linked';
  const planDisplay = membership?.is_active ? membership?.plan_badge ?? membership?.plan_name ?? 'Member' : 'Free plan';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const bgSource = theme === 'dark'
    ? require('@/assets/images/create-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  return (
    <ImageBackground
      source={bgSource}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Glitters count={10} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={[
          styles.backBtn,
          {
            top: insets.top + 8,
            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.1)',
          }
        ]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <View style={[styles.backChevron, { borderColor: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]} />
      </Pressable>

      <View style={[styles.container, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.title, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Settings</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>

          {/* ── Account & Security ── */}
          <Text style={styles.sectionLabel}>ACCOUNT & SECURITY</Text>
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <View style={[styles.row, styles.rowTopAlign]}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>📱</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Phone number</Text>
                  <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>Your login credential — contact support to change it.</Text>
                </View>
              </View>
              <Text style={[styles.rowValue, styles.rowValueTopAlign, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>{phoneDisplay}</Text>
            </View>

            <View style={styles.divider} />

            <Pressable
              id="btn-settings-sign-out"
              onPress={handleSignOut}
              disabled={signingOut}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🚪</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, styles.destructiveText]}>Sign out</Text>
                </View>
              </View>
              {signingOut ? <ActivityIndicator size="small" color="#F87171" /> : null}
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              id="btn-settings-delete-account"
              onPress={handleDeleteAccount}
              disabled={deleting}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🗑️</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, styles.destructiveText]}>Delete account</Text>
                </View>
              </View>
              {deleting ? <ActivityIndicator size="small" color="#F87171" /> : null}
            </Pressable>
          </View>

          {/* ── Subscription & Billing ── */}
          <Text style={styles.sectionLabel}>SUBSCRIPTION & BILLING</Text>
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <Pressable
              id="btn-settings-manage-subscription"
              onPress={() => router.push('/subscription')}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>✦</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Manage subscription</Text>
                  <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>Current plan: {planDisplay}</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              id="btn-settings-restore-purchases"
              onPress={handleRestore}
              disabled={restoring}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>♻️</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Restore purchases</Text>
                </View>
              </View>
              {restoring ? <ActivityIndicator size="small" color="#A855F7" /> : null}
            </Pressable>
          </View>

          {/* ── Privacy & Location ── */}
          <Text style={styles.sectionLabel}>PRIVACY & LOCATION</Text>
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>

            {/* Location sharing row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>📍</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Share My Location</Text>
                  <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>
                    Show a fuzzed distance to nearby users.{'\n'}
                    Your exact position is never revealed.
                  </Text>
                </View>
              </View>

              {locationLoading ? (
                <ActivityIndicator color="#A855F7" size="small" />
              ) : (
                <Switch
                  id="toggle-location-sharing"
                  value={locationEnabled}
                  onValueChange={handleLocationToggle}
                  trackColor={{ false: theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', true: '#7C3AED' }}
                  thumbColor={locationEnabled ? '#D4B8FF' : (theme === 'dark' ? '#6B6785' : '#A39FBD')}
                  ios_backgroundColor={theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}
                  accessibilityLabel="Toggle location sharing"
                />
              )}
            </View>

            <View style={styles.divider} />

            {/* Blocked accounts */}
            <Pressable
              id="btn-settings-blocked-accounts"
              onPress={() => router.push('/blocked-accounts')}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🛡️</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Blocked Accounts</Text>
                  <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>
                    See and manage who you&apos;ve blocked.
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <View style={styles.divider} />

            {/* Privacy Policy link */}
            <Pressable
              id="btn-privacy-policy"
              onPress={() => router.push('/privacy')}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🔒</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Privacy Policy</Text>
                  <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>
                    How we collect, use, and protect your data.
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>

          {/* ── Notifications ── */}
          <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
            {notifLoading ? (
              <View style={styles.row}>
                <ActivityIndicator color="#A855F7" size="small" />
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowIcon}>✨</Text>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>New Matches</Text>
                    </View>
                  </View>
                  <Switch
                    id="toggle-notif-matches"
                    value={notifPrefs.new_matches_enabled}
                    onValueChange={(v) => handleNotifToggle('new_matches_enabled', 'p_new_matches_enabled', v)}
                    trackColor={{ false: theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', true: '#7C3AED' }}
                    thumbColor={notifPrefs.new_matches_enabled ? '#D4B8FF' : (theme === 'dark' ? '#6B6785' : '#A39FBD')}
                    ios_backgroundColor={theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}
                    accessibilityLabel="Toggle new match notifications"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowIcon}>💬</Text>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Messages</Text>
                    </View>
                  </View>
                  <Switch
                    id="toggle-notif-messages"
                    value={notifPrefs.new_messages_enabled}
                    onValueChange={(v) => handleNotifToggle('new_messages_enabled', 'p_new_messages_enabled', v)}
                    trackColor={{ false: theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', true: '#7C3AED' }}
                    thumbColor={notifPrefs.new_messages_enabled ? '#D4B8FF' : (theme === 'dark' ? '#6B6785' : '#A39FBD')}
                    ios_backgroundColor={theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}
                    accessibilityLabel="Toggle message notifications"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowIcon}>❤️</Text>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Likes</Text>
                      <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>
                        When someone new likes you.
                      </Text>
                    </View>
                  </View>
                  <Switch
                    id="toggle-notif-likes"
                    value={notifPrefs.marketing_enabled}
                    onValueChange={(v) => handleNotifToggle('marketing_enabled', 'p_marketing_enabled', v)}
                    trackColor={{ false: theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', true: '#7C3AED' }}
                    thumbColor={notifPrefs.marketing_enabled ? '#D4B8FF' : (theme === 'dark' ? '#6B6785' : '#A39FBD')}
                    ios_backgroundColor={theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}
                    accessibilityLabel="Toggle likes notifications"
                  />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowIcon}>🔮</Text>
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Astrology Updates</Text>
                      <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>
                        Daily forecasts and standout matches entering your sky.
                      </Text>
                    </View>
                  </View>
                  <Switch
                    id="toggle-notif-engagement"
                    value={notifPrefs.engagement_enabled}
                    onValueChange={(v) => handleNotifToggle('engagement_enabled', 'p_engagement_enabled', v)}
                    trackColor={{ false: theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)', true: '#7C3AED' }}
                    thumbColor={notifPrefs.engagement_enabled ? '#D4B8FF' : (theme === 'dark' ? '#6B6785' : '#A39FBD')}
                    ios_backgroundColor={theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'}
                    accessibilityLabel="Toggle astrology update notifications"
                  />
                </View>
              </>
            )}
          </View>

          {/* ── Appearance ── */}
          <Text style={styles.sectionLabel}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🎨</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Theme Mode</Text>
                  <Text style={[styles.rowSub, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>
                    Choose between system default, light, or dark.
                  </Text>
                </View>
              </View>
              
              {/* Theme switch selector */}
              <View style={[styles.themeSelectorContainer, { backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderColor: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}>
                {(['system', 'light', 'dark'] as const).map((mode) => {
                  const isActive = themeMode === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => setThemeMode(mode)}
                      style={[
                        styles.themeSelectorButton,
                        isActive && styles.themeSelectorButtonActive
                      ]}
                    >
                      <Text style={[
                        styles.themeSelectorText,
                        { color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' },
                        isActive && styles.themeSelectorTextActive
                      ]}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── Legal & Support ── */}
          <Text style={styles.sectionLabel}>LEGAL & SUPPORT</Text>
          <View style={[styles.card, { backgroundColor: theme === 'dark' ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)', borderColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }]}>
            <Pressable
              id="btn-settings-terms"
              onPress={() => router.push('/terms')}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>📜</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Terms of Service</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              id="btn-settings-contact-support"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>💬</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Contact support</Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>ℹ️</Text>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>App version</Text>
                </View>
              </View>
              <Text style={[styles.rowValue, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>{appVersion}</Text>
            </View>
          </View>

          {/* Info note */}
          <View style={[styles.infoNote, { backgroundColor: theme === 'dark' ? 'rgba(20, 12, 40, 0.55)' : 'rgba(255, 255, 255, 0.85)', borderColor: theme === 'dark' ? 'rgba(168, 85, 247, 0.18)' : 'rgba(168, 85, 247, 0.3)' }]}>
            <Text style={[styles.infoNoteText, { color: theme === 'dark' ? '#7C7796' : '#6B7280' }]}>
              Disabling location sharing removes your location from our servers immediately.
              You will still appear in the discovery feed, but without a distance label.
            </Text>
          </View>

        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  container: { flex: 1, paddingHorizontal: 20 },
  scroll: { flex: 1 },

  backBtn: {
    position: 'absolute',
    left: 18,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },

  title: {
    fontFamily: SERIF,
    color: '#FFFFFF',
    fontSize: 26,
    marginBottom: 28,
  },

  sectionLabel: {
    color: '#6B6785',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ── Card ──
  card: {
    borderRadius: 18,
    backgroundColor: 'rgba(13, 9, 32, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    marginBottom: 16,
  },

  // ── Row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  // Default `row` centers its children on the row's full height, which only
  // looks right when both sides are single-line. Phone number's subtitle
  // wraps to 2 lines, so centering left the value floating mid-way down
  // instead of next to the title -- top-align just this row instead.
  rowTopAlign: { alignItems: 'flex-start' },
  rowValueTopAlign: { marginTop: 2 },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, gap: 12 },
  rowIcon: { fontSize: 22, marginTop: 1 },
  rowText: { flex: 1 },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  rowSub: {
    color: '#7C7796',
    fontSize: 12,
    lineHeight: 17,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 8,
  },
  destructiveText: {
    color: '#F87171',
  },
  chevron: {
    color: '#6B6785',
    fontSize: 22,
    marginLeft: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginHorizontal: 16,
  },

  // ── Info note ──
  infoNote: {
    borderRadius: 12,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.18)',
    padding: 14,
    marginBottom: 32,
  },
  infoNoteText: {
    color: '#7C7796',
    fontSize: 12,
    lineHeight: 18,
  },
  themeSelectorContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
  },
  themeSelectorButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  themeSelectorButtonActive: {
    backgroundColor: '#7C3AED',
  },
  themeSelectorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeSelectorTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
