import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
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

interface HeightOption {
  id: string;
  label: string;
  dbValue: string;
}

const HEIGHT_OPTIONS: HeightOption[] = [
  { id: 'under_150', label: '<150 cm', dbValue: '<150' },
  { id: '150_165', label: '150–165 cm', dbValue: '150-165' },
  { id: '165_180', label: '165–180 cm', dbValue: '165-180' },
  { id: 'over_180', label: '180 cm+', dbValue: '180+' },
];

export default function OnboardingQues5Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceH = isDesktopWeb ? 844 : screenH;
  const FORM_GAP = Math.round(deviceH * 0.04);

  const handleNext = async () => {
    if (!selectedId) {
      Alert.alert('Selection Required', 'Please select a height range.');
      return;
    }

    const selectedOption = HEIGHT_OPTIONS.find(opt => opt.id === selectedId);
    if (!selectedOption) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Save user response to section1_qns table
      const { error } = await supabase.from('section1_qns').upsert({
        user_id: user.id,
        height: selectedOption.dbValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;

      // Proceed to Page 6 of 10
      router.push('/onboarding-ques-06');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'An unexpected error occurred while saving your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/onboard-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style="light" />
      <Glitters count={14} />

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 25 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          
          {/* Progress bar — Page 5 of 10 indicator */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <View style={[styles.progressSegment, styles.progressSegmentActive]} />
              <View style={styles.progressSegmentEmpty} />
            </View>
            <Text style={styles.progressText}>Page 5 of 10</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>How tall are you?</Text>
            <Text style={styles.subtitle}>
              This helps us find compatible matches.
            </Text>
          </View>

          {/* Options List */}
          <View style={[styles.form, { marginTop: FORM_GAP }]}>
            {HEIGHT_OPTIONS.map((opt) => {
              const isSelected = selectedId === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  id={`btn-height-${opt.id}`}
                  onPress={() => setSelectedId(opt.id)}
                  style={[
                    styles.preferenceCard,
                    isSelected && styles.preferenceCardSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.preferenceLabel,
                      isSelected && styles.preferenceLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  
                  {/* Select checkmark indicator (matching screenshot) */}
                  {isSelected && (
                    <Text style={styles.checkmarkIcon}>✓</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Bottom Nav Area */}
          <View style={styles.bottomNav}>
            {/* Back Button */}
            <Pressable
              id="btn-back-page5"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backNavBtn, pressed && styles.backNavBtnPressed]}
            >
              <Text style={styles.backNavArrow}>←</Text>
            </Pressable>

            {/* Action Continue Button */}
            <Pressable
              id="btn-height-continue"
              onPress={handleNext}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>Continue  →</Text>
              )}
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  scrollStyle: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  container: { flex: 1, paddingHorizontal: 24 },

  // ── Progress Bar ──
  progressSection: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 32,
  },
  progressRow: {
    flexDirection: 'row',
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressSegment: {
    height: '100%',
    borderRadius: 2,
  },
  progressSegmentActive: {
    width: '50%', // 5 of 10 pages active
    backgroundColor: '#B57BFF',
  },
  progressSegmentEmpty: {
    flex: 1,
  },
  progressText: {
    color: '#9A93B5',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },

  // ── Header ──
  header: { alignItems: 'flex-start', width: '100%' },
  heading: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '800',
    textAlign: 'left',
    letterSpacing: 0.1,
    marginBottom: 10,
  },
  subtitle: {
    color: '#9A93B5',
    fontSize: 14,
    textAlign: 'left',
    opacity: 0.85,
    lineHeight: 20,
  },

  // ── Form Panel ──
  form: { alignItems: 'stretch', width: '100%', gap: 12 },
  preferenceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  preferenceCardSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(30, 15, 60, 0.65)',
  },
  preferenceLabel: {
    color: '#C9C3DE',
    fontSize: 15,
    fontWeight: '600',
  },
  preferenceLabelSelected: {
    color: '#FFFFFF',
  },
  checkmarkIcon: {
    color: '#B57BFF',
    fontSize: 18,
    fontWeight: '900',
    marginRight: 4,
  },

  // ── Bottom Navigation Row ──
  bottomNav: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
    gap: 16,
    marginTop: 32,
  },
  backNavBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backNavBtnPressed: {
    opacity: 0.7,
  },
  backNavArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },

  // ── Action Button ──
  actionButton: {
    flex: 1,
    height: 54,
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
