import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AuthProvider } from '@/context/auth';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack>
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
          {/* Birth details collection */}
          <Stack.Screen name="birth-details" options={{ headerShown: false }} />
          {/* Profile preview review screen */}
          <Stack.Screen name="profile-preview" options={{ headerShown: false }} />
          {/* Sign back in third-party account link option screen */}
          <Stack.Screen name="sign-back-in" options={{ headerShown: false }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}
