import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import { useAuth } from '@/context/auth';
import { useSubscriptionStatus } from '@/context/subscription';
import {
  REVENUECAT_API_KEY_ANDROID,
  REVENUECAT_API_KEY_IOS,
  REVENUECAT_ENTITLEMENT_IDS,
  REVENUECAT_PRODUCT_IDS,
  type RevenueCatPlanSlug,
} from '@/lib/iap-products';
import { supabase } from '@/lib/supabase';

export type PaymentStatus = 'idle' | 'purchasing' | 'active' | 'failed';

export interface UseSubscriptionPaymentReturn {
  paymentStatus: PaymentStatus;
  paymentError: string | null;
  startPayment: (planSlug: RevenueCatPlanSlug) => Promise<void>;
  resetPayment: () => void;
  restorePurchases: () => Promise<boolean>;
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

  Purchases.configure({ apiKey });
  _rcConfigured = true;
  _rcActive = true;
}

function isPurchaseCancelled(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR
  );
}

function getErrorMessage(error: unknown) {
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
      const { data, error } = await supabase.functions.invoke('confirm-purchase');
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
  const isMountedRef = useRef(true);

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

        const offerings = await Purchases.getOfferings();
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
        const offerings = await Purchases.getOfferings();
        const allPackages = Object.values(offerings.all).flatMap((offering) => offering.availablePackages);

        if (allPackages.length === 0) {
          // No packages = products not yet live in App Store Connect/Play
          // Console + RevenueCat dashboard, or running outside a store build.
          throw new Error('In-app purchases are not available yet. Please try again later.');
        }

        const selectedPackage = allPackages.find(
          (candidate) => candidate.product.identifier === productId
        );

        if (!selectedPackage) {
          throw new Error(
            'This subscription plan is not available for purchase right now. ' +
            'Please try again later or contact support.'
          );
        }

        const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
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
      }
    },
    [user, refetchMembership]
  );

  const restorePurchases = useCallback(async () => {
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
    const customerInfo = await Purchases.restorePurchases();
    const hasActiveEntitlement = Object.keys(customerInfo.entitlements.active).length > 0;
    if (hasActiveEntitlement) {
      await syncPurchaseWithBackend();
      void refetchMembership();
    }
    return hasActiveEntitlement;
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
    packages,
    loadingPackages,
    packagesError,
  };
}
