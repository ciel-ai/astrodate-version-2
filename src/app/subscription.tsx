import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionStatus } from '@/context/subscription';
import { useSubscriptionPayment } from '@/hooks/use-subscription-payment';
import { matchesProductId, REVENUECAT_PRODUCT_IDS, type RevenueCatPlanSlug } from '@/lib/iap-products';

type PlanCard = {
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
// add bullets for any of those back until the feature is actually built —
// listing unenforced features here is a false-advertising / refund risk.
const PLANS: PlanCard[] = [
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

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { membership } = useSubscriptionStatus();
  const {
    paymentStatus,
    paymentError,
    startPayment,
    resetPayment,
    restorePurchases,
    packages,
    loadingPackages,
    packagesError,
  } = useSubscriptionPayment();

  useEffect(() => {
    if (paymentStatus === 'active') {
      const timer = setTimeout(() => router.back(), 900);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus]);

  const isBusy = paymentStatus === 'purchasing';
  const currentPlanSlug = membership?.plan_slug ?? 'free';

  const showFallbackMsg = !loadingPackages && packages.length === 0;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        <Text style={styles.title}>Choose your plan</Text>
        <Text style={styles.subtitle}>Unlock more matches, more insight, more you.</Text>

        {paymentStatus === 'active' && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>Purchase confirmed — welcome aboard!</Text>
          </View>
        )}

        {(paymentError || packagesError) && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{paymentError || packagesError}</Text>
          </View>
        )}

        {showFallbackMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>In-app purchases are temporarily unavailable. Please try again later.</Text>
          </View>
        )}

        {loadingPackages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A855F7" />
            <Text style={styles.loadingText}>Loading store pricing...</Text>
          </View>
        ) : (
          PLANS.map((plan) => {
            const isCurrentPlan = currentPlanSlug === plan.slug;
            const matchedPackage = packages.find(
              (pkg) => matchesProductId(pkg.product.identifier, REVENUECAT_PRODUCT_IDS[plan.slug])
            );

            // If a specific plan's package is not available from the store, treat it as unavailable
            const isPlanUnavailable = !matchedPackage;

            return (
              <View key={plan.slug} style={[styles.card, { borderColor: plan.borderColor }, isPlanUnavailable && styles.cardUnavailable]}>
                {plan.popular && !isPlanUnavailable && (
                  <View style={[styles.popularTag, { backgroundColor: plan.accentColor }]}>
                    <Text style={styles.popularTagText}>MOST POPULAR</Text>
                  </View>
                )}
                <Text style={[styles.planBadge, { color: plan.accentColor }]}>{plan.badge}</Text>
                
                {isPlanUnavailable ? (
                  <Text style={styles.planPrice}>Unavailable</Text>
                ) : (
                  <Text style={styles.planPrice}>{matchedPackage.product.priceString}/mo</Text>
                )}
                
                <Text style={styles.planTagline}>{plan.tagline}</Text>

                <View style={styles.featureList}>
                  {plan.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <Text style={[styles.featureCheck, { color: plan.accentColor }]}>✓</Text>
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <Pressable
                  disabled={isBusy || isCurrentPlan || isPlanUnavailable}
                  onPress={() => {
                    resetPayment();
                    void startPayment(plan.slug);
                  }}
                  style={({ pressed }) => [
                    styles.cta,
                    { backgroundColor: plan.accentColor },
                    (pressed || isBusy) && styles.ctaPressed,
                    (isCurrentPlan || isPlanUnavailable) && styles.ctaDisabled,
                  ]}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#1A1030" />
                  ) : (
                    <Text style={styles.ctaText}>
                      {isCurrentPlan ? 'Current plan' : isPlanUnavailable ? 'Plan unavailable' : `Get ${plan.name}`}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}

        <Pressable
          disabled={isBusy}
          onPress={async () => {
            const restored = await restorePurchases();
            if (restored) router.back();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.restoreText}>Restore purchases</Text>
        </Pressable>

        {/* Legal links required by Apple Guideline 3.1.2 */}
        <View style={styles.legalLinksRow}>
          <Pressable onPress={() => router.push('/terms')}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.legalDivider}>|</Text>
          <Pressable onPress={() => router.push('/privacy')}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>

        {/* Subscription Auto-renewing disclosures required by Apple Guideline 3.1.2 */}
        <View style={styles.disclosureContainer}>
          <Text style={styles.disclosureText}>
            Payment will be charged to your iTunes Account at confirmation of purchase.
          </Text>
          <Text style={styles.disclosureText}>
            Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.
          </Text>
          <Text style={styles.disclosureText}>
            You can manage your subscriptions and turn off auto-renewal by going to your Account Settings on the App Store after purchase.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09031C' },
  content: { paddingHorizontal: 24, gap: 16 },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 15 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', marginTop: 4 },
  subtitle: { color: '#B0A8C4', fontSize: 15, lineHeight: 22, marginBottom: 8 },
  successBanner: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    borderRadius: 12,
    padding: 12,
  },
  successText: { color: '#34D399', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  errorBanner: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: { color: '#F87171', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    gap: 4,
  },
  cardUnavailable: {
    opacity: 0.5,
  },
  popularTag: {
    position: 'absolute',
    top: -10,
    right: 20,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  popularTagText: { color: '#1A1030', fontSize: 11, fontWeight: '800' },
  planBadge: { fontSize: 18, fontWeight: '800' },
  planPrice: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 2 },
  planTagline: { color: '#B0A8C4', fontSize: 14, marginBottom: 12 },
  featureList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: { fontSize: 14, fontWeight: '800' },
  featureText: { color: '#E4DEEF', fontSize: 14, flexShrink: 1 },
  cta: { borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: '#1A1030', fontSize: 15, fontWeight: '800' },
  restoreText: { color: '#8B8D99', fontSize: 14, textAlign: 'center', marginTop: 4, textDecorationLine: 'underline' },
  
  // Loading Packages style
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#B0A8C4',
    fontSize: 14,
  },

  // Legal Links
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  legalLink: {
    color: '#8B8D99',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    color: '#4A4C5A',
    fontSize: 13,
  },

  // Disclosures
  disclosureContainer: {
    marginTop: 20,
    paddingHorizontal: 8,
    gap: 8,
  },
  disclosureText: {
    color: '#6B6885',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
