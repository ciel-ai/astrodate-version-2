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

interface PreferenceOption {
  id: string;
  label: string;
  dbValue: string;
}

const PREFERENCE_OPTIONS: PreferenceOption[] = [
  { id: 'men', label: 'Men', dbValue: 'male' },
  { id: 'women', label: 'Women', dbValue: 'female' },
  { id: 'beyond_binary', label: 'Beyond Binary', dbValue: 'non-binary' },
  { id: 'everyone', label: 'Everyone', dbValue: 'everyone' },
];

export default function OnboardingQuesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceH = isDesktopWeb ? 844 : screenH;
  const FORM_GAP = Math.round(deviceH * 0.04);

  const handleSelectOption = (optId: string) => {
    if (optId === 'everyone') {
      if (selectedIds.includes('everyone')) {
        // Clear all selections
        setSelectedIds([]);
      } else {
        // Select all options
        setSelectedIds(['men', 'women', 'beyond_binary', 'everyone']);
      }
    } else {
      let nextSelected = [...selectedIds];
      if (nextSelected.includes(optId)) {
        nextSelected = nextSelected.filter(id => id !== optId && id !== 'everyone');
      } else {
        nextSelected.push(optId);
        // If all sub-options are selected, automatically include 'everyone'
        const hasAllSubs = ['men', 'women', 'beyond_binary'].every(id => nextSelected.includes(id));
        if (hasAllSubs) {
          nextSelected.push('everyone');
        }
      }
      setSelectedIds(nextSelected);
    }
  };

  const handleNext = async () => {
    // Filter out 'everyone' from database entries
    const dbSelections = PREFERENCE_OPTIONS
      .filter(opt => selectedIds.includes(opt.id) && opt.dbValue !== 'everyone')
      .map(opt => opt.dbValue);

    if (dbSelections.length === 0) {
      Alert.alert('Selection Required', 'Please select at least one preference option.');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Upsert preferences to section1_qns table
      const { error } = await supabase.from('section1_qns').upsert({
        user_id: user.id,
        interest: dbSelections,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;

      // Proceed to Page 2 of 10
      router.push('/onboarding-ques-02');
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

      {/* Back Button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: Math.max(insets.top, 16) }]}
        hitSlop={10}
      >
        <Text style={styles.backIcon}>‹</Text>
      </Pressable>

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 25 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          
          {/* Progress bar — Page 1 of 10 indicator */}
          <View style={styles.progressSection}>
            <View style={styles.progressRow}>
              <View style={[styles.progressSegment, styles.progressSegmentActive]} />
              <View style={styles.progressSegmentEmpty} />
            </View>
            <Text style={styles.progressText}>Page 1 of 10</Text>
          </View>

          {/* Heading */}
          <View style={styles.header}>
            <Text style={styles.heading}>Who are you interested in seeing?</Text>
            <Text style={styles.subtitle}>
              Select all that apply to help us recommend the right people for you.
            </Text>
          </View>

          {/* Options */}
          <View style={[styles.form, { marginTop: FORM_GAP }]}>
            {PREFERENCE_OPTIONS.map((opt) => {
              const isSelected = selectedIds.includes(opt.id);
              return (
                <Pressable
                  key={opt.id}
                  id={`btn-pref-${opt.id}`}
                  onPress={() => handleSelectOption(opt.id)}
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
                  
                  {/* Select check/radio bubble indicator */}
                  <View style={[
                    styles.radioIndicator,
                    isSelected && styles.radioIndicatorSelected
                  ]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </Pressable>
              );
            })}

            {/* Action Continue Button */}
            <Pressable
              id="btn-preferences-continue"
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
    width: '10%', // 1 of 10 pages active
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

  // ── Form Options ──
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

  // ── Action Button ──
  actionButton: {
    height: 54,
    borderRadius: 27,
    marginTop: 22,
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
