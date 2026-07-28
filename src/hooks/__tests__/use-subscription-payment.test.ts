import { Platform } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';

// -- react-native-purchases -------------------------------------------------
// The real package pulls in @revenuecat/purchases-js-hybrid-mappings, which
// ships untranspiled ESM `export` syntax Jest can't parse -- mocking the
// whole module (rather than fighting transformIgnorePatterns) sidesteps
// that entirely. PURCHASES_ERROR_CODE is defined inline inside the factory
// (not referenced from outer scope) because jest.mock() factories may only
// close over identifiers that either start with "mock" or are declared
// inside the factory itself.
const mockConfigure = jest.fn();
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();
const mockLogIn = jest.fn();

jest.mock('react-native-purchases', () => {
  const PURCHASES_ERROR_CODE = {
    PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    OFFLINE_CONNECTION_ERROR: 'OFFLINE_CONNECTION_ERROR',
    STORE_PROBLEM_ERROR: 'STORE_PROBLEM_ERROR',
    PRODUCT_ALREADY_PURCHASED_ERROR: 'PRODUCT_ALREADY_PURCHASED_ERROR',
    PAYMENT_PENDING_ERROR: 'PAYMENT_PENDING_ERROR',
    RECEIPT_ALREADY_IN_USE_ERROR: 'RECEIPT_ALREADY_IN_USE_ERROR',
    OPERATION_ALREADY_IN_PROGRESS_ERROR: 'OPERATION_ALREADY_IN_PROGRESS_ERROR',
    PURCHASE_NOT_ALLOWED_ERROR: 'PURCHASE_NOT_ALLOWED_ERROR',
    PRODUCT_REQUEST_TIMED_OUT_ERROR: 'PRODUCT_REQUEST_TIMED_OUT_ERROR',
  };
  return {
    __esModule: true,
    default: {
      configure: (...args: unknown[]) => mockConfigure(...args),
      getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
      purchasePackage: (...args: unknown[]) => mockPurchasePackage(...args),
      restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
      logIn: (...args: unknown[]) => mockLogIn(...args),
    },
    PURCHASES_ERROR_CODE,
  };
});

// -- app context / data layer ------------------------------------------------
const mockUseAuth = jest.fn();
const mockUseSubscriptionStatus = jest.fn();
const mockFunctionsInvoke = jest.fn();
const mockRefetchMembership = jest.fn();

jest.mock('@/context/auth', () => ({ useAuth: () => mockUseAuth() }));
jest.mock('@/context/subscription', () => ({ useSubscriptionStatus: () => mockUseSubscriptionStatus() }));
jest.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockFunctionsInvoke(...args) } },
}));
// ensureRevenueCatConfigured() treats a missing API key as "IAP disabled" and
// never calls Purchases.configure() at all -- spread the real module
// (matchesProductId, product/entitlement id maps) and only override the two
// env-derived key constants so this whole file exercises the "RC is active"
// path. _rcConfigured/_rcActive are memoized at module scope and only ever
// evaluated once per process, so a separate file
// (use-subscription-payment-no-api-key.test.ts, which gets its own fresh
// module registry from Jest automatically) covers the missing-key path
// instead of trying to toggle this mid-file.
jest.mock('@/lib/iap-products', () => ({
  ...jest.requireActual('@/lib/iap-products'),
  REVENUECAT_API_KEY_IOS: 'test-ios-key',
  REVENUECAT_API_KEY_ANDROID: 'test-android-key',
}));

import { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { useSubscriptionPayment } from '../use-subscription-payment';

function makePackage(productId: string) {
  return { product: { identifier: productId }, identifier: 'monthly' };
}

function offeringsWithPackages(...packages: ReturnType<typeof makePackage>[]) {
  return { current: null, all: { default: { availablePackages: packages } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  (Platform as any).OS = 'ios';
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockUseSubscriptionStatus.mockReturnValue({ refetch: mockRefetchMembership });
  // Mount-time offerings fetch (separate from the startPayment-time fetch) --
  // give it a harmless empty response by default.
  mockGetOfferings.mockResolvedValue({ current: null, all: {} });
  mockFunctionsInvoke.mockResolvedValue({ data: { success: true }, error: null });
});

describe('startPayment', () => {
  it('activates the plan and syncs with the backend on a successful purchase', async () => {
    mockGetOfferings.mockResolvedValue(offeringsWithPackages(makePackage('astro_plus_monthly')));
    mockPurchasePackage.mockResolvedValue({
      customerInfo: { entitlements: { active: { astro_plus: {} } } },
    });

    const { result } = renderHook(() => useSubscriptionPayment());

    await act(async () => {
      await result.current.startPayment('astro_plus');
    });

    expect(result.current.paymentStatus).toBe('active');
    expect(result.current.paymentError).toBeNull();
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('confirm-purchase');
    expect(mockRefetchMembership).toHaveBeenCalled();
  });

  it('matches Android\'s "productId:basePlanId" package identifier shape', async () => {
    (Platform as any).OS = 'android';
    mockGetOfferings.mockResolvedValue(offeringsWithPackages(makePackage('astro_x_monthly:monthly')));
    mockPurchasePackage.mockResolvedValue({
      customerInfo: { entitlements: { active: { astro_x: {} } } },
    });

    const { result } = renderHook(() => useSubscriptionPayment());

    await act(async () => {
      await result.current.startPayment('astro_x');
    });

    expect(result.current.paymentStatus).toBe('active');
    expect(mockPurchasePackage).toHaveBeenCalledWith(
      expect.objectContaining({ product: expect.objectContaining({ identifier: 'astro_x_monthly:monthly' }) })
    );
  });

  it('resets to idle without an error message when the user cancels the store sheet', async () => {
    mockGetOfferings.mockResolvedValue(offeringsWithPackages(makePackage('astro_plus_monthly')));
    mockPurchasePackage.mockRejectedValue({ code: PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR });

    const { result } = renderHook(() => useSubscriptionPayment());

    await act(async () => {
      await result.current.startPayment('astro_plus');
    });

    expect(result.current.paymentStatus).toBe('idle');
    expect(result.current.paymentError).toBeNull();
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('fails with a friendly message for a known store error code', async () => {
    mockGetOfferings.mockResolvedValue(offeringsWithPackages(makePackage('astro_plus_monthly')));
    mockPurchasePackage.mockRejectedValue({ code: PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR, message: 'raw sdk text' });

    const { result } = renderHook(() => useSubscriptionPayment());

    await act(async () => {
      await result.current.startPayment('astro_plus');
    });

    expect(result.current.paymentStatus).toBe('failed');
    expect(result.current.paymentError).toBe('There was a problem connecting to the store. Please try again shortly.');
  });

  it('fails when the purchase succeeds but the expected entitlement is not active', async () => {
    mockGetOfferings.mockResolvedValue(offeringsWithPackages(makePackage('astro_plus_monthly')));
    mockPurchasePackage.mockResolvedValue({ customerInfo: { entitlements: { active: {} } } });

    const { result } = renderHook(() => useSubscriptionPayment());

    await act(async () => {
      await result.current.startPayment('astro_plus');
    });

    expect(result.current.paymentStatus).toBe('failed');
    expect(result.current.paymentError).toBe('Purchase completed, but no active entitlement was returned.');
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('fails when no package matches the requested plan\'s product id', async () => {
    mockGetOfferings.mockResolvedValue(offeringsWithPackages(makePackage('some_other_product')));

    const { result } = renderHook(() => useSubscriptionPayment());

    await act(async () => {
      await result.current.startPayment('astro_plus');
    });

    expect(result.current.paymentStatus).toBe('failed');
    expect(result.current.paymentError).toContain('not available for purchase');
    expect(mockPurchasePackage).not.toHaveBeenCalled();
  });

  it('ignores a second concurrent call while a purchase is already in flight', async () => {
    mockGetOfferings.mockResolvedValue(offeringsWithPackages(makePackage('astro_plus_monthly')));
    let resolvePurchase: (v: unknown) => void = () => {};
    mockPurchasePackage.mockReturnValue(new Promise((resolve) => { resolvePurchase = resolve; }));

    const { result } = renderHook(() => useSubscriptionPayment());

    let firstCall!: Promise<void>;
    await act(async () => {
      firstCall = result.current.startPayment('astro_plus');
      await result.current.startPayment('astro_plus'); // should no-op immediately
    });

    expect(mockPurchasePackage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePurchase({ customerInfo: { entitlements: { active: { astro_plus: {} } } } });
      await firstCall;
    });

    expect(result.current.paymentStatus).toBe('active');
  });
});

describe('restorePurchases', () => {
  it('returns true and syncs when an active entitlement is restored', async () => {
    mockRestorePurchases.mockResolvedValue({ entitlements: { active: { astro_plus: {} } } });

    const { result } = renderHook(() => useSubscriptionPayment());

    let restored = false;
    await act(async () => {
      restored = await result.current.restorePurchases();
    });

    expect(restored).toBe(true);
    expect(mockFunctionsInvoke).toHaveBeenCalledWith('confirm-purchase');
    expect(mockRefetchMembership).toHaveBeenCalled();
    expect(result.current.paymentError).toBeNull();
  });

  it('returns false with an explanatory message when there is nothing to restore', async () => {
    mockRestorePurchases.mockResolvedValue({ entitlements: { active: {} } });

    const { result } = renderHook(() => useSubscriptionPayment());

    let restored = true;
    await act(async () => {
      restored = await result.current.restorePurchases();
    });

    expect(restored).toBe(false);
    expect(result.current.paymentError).toBe('No active purchases found to restore.');
    expect(mockFunctionsInvoke).not.toHaveBeenCalled();
  });

  it('returns false and surfaces the error when the SDK call itself fails', async () => {
    mockRestorePurchases.mockRejectedValue({ code: PURCHASES_ERROR_CODE.NETWORK_ERROR });

    const { result } = renderHook(() => useSubscriptionPayment());

    let restored = true;
    await act(async () => {
      restored = await result.current.restorePurchases();
    });

    expect(restored).toBe(false);
    expect(result.current.paymentError).toBe('No internet connection. Please check your network and try again.');
  });

  it('clears restoringPurchases even after a failure', async () => {
    mockRestorePurchases.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useSubscriptionPayment());

    await act(async () => {
      await result.current.restorePurchases();
    });

    await waitFor(() => expect(result.current.restoringPurchases).toBe(false));
  });
});
