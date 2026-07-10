import { useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { requestAndSyncLocation } from '@/lib/location';

const SERIF = 'Baskerville-Old-Face';

// Dedicated, explicit ask for precise device location -- kept separate from
// address.tsx's city text field on purpose. Filling in a city name doesn't
// need device GPS at all; radius-based Discover matching does, and it's a
// materially more sensitive permission, so it gets its own clear rationale
// and its own skippable moment rather than being bundled into an unrelated
// "fill in my city" action. Distance filtering already fails open
// server-side (get_fallback_feed) when this is skipped, so declining here
// costs nothing functionally -- it just means no radius filtering for that
// user, same as today's silent gap, just now an honest visible choice.
export default function EnableLocationScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09031C' : '#F0E6FF' }} />;
  }

  const handleEnable = async () => {
    setLoading(true);
    await requestAndSyncLocation();
    setLoading(false);
    router.push('/birth-details');
  };

  const handleSkip = () => {
    router.push('/birth-details');
  };

  return (
    <ImageBackground
      source={bgSource}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <Glitters count={16} />

      <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>

        <View style={styles.starIconWrap}>
          <Text style={styles.starEmoji}>📍</Text>
        </View>

        <Text style={styles.titleText}>
          See people{'\n'}<Text style={styles.highlightText}>close to you</Text>
        </Text>

        <Text style={styles.descriptionText}>
          Enable location so we can show you matches nearby and filter Discover by distance.
        </Text>

        <View style={styles.buttonArea}>
          <Pressable
            id="btn-enable-location"
            onPress={handleEnable}
            disabled={loading}
            style={({ pressed }) => [
              styles.btnBase,
              styles.btnEnable,
              pressed && styles.btnPressed,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.btnText}>Enable Location</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          id="btn-skip-location"
          onPress={handleSkip}
          disabled={loading}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },

  starIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  starEmoji: {
    fontSize: 26,
  },

  titleText: {
    color: '#FFFFFF',
    fontFamily: SERIF,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    fontWeight: 'normal',
    marginBottom: 12,
  },
  highlightText: {
    color: '#B57BFF',
  },

  descriptionText: {
    color: '#9A93B5',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.85,
    marginBottom: 28,
    paddingHorizontal: 10,
  },

  buttonArea: {
    width: '100%',
    gap: 12,
    marginBottom: 20,
  },
  btnBase: {
    height: 52,
    width: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnEnable: {
    experimental_backgroundImage: 'linear-gradient(90deg, #7C3AED, #C026D3)',
    ...Platform.select({
      ios: { shadowColor: '#C026D3', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
      web: { boxShadow: '0 6px 20px 0 rgba(192,38,211,0.45)' } as any,
    }),
  } as any,
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  skipBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipBtnPressed: {
    opacity: 0.7,
  },
  skipText: {
    color: '#7C7796',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
