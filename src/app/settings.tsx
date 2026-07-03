/**
 * Settings screen
 *
 * Surfaces the location-sharing toggle (backed by disableLocationSharing /
 * requestAndSyncLocation) and links through to Privacy Policy.
 */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
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
import { useAppTheme } from '@/lib/theme-context';

import Glitters from '@/components/glitters';
import {
  disableLocationSharing,
  hasLocationPermission,
  requestAndSyncLocation,
} from '@/lib/location';

const SERIF = 'Baskerville-Old-Face';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setThemeMode } = useAppTheme();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  // Read current permission state on mount
  useEffect(() => {
    hasLocationPermission().then((granted) => {
      setLocationEnabled(granted);
      setLocationLoading(false);
    });
  }, []);

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
        <Text style={[styles.backIcon, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>‹</Text>
      </Pressable>

      <View style={[styles.container, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.title, { color: theme === 'dark' ? '#FFFFFF' : '#1B1528' }]}>Settings</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>

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
  backIcon: { color: '#FFFFFF', fontSize: 26, lineHeight: 28, marginTop: -2 },

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
