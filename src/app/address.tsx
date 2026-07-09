import { useRef, useState } from 'react';
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

const SERIF = 'Baskerville-Old-Face';

interface AddressForm {
  houseNo: string;
  street: string;
  district: string;
  state: string;
  country: string;
  pinCode: string;
}

const EMPTY: AddressForm = {
  houseNo: '',
  street: '',
  district: '',
  state: '',
  country: '',
  pinCode: '',
};

export default function AddressScreen() {
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

  const [form, setForm] = useState<AddressForm>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<keyof AddressForm | null>(null);

  // Refs for keyboard "next" navigation
  const streetRef  = useRef<TextInput>(null);
  const districtRef = useRef<TextInput>(null);
  const stateRef   = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);
  const pinRef     = useRef<TextInput>(null);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const set = (key: keyof AddressForm) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const validate = (): string | null => {
    if (!form.houseNo.trim())  return 'Please enter your house / flat number.';
    if (!form.street.trim())   return 'Please enter your street name.';
    if (!form.district.trim()) return 'Please enter your district.';
    if (!form.state.trim())    return 'Please enter your state.';
    if (!form.country.trim())  return 'Please enter your country.';
    if (!form.pinCode.trim())  return 'Please enter your pin / postal code.';
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Required', err); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        await supabase.from('profiles').upsert({
          id: user.id,
          address_house:    form.houseNo.trim(),
          address_street:   form.street.trim(),
          address_district: form.district.trim(),
          address_state:    form.state.trim(),
          address_country:  form.country.trim(),
          address_pincode:  form.pinCode.trim(),
          updated_at: new Date().toISOString(),
        });
      }
      router.push('/birth-details');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save address. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (key: keyof AddressForm) => [
    styles.inputContainer,
    {
      backgroundColor: isDark ? 'rgba(20, 12, 40, 0.55)' : '#FFFFFF',
      borderColor: focused === key
        ? (isDark ? '#A855F7' : '#4B0082')
        : (isDark ? 'rgba(255, 255, 255, 0.12)' : '#E5E7EB'),
    },
    focused === key && {
      backgroundColor: isDark ? 'rgba(30, 15, 60, 0.65)' : '#F3ECFF',
    }
  ];

  const isDesktopWeb = Platform.OS === 'web' && screenW > 768;
  const deviceH = isDesktopWeb ? 844 : screenH;
  const FORM_GAP = Math.round(deviceH * 0.04);

  return (
    <ImageBackground
      source={bgSource}
      style={styles.bg}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={14} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { top: Math.max(insets.top, 16) }]}
        hitSlop={10}
      >
        <View style={[styles.backChevron, { borderColor: isDark ? '#FFFFFF' : '#1B1528' }]} />
      </Pressable>

      <ScrollView
        style={styles.scrollStyle}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 60 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Steps Horizontal Bar Indicator — step 3 of 4 */}
          <View style={styles.progressRow}>
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }, styles.progressSegmentActive]} />
            <View style={[styles.progressSegment, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Where are you based?</Text>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
              Sharing your city helps us surface better local matches.
            </Text>
          </View>

          {/* Form */}
          <View style={[styles.form, { marginTop: FORM_GAP }]}>
            
            {/* House / Flat No */}
            <View style={inputStyle('houseNo')}>
              <Text style={styles.inputIcon}>🏠</Text>
              <TextInput
                value={form.houseNo}
                onChangeText={set('houseNo')}
                placeholder="House / Flat No."
                placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                returnKeyType="next"
                onSubmitEditing={() => streetRef.current?.focus()}
                onFocus={() => setFocused('houseNo')}
                onBlur={() => setFocused(null)}
                accessibilityLabel="House or flat number"
              />
            </View>

            {/* Street Name */}
            <View style={inputStyle('street')}>
              <Text style={styles.inputIcon}>🛣️</Text>
              <TextInput
                ref={streetRef}
                value={form.street}
                onChangeText={set('street')}
                placeholder="Street Name"
                placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                returnKeyType="next"
                onSubmitEditing={() => districtRef.current?.focus()}
                onFocus={() => setFocused('street')}
                onBlur={() => setFocused(null)}
                accessibilityLabel="Street name"
              />
            </View>

            {/* District */}
            <View style={inputStyle('district')}>
              <Text style={styles.inputIcon}>🏙️</Text>
              <TextInput
                ref={districtRef}
                value={form.district}
                onChangeText={set('district')}
                placeholder="District"
                placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                returnKeyType="next"
                onSubmitEditing={() => stateRef.current?.focus()}
                onFocus={() => setFocused('district')}
                onBlur={() => setFocused(null)}
                accessibilityLabel="District"
              />
            </View>

            {/* State & Country */}
            <View style={styles.twoCol}>
              <View style={[inputStyle('state'), { flex: 1 }]}>
                <TextInput
                  ref={stateRef}
                  value={form.state}
                  onChangeText={set('state')}
                  placeholder="State"
                  placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                  style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                  returnKeyType="next"
                  onSubmitEditing={() => countryRef.current?.focus()}
                  onFocus={() => setFocused('state')}
                  onBlur={() => setFocused(null)}
                  accessibilityLabel="State"
                />
              </View>

              <View style={[inputStyle('country'), { flex: 1 }]}>
                <TextInput
                  ref={countryRef}
                  value={form.country}
                  onChangeText={set('country')}
                  placeholder="Country"
                  placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                  style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                  returnKeyType="next"
                  onSubmitEditing={() => pinRef.current?.focus()}
                  onFocus={() => setFocused('country')}
                  onBlur={() => setFocused(null)}
                  accessibilityLabel="Country"
                />
              </View>
            </View>

            {/* Pin Code */}
            <View style={inputStyle('pinCode')}>
              <Text style={styles.inputIcon}>📮</Text>
              <TextInput
                ref={pinRef}
                value={form.pinCode}
                onChangeText={set('pinCode')}
                placeholder="Pin / Postal Code"
                placeholderTextColor={isDark ? "#7C7796" : "#9CA3AF"}
                style={[styles.textInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="done"
                onSubmitEditing={handleSave}
                onFocus={() => setFocused('pinCode')}
                onBlur={() => setFocused(null)}
                accessibilityLabel="Pin or postal code"
              />
            </View>

            {/* Privacy Note */}
            <View style={[
              styles.privacyNote,
              {
                backgroundColor: isDark ? 'rgba(20, 12, 40, 0.55)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(168, 85, 247, 0.2)' : '#E5E7EB',
              }
            ]}>
              <Text style={[styles.privacyText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
                🔒  Your full address is private and never shown to other users. Only your city is used for match discovery.
              </Text>
            </View>

            {/* Action Button */}
            <Pressable
              id="btn-save-address"
              onPress={handleSave}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.actionButtonContent}>
                  <Text style={styles.actionText}>Save Address</Text>
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
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },

  // ── Progress bar ──
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

  // ── Header ──
  header: { alignItems: 'center', width: '100%' },
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

  // ── Form Panel ──
  form: { alignItems: 'stretch', width: '100%', gap: 12 },

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
  },
  inputContainerFocused: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(30, 15, 60, 0.65)',
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

  // ── Two column row ──
  twoCol: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },

  // ── Privacy Note ──
  privacyNote: {
    borderRadius: 12,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
    padding: 14,
    marginTop: 10,
  },
  privacyText: {
    color: '#9A93B5',
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Action Button ──
  actionButton: {
    height: 54,
    borderRadius: 27,
    marginTop: 10,
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
