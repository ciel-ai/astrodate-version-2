// RevenueCat product identifiers — must match the product IDs configured in
// App Store Connect / Google Play Console AND attached to these products in
// the RevenueCat dashboard (Products tab).
export const REVENUECAT_PRODUCT_IDS = {
  astro_plus: 'astro_plus_monthly',
  astro_x: 'astro_x_monthly',
} as const;

// RevenueCat entitlement identifiers — configured in the RevenueCat dashboard
// (Entitlements tab), each attached to both platforms' products above.
export const REVENUECAT_ENTITLEMENT_IDS = {
  astro_plus: 'astro_plus',
  astro_x: 'astro_x',
} as const;

// Set EXPO_PUBLIC_REVENUECAT_API_KEY_IOS / _ANDROID in EAS Secrets (never
// commit the real values). In development you can also add them to a local
// .env file. These are RevenueCat's public SDK keys, not secrets.
export const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? '';

export const REVENUECAT_API_KEY_ANDROID =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? '';

export type RevenueCatPlanSlug = keyof typeof REVENUECAT_PRODUCT_IDS;

// On Android, RevenueCat identifies Play subscription products as
// `productId:basePlanId` (e.g. `astro_plus_monthly:monthly`), not the bare
// product ID — iOS has no base plans, so its identifier is always the bare
// product ID. Compare against both forms so package lookups work on either
// platform.
export function matchesProductId(packageIdentifier: string, productId: string): boolean {
  return packageIdentifier === productId || packageIdentifier.startsWith(`${productId}:`);
}
