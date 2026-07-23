import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Modal,
  FlatList,
} from 'react-native';
import { alert } from '@/lib/themed-alert';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = 'Baskerville-Old-Face';

export type Country = {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  length: number;
};

export const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India', dialCode: '+91', flag: '🇮🇳', length: 10 },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', length: 10 },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', length: 10 },
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', length: 10 },
  { code: 'AE', name: 'United Arab Emirates', dialCode: '+971', flag: '🇦🇪', length: 9 },
  { code: 'AU', name: 'Australia', dialCode: '+61', flag: '🇦🇺', length: 9 },
  { code: 'SG', name: 'Singapore', dialCode: '+65', flag: '🇸🇬', length: 8 },
  { code: 'DE', name: 'Germany', dialCode: '+49', flag: '🇩🇪', length: 11 },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', length: 9 },
];

export default function CreateAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: deviceW, height: deviceH } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.dialCode.includes(searchQuery)
  );

  const closePicker = () => {
    setSearchQuery('');
    setCountryPickerVisible(false);
  };

  const handleSendOtp = async () => {
    if (loading) return;

    if (!phone || phone.trim().length < selectedCountry.length) {
      alert('Invalid Phone', `Please enter a valid phone number (${selectedCountry.length} digits).`);
      return;
    }

    if (!agreed) {
      alert('Terms of Service', 'Please agree to the Terms of Service and Privacy Policy to continue.');
      return;
    }

    setLoading(true);
    const fullPhone = `${selectedCountry.dialCode}${phone.trim()}`;

    try {
      // Check for an existing account before spending an OTP send on it --
      // someone landing on Sign Up with a number that already has an account
      // should be routed to Login instead, not charged another SMS.
      const { data: existing, error: checkError } = await supabase.rpc('check_auth_user_exists', {
        input_phone: fullPhone,
      });

      if (checkError) throw checkError;

      if (existing) {
        alert(
          'Account Already Exists',
          'An account with this phone number already exists. Please log in instead.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In', onPress: () => router.push('/login') },
          ]
        );
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
      });

      if (error) {
        alert('Error', error.message);
      } else {
        router.push({
          pathname: '/verify-otp',
          params: { phone: fullPhone },
        });
      }
    } catch (err: any) {
      alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  // Tunable layout
  const LOGO_TOP = Math.round(deviceH * 0.03);   // lockup position in the galaxy
  const FORM_GAP = Math.round(deviceH * 0.12);   // gap between lockup and form (planet shows here)
  const LOGO_W = Math.round(deviceW * 0.50);
  const LOGO_H = Math.round(LOGO_W * (175 / 145));
  const TITLE_FS = Math.round(deviceW * 0.105);
  const BG_SHIFT = isDark ? Math.round(deviceH * 0.18) : Math.round(deviceH * 0.26);
  const BG_SCALE = isDark ? 1.38 : 2.25;
  const bgSource = isDark
    ? require('@/assets/images/create-bg.png')
    : require('@/assets/images/create-bg-light.png');
  const logoSource = isDark
    ? require('@/assets/images/logo.png')
    : require('@/assets/images/logo-dark-text.png');

  return (
    <ImageBackground
      source={bgSource}
      style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#E6D8FF' }]}
      resizeMode="cover"
      imageStyle={{ transform: [{ scale: BG_SCALE }, { translateY: -BG_SHIFT }] }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Twinkling glitter overlay (decorative, behind content) */}
      <Glitters count={18} />

      {/* Back button */}
      <Pressable
        onPress={() => router.back()}
        style={[
          styles.backBtn, 
          { 
            top: insets.top + 8,
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
          }
        ]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <View style={[styles.backChevron, { borderColor: isDark ? '#FFFFFF' : '#1B1528' }]} />
      </Pressable>

      <View style={styles.content}>
        {/* Logo lockup */}
        <View style={[styles.lockup, { marginTop: LOGO_TOP }]} pointerEvents="none">
          <Image
            source={logoSource}
            style={{ width: LOGO_W, height: LOGO_H }}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.wordmark, 
              { 
                fontSize: TITLE_FS, 
                marginTop: -Math.round(LOGO_H * 0.30),
                color: isDark ? '#FFFFFF' : '#1B1528' 
              }
            ]}
          >
            Astro date
          </Text>
          <View style={styles.sepRow}>
            <View style={[styles.sepLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(75,0,130,0.25)' }]} />
            <View style={[styles.sepDiamond, { backgroundColor: isDark ? '#FFFFFF' : '#7C3AED' }]} />
            <View style={[styles.sepLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(75,0,130,0.25)' }]} />
          </View>
          <Text style={[styles.tagline, { color: isDark ? '#E6D8FF' : '#6B7280' }]}>LOVE, WRITTEN IN THE STARS</Text>
        </View>

        {/* Form */}
        <View style={[styles.form, { marginTop: FORM_GAP }]}>
          <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]} numberOfLines={1} adjustsFontSizeToFit>
            Create <Text style={[styles.headingAccent, { color: isDark ? '#B57BFF' : '#7C3AED' }]}>Account</Text>
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#5C5478' }]}>Enter your mobile number to continue</Text>

          {/* Phone input */}
          <View 
            style={[
              styles.phoneRow, 
              { 
                backgroundColor: isDark ? 'rgba(20,12,40,0.55)' : 'rgba(255,255,255,0.75)',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(75,0,130,0.15)' 
              }
            ]}
          >
            <Pressable 
              style={styles.countryBox} 
              hitSlop={6}
              onPress={() => setCountryPickerVisible(true)}
            >
              <Text style={styles.flag}>{selectedCountry.flag}</Text>
              <Text style={[styles.countryCode, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>{selectedCountry.dialCode}</Text>
              <Text style={[styles.chevron, { color: isDark ? '#B57BFF' : '#7C3AED' }]}>▾</Text>
            </Pressable>
            <View style={[styles.phoneDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(75,0,130,0.12)' }]} />
            <TextInput
              value={phone}
              onChangeText={(txt) => setPhone(txt.replace(/[^0-9]/g, ''))}
              placeholder="Phone number"
              placeholderTextColor={isDark ? '#7C7796' : '#9E9AA8'}
              keyboardType="phone-pad"
              style={[styles.phoneInput, { color: isDark ? '#FFFFFF' : '#1B1528' }]}
              maxLength={selectedCountry.length}
            />
          </View>

          {/* Terms checkbox */}
          <Pressable style={styles.termsRow} onPress={() => setAgreed((v) => !v)}>
            <View 
              style={[
                styles.checkbox, 
                { borderColor: isDark ? 'rgba(255,255,255,0.30)' : 'rgba(75,0,130,0.25)' },
                agreed && styles.checkboxOn
              ]}
            >
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.termsText, { color: isDark ? '#C9C3DE' : '#5C5478' }]}>
              I agree to the{' '}
              <Text style={[styles.link, { color: isDark ? '#A855F7' : '#7C3AED' }]} onPress={() => router.push('/terms')}>
                Terms of Service
              </Text>{' '}
              &{' '}
              <Text style={[styles.link, { color: isDark ? '#A855F7' : '#7C3AED' }]} onPress={() => router.push('/privacy')}>
                Privacy Policy
              </Text>
            </Text>
          </Pressable>

          {/* Send OTP */}
          <Pressable
            onPress={handleSendOtp}
            style={({ pressed }) => [styles.otpButton, pressed && styles.otpPressed]}
            accessibilityRole="button"
            accessibilityLabel="Send OTP"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.otpSparkle}>✦</Text>
                <Text style={styles.otpText}>Send OTP</Text>
              </>
            )}
          </Pressable>

          {/* Security note */}
          <View style={styles.secureNote}>
            <Text style={styles.shield}>🛡️</Text>
            <View>
              <Text style={[styles.secureLine, { color: isDark ? '#A79FC4' : '#5C5478' }]}>Your phone number is never shared.</Text>
              <Text style={[styles.secureSub, { color: isDark ? '#8A82A8' : '#7C7796' }]}>Safe • Private • Secure</Text>
            </View>
          </View>

          {/* Footer divider */}
          <View style={[styles.sepRow, styles.footerSep]}>
            <View style={[styles.footerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(75,0,130,0.10)' }]} />
            <View style={[styles.sepDiamond, { backgroundColor: isDark ? '#FFFFFF' : '#7C3AED' }]} />
            <View style={[styles.footerLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(75,0,130,0.10)' }]} />
          </View>

          <Text style={[styles.footerText, { color: isDark ? '#9A93B5' : '#5C5478' }]}>
            Already have an account?{' '}
            <Text style={[styles.link, { color: isDark ? '#A855F7' : '#7C3AED' }]} onPress={() => router.push('/login')}>
              Log In
            </Text>
          </Text>
        </View>
      </View>

      <Modal
        visible={countryPickerVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closePicker}
      >
        <Pressable style={styles.modalOverlay} onPress={closePicker}>
          <View 
            style={[
              styles.modalContent, 
              { 
                backgroundColor: isDark ? '#15102a' : '#F5F2FF',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(75,0,130,0.12)' 
              }
            ]}
          >
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Select Country</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search country..."
              placeholderTextColor={isDark ? '#7C7796' : '#9E9AA8'}
              style={[
                styles.modalSearchInput, 
                { 
                  backgroundColor: isDark ? 'rgba(20, 12, 40, 0.45)' : 'rgba(255, 255, 255, 0.85)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(75,0,130,0.12)',
                  color: isDark ? '#FFFFFF' : '#1B1528'
                }
              ]}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.countryItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(75,0,130,0.06)' }]}
                  onPress={() => {
                    setSelectedCountry(item);
                    setPhone('');
                    closePicker();
                  }}
                >
                  <Text style={styles.itemFlag}>{item.flag}</Text>
                  <Text style={[styles.itemName, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>{item.name}</Text>
                  <Text style={styles.itemDialCode}>{item.dialCode}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  content: { flex: 1 },

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

  // ── Lockup ──
  lockup: { alignItems: 'center' },
  wordmark: { fontFamily: SERIF, color: '#FFFFFF' },
  sepRow: { flexDirection: 'row', alignItems: 'center', width: 150, marginTop: 2 },
  sepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.40)' },
  sepDiamond: {
    width: 6,
    height: 6,
    marginHorizontal: 8,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
  },
  tagline: {
    color: '#E6D8FF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 3,
    opacity: 0.75,
    marginTop: 8,
  },

  // ── Form ── transparent so the planet shows through clearly behind it
  form: { paddingHorizontal: 24 },
  heading: { fontFamily: SERIF, color: '#FFFFFF', fontSize: 28, textAlign: 'center' },
  headingAccent: { color: '#B57BFF' },
  subtitle: {
    color: '#9A93B5',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(20,12,40,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
  },
  countryBox: { flexDirection: 'row', alignItems: 'center' },
  flag: { 
    fontSize: 20, 
    marginRight: 6, 
    ...Platform.select({
      android: { marginTop: -2 },
      ios: { marginTop: 0 }
    })
  },
  countryCode: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  chevron: { color: '#B57BFF', fontSize: 12, marginLeft: 4, fontWeight: '700', marginTop: 1 },
  phoneDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.14)', marginHorizontal: 12 },
  phoneInput: { flex: 1, color: '#FFFFFF', fontSize: 15, height: '100%' },

  termsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  termsText: { color: '#C9C3DE', fontSize: 13, flex: 1 },
  link: { color: '#A855F7', fontWeight: '600' },

  otpButton: {
    height: 54,
    borderRadius: 27,
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(100deg, #C026D3, #7C3AED 55%, #2563EB)',
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 28px 0 rgba(124,58,237,0.55)' } as any,
    }),
  } as any,
  otpPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  otpSparkle: { color: '#FFFFFF', fontSize: 16, marginRight: 9 },
  otpText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  shield: { fontSize: 15, marginRight: 9 },
  secureLine: { color: '#A79FC4', fontSize: 12 },
  secureSub: { color: '#8A82A8', fontSize: 12, textAlign: 'center', marginTop: 2 },

  footerSep: { alignSelf: 'center', width: 200, marginTop: 24 },
  footerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  footerText: { color: '#9A93B5', fontSize: 14, textAlign: 'center', marginTop: 14 },

  // ── Country Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 3, 28, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '60%',
    backgroundColor: '#15102a',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15 },
      android: { elevation: 15 },
      web: { boxShadow: '0 10px 30px rgba(0,0,0,0.5)' } as any,
    }),
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  itemFlag: {
    fontSize: 22,
    marginRight: 14,
  },
  itemName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
  },
  itemDialCode: {
    color: '#B57BFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSearchInput: {
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 16,
  },
});
