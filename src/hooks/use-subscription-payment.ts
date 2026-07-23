import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { useAuth } from '@/context/auth';
import { useSubscriptionStatus } from '@/context/subscription';
import {
  matchesProductId,
  REVENUECAT_API_KEY_ANDROID,
  REVENUECAT_API_KEY_IOS,
  REVENUECAT_ENTITLEMENT_IDS,
  REVENUECAT_PRODUCT_IDS,
  type RevenueCatPlanSlug,
} from '@/lib/iap-products';
import { supabase } from '@/lib/supabase';
import { withTimeout } from '@/lib/network';

// RevenueCat SDK calls have no built-in timeout -- a hang here (bad network,
// captive portal) previously left paymentStatus stuck at 'purchasing'
// forever with no way out but leaving the screen.
const RC_CALL_TIMEOUT_MS = 20000;

export type PaymentStatus = 'idle' | 'purchasing' | 'active' | 'failed';

export interface UseSubscriptionPaymentReturn {
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  startPayment: (planSlug: RevenueCatPlanSlug) => Promise<void>;
  resetPayment: () => void;
  restorePurchases: () => Promise<boolean>;
  restoringPurchases: boolean;
  packages: any[];
  loadingPackages: boolean;
  packagesError: string | null;
}

let _rcConfigured = false;
let _rcActive = false; // true only when Purchases.configure() was actually called

// Both stores go through RevenueCat — there is no non-RevenueCat purchase
// path in this app (Razorpay was intentionally dropped from the schema).
export async function ensureRevenueCatConfigured() {
  if (_rcConfigured) return;

  if (Platform.OS === 'web') {
    _rcConfigured = true;
    return;
  }

  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

  if (!apiKey) {
    // Non-fatal in Expo Go / dev builds without secrets configured — IAP
    // won't work but the app still loads. Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS
    // / _ANDROID in .env or EAS Secrets for real purchases.
    console.warn(`[RevenueCat] ${Platform.OS} API key is missing — in-app purchases disabled.`);
    _rcConfigured = true;
    _rcActive = false;
    return;
  }

  try {
    Purchases.configure({ apiKey });
    _rcActive = true;
  } catch (err) {
    // Expo Go can't load native modules at all -- react-native-purchases
    // throws "native store is not available" for any real (non-Test Store)
    // API key there. Same "IAP disabled, app still loads" fallback as the
    // missing-key case above, just reached via a thrown error instead of an
    // empty string. Without this catch, _rcConfigured never gets set (it's
    // only set after configure() succeeds), so every remount retries and
    // rethrows the identical error forever in Expo Go.
    console.warn(`[RevenueCat] configure() failed — in-app purchases disabled:`, err);
    _rcActive = false;
  }
  _rcConfigured = true;
}

function isPurchaseCancelled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

// Friendlier copy for the codes a user is actually likely to hit -- everything
// else falls back to error.message, which can be raw StoreKit/Play Billing
// text (still shown, just not specially worded).
const FRIENDLY_ERROR_MESSAGES: Partial<Record<PURCHASES_ERROR_CODE, string>> = {
  [PURCHASES_ERROR_CODE.NETWORK_ERROR]: 'No internet connection. Please check your network and try again.',
  [PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR]: 'No internet connection. Please check your network and try again.',
  [PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR]: 'There was a problem connecting to the store. Please try again shortly.',
  [PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR]: 'You already own this subscription. Try Restore Purchases instead.',
  [PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR]: 'Your payment is pending approval. This can take a moment to complete.',
  [PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR]: 'This purchase is already linked to a different account.',
  [PURCHASES_ERROR_CODE.OPERATION_ALREADY_IN_PROGRESS_ERROR]: 'A purchase is already in progress. Please wait a moment.',
  [PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR]: 'Purchases are not allowed on this device. Check your device restrictions.',
  [PURCHASES_ERROR_CODE.PRODUCT_REQUEST_TIMED_OUT_ERROR]: 'The store took too long to respond. Please try again.',
};

function getErrorMessage(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const friendly = FRIENDLY_ERROR_MESSAGES[(error as { code: PURCHASES_ERROR_CODE }).code];
    if (friendly) return friendly;
  }
  return error instanceof Error ? error.message : String(error);
}

// Verifies the purchase server-side (RevenueCat's own API, not anything the
// client says — see supabase/functions/confirm-purchase) and, on success,
// activates the plan immediately rather than waiting on the async webhook.
// RevenueCat's REST API can lag a couple seconds behind the SDK's local
// purchase confirmation, so this retries briefly before giving up — the
// webhook is still the backstop if every attempt misses.
async function syncPurchaseWithBackend(): Promise<boolean> {
  const delaysMs = [0, 1500, 3000];
  for (const delay of delaysMs) {
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const { data, error } = await withTimeout(
        supabase.functions.invoke('confirm-purchase'),
        RC_CALL_TIMEOUT_MS,
        'confirm-purchase timed out'
      );
      if (!error && data?.success) return true;
    } catch (err) {
      console.warn('[confirm-purchase] attempt failed:', err);
    }
  }
  return false;
}

export function useSubscriptionPayment(): UseSubscriptionPaymentReturn {
  const { user } = useAuth();
  const { refetch: refetchMembership } = useSubscriptionStatus();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const isMountedRef = useRef(true);
  // Synchronous guard against a fast double-tap firing two concurrent
  // purchasePackage() calls before the isBusy/'purchasing' state (set inside
  // this same async function) has actually re-rendered the disabled button.
  const purchaseInProgressRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const fetchOfferings = async () => {
      try {
        setLoadingPackages(true);
        setPackagesError(null);
        await ensureRevenueCatConfigured();

        if (!_rcActive) {
          if (active) {
            setPackages([]);
            setLoadingPackages(false);
          }
          return;
        }

        const offerings = await withTimeout(Purchases.getOfferings(), RC_CALL_TIMEOUT_MS, 'getOfferings timed out');
        if (offerings.current) {
          if (active) {
            setPackages(offerings.current.availablePackages);
          }
        } else {
          const allPackages = Object.values(offerings.all).flatMap((o) => o.availablePackages);
          if (active) {
            setPackages(allPackages);
          }
        }
      } catch (err: any) {
        console.warn('[RevenueCat] failed to load offerings on mount:', err);
        if (active) {
          setPackagesError('Failed to load store pricing.');
        }
      } finally {
        if (active) {
          setLoadingPackages(false);
        }
      }
    };
    fetchOfferings();
    return () => {
      active = false;
    };
  }, []);

  const startPayment = useCallback(
    async (planSlug: RevenueCatPlanSlug) => {
      if (purchaseInProgressRef.current) return;
      purchaseInProgressRef.current = true;
      setPaymentError(null);
      setPaymentStatus('purchasing');

      try {
        await ensureRevenueCatConfigured();

        if (!_rcActive) {
          throw new Error(
            'In-app purchases are not available in this build. Please install from ' +
            'TestFlight/Play internal testing or the store listing to subscribe.'
          );
        }

        if (user) {
          try {
            await Purchases.logIn(user.id);
          } catch (loginErr) {
            console.warn('[RevenueCat] logIn failed — purchase will proceed anonymously:', loginErr);
          }
        }

        const productId = REVENUECAT_PRODUCT_IDS[planSlug];
        const offerings = await withTimeout(Purchases.getOfferings(), RC_CALL_TIMEOUT_MS, 'getOfferings timed out');
        const allPackages = Object.values(offerings.all).flatMap((offering) => offering.availablePackages);

        if (allPackages.length === 0) {
          // No packages = products not yet live in App Store Connect/Play
          // Console + RevenueCat dashboard, or running outside a store build.
          throw new Error('In-app purchases are not available yet. Please try again later.');
        }

        const selectedPackage = allPackages.find(
          (candidate) => matchesProductId(candidate.product.identifier, productId)
        );

        if (!selectedPackage) {
          throw new Error(
            'This subscription plan is not available for purchase right now. ' +
            'Please try again later or contact support.'
          );
        }

        const { customerInfo } = await withTimeout(
          Purchases.purchasePackage(selectedPackage),
          RC_CALL_TIMEOUT_MS,
          'The store took too long to respond. Please check your connection and try again.'
        );
        const entitlementId = REVENUECAT_ENTITLEMENT_IDS[planSlug];
        if (!customerInfo.entitlements.active[entitlementId]) {
          throw new Error('Purchase completed, but no active entitlement was returned.');
        }

        // The store confirmed the purchase. Verify + activate it server-side
        // now (confirm-purchase checks RevenueCat's own API — never trusts
        // this client) so feature gates unlock before this screen closes,
        // instead of waiting on the async webhook. If confirm-purchase can't
        // confirm it in time, the webhook still lands shortly after and
        // activates the account — this is only about closing the gap, not
        // the only path to activation.
        await syncPurchaseWithBackend();

        if (isMountedRef.current) {
          setPaymentStatus('active');
          setPaymentError(null);
        }
        void refetchMembership();
      } catch (error) {
        if (isPurchaseCancelled(error)) {
          if (isMountedRef.current) {
            setPaymentStatus('idle');
            setPaymentError(null);
          }
          return;
        }

        if (isMountedRef.current) {
          setPaymentStatus('failed');
          setPaymentError(getErrorMessage(error));
        }
      } finally {
        purchaseInProgressRef.current = false;
      }
    },
    [user, refetchMembership]
  );

  const restorePurchases = useCallback(async () => {
    setPaymentError(null);
    setRestoringPurchases(true);
    try {
      await ensureRevenueCatConfigured();
      if (!_rcActive) {
        console.warn('[RevenueCat] restorePurchases skipped — SDK not initialized (missing API key).');
        return false;
      }
      if (user) {
        try {
          await Purchases.logIn(user.id);
        } catch {
          // non-fatal
        }
      }
      const customerInfo = await withTimeout(
        Purchases.restorePurchases(),
        RC_CALL_TIMEOUT_MS,
        'The store took too long to respond. Please check your connection and try again.'
      );
      const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
      if (hasActiveEntitlement) {
        await syncPurchaseWithBackend();
        void refetchMembership();
      } else if (isMountedRef.current) {
        setPaymentError('No active purchases found to restore.');
      }
      return hasActiveEntitlement;
    } catch (error) {
      if (isMountedRef.current) {
        setPaymentError(getErrorMessage(error));
      }
      return false;
    } finally {
      if (isMountedRef.current) {
        setRestoringPurchases(false);
      }
    }
  }, [user, refetchMembership]);

  const resetPayment = useCallback(() => {
    setPaymentStatus('idle');
    setPaymentError(null);
  }, []);

  return {
    paymentStatus,
    paymentError,
    startPayment,
    resetPayment,
    restorePurchases,
    restoringPurchases,
    packages,
    loadingPackages,
    packagesError,
  };
}
