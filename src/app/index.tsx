import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';

import { ThemedText } from '@/components/themed-text';
import Glitters from '@/components/glitters';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth';
import { getOnboardingResumeRoute, type OnboardingResumeRoute } from '@/lib/user-profile';

// ─── Layout constants ────────────────────────────────────────────────────────

const LOGO_WIDTH  = 145;
const LOGO_HEIGHT = 175;

// The zodiac wheel is baked into the background image. This is the wheel's
// centre as a fraction of screen height (the bg fills the full height on the
// target device, so this maps 1:1). Tune if the lockup sits off the wheel.
const WHEEL_CENTER_Y_RATIO = 0.320;

// ─────────────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { session, loading: authLoading } = useAuth();

  const [fontsLoaded] = useFonts({
    'Baskerville-Old-Face': require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  // A returning signed-in user should never see the "Get Started" splash --
  // resolve where they belong (mid-onboarding step or Discover) and redirect
  // there, same resume logic verify-otp.tsx uses right after login.
  const [resumeRoute, setResumeRoute] = useState<OnboardingResumeRoute | null>(null);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    getOnboardingResumeRoute()
      .then((route) => {
        if (!cancelled) setResumeRoute(route);
      })
      .catch((err) => {
        console.warn('getOnboardingResumeRoute failed, falling back to /onboarding:', err);
        if (!cancelled) setResumeRoute('/onboarding');
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (resumeRoute) router.replace(resumeRoute);
  }, [resumeRoute, router]);

  if (!fontsLoaded || authLoading || (session && !resumeRoute)) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#0A051B' : '#FFFFFF' }} />;
  }

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;

  // ── Geometry ──────────────────────────────────────────────────────────────
  const deviceW = isDesktopWeb ? 390 : screenW;
  const deviceH = isDesktopWeb ? 844 : screenH;

  // ── Content group ───────────────────────────────────────────────────────────
  // logo → title → divider → tagline are one centred group, with the logo placed
  // on the wheel centre baked into the background. Fixed gaps (24 / 20 / 18 px).
  const wheelCenterY = Math.round(deviceH * WHEEL_CENTER_Y_RATIO);

  const LOGO_W   = Math.round(deviceW * 0.64);                          // larger logo, fills the wheel centre
  const LOGO_H   = Math.round(LOGO_W * (LOGO_HEIGHT / LOGO_WIDTH));
  const TITLE_FS = Math.round(deviceW * 0.112) - 4;                     // ~40 px elegant serif
  const TITLE_LH = Math.round(TITLE_FS * 1.05);
  const sepW     = Math.round(deviceW * 0.41);                          // ~160 px divider

  // Anchor the group so the logo's centre sits on the wheel centre.
  const groupTop = wheelCenterY - Math.round(LOGO_H / 2);

  const bgSource = isDark
    ? require('@/assets/images/bg.png')
    : require('@/assets/images/bg-light.png');
  const logoSource = isDark
    ? require('@/assets/images/logo.png')
    : require('@/assets/images/logo-dark-text.png');

  // ── Content ───────────────────────────────────────────────────────────────
  const renderContent = () => (
    <ImageBackground
      source={bgSource}
      style={[styles.bgImage, { backgroundColor: isDark ? '#09031C' : '#FFFFFF' }]}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Twinkling glitter overlay (decorative, behind content) */}
      <Glitters count={22} />

      {/* ── Logo + wordmark, centred on the wheel baked into the background ── */}
      <View style={[styles.group, { top: groupTop, left: 0, width: deviceW }]} pointerEvents="none">
        <Image
          source={logoSource}
          style={{ width: LOGO_W, height: LOGO_H }}
          resizeMode="contain"
        />

        <ThemedText
          style={[styles.title, { fontSize: TITLE_FS, lineHeight: TITLE_LH, marginTop: -68, color: isDark ? '#FFFFFF' : '#1B1528' }]}
        >
          Astro date
        </ThemedText>

        {/* Decorative divider with a tiny glowing diamond */}
        <View style={[styles.sepRow, { width: sepW, marginTop: 1.5 }]}>
          <View style={[styles.sepLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(75,0,130,0.25)' }]} />
          <View style={[styles.sepDiamond, { backgroundColor: isDark ? '#FFFFFF' : '#7C3AED' }]} />
          <View style={[styles.sepLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(75,0,130,0.25)' }]} />
        </View>

        <ThemedText style={[styles.tagline, { marginTop: 1, color: isDark ? '#E6D8FF' : '#6B7280' }]}>
          LOVE, WRITTEN IN THE STARS
        </ThemedText>
      </View>

      {/* ── Get Started button — bottom centred ── */}
      <View style={styles.bottomArea} pointerEvents="box-none">
        <Pressable
          onPress={() => router.push('/create-account')}
          style={({ pressed }) => [
            styles.ctaButton,
            {
              backgroundColor: isDark ? '#FFFFFF' : '#7C3AED',
            },
            pressed && styles.ctaPressed
          ]}
          accessibilityRole="button"
          accessibilityLabel="Get Started"
        >
          <ThemedText style={[styles.ctaText, { color: isDark ? '#0D0930' : '#FFFFFF' }]}>Get Started</ThemedText>
        </Pressable>
      </View>
    </ImageBackground>
  );

  // ── Desktop simulator shell ───────────────────────────────────────────────
  if (isDesktopWeb) {
    return (
      <View style={styles.desktop}>
        <View style={styles.glowAura} />
        <View style={styles.deviceFrame}>
          <View style={styles.screenInner}>{renderContent()}</View>
          <View style={styles.homeBar} />
        </View>
      </View>
    );
  }

  return renderContent();
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#09031C',   // dark base so the screen is never white
  },

  // Centred content group, overlaid on the wheel baked into the background
  group: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
  },

  // ── Typography ────────────────────────────────────────────────────────────
  title: {
    color: '#FFFFFF',
    fontFamily: 'Baskerville-Old-Face',
    fontWeight: 'normal',
    textAlign: 'center',
  },

  // ─ divider ─
  sepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sepLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.40)',
  },
  // Tiny glowing diamond (6 px square rotated 45°) at the divider centre
  sepDiamond: {
    width: 6,
    height: 6,
    marginHorizontal: 8,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    ...Platform.select({
      ios: {
        shadowColor: '#D38BFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
      },
      android: { elevation: 0 },
      web: { boxShadow: '0 0 6px 1px rgba(211,139,255,0.9)' } as any,
    }),
  },
  tagline: {
    fontSize: 12,
    color: '#E6D8FF',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 3,
    opacity: 0.75,
  },

  // ── Get Started button ──────────────────────────────────────────────────────
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '7%',
    alignItems: 'center',
  },
  ctaButton: {
    width: '76%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingVertical: 18,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#9C5CFF',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      web: { boxShadow: '0 6px 20px 0 rgba(140,80,255,0.40)' } as any,
    }),
  },
  ctaPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  ctaText: {
    color: '#0D0930',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // ── Desktop simulator ─────────────────────────────────────────────────────
  desktop: {
    flex: 1,
    backgroundColor: '#03010a',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web'
      ? ({ height: '100vh', width: '100vw', overflow: 'hidden' } as any)
      : {}),
  },
  glowAura: {
    position: 'absolute',
    width: 560,
    height: 840,
    borderRadius: 280,
    backgroundColor: '#6A3FE0',
    opacity: 0.06,
    ...(Platform.OS === 'web' ? ({ filter: 'blur(130px)' } as any) : {}),
  },
  deviceFrame: {
    width: 390,
    height: 844,
    borderRadius: 50,
    borderWidth: 10,
    borderColor: '#160B26',
    backgroundColor: '#0A051B',
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 22px 48px -8px rgba(100,50,240,0.42)' } as any)
      : {}),
  },
  screenInner: {
    flex: 1,
    borderRadius: 40,
    overflow: 'hidden',
  },
  homeBar: {
    position: 'absolute',
    bottom: 7,
    alignSelf: 'center',
    width: 130,
    height: 5,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    opacity: 0.32,
  },
});
