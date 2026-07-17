import { useEffect } from 'react';
import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import { KeyboardProvider } from '@/lib/keyboard-controller';
import { AppThemeProvider, useAppTheme } from '@/lib/theme-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth';
import { SubscriptionProvider } from '@/context/subscription';
import { registerNotificationTapHandler } from '@/lib/push-notifications';

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
            {/* Address collection */}
            <Stack.Screen name="address" options={{ headerShown: false }} />
            {/* Enable device location for Discover radius filtering */}
            <Stack.Screen name="enable-location" options={{ headerShown: false }} />
            {/* Birth details collection */}
            <Stack.Screen name="birth-details" options={{ headerShown: false }} />
            {/* Profile preview review screen */}
            <Stack.Screen name="profile-preview" options={{ headerShown: false }} />
            {/* Sign back in third-party account link option screen */}
            <Stack.Screen name="sign-back-in" options={{ headerShown: false }} />
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
            <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
            {/* Plan picker — Free / Astro+ / AstroX, purchase flow lives here */}
            <Stack.Screen name="subscription" options={{ headerShown: false, presentation: 'modal' }} />
            {/* Message thread for a matched conversation — custom in-screen header */}
            <Stack.Screen name="chat/[channelId]" options={{ headerShown: false }} />
            {/* Verification — placeholder entry point linked from Profile's Hero card */}
            <Stack.Screen name="verification" options={{ headerShown: false, presentation: 'modal' }} />
            {/* Profile's prompts editor — reuses PromptEditorForm, pushed from PromptsCard */}
            <Stack.Screen name="edit-prompts" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
        </NavThemeProvider>
        </KeyboardProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default function LayoutWrapper() {
  return (
    <AppThemeProvider>
      <RootLayout />
    </AppThemeProvider>
  );
}
