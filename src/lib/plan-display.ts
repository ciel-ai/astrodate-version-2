import { Platform } from 'react-native';
import type { RevenueCatPlanSlug } from '@/lib/iap-products';

export type PlanCard = {
  slug: RevenueCatPlanSlug;
  name: string;
  badge: string;
  price: string;
  tagline: string;
  accentColor: string;
  popular?: boolean;
  features: string[];
};

// Single source of truth for plan display copy -- used by both the
// subscription (purchase) screen and Profile's plan carousel, so the two
// never drift out of sync with each other.
//
// Static display copy mirroring plan_catalog's seeded `features` JSON
// (supabase/migrations/20260630120200_subscriptions.sql, trimmed by
// 20260721120000_remove_dead_plan_features.sql) — prices shown here are
// fallbacks; the store charges whatever price is configured against each
// product ID in App Store Connect / Google Play Console.
//
// Only bullets backed by an actual enforced RPC/gate are listed here.
// plan_catalog.features now only contains the 8 keys real RPCs actually
// read (daily_likes, see_who_likes_you, weekly_super_likes, daily_rewinds,
// deck_size, high_match_quota, high_match_percent, top_match_of_day) — the
// unenforced marketing keys that used to sit alongside them (advanced_filters,
// dealbreakers, incognito_mode, full_synastry_report, deep_synastry,
// ai_match_reading, weekly_boost, priority_likes, skip_the_line,
// astrologer_chat, reading_packages) were removed rather than fixed. Don't
// add bullets for any of those back until the feature is actually built --
// listing unenforced features here is a false-advertising / refund risk.
export const PLANS: PlanCard[] = [
  {
    slug: 'astro_plus',
    name: 'Astro+',
    badge: '✦ Astro+',
    price: '₹299/mo',
    tagline: 'See who already likes you',
    accentColor: '#A855F7',
    popular: true,
    features: [
      '40 likes per day',
      'See 5 profiles who liked you',
      '3 super likes per week',
      '1 rewind per day',
      'Bigger daily deck with more high-compatibility matches',
    ],
  },
  {
    slug: 'astro_x',
    name: 'AstroX',
    badge: '✦ AstroX',
    price: '₹599/mo',
    tagline: 'The full cosmic picture',
    accentColor: '#F6B93B',
    features: [
      'Unlimited likes',
      'See everyone who liked you',
      '5 super likes per week, unlimited rewinds',
      'Largest daily deck, weighted toward top matches',
      'Your #1 match pinned every day',
    ],
  },
];

/** Mixes a hex color toward white (target=255) or black (target=0) by
 *  `amount` (0-1). Used to derive a plan card gradient's light/dark stops
 *  from its single accentColor instead of hand-picking a second color per
 *  plan -- shared by the Profile plan carousel and the /subscription plan
 *  picker so both render the exact same purple-for-Astro+/gold-for-AstroX
 *  gradient card treatment. */
function mix(hex: string, target: number, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c + (target - c) * amount).toString(16).padStart(2, '0');
  return `#${blend(r)}${blend(g)}${blend(b)}`;
}
export const lightenPlanColor = (hex: string, amount = 0.32) => mix(hex, 255, amount);
export const darkenPlanColor = (hex: string, amount = 0.28) => mix(hex, 0, amount);

/** Colored drop shadow behind a plan card, matching the pattern already used
 *  elsewhere in this app (e.g. hero-card.tsx's avatar glow) -- Android's
 *  elevation can't be tinted, so it falls back to a plain gray shadow there,
 *  same tradeoff already accepted throughout this codebase. */
export function planCardShadow(color: string) {
  return Platform.select({
    ios: { shadowColor: color, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8 },
    web: { boxShadow: `0 8px 24px ${color}59` } as any,
  });
}
