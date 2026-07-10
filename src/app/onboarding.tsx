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
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';
import { saveUserProfile } from '@/lib/user-profile';

const SERIF = 'Baskerville-Old-Face';

type GenderOption = 'male' | 'female' | 'nonBinary';

interface GenderDetailOption {
  value: string;
  label: string;
  description: string;
}

const GENDER_OPTIONS: { id: GenderOption; label: string; emoji: string }[] = [
  { id: 'male', label: 'Man', emoji: '👨' },
  { id: 'female', label: 'Woman', emoji: '👩' },
  { id: 'nonBinary', label: 'Beyond Binary', emoji: '✨' },
];

const GENDER_DETAILS: Record<GenderOption, GenderDetailOption[]> = {
  male: [
    { value: 'cis-man', label: 'Cis Man', description: 'A man whose gender aligns with the sex they were assigned at birth.' },
    { value: 'intersex-man', label: 'Intersex Man', description: "A man born with one or more variations in sex characteristics that don't fit binary ideas of male or female bodies." },
    { value: 'trans-man', label: 'Trans Man', description: 'A man whose gender is different from his sex assigned at birth.' },
    { value: 'transmasculine', label: 'Transmasculine', description: 'Assigned female at birth but presents as masculine; may see themselves as a man or transgender man.' },
    { value: 'not-listed-man', label: 'Not listed', description: "Tell us what's missing." },
  ],
  female: [
    { value: 'cis-woman', label: 'Cis Woman', description: 'A woman whose gender aligns with the sex they were assigned at birth.' },
    { value: 'intersex-woman', label: 'Intersex Woman', description: "A woman born with one or more variations in sex characteristics that don't fit binary ideas of male or female bodies." },
    { value: 'trans-woman', label: 'Trans Woman', description: 'A woman whose gender is different from her sex assigned at birth.' },
    { value: 'transfeminine', label: 'Transfeminine', description: 'Assigned male at birth but presents as feminine; may see themselves as a woman or transgender woman.' },
    { value: 'not-listed-woman', label: 'Not listed', description: "Tell us what's missing." },
  ],
  nonBinary: [
    { value: 'agender', label: 'Agender', description: 'A person who does not have a gender.' },
    { value: 'bigender', label: 'Bigender', description: 'A person whose gender has two or more forms.' },
    { value: 'genderfluid', label: 'Genderfluid', description: 'A person whose gender is not simply fixed.' },
    { value: 'gender-questioning', label: 'Gender Questioning', description: 'Questioning their current gender and/or exploring other genders.' },
    { value: 'genderqueer', label: 'Genderqueer', description: 'Does not identify or express their gender within the gender binary.' },
    { value: 'intersex', label: 'Intersex', description: 'Refers to people born with variations in sex characteristics.' },
    { value: 'nonbinary', label: 'Nonbinary', description: 'A gender beyond the exclusive categories of man and woman.' },
    { value: 'pangender', label: 'Pangender', description: 'Experiences multiple genders either simultaneously or over time.' },
    { value: 'trans-person', label: 'Trans Person', description: 'Transgender and their gender is different from the sex assigned at birth.' },
    { value: 'transfeminine', label: 'Transfeminine', description: 'Assigned male at birth, presents as feminine.' },
    { value: 'transmasculine', label: 'Transmasculine', description: 'Assigned female at birth, presents as masculine.' },
    { value: 'two-spirit', label: 'Two-Spirit', description: 'An umbrella term used across some Native communities for spiritual roles.' },
    { value: 'not-listed-nb', label: 'Not listed', description: "Tell us what's missing." },
  ],
};

export default function OnboardingScreen() {
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

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderOption | ''>('');
  const [genderDetail, setGenderDetail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceH = isDesktopWeb ? 844 : screenH;

  // Render planet shifted up like in login and sign up screens
  const FORM_GAP = Math.round(deviceH * 0.08);

  const handleGenderSelect = (gId: GenderOption) => {
    setGender(gId);
    setGenderDetail(''); // Reset detail selection when changing primary option
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!name.trim()) {
        Alert.alert('Name Required', 'Please enter your name to continue.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!gender) {
        Alert.alert('Gender Required', 'Please select a gender option to continue.');
        return;
      }
      if (!genderDetail) {
        Alert.alert('Details Required', 'Please select a gender detail description below.');
        return;
      }

      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Update auth user metadata
        const { error: metaErr } = await supabase.auth.updateUser({
          data: {
            display_name: name.trim(),
            gender: gender,
            gender_detail: genderDetail,
            onboarding_completed: true,
          },
        });

        if (metaErr) throw metaErr;

        // 2. Create/update the real user_profiles row -- this is the table
        // Discover/matching actually read from. phone_number/email come from
        // whichever signup path the user took (phone OTP sets auth.users.phone,
        // email signup sets auth.users.email); this app is phone-first, so
        // email is left blank rather than forcing a dedicated collection step.
        const result = await saveUserProfile({
          full_name: name.trim(),
          gender,
          gender_detail: genderDetail,
          phone_number: user?.phone,
          email: user?.email,
        });

        if (!result.success) throw new Error(result.error || 'Failed to save profile');

        // 3. Proceed to address collection
        router.push('/address');
      } catch (err: any) {
        Alert.alert('Setup Failed', err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.replace('/login');
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>What&apos;s your name?</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#6B7280' }]}>This will be displayed on your profile.</Text>

            <View style={[styles.inputContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF', borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB' }]}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                maxLength={40}
                autoFocus
              />
            </View>
          </View>
        );
      case 2:
        return (
          <View style={styles.stepContainer}>
            <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>What describes you?</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
              Select what describes you to help us show your profile to the right people.
            </Text>

            <View style={styles.genderOptionsContainer}>
              {GENDER_OPTIONS.map((opt) => {
                const isSelected = gender === opt.id;
                return (
                  <View key={opt.id} style={styles.optionWrapper}>
                    <Pressable
                      onPress={() => handleGenderSelect(opt.id)}
                      style={[
                        styles.genderCard,
                        {
                          backgroundColor: isDark ? 'rgba(20, 12, 40, 0.55)' : '#FFFFFF',
                          borderColor: isSelected
                            ? (isDark ? '#A855F7' : '#4B0082')
                            : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB'),
                        },
                        isSelected && { backgroundColor: isDark ? 'rgba(30, 15, 60, 0.65)' : '#F3ECFF' }
                      ]}
                    >
                      <Text style={styles.genderEmoji}>{opt.emoji}</Text>
                      <Text
                        style={[
                          styles.genderLabel,
                          { color: isDark ? '#C9C3DE' : '#6B7280' },
                          isSelected && { color: isDark ? '#FFFFFF' : '#4B0082' }
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <View
                        style={[
                          styles.radioIndicator,
                          { borderColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(75, 0, 130, 0.3)' },
                          isSelected && { borderColor: isDark ? '#B57BFF' : '#4B0082' }
                        ]}
                      >
                        {isSelected && <View style={[styles.radioDot, { backgroundColor: isDark ? '#B57BFF' : '#4B0082' }]} />}
                      </View>
                    </Pressable>

                    {/* Gender details list sub-selector */}
                    {isSelected && (
                      <View style={styles.detailContainer}>
                        <Text style={styles.detailTitle}>Select specific classification:</Text>
                        {GENDER_DETAILS[opt.id].map((detail) => {
                          const isDetailSelected = genderDetail === detail.value;
                          return (
                            <Pressable
                              key={detail.value}
                              onPress={() => setGenderDetail(detail.value)}
                              style={[
                                styles.detailCard,
                                {
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
                                  borderColor: isDetailSelected
                                    ? (isDark ? 'rgba(168, 85, 247, 0.3)' : '#4B0082')
                                    : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#E5E7EB'),
                                },
                                isDetailSelected && { backgroundColor: isDark ? 'rgba(168, 85, 247, 0.1)' : '#F3ECFF' }
                              ]}
                            >
                              <View style={styles.detailInfo}>
                                <Text style={[
                                  styles.detailLabel,
                                  { color: isDark ? '#FFFFFF' : '#1B1528' },
                                  isDetailSelected && { color: isDark ? '#FFFFFF' : '#4B0082' }
                                ]}>
                                  {detail.label}
                                </Text>
                                <Text style={[styles.detailDescription, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
                                  {detail.description}
                                </Text>
                              </View>
                              <View style={[
                                styles.detailRadio,
                                isDetailSelected && styles.detailRadioSelected
                              ]}>
                                {isDetailSelected && <View style={styles.detailRadioDot} />}
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ImageBackground
      source={bgSource}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={16} />

      {/* Back button */}
      <Pressable
        onPress={handleBack}
        style={[styles.backBtn, { top: Math.max(insets.top, 16), backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)', borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.1)' }]}
        hitSlop={10}
      >
        <Text style={[styles.backIcon, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>‹</Text>
      </Pressable>

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 20) + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* Steps Horizontal Bar Indicator — 4 total (name / gender / address / birth details) */}
          <View style={styles.progressRow}>
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, step >= 1 && styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, step >= 2 && styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]} />
          </View>

          {/* Step Body */}
          <View style={[styles.form, { marginTop: FORM_GAP }]}>
            {renderStepContent()}

            {/* Action button */}
            <Pressable
              onPress={handleNext}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.actionText}>Next  →</Text>
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

  // ── Step Indicators ──
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 40,
    gap: 8,
  },
  progressSegment: {
    width: 50,
    height: 4,
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#B57BFF',
  },

  // ── Form Panel ──
  form: { alignItems: 'stretch' },
  stepContainer: { width: '100%', alignItems: 'center' },
  heading: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  subtitle: {
    color: '#9A93B5',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.85,
    marginBottom: 24,
    lineHeight: 20,
  },

  // ── Input Fields ──
  inputContainer: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: 12,
    color: '#A855F7',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    height: '100%',
  },

  // ── Gender Options ──
  genderOptionsContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 10,
  },
  optionWrapper: {
    width: '100%',
  },
  genderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 16,
  },
  genderCardSelected: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(30, 15, 60, 0.65)',
  },
  genderEmoji: {
    fontSize: 20,
    marginRight: 12,
  },
  genderLabel: {
    flex: 1,
    color: '#C9C3DE',
    fontSize: 15,
    fontWeight: '600',
  },
  genderLabelSelected: {
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

  // ── Sub-selector Details ──
  detailContainer: {
    marginTop: 8,
    marginLeft: 12,
    paddingLeft: 12,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(168, 85, 247, 0.25)',
    gap: 8,
    marginBottom: 8,
  },
  detailTitle: {
    color: '#9A93B5',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 8, 30, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailCardSelected: {
    borderColor: 'rgba(168, 85, 247, 0.4)',
    backgroundColor: 'rgba(25, 12, 50, 0.55)',
  },
  detailInfo: {
    flex: 1,
    gap: 2,
  },
  detailLabel: {
    color: '#C9C3DE',
    fontSize: 14,
    fontWeight: '600',
  },
  detailLabelSelected: {
    color: '#FFFFFF',
  },
  detailDescription: {
    color: '#7C7796',
    fontSize: 11,
    lineHeight: 15,
  },
  detailRadio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRadioSelected: {
    borderColor: '#B57BFF',
  },
  detailRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
