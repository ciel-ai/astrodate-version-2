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
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#0d0a1e',
      foregroundImage: './assets/images/icon.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.ACCESS_FINE_LOCATION',
    ],
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
      'react-native-maps',
      {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID || '',
        googleMapsApiKeyIOS: process.env.GOOGLE_MAPS_API_KEY_IOS || '',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'Astro Date needs your location to show nearby matches.',
        locationAlwaysPermission: 'Astro Date uses your location to find matches near you.',
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
