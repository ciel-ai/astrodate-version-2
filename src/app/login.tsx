import { useFonts } from 'expo-font';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: deviceW, height: deviceH } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [phone, setPhone] = useState('');
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

    setLoading(true);
    const fullPhone = `${selectedCountry.dialCode}${phone.trim()}`;

    try {
      // Check for an account before spending an OTP send on it -- without
      // this, signInWithOtp's default shouldCreateUser:true would silently
      // create a brand-new account for an unrecognized number typed into
      // Login, and charge an SMS for it.
      const { data: existing, error: checkError } = await supabase.rpc('check_auth_user_exists', {
        input_phone: fullPhone,
      });

      if (checkError) throw checkError;

      if (!existing) {
        alert(
          'No Account Found',
          "We couldn't find an account with this phone number. Please sign up instead.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Up', onPress: () => router.push('/create-account') },
          ]
        );
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        phone: fullPhone,
        options: { shouldCreateUser: false },
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

  const LOGO_TOP = 0;
  const LOGO_W = Math.round(deviceW * 0.50);
  const LOGO_H = Math.round(LOGO_W * (175 / 145));
  const TITLE_FS = Math.round(deviceW * 0.105);
  const BG_SHIFT = isDark ? Math.round(deviceH * 0.18) : Math.round(deviceH * 0.26);
  const BG_SCALE = isDark ? 1.38 : 2.25;
  const FORM_GAP = 65;

  const bgSource = isDark
    ? require('@/assets/images/create-bg.png')
    : require('@/assets/images/create-bg-light.png');

  return (
    <ImageBackground
      source={bgSource}
      style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#E6D8FF' }]}
      resizeMode="cover"
      imageStyle={{ transform: [{ scale: BG_SCALE }, { translateY: -BG_SHIFT }] }}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
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

      {/* Main layout — plain View, no scrolling */}
      <View style={[styles.container, { paddingTop: Math.max(0, insets.top - 2), paddingBottom: insets.bottom + 16 }]}>

        {/* ── Logo lockup ── */}
        <View style={[styles.lockup, { marginTop: LOGO_TOP }]} pointerEvents="none">
          <Image
            source={require('@/assets/images/logo.png')}
            style={{ width: LOGO_W, height: LOGO_H }}
            resizeMode="contain"
          />
          <Text style={[styles.wordmark, { fontSize: TITLE_FS, marginTop: -Math.round(LOGO_H * 0.30), color: isDark ? '#FFFFFF' : '#1B1528' }]}>
            Astro date
          </Text>
          <View style={styles.sepRow}>
            <View style={[styles.sepLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(75,0,130,0.25)' }]} />
            <View style={[styles.sepDiamond, { backgroundColor: isDark ? '#FFFFFF' : '#7C3AED' }]} />
            <View style={[styles.sepLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(75,0,130,0.25)' }]} />
          </View>
          <Text style={[styles.tagline, { color: isDark ? '#E6D8FF' : '#6B7280' }]}>LOVE, WRITTEN IN THE STARS</Text>
        </View>

        {/* ── Welcome Back ── */}
        <View style={[styles.heroSection, { marginTop: FORM_GAP }]}>
          <Text style={[styles.welcomeTitle, { color: isDark ? '#FFFFFF' : '#1B1528' }]} numberOfLines={1} adjustsFontSizeToFit>
            Welcome Back
          </Text>
          <Text style={[styles.welcomeSub, { color: isDark ? '#9A93B5' : '#5C5478' }]}>Your stars have been waiting ✦</Text>
        </View>

        {/* ── Form section ── */}
        <View style={styles.formSection}>

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
                <Text style={styles.otpSparkle}>➤</Text>
                <Text style={styles.otpText}>Send OTP</Text>
              </>
            )}
          </Pressable>


          <Text style={[styles.footerText, { color: isDark ? '#9A93B5' : '#5C5478' }]}>
            {"Don't have an account? "}
            <Text style={[styles.signupLink, { color: isDark ? '#A855F7' : '#7C3AED' }]} onPress={() => router.push('/create-account')}>
              Sign up
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
  container: { flex: 1 },

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

  // ── Welcome Back ──
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontFamily: SERIF,
    color: '#FFFFFF',
    fontSize: 28,
    textAlign: 'center',
  },
  welcomeSub: {
    color: '#C9C3DE',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
    opacity: 0.85,
  },

  // ── Form section ──
  formSection: {
    paddingHorizontal: 24,
  },

  // ── Phone input ──
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

  // ── Send OTP ──
  otpButton: {
    height: 52,
    borderRadius: 26,
    marginTop: 18,
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
  otpSparkle: { color: '#FFFFFF', fontSize: 15, marginRight: 8 },
  otpText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },


  // ── Footer ──
  footerText: {
    color: '#9A93B5',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  signupLink: { color: '#A855F7', fontWeight: '700' },

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
