import { renderHook, act } from '@testing-library/react-native';

// Deliberately a separate file from use-subscription-payment.test.ts: RC's
// _rcConfigured/_rcActive module state is only ever evaluated once per
// process, so this scenario (no API key at all) needs its own fresh module
// registry rather than trying to toggle it mid-file.
const mockPurchasePackage = jest.fn();

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getOfferings: jest.fn().mockResolvedValue({ current: null, all: {} }),
    purchasePackage: (...args: unknown[]) => mockPurchasePackage(...args),
    restorePurchases: jest.fn(),
    logIn: jest.fn(),
  },
  PURCHASES_ERROR_CODE: {},
}));

jest.mock('@/context/auth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
jest.mock('@/context/subscription', () => ({ useSubscriptionStatus: () => ({ refetch: jest.fn() }) }));
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));
jest.mock('@/lib/iap-products', () => ({
  ...jest.requireActual('@/lib/iap-products'),
  REVENUECAT_API_KEY_IOS: '',
  REVENUECAT_API_KEY_ANDROID: '',
}));

import { useSubscriptionPayment } from '../use-subscription-payment';

it('fails with a friendly message instead of hanging when RevenueCat has no API key configured', async () => {
  const { result } = renderHook(() => useSubscriptionPayment());

  await act(async () => {
    await result.current.startPayment('astro_plus');
  });

  expect(result.current.paymentStatus).toBe('failed');
  expect(result.current.paymentError).toContain('TestFlight/Play internal testing');
  expect(mockPurchasePackage).not.toHaveBeenCalled();
});
