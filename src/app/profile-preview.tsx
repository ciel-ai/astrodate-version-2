import { useColorScheme } from '@/hooks/use-color-scheme';
import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';

const SERIF = 'Baskerville-Old-Face';

export default function ProfilePreviewScreen() {
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

  const [name, setName] = useState('User');
  const [age, setAge] = useState<number | string>('--');
  const [location, setLocation] = useState('Your location');
  const [gender, setGender] = useState('Gender Details');
  const [birthTime, setBirthTime] = useState('Time of Birth');
  const [loading, setLoading] = useState(true);
  const [vedicSign, setVedicSign] = useState('--');
  const [westernSign, setWesternSign] = useState('--');
  const [nakshatraSign, setNakshatraSign] = useState('--');

  const formatSign = (val: string) => {
    if (!val) return '--';
    return val.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return 'Time of Birth';
    try {
      const parts = timeStr.split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  const getGenderLabel = (gVal: string) => {
    if (!gVal) return 'Gender';
    const clean = gVal.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    if (clean === 'Nonbinary') return 'Non-binary';
    return clean;
  };

  // gender_detail (the sub-selector, e.g. "cis-man") is optional -- onboarding.tsx
  // no longer requires picking one. gender (the broad category) is always set,
  // so fall back to it rather than leaving Identity stuck on the placeholder
  // for anyone who skipped the detail step.
  const BASE_GENDER_LABEL: Record<string, string> = {
    male: 'Man',
    female: 'Woman',
    nonBinary: 'Beyond Binary',
  };

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, location, gender, gender_detail')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          if (profile.full_name) setName(profile.full_name);
          if (profile.location) setLocation(profile.location);
          if (profile.gender_detail) {
            setGender(getGenderLabel(profile.gender_detail));
          } else if (profile.gender) {
            setGender(BASE_GENDER_LABEL[profile.gender] ?? profile.gender);
          }
        }

        const { data: astro } = await supabase
          .from('astro_details')
          .select('birth_date, birth_time, western_sign, indian_sign, nakshatra_name')
          .eq('user_id', user.id)
          .single();

        if (astro) {
          if (astro.birth_date) {
            const birthDate = new Date(astro.birth_date);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              calculatedAge--;
            }
            setAge(calculatedAge);
          }
          if (astro.birth_time) setBirthTime(formatTime(astro.birth_time));
          if (astro.indian_sign) setVedicSign(formatSign(astro.indian_sign));
          if (astro.western_sign) setWesternSign(formatSign(astro.western_sign));
          if (astro.nakshatra_name) setNakshatraSign(formatSign(astro.nakshatra_name));
        }
      } catch (err) {
        console.warn('Failed to load profile preview details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09031C' : '#F0E6FF' }} />;
  }

  const handleContinue = () => router.push('/sign-back-in');

  // Theme tokens
  const T = {
    cardBg: isDark ? 'rgba(14, 8, 35, 0.82)' : 'rgba(255,255,255,0.88)',
    cardBdr: isDark ? 'rgba(168,85,247,0.22)' : 'rgba(168,85,247,0.18)',
    rowBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(120,60,210,0.06)',
    rowBdr: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(168,85,247,0.14)',
    label: isDark ? '#9A8FBF' : '#7B6A9B',
    value: isDark ? '#EDE9FF' : '#1A0A2E',
    heading: isDark ? '#FFFFFF' : '#1A0A2E',
    dot: isDark ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.18)',
  };

  const rows = [
    { icon: '👤', label: 'Name', value: name },
    { icon: '🎂', label: 'Age', value: String(age) },
    { icon: '📍', label: 'Location', value: location },
    { icon: '✨', label: 'Identity', value: gender },
    { icon: '🕒', label: 'Birth time', value: birthTime },
    { icon: '💠', label: 'Vedic Sign', value: `${vedicSign} (Vedic)` },
    { icon: '🌙', label: 'Western Sign', value: `${westernSign} (Western)` },
    { icon: '☀️', label: 'Nakshatra', value: `${nakshatraSign} (Nakshatra)` },
  ];
  return (
    <ImageBackground
      source={bgSource}
      style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#F0E6FF' }]}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={14} />

      {/* Decorative Cosmic Glow Blobs */}
      <View style={styles.glowBlob1} />
      <View style={styles.glowBlob2} />

      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 32, paddingBottom: insets.bottom + 32 }]}>

        {/* Title */}
        <View style={styles.header}>
          <View style={styles.eyebrowContainer}>
            <View style={[styles.eyebrowDot, { backgroundColor: isDark ? '#A855F7' : '#7B6A9B' }]} />
            <Text style={[styles.eyebrow, { color: T.label }]}>YOUR PROFILE PREVIEW</Text>
          </View>
          <Text style={[styles.titleText, { color: T.heading }]}>
            Here&apos;s how some{'\n'}of what you{'\n'}share will{' '}
            <Text style={styles.highlightText}>appear.</Text>
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#A855F7" />
          </View>
        ) : (
          /* ── Premium Preview Card ── */
          <View style={[styles.previewCard, { backgroundColor: T.cardBg, borderColor: T.cardBdr }]}>
            {/* Top glass bevel shine */}
            <View style={styles.cardHeaderAccent} />

            {/* Decorative star accent */}
            <Text style={styles.cardStarAccent}>✦</Text>

            {/* Card title */}
            <Text style={[styles.cardTitle, { color: T.label }]}>SHARED PUBLICLY</Text>

            <ScrollView
              showsVerticalScrollIndicator={true}
              style={styles.cardScrollView}
              contentContainerStyle={styles.cardScrollContent}
            >
              {rows.map((row, i) => (
                <View
                  key={row.label}
                  style={[
                    styles.row,
                    { backgroundColor: T.rowBg, borderColor: T.rowBdr },
                    i === rows.length - 1 && { marginBottom: 0 },
                  ]}
                >
                  {/* Left accent dot */}
                  <View style={[styles.dot, { backgroundColor: T.dot }]} />

                  {/* Icon */}
                  <Text style={styles.rowIcon}>{row.icon}</Text>

                  {/* Content */}
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowLabel, { color: T.label }]}>{row.label}</Text>
                    <Text style={[styles.rowValue, { color: T.value }]} numberOfLines={1}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Continue Button */}
        <Pressable
          id="btn-preview-continue"
          onPress={handleContinue}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        >
        <View style={styles.actionButtonContent}>
          <Text style={styles.actionText}>Continue</Text>
          <Text style={styles.actionArrow}>→</Text>
        </View>
        </Pressable>

      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },

  // ── Glow Blobs ──
  glowBlob1: {
    position: 'absolute',
    top: '20%',
    left: '-10%',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#7C3AED',
    opacity: 0.08,
  },
  glowBlob2: {
    position: 'absolute',
    bottom: '15%',
    right: '-10%',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#C026D3',
    opacity: 0.07,
  },

  // ── Header ──
  header: { width: '100%', alignItems: 'flex-start', gap: 6 },
  eyebrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  titleText: {
    fontFamily: SERIF,
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'left',
    fontWeight: 'normal',
  },
  highlightText: { color: '#B57BFF' },

  // ── Loader ──
  loaderWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // ── Premium Card ──
  previewCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 20,
    gap: 10,
    marginVertical: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#A855F7', shadowOpacity: 0.20, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
      web: { boxShadow: '0 10px 40px rgba(168,85,247,0.20)' } as any,
    }),
  },
  cardHeaderAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardStarAccent: {
    position: 'absolute',
    top: 18,
    right: 20,
    fontSize: 16,
    color: '#B57BFF',
    opacity: 0.6,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
    marginBottom: 4,
    marginLeft: 4,
  },
  cardScrollView: {
    height: 300,
    width: '100%',
    marginTop: 8,
  },
  cardScrollContent: {
    gap: 10,
    paddingBottom: 4,
  },

  // ── Info Rows ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    ...Platform.select({
      ios: { shadowColor: '#B57BFF', shadowOpacity: 0.8, shadowRadius: 3 },
      android: { elevation: 2 },
      web: { boxShadow: '0 0 6px #B57BFF' } as any,
    }),
  },
  rowIcon: { fontSize: 20 },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },

  // ── Action Button ──
  actionButton: {
    height: 54,
    width: '100%',
    maxWidth: 320,
    borderRadius: 27,
    flexDirection: 'row',
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