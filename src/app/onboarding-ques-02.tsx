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

interface LookingForOption {
  id: string;
  label: string;
  emoji: string;
  dbValue: string;
}

const LOOKING_FOR_OPTIONS: LookingForOption[] = [
  { id: 'casual', label: 'Something casual', emoji: '🎉', dbValue: 'casual' },
  { id: 'long_term', label: 'Long-term relationship', emoji: '💘', dbValue: 'long_term' },
  { id: 'long_open_short', label: 'Long-term, open to short', emoji: '😍', dbValue: 'long_open_short' },
  { id: 'short_open_long', label: 'Short-term, open to long', emoji: '🥂', dbValue: 'short_open_long' },
  { id: 'friends', label: 'Making friends', emoji: '👋', dbValue: 'friends' },
  { id: 'not_sure', label: 'Not sure yet', emoji: '🤔', dbValue: 'not_sure' },
];

export default function OnboardingQues2Screen() {
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
      Alert.alert('Selection Required', 'Please choose what you are looking for.');
      return;
    }

    const selectedOption = LOOKING_FOR_OPTIONS.find(opt => opt.id === selectedId);
    if (!selectedOption) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Save user response to section1_qns table
      const { error } = await supabase.from('section1_qns').upsert({
        user_id: user.id,
        looking_for: selectedOption.dbValue,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;

      // Proceed to Page 3 of 9
      router.push('/onboarding-ques-03');
    } catch (e: any) {
      Alert.alert('Save Failed', e.message || 'An unexpected error occurred while saving your preferences.');
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
          
          {/* Progress bar — Page 2 of 9 indicator */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <View style={[styles.progressSegment, styles.progressSegmentActive]} />
              <View style={styles.progressSegmentEmpty} />
            </View>
            <Text style={styles.progressText}>Page 2 of 9</Text>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>What are you looking for?</Text>
            <Text style={styles.subtitle}>
              All good if it changes. There's something for everyone.
            </Text>
          </View>

          {/* Options 2-Column Grid */}
          <View style={[styles.grid, { marginTop: FORM_GAP }]}>
            {LOOKING_FOR_OPTIONS.map((opt) => {
              const isSelected = selectedId === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  id={`btn-look-${opt.id}`}
                  onPress={() => setSelectedId(opt.id)}
                  style={[
                    styles.gridCard,
                    isSelected && styles.gridCardSelected,
                  ]}
                >
                  <Text style={styles.emojiText}>{opt.emoji}</Text>
                  <Text
                    style={[
                      styles.cardLabel,
                      isSelected && styles.cardLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Bottom Nav Area */}
          <View style={styles.bottomNav}>
            {/* Back Button */}
            <Pressable
              id="btn-back-page2"
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backNavBtn, pressed && styles.backNavBtnPressed]}
            >
              <Text style={styles.backNavArrow}>←</Text>
            </Pressable>

            {/* Action Continue Button */}
            <Pressable
              id="btn-looking-continue"
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
    width: '22.22%', // 2 of 9 pages active
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

  // ── 2-Column Grid ──
  grid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: '48%',
    height: 140,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  gridCardSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(30, 15, 60, 0.65)',
  },
  emojiText: {
    fontSize: 28,
  },
  cardLabel: {
    color: '#C9C3DE',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
  },
  cardLabelSelected: {
    color: '#FFFFFF',
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
