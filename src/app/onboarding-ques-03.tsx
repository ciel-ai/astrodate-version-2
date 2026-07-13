import { useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { OnboardingProgressBar } from '@/components/onboarding-progress-bar';
import { useOnboardingFonts } from '@/hooks/use-onboarding-fonts';
import { supabase } from '@/lib/supabase';

interface RelationshipOption {
  id: string;
  label: string;
  dbValue: string;
}

const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  { id: 'single', label: 'Single', dbValue: 'single' },
  { id: 'divorced', label: 'Divorced', dbValue: 'divorced' },
  { id: 'separated', label: 'Separated', dbValue: 'separated' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say', dbValue: 'prefer_not_to_say' },
];

export default function OnboardingQues3Screen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const fontsLoaded = useOnboardingFonts();

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
      Alert.alert('Selection Required', 'Please choose your relationship status.');
      return;
    }

    const selectedOption = RELATIONSHIP_OPTIONS.find(opt => opt.id === selectedId);
    if (!selectedOption) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Save user response to section1_qns table
      const { error } = await supabase.from('section1_qns').upsert({
        user_id: user.id,
        relationship_status: selectedOption.dbValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;

      // Proceed to Page 4 of 10
      router.push('/onboarding-ques-04');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'An unexpected error occurred while saving your status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={bgSource}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
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
          
          <OnboardingProgressBar current={3} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>What&apos;s your relationship status?</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
              This helps us match you better.
            </Text>
          </View>

          {/* Options List */}
          <View style={[styles.form, { marginTop: FORM_GAP }]}>
            {RELATIONSHIP_OPTIONS.map((opt) => {
              const isSelected = selectedId === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  id={`btn-status-${opt.id}`}
                  onPress={() => setSelectedId(opt.id)}
                  style={[
                    styles.preferenceCard,
                    {
                      backgroundColor: isDark ? 'rgba(20, 12, 40, 0.55)' : '#FFFFFF',
                      borderColor: isSelected
                        ? (isDark ? '#A855F7' : '#4B0082')
                        : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB'),
                    },
                    isSelected && { backgroundColor: isDark ? 'rgba(30, 15, 60, 0.65)' : '#F3ECFF' }
                  ]}
                >
                  <Text
                    style={[
                      styles.preferenceLabel,
                      { color: isDark ? '#C9C3DE' : '#6B7280' },
                      isSelected && { color: isDark ? '#FFFFFF' : '#4B0082' }
                    ]}
                  >
                    {opt.label}
                  </Text>
                  
                  {/* Select check/radio bubble indicator */}
                  <View style={[
                    styles.radioIndicator,
                    { borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(75, 0, 130, 0.3)' },
                    isSelected && { borderColor: isDark ? '#B57BFF' : '#4B0082' }
                  ]}>
                    {isSelected && <View style={[styles.radioDot, { backgroundColor: isDark ? '#B57BFF' : '#4B0082' }]} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Bottom Nav Area */}
          <View style={styles.bottomNav}>
            {/* Back Button */}
            <Pressable
              id="btn-back-page3"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backNavBtn, { backgroundColor: isDark ? 'rgba(20, 12, 40, 0.55)' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E5E7EB' }, pressed && styles.backNavBtnPressed]}
            >
              <View style={[styles.backChevron, { borderColor: isDark ? '#FFFFFF' : '#1B1528' }]} />
            </Pressable>

            {/* Action Continue Button */}
            <Pressable
              id="btn-status-continue"
              onPress={handleNext}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionText}>Continue</Text>
                  <Text style={styles.actionArrow}>→</Text>
                </View>
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
  radioIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioIndicatorSelected: {
    borderColor: '#B57BFF',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B57BFF',
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
  backChevron: {
    width: 12,
    height: 12,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
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
