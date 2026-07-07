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
import Svg, { Path } from 'react-native-svg';

import Glitters from '@/components/glitters';

const SERIF = 'Baskerville-Old-Face';

export default function SignBackInScreen() {
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

  const [loadingType, setLoadingType] = useState<'google' | 'apple' | null>(null);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09031C' : '#F0E6FF' }} />;
  }

  const handleAuth = (type: 'google' | 'apple') => {
    setLoadingType(type);
    // Simulate linking auth and redirect
    setTimeout(() => {
      setLoadingType(null);
      router.push('/cosmic-identity');
    }, 1500);
  };

  const handleSkip = () => {
    router.push('/cosmic-identity');
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
        
        {/* Top star icon overlay */}
        <View style={styles.starIconWrap}>
          <Text style={styles.starEmoji}>✦</Text>
        </View>

        {/* Heading title */}
        <Text style={styles.titleText}>
          An easier way{'\n'}to <Text style={styles.highlightText}>sign back in</Text>
        </Text>

        {/* Description */}
        <Text style={styles.descriptionText}>
          Connect an account to log back in quickly if you’re signed out.
        </Text>

        {/* Buttons Area */}
        <View style={styles.buttonArea}>
          
          {/* Google button */}
          <Pressable
            id="btn-link-google"
            onPress={() => handleAuth('google')}
            disabled={loadingType !== null}
            style={({ pressed }) => [
              styles.btnBase,
              styles.btnGoogle,
              pressed && styles.btnPressed
            ]}
          >
            {loadingType === 'google' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                {/* Google SVG G-Icon */}
                <Svg width="18" height="18" viewBox="0 0 24 24" style={styles.btnIcon}>
                  <Path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69a5.74 5.74 0 0 1-2.49 3.77v3.12h4.01c2.34-2.16 3.69-5.32 3.69-8.74z"
                  />
                  <Path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-4.01-3.12c-1.12.75-2.54 1.19-3.95 1.19-3.04 0-5.62-2.05-6.54-4.81H1.31v3.22A12.003 12.003 0 0 0 12 24z"
                  />
                  <Path
                    fill="#FBBC05"
                    d="M5.46 14.35A7.16 7.16 0 0 1 5.06 12c0-.82.14-1.62.4-2.35V6.43H1.31A11.99 11.99 0 0 0 0 12c0 2.12.56 4.12 1.31 5.57l4.15-3.22z"
                  />
                  <Path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.22 0 12 0 7.31 0 3.25 2.69 1.31 6.43l4.15 3.22c.92-2.76 3.5-4.9 6.54-4.9z"
                  />
                </Svg>
                <Text style={styles.btnText}>Continue with Google</Text>
              </View>
            )}
          </Pressable>

          {/* Apple button */}
          <Pressable
            id="btn-link-apple"
            onPress={() => handleAuth('apple')}
            disabled={loadingType !== null}
            style={({ pressed }) => [
              styles.btnBase,
              styles.btnApple,
              pressed && styles.btnPressed
            ]}
          >
            {loadingType === 'apple' ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.btnContent}>
                {/* Apple SVG Logo */}
                <Svg width="18" height="18" viewBox="0 0 24 24" style={styles.btnIcon}>
                  <Path
                    fill="#FFFFFF"
                    d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.22.67-2.94 1.51-.63.73-1.18 1.87-1.03 2.98 1.12.09 2.27-.56 2.98-1.43z"
                  />
                </Svg>
                <Text style={styles.btnTextApple}>Continue with Apple</Text>
              </View>
            )}
          </Pressable>

        </View>

        {/* Muted Skip Button */}
        <Pressable
          id="btn-skip-link"
          onPress={handleSkip}
          style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
        >
          <Text style={styles.skipText}>No thanks</Text>
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

  // ── Glass Card ──
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 32,
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#A855F7', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
      android: { elevation: 12 },
      web: { boxShadow: '0 12px 40px rgba(168,85,247,0.25)' } as any,
    }),
  },
  cardDesktop: {
    maxWidth: 400,
  },

  // ── Icon overlay ──
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
    color: '#D4B8FF',
  },

  // ── Heading ──
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

  // ── Description ──
  descriptionText: {
    color: '#9A93B5',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.85,
    marginBottom: 28,
    paddingHorizontal: 10,
  },

  // ── Action Buttons ──
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
  btnGoogle: {
    experimental_backgroundImage: 'linear-gradient(90deg, #7C3AED, #C026D3)',
    ...Platform.select({
      ios: { shadowColor: '#C026D3', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
      web: { boxShadow: '0 6px 20px 0 rgba(192,38,211,0.45)' } as any,
    }),
  } as any,
  btnApple: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  btnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnIcon: {
    marginRight: 4,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnTextApple: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Skip Button ──
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
