// app.config.js — reads sensitive keys from .env
export default ({ config }) => ({
  ...config,
  name: 'astro-date',
  slug: 'astro-date',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'astrodate',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/images/icon.png',
    bundleIdentifier: 'com.ciel.ai.astrodate',
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0d0a1e',
      foregroundImage: './assets/images/icon.png',
    },
    predictiveBackGestureEnabled: false,
    package: 'com.ciel.ai.astrodate',
  },
  web: {
    output: 'static',
    favicon: './assets/images/icon.png',
  },
  plugins: [
    'expo-router',
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
    'expo-secure-store',
    [
      'expo-audio',
      {
        microphonePermission: 'Astro date uses your microphone to record voice messages in chats.',
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
