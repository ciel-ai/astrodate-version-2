import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

// SecureStore is native-only; fall back to AsyncStorage on web/Expo Go.
const isWeb = Platform.OS === 'web';

/**
 * Check if the native module for SecureStore is linked and registered in the binary.
 */
function hasNativeSecureStore(): boolean {
  if (isWeb) return false;

  // Check the global Expo Modules registry
  const expoModules = (globalThis as any).expo?.modules || (globalThis as any).ExpoModules;
  if (expoModules && (expoModules.ExpoSecureStore || expoModules.SecureStore)) {
    return true;
  }

  // Fall back to checking standard React Native NativeModules
  if (NativeModules && (NativeModules.ExpoSecureStore || NativeModules.SecureStore)) {
    return true;
  }

  return false;
}

function getSecureStore() {
  if (isWeb) return null;

  // Safely check if the native module is registered in this binary before attempting to require it,
  // preventing native-level JSI crashes that bypass JavaScript try/catch blocks.
  if (!hasNativeSecureStore()) {
    console.warn('[secure-storage] ExpoSecureStore native module is not registered in this binary, using AsyncStorage fallback.');
    return null;
  }

  try {
    // Dynamic require: expo-secure-store is an optional native dependency,
    // so this must not be a static import or the bundler would require it to be installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-secure-store');
  } catch (e) {
    console.warn('[secure-storage] expo-secure-store not available in this environment, using AsyncStorage fallback:', e);
    return null;
  }
}

/**
 * Read a value from SecureStore (native) or AsyncStorage (web/Expo Go fallback).
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isWeb) return AsyncStorage.getItem(key);

  const SecureStore = getSecureStore();
  if (!SecureStore) {
    return AsyncStorage.getItem(key);
  }

  try {
    const value = await SecureStore.getItemAsync(key);
    if (value !== null) return value;

    // One-time migration: promote legacy plaintext value to SecureStore.
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      try {
        await SecureStore.setItemAsync(key, legacy);
        await AsyncStorage.removeItem(key);
      } catch (writeErr) {
        console.warn('[secure-storage] Migration write failed:', writeErr);
      }
      return legacy;
    }
  } catch (e) {
    console.warn('[secure-storage] SecureStore read failed, falling back:', e);
    return AsyncStorage.getItem(key);
  }

  return null;
}

/**
 * Write a value to SecureStore (native) or AsyncStorage (web/Expo Go fallback).
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  const SecureStore = getSecureStore();
  if (!SecureStore) {
    await AsyncStorage.setItem(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn('[secure-storage] SecureStore write failed, falling back:', e);
    await AsyncStorage.setItem(key, value);
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
    return;
  }

  const SecureStore = getSecureStore();
  if (!SecureStore) {
    await AsyncStorage.removeItem(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (e) {
    console.warn('[secure-storage] SecureStore delete failed, falling back:', e);
    await AsyncStorage.removeItem(key);
  }
}
