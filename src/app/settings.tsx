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

  return (
    <ImageBackground
      source={require('@/assets/images/create-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <Glitters count={10} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 8 }]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <View style={[styles.container, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.title}>Settings</Text>

        <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>

          {/* ── Privacy & Location ── */}
          <Text style={styles.sectionLabel}>PRIVACY & LOCATION</Text>
          <View style={styles.card}>

            {/* Location sharing row */}
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>📍</Text>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>Share My Location</Text>
                  <Text style={styles.rowSub}>
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
                  trackColor={{ false: 'rgba(255,255,255,0.12)', true: '#7C3AED' }}
                  thumbColor={locationEnabled ? '#D4B8FF' : '#6B6785'}
                  ios_backgroundColor="rgba(255,255,255,0.12)"
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
                  <Text style={styles.rowTitle}>Privacy Policy</Text>
                  <Text style={styles.rowSub}>
                    How we collect, use, and protect your data.
                  </Text>
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>

          {/* Info note */}
          <View style={styles.infoNote}>
            <Text style={styles.infoNoteText}>
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
});
