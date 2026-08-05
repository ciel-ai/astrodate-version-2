// app.config.js — reads sensitive keys from .env
export default ({ config }) => ({
  ...config,
  name: 'AstroDate',
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
    // Required for production push notifications via expo-notifications.
    // 'development' is injected automatically during debug/sim builds;
    // production store binaries need this declared explicitly so Xcode
    // code-signs with the APS Production entitlement, not development.
    entitlements: {
      'aps-environment': 'production',
    },
    // Apple's "required reason" API declarations (effective for all App
    // Store submissions since Spring 2024) -- several dependencies in this
    // app's native tree (RevenueCat's SDK, AsyncStorage, expo-secure-store's
    // fallback, react-native-keyboard-controller, expo-file-system) actually
    // call these APIs, and Expo/EAS Build doesn't reliably auto-merge every
    // static CocoaPod's own PrivacyInfo.xcprivacy (see
    // https://docs.expo.dev/guides/apple-privacy/), so declaring the
    // aggregate set here is the safe path rather than relying on that. Reason
    // codes are Apple's own published ones for each category -- if a fresh
    // Xcode Archive / App Store Connect privacy report ever flags an
    // undeclared API, add its category+reason here rather than guessing
    // preemptively at more than this.
    privacyManifests: {
  NSPrivacyAccessedAPITypes: [
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
      NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
      NSPrivacyAccessedAPITypeReasons: ['0A2A.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
      NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
    },
    {
      NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
      NSPrivacyAccessedAPITypeReasons: ['E174.1'],
    },
  ],
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
        // iOS reads `image`/`imageWidth` from the top level of this config
        // block, NOT from an `ios:` sub-key -- without it here, the plugin
        // silently skips generating the iOS splash asset entirely, so only
        // Android (which has its own explicit block below) showed a logo.
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
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
        cameraPermission:
          'Astro date uses your camera so you can take a photo to send in chat.',
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
    // Real Sentry project now exists (org: ciel-ai, project: astrodate) with
    // SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN set as EAS env vars, so
    // preview/production builds upload real source maps. development still
    // sets SENTRY_DISABLE_AUTO_UPLOAD=true in eas.json -- dev-client builds
    // don't need release source maps, no reason to add the upload step there.
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
