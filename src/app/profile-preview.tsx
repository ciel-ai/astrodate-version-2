import { useEffect, useState } from 'react';
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

  // Helper to format 24h TIME string to 12h AM/PM
  const formatTime = (timeStr: string) => {
    if (!timeStr) return 'Time of Birth';
    try {
      const parts = timeStr.split(':');
      let hours = parseInt(parts[0], 10);
      const minutes = parts[1];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  // Helper to map gender value to human-readable label
  const getGenderLabel = (gVal: string) => {
    if (!gVal) return 'Gender';
    // Cis Man, Cis Woman, Trans Man, Trans Woman, etc.
    const clean = gVal.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    if (clean === 'Nonbinary') return 'Non-binary';
    return clean;
  };

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch name, location, and gender details
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
          
          if (profile.gender_detail) {
            setGender(getGenderLabel(profile.gender_detail));
          }
        }

        // Fetch birth date & time to calculate age & formatted time
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
          if (astro.birth_time) {
            setBirthTime(formatTime(astro.birth_time));
          }
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
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const handleContinue = () => {
    router.push('/sign-back-in');
  };

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceH = isDesktopWeb ? 844 : screenH;

  return (
    <ImageBackground
      source={require('@/assets/images/onboard-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <Glitters count={14} />

      <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + 40, paddingBottom: insets.bottom + 40 }]}>
        
        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.titleText}>
            Here’s how some{'\n'}of what you{'\n'}share will <Text style={styles.highlightText}>appear.</Text>
          </Text>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#A855F7" />
          </View>
        ) : (
          /* Preview Mockup Card */
          <View style={styles.previewCard}>
            
            {/* Name Row */}
            <View style={styles.cardRow}>
              <Text style={styles.icon}>👤</Text>
              <Text style={styles.cardText}>{name}</Text>
            </View>

            {/* Age Row */}
            <View style={styles.cardRow}>
              <Text style={styles.icon}>🎂</Text>
              <Text style={styles.cardText}>{age}</Text>
            </View>

            {/* Location Row (showing district and state) */}
            <View style={styles.cardRow}>
              <Text style={styles.icon}>📍</Text>
              <Text style={styles.cardText} numberOfLines={1}>{location}</Text>
            </View>

            {/* Gender Row */}
            <View style={styles.cardRow}>
              <Text style={styles.icon}>✨</Text>
              <Text style={styles.cardText}>{gender}</Text>
            </View>

            {/* Time of Birth Row */}
            <View style={styles.cardRow}>
              <Text style={styles.icon}>🕒</Text>
              <Text style={styles.cardText}>{birthTime}</Text>
            </View>

          </View>
        )}

        {/* Action Continue Button */}
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
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  container: { 
    flex: 1, 
    paddingHorizontal: 24, 
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },

  // ── Header ──
  header: { 
    width: '100%',
    marginTop: 20,
  },
  titleText: {
    color: '#FFFFFF',
    fontFamily: SERIF,
    fontSize: 32,
    lineHeight: 42,
    textAlign: 'center',
    fontWeight: 'normal',
  },
  highlightText: {
    color: '#B57BFF',
  },

  // ── Loader ──
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Mockup Card ──
  previewCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    padding: 20,
    gap: 12,
    marginVertical: 20,
    ...Platform.select({
      ios: { shadowColor: '#A855F7', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
      web: { boxShadow: '0 8px 30px rgba(168,85,247,0.22)' } as any,
    }),
  },
  cardRow: {
    height: 52,
    width: '100%',
    borderRadius: 14,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    fontSize: 18,
    color: '#B57BFF',
    opacity: 0.9,
  },
  cardText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  cardTextFallback: {
    color: '#7C7796',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
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
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
