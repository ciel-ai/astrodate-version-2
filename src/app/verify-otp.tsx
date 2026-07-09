import { useFonts } from 'expo-font';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/hooks/use-color-scheme';

const SERIF = 'Baskerville-Old-Face';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { width: deviceW, height: deviceH } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const phone = (params.phone as string) || '+91 98765 43210';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(29);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const inputRef = useRef<TextInput>(null);

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  // Countdown timer for code resend
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: '#09031C' }} />;
  }

  const handleVerify = async () => {
    if (loading) return;

    if (!code || code.trim().length < 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phone,
        token: code.trim(),
        type: 'sms',
      });

      if (error) {
        Alert.alert('Verification Failed', error.message);
      } else {
        Alert.alert(
          'Verification Successful',
          'Your phone number has been verified successfully!',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/onboarding'),
            }
          ]
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phone,
      });

      if (error) {
        Alert.alert('Resend Failed', error.message);
      } else {
        Alert.alert('Code Resent', 'A new verification code has been sent to your phone.');
        setResendTimer(29);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // UI rendering of split code boxes
  const codeDigits = code.split('');
  const slots = Array(6).fill('');

  // Layout positioning to match image
  const LOGO_TOP = Math.round(deviceH * 0.02);
  const FORM_GAP = Math.round(deviceH * 0.11);
  const LOGO_W = Math.round(deviceW * 0.50);
  const LOGO_H = Math.round(LOGO_W * (175 / 145));
  const TITLE_FS = Math.round(deviceW * 0.105);

  const BG_SHIFT = isDark ? Math.round(deviceH * 0.18) : Math.round(deviceH * 0.26);
  const BG_SCALE = isDark ? 1.38 : 2.25;
  const slotWidth = Math.floor((deviceW - 48 - 40) / 6);

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
      <Glitters count={16} />

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
            source={require('@/assets/images/logo.png')}
            style={{ width: LOGO_W, height: LOGO_H }}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.wordmark, 
              { 
                fontSize: TITLE_FS, 
                marginTop: -Math.round(LOGO_H * 0.28),
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

        {/* Custom Form Layout */}
        <View style={[styles.form, { marginTop: FORM_GAP }]}>
          <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Enter Verification Code</Text>

          <View style={styles.subtitleRow}>
            <Text style={[styles.subtitle, { color: isDark ? '#9A93B5' : '#5C5478' }]}>{"We've sent a 6-digit code to"}</Text>
            <View style={styles.phoneEditRow}>
              <Text style={[styles.phoneNumberText, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>{phone}</Text>
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <Text style={{ color: isDark ? '#B57BFF' : '#7C3AED', fontSize: 13, marginLeft: 6, marginTop: -2 }}>✎</Text>
              </Pressable>
            </View>
          </View>

          {/* Hidden native textinput placed off-screen to avoid any layout calculations */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={(txt) => setCode(txt.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            style={styles.hiddenInput}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            caretHidden
            autoFocus
          />

          {/* Split Custom Input slots */}
          <Pressable style={styles.slotsContainer} onPress={() => inputRef.current?.focus()}>
            {slots.map((_, index) => {
              const char = codeDigits[index] || '';
              const isFocused = index === code.length && isInputFocused;
              return (
                <View
                  key={index}
                  style={[
                    styles.slotBox,
                    { 
                      width: slotWidth,
                      borderColor: isFocused ? '#A855F7' : (char !== '' ? (isDark ? 'rgba(181, 123, 255, 0.35)' : 'rgba(124, 58, 237, 0.35)') : (isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(75,0,130,0.15)')),
                      backgroundColor: isFocused ? (isDark ? 'rgba(30, 15, 60, 0.65)' : 'rgba(245, 240, 255, 0.85)') : (isDark ? 'rgba(20, 12, 40, 0.45)' : 'rgba(255, 255, 255, 0.75)')
                    }
                  ]}
                >
                  <Text style={[styles.slotText, { color: isDark ? '#FFFFFF' : '#1B1528' }, char === '' && [styles.slotDash, { color: isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(75,0,130,0.25)' }]]}>
                    {char || '-'}
                  </Text>
                </View>
              );
            })}
          </Pressable>

          {/* Timer Display */}
          <View style={styles.timerRow}>
            <Text style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : '#5C5478', fontSize: 13, marginRight: 6 }}>🕒</Text>
            <Text style={[styles.timerText, { color: isDark ? 'rgba(255, 255, 255, 0.65)' : '#5C5478' }]}>
              {"Resend code in "}
              <Text style={[styles.timerHighlight, { color: isDark ? '#B57BFF' : '#7C3AED' }]}>
                {resendTimer > 0
                  ? `00:${resendTimer < 10 ? `0${resendTimer}` : resendTimer}`
                  : '00:00'}
              </Text>
            </Text>
          </View>

          {/* Action button */}
          <Pressable
            onPress={handleVerify}
            style={({ pressed }) => [styles.verifyButton, pressed && styles.verifyPressed]}
            accessibilityRole="button"
            accessibilityLabel="Verify & Continue"
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.verifySparkle}>✦</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 16, marginRight: 6 }}>🛡️</Text>
                <Text style={styles.verifyText}>Verify & Continue</Text>
                <Text style={styles.verifySparkleRight}>✦</Text>
              </View>
            )}
          </Pressable>

          {/* OR separator */}
          <View style={styles.orRow}>
            <View style={[styles.orLine, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(75, 0, 130, 0.10)' }]} />
            <Text style={[styles.orText, { color: isDark ? 'rgba(255, 255, 255, 0.35)' : '#7C7796' }]}>OR</Text>
            <View style={[styles.orLine, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(75, 0, 130, 0.10)' }]} />
          </View>

          {/* Resend Link */}
          <View style={styles.resendRow}>
            <Text style={[styles.didNotReceiveText, { color: isDark ? '#8A82A8' : '#7C7796' }]}>{"Didn't receive the code?"}</Text>
            <Pressable onPress={handleResend} disabled={resendTimer > 0 || loading} hitSlop={10}>
              <Text style={[styles.resendLink, { color: isDark ? '#B57BFF' : '#7C3AED' }, resendTimer > 0 && styles.resendLinkDisabled]}>
                Resend OTP
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  content: { flex: 1, justifyContent: 'flex-start' },

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

  // ── Form Panel ──
  form: { paddingHorizontal: 24, alignItems: 'center' },
  heading: { color: '#FFFFFF', fontSize: 25, fontWeight: '700', textAlign: 'center', letterSpacing: 0.2 },

  subtitleRow: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 26,
  },
  subtitle: {
    color: '#9A93B5',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.85,
  },
  phoneEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  phoneNumberText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ── Hidden native input ──
  hiddenInput: {
    position: 'absolute',
    width: 100,
    height: 40,
    left: -9999,
    opacity: 0.01,
  },

  // ── Custom slots ──
  slotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  slotBox: {
    height: 60,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotBoxFocused: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(30, 15, 60, 0.65)',
    ...Platform.select({
      ios: {
        shadowColor: '#B57BFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 0 10px 1px rgba(181, 123, 255, 0.8)',
      } as any,
    }),
  },
  slotBoxFilled: {
    borderColor: 'rgba(181, 123, 255, 0.35)',
  },
  slotText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30,
  },
  slotDash: {
    color: 'rgba(255, 255, 255, 0.25)',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 30,
  },

  // ── Timer Display ──
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  timerText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 13,
  },
  timerHighlight: {
    color: '#B57BFF',
    fontWeight: '700',
  },

  // ── OR Separator ──
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  orText: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 16,
    letterSpacing: 1,
  },

  // ── Resend Options ──
  resendRow: {
    alignItems: 'center',
    marginBottom: 26,
  },
  didNotReceiveText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13.5,
    marginBottom: 6,
  },
  resendLink: {
    color: '#A855F7',
    fontSize: 15,
    fontWeight: '700',
  },
  resendLinkDisabled: {
    opacity: 0.4,
  },

  // ── Verify & Continue button ──
  verifyButton: {
    height: 54,
    width: '100%',
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(100deg, #C026D3, #7C3AED 55%, #2563EB)',
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 10 },
      web: { boxShadow: '0 8px 28px 0 rgba(124,58,237,0.55)' } as any,
    }),
    marginBottom: 16,
  } as any,
  verifyPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifySparkle: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, marginRight: 8 },
  verifySparkleRight: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 13, marginLeft: 8 },
  verifyText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  // ── Change number Row ──
  changeNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  changeNumberText: {
    color: '#A855F7',
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Footer agreement text ──
  footerAgreementText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: '85%',
  },
  agreementLink: {
    color: '#B57BFF',
    fontWeight: '600',
  },
  andText: {
    color: 'rgba(255, 255, 255, 0.45)',
  },
});
