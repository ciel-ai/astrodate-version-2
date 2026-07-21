import type { RevenueCatPlanSlug } from '@/lib/iap-products';

export type PlanCard = {
  slug: RevenueCatPlanSlug;
  name: string;
  badge: string;
  price: string;
  tagline: string;
  accentColor: string;
  borderColor: string;
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
    borderColor: 'rgba(168, 85, 247, 0.4)',
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
    borderColor: 'rgba(246, 185, 59, 0.4)',
    features: [
      'Unlimited likes',
      'See everyone who liked you',
      '5 super likes per week, unlimited rewinds',
      'Largest daily deck, weighted toward top matches',
      'Your #1 match pinned every day',
    ],
  },
];
