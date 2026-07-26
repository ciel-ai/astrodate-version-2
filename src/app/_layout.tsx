import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { KeyboardProvider } from '@/lib/keyboard-controller';
import { AppThemeProvider, useAppTheme } from '@/lib/theme-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth';
import { SubscriptionProvider } from '@/context/subscription';
import { registerNotificationTapHandler } from '@/lib/push-notifications';
import { initSentry } from '@/lib/sentry';
import { ThemedAlertHost } from '@/lib/themed-alert';

// Must run before the rest of the app renders so crashes during first render
// are still captured.
initSentry();

function RootLayout() {
  const { theme } = useAppTheme();

  // App-wide, registered once regardless of auth state so a cold-start tap
  // (before AuthProvider resolves) is still captured by
  // getLastNotificationResponseAsync inside the handler.
  useEffect(() => {
    return registerNotificationTapHandler();
  }, []);

  return (
    <AuthProvider>
      <SubscriptionProvider>
        <KeyboardProvider>
        <NavThemeProvider value={theme === 'dark' ? NavDarkTheme : NavDefaultTheme}>
          <AnimatedSplashOverlay />
          <ThemedAlertHost />
          <Stack
            screenOptions={{
              contentStyle: {
                backgroundColor: theme === 'dark' ? '#09031C' : '#E6D8FF',
              },
            }}
          >
            {/* Main app shell — 5-tab bottom navigation, frozen on blur */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            {/* Full-screen cosmic splash — no header, no tab bar */}
            <Stack.Screen name="index" options={{ headerShown: false }} />
            {/* Create account / phone sign-up — full screen, no header */}
            <Stack.Screen name="create-account" options={{ headerShown: false }} />
            {/* Login — full screen, no header */}
            <Stack.Screen name="login" options={{ headerShown: false }} />
            {/* Verify OTP — full screen, no header */}
            <Stack.Screen name="verify-otp" options={{ headerShown: false }} />
            {/* Onboarding Wizard */}
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            {/* Terms of Service */}
            <Stack.Screen name="terms" options={{ headerShown: false }} />
            {/* Privacy Policy */}
            <Stack.Screen name="privacy" options={{ headerShown: false }} />
            {/* Settings */}
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            {/* Blocked accounts — reached from Settings > Privacy & Location */}
            <Stack.Screen name="blocked-accounts" options={{ headerShown: false }} />
            {/* Address collection */}
            <Stack.Screen name="address" options={{ headerShown: false }} />
            {/* Enable device location for Discover radius filtering */}
            <Stack.Screen name="enable-location" options={{ headerShown: false }} />
            {/* Birth details collection */}
            <Stack.Screen name="birth-details" options={{ headerShown: false }} />
            {/* Profile preview review screen */}
            <Stack.Screen name="profile-preview" options={{ headerShown: false }} />
            {/* Cosmic identity: Vedic / Western / Nakshatra reveal */}
            <Stack.Screen name="cosmic-identity" options={{ headerShown: false }} />
            {/* Onboarding Questionnaire Pages */}
            <Stack.Screen name="onboarding-ques-01" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-02" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-03" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-04" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-05" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-06" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-07" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-08" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-09" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding-ques-10" options={{ headerShown: false }} />
            {/* Final transition screen after questionnaire */}
            <Stack.Screen name="finish-ques" options={{ headerShown: false }} />
            {/* Photo upload screen */}
            <Stack.Screen name="upload-photos" options={{ headerShown: false }} />
            {/* Saved (bookmarked) Daily Insights entries */}
            <Stack.Screen name="saved-insights" options={{ headerShown: false }} />
            {/* Paywall — contextual upgrade prompt (locked likes reveal, sort, etc.) */}
            {/* fullScreenModal (not 'modal'/pageSheet) so the sheet covers the
                whole screen on iOS -- pageSheet leaves the previous screen
                peeking through with rounded corners at the top, which reads
                as this screen's own top being cut off. */}
            <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            {/* Plan picker — Free / Astro+ / AstroX, purchase flow lives here */}
            <Stack.Screen name="subscription" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            {/* Message thread for a matched conversation — custom in-screen header */}
            <Stack.Screen name="chat/[channelId]" options={{ headerShown: false }} />
            {/* Match page — beautiful transition overlay */}
            <Stack.Screen name="match" options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade' }} />
            {/* Profile's prompts editor — reuses PromptEditorForm, pushed from PromptsCard */}
            <Stack.Screen name="edit-prompts" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
        </NavThemeProvider>
        </KeyboardProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

// Last-resort fallback for an uncaught render error anywhere in the tree --
// previously there was none, so any such error crashed straight to a blank
// screen with no way back short of force-quitting. Deliberately has zero
// dependency on app context (no useAppTheme/font loading/etc.) since this
// needs to render even if the crash happened inside one of those providers.
function CrashFallback({ resetError }: { resetError: () => void }) {
  return (
    <View style={crashStyles.container}>
      <Text style={crashStyles.title}>Something went wrong</Text>
      <Text style={crashStyles.body}>
        {"AstroDate hit an unexpected error. You can try again, or restart the app if that doesn't help."}
      </Text>
      <Pressable
        onPress={resetError}
        style={({ pressed }) => [crashStyles.button, pressed && crashStyles.buttonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={crashStyles.buttonText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const crashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09031C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  body: { color: '#B0A8C4', fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 28 },
  button: { backgroundColor: '#7C3AED', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 14 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});

function LayoutWrapper() {
  return (
    <Sentry.ErrorBoundary fallback={({ resetError }) => <CrashFallback resetError={resetError} />}>
      <AppThemeProvider>
        <RootLayout />
      </AppThemeProvider>
    </Sentry.ErrorBoundary>
  );
}

export default Sentry.wrap(LayoutWrapper);
