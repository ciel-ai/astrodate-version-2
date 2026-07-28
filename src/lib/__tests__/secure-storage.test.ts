import { Platform, NativeModules } from 'react-native';

// Closes over a single persisted jest.fn(), same as mockSecureStore below --
// the factory form `() => ({ captureMessage: jest.fn() })` would mint a new
// mock function on every jest.resetModules() reload, silently disconnecting
// it from whatever reference a test asserted against beforehand.
const mockSentry = {
  captureMessage: jest.fn(),
};
jest.mock('@sentry/react-native', () => mockSentry);

// expo-secure-store is required dynamically (not statically imported) in
// secure-storage.ts, so it must be registered as a mock module here for the
// `require('expo-secure-store')` call inside getSecureStore() to resolve.
const mockSecureStore = {
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};
jest.mock('expo-secure-store', () => mockSecureStore, { virtual: true });

function setNativeSecureStoreRegistered(registered: boolean) {
  (NativeModules as any).ExpoSecureStore = registered ? {} : undefined;
}

// secure-storage.ts resolves `isWeb` and imports AsyncStorage at module-load
// time, and each test reloads it via jest.resetModules() to pick up a fresh
// Platform.OS. AsyncStorage must be re-required after each reset too, or the
// test and the module under test end up talking to two different mock
// storage instances.
function freshAsyncStorage() {
  // require() (unlike a static `import`) isn't run through babel's
  // interop wrapper, so the mock's raw `module.exports` object is
  // returned directly -- there is no `.default` to unwrap here.
  return require('@react-native-async-storage/async-storage');
}

describe('secure-storage (native platform, SecureStore available)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (Platform as any).OS = 'ios';
    setNativeSecureStoreRegistered(true);
  });

  it('reads through to SecureStore when a value exists', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue('token-123');
    const { getSecureItem } = require('../secure-storage');

    await expect(getSecureItem('session')).resolves.toBe('token-123');
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith('session');
  });

  it('migrates a legacy AsyncStorage value into SecureStore on read, then clears it', async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);
    const AsyncStorage = freshAsyncStorage();
    await AsyncStorage.setItem('session', 'legacy-token');
    const { getSecureItem } = require('../secure-storage');

    await expect(getSecureItem('session')).resolves.toBe('legacy-token');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('session', 'legacy-token');
    await expect(AsyncStorage.getItem('session')).resolves.toBeNull();
  });

  it('falls back to AsyncStorage and reports to Sentry exactly once when SecureStore read throws', async () => {
    mockSecureStore.getItemAsync.mockRejectedValue(new Error('keychain error'));
    const AsyncStorage = freshAsyncStorage();
    await AsyncStorage.setItem('session', 'fallback-value');
    const { getSecureItem } = require('../secure-storage');

    await getSecureItem('session');
    await getSecureItem('session');

    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(mockSentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('falling back to AsyncStorage'),
      'warning'
    );
  });

  it('writes through to SecureStore', async () => {
    const { setSecureItem } = require('../secure-storage');
    await setSecureItem('session', 'new-token');
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('session', 'new-token');
  });

  it('falls back to AsyncStorage on write failure instead of losing the value', async () => {
    mockSecureStore.setItemAsync.mockRejectedValue(new Error('keychain full'));
    const AsyncStorage = freshAsyncStorage();
    const { setSecureItem } = require('../secure-storage');

    await setSecureItem('session', 'new-token');
    await expect(AsyncStorage.getItem('session')).resolves.toBe('new-token');
  });

  it('deletes through to SecureStore', async () => {
    const { deleteSecureItem } = require('../secure-storage');
    await deleteSecureItem('session');
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('session');
  });
});

describe('secure-storage (native platform, SecureStore native module missing)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    setNativeSecureStoreRegistered(false);
  });

  it('goes straight to AsyncStorage without touching SecureStore', async () => {
    const AsyncStorage = freshAsyncStorage();
    await AsyncStorage.setItem('session', 'plain-token');
    const { getSecureItem } = require('../secure-storage');

    await expect(getSecureItem('session')).resolves.toBe('plain-token');
    expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(mockSentry.captureMessage).toHaveBeenCalledTimes(1);
  });
});

describe('secure-storage (web platform)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    (Platform as any).OS = 'web';
  });

  it('uses AsyncStorage directly and never reports a Sentry fallback', async () => {
    const AsyncStorage = freshAsyncStorage();
    await AsyncStorage.setItem('session', 'web-token');
    const { getSecureItem } = require('../secure-storage');

    await expect(getSecureItem('session')).resolves.toBe('web-token');
    expect(mockSecureStore.getItemAsync).not.toHaveBeenCalled();
    expect(mockSentry.captureMessage).not.toHaveBeenCalled();
  });
});
