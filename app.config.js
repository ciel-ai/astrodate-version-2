// app.config.js — reads sensitive keys from .env
export default ({ config }) => ({
  ...config,
  name: 'astro-date',
  slug: 'astro-date',
  version: '1.0.0',
  // 'fingerprint' computes compatibility from the actual native code/config
  // hash, so an OTA update (`eas update`) only reaches builds it's actually
  // compatible with -- safer than a manually-bumped version string given
  // this app has several native config plugins (RevenueCat, Sentry, etc.).
  runtimeVersion: {
    policy: 'fingerprint',
  },
  updates: {
    url: 'https://u.expo.dev/815421e2-6735-481b-93e0-2e59e59282ff',
  },
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'astrodate',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/images/icon.png',
    bundleIdentifier: 'com.ciel.astrodate',
    // Every screen in this app is phone-oriented (fixed portrait, no tablet
    // layout anywhere) -- explicit false rather than relying on Expo's
    // implicit default, so App Store Connect only offers iPhone screenshot
    // slots and the binary's Info.plist UIDeviceFamily excludes iPad.
    supportsTablet: false,
    infoPlist: {
      // Standard HTTPS/TLS only (Supabase, RevenueCat, AstrologyAPI) — no
      // custom or proprietary encryption, so this is a deliberate exemption
      // answer rather than leaving Apple to ask it per-build.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0d0a1e',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'com.ciel.astrodate',
  },
  web: {
    output: 'static',
    favicon: './assets/images/icon.png',
  },
  plugins: [
    'expo-router',
    'expo-asset',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#208AEF',
        android: {
          image: './assets/images/splash-icon.png',
          imageWidth: 76,
        },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Astro date uses your location to show you people nearby and how far away they are. Your exact location is never shown to other users.',
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Astro date uses your photo library so you can choose profile photos to show other users.',
      },
    ],
    'expo-secure-store',
    [
      'expo-notifications',
      {
        color: '#7C3AED',
      },
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Astro date uses your microphone to record voice messages in chats.',
      },
    ],
    // Missing SENTRY_ORG/SENTRY_PROJECT (no Sentry project created yet) is
    // fine -- the plugin warns and falls back to those env vars at build
    // time rather than failing; see .env.example.
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        ...(process.env.SENTRY_ORG ? { organization: process.env.SENTRY_ORG } : {}),
        ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: '815421e2-6735-481b-93e0-2e59e59282ff',
    },
  },
});
