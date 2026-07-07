import { useEffect, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
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
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [name, setName] = useState('User');
  const [age, setAge] = useState<number | string>('--');
  const [location, setLocation] = useState('Your location');
  const [gender, setGender] = useState('Gender Details');
  const [birthTime, setBirthTime] = useState('Time of Birth');
  const [loading, setLoading] = useState(true);

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
    } catch (e) {
      return timeStr;
    }
  };

  const getGenderLabel = (gVal: string) => {
    if (!gVal) return 'Gender';
    const clean = gVal.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    if (clean === 'Nonbinary') return 'Non-binary';
    return clean;
  };

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, address_district, address_state, gender_detail')
          .eq('id', user.id)
          .single();

        if (profile) {
          if (profile.display_name) setName(profile.display_name);
          const locString = [profile.address_district, profile.address_state]
            .filter(Boolean)
            .join(', ');
          if (locString) setLocation(locString);
          if (profile.gender_detail) setGender(getGenderLabel(profile.gender_detail));
        }

        const { data: astro } = await supabase
          .from('astro_details')
          .select('birth_date, birth_time')
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
    cardBg:   isDark ? 'rgba(14, 8, 35, 0.82)' : 'rgba(255,255,255,0.88)',
    cardBdr:  isDark ? 'rgba(168,85,247,0.22)' : 'rgba(168,85,247,0.18)',
    rowBg:    isDark ? 'rgba(255,255,255,0.05)' : 'rgba(120,60,210,0.06)',
    rowBdr:   isDark ? 'rgba(255,255,255,0.07)' : 'rgba(168,85,247,0.14)',
    label:    isDark ? '#9A8FBF' : '#7B6A9B',
    value:    isDark ? '#EDE9FF' : '#1A0A2E',
    heading:  isDark ? '#FFFFFF' : '#1A0A2E',
    dot:      isDark ? 'rgba(168,85,247,0.35)' : 'rgba(168,85,247,0.18)',
  };

  const rows = [
    { icon: '👤', label: 'Name',        value: name },
    { icon: '🎂', label: 'Age',         value: String(age) },
    { icon: '📍', label: 'Location',    value: location },
    { icon: '✨', label: 'Identity',    value: gender },
    { icon: '🕒', label: 'Birth time',  value: birthTime },
  ];

  return (
    <ImageBackground
      source={bgSource}
      style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#F0E6FF' }]}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={14} />

      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 32, paddingBottom: insets.bottom + 32 }]}>

        {/* Title */}
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: T.label }]}>YOUR PROFILE PREVIEW</Text>
          <Text style={[styles.titleText, { color: T.heading }]}>
            Here's how some{'\n'}of what you{'\n'}share will{' '}
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
            {/* Decorative star accent */}
            <Text style={styles.cardStarAccent}>✦</Text>

            {/* Card title */}
            <Text style={[styles.cardTitle, { color: T.label }]}>SHARED PUBLICLY</Text>

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
          </View>
        )}

        {/* Continue Button */}
        <Pressable
          id="btn-preview-continue"
          onPress={handleContinue}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionText}>Continue  →</Text>
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

  // ── Header ──
  header: { width: '100%', alignItems: 'flex-start', gap: 10 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  titleText: {
    fontFamily: SERIF,
    fontSize: 30,
    lineHeight: 40,
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
    ...Platform.select({
      ios:  { shadowColor: '#A855F7', shadowOpacity: 0.20, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
      web:  { boxShadow: '0 10px 40px rgba(168,85,247,0.20)' } as any,
    }),
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
      ios:  { shadowColor: '#C026D3', shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
      web:  { boxShadow: '0 8px 28px 0 rgba(192,38,211,0.55)' } as any,
    }),
  } as any,
  actionPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
