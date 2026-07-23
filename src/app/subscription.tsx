import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscriptionStatus } from '@/context/subscription';
import { useSubscriptionPayment } from '@/hooks/use-subscription-payment';
import { matchesProductId, REVENUECAT_PRODUCT_IDS } from '@/lib/iap-products';
import { PLANS } from '@/lib/plan-display';
import { useAppTheme } from '@/lib/theme-context';

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';
  const T = {
    bg: isDark ? '#09031C' : '#F9F9FB',
    closeBtnBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#B0A8C4' : '#6B7280',
    dim2: isDark ? '#6B6885' : '#8B93A6',
    card: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    divider: isDark ? '#4A4C5A' : '#C4C1CC',
  };
  const { membership } = useSubscriptionStatus();
  const {
    paymentStatus,
    paymentError,
    startPayment,
    resetPayment,
    restorePurchases,
    restoringPurchases,
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
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
      >
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={[styles.closeBtn, { backgroundColor: T.closeBtnBg }]}>
          <Text style={[styles.closeText, { color: T.text }]}>✕</Text>
        </Pressable>

        <Text style={[styles.title, { color: T.text }]}>Choose your plan</Text>
        <Text style={[styles.subtitle, { color: T.dim }]}>Unlock more matches, more insight, more you.</Text>

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
            <Text style={[styles.loadingText, { color: T.dim }]}>Loading store pricing...</Text>
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
              <View key={plan.slug} style={[styles.card, { backgroundColor: T.card, borderColor: plan.borderColor }, isPlanUnavailable && styles.cardUnavailable]}>
                {plan.popular && !isPlanUnavailable && (
                  <View style={[styles.popularTag, { backgroundColor: plan.accentColor }]}>
                    <Text style={styles.popularTagText}>MOST POPULAR</Text>
                  </View>
                )}
                <Text style={[styles.planBadge, { color: plan.accentColor }]}>{plan.badge}</Text>

                {isPlanUnavailable ? (
                  <Text style={[styles.planPrice, { color: T.text }]}>Unavailable</Text>
                ) : (
                  <Text style={[styles.planPrice, { color: T.text }]}>{matchedPackage.product.priceString}/mo</Text>
                )}

                <Text style={[styles.planTagline, { color: T.dim }]}>{plan.tagline}</Text>

                <View style={styles.featureList}>
                  {plan.features.map((feature) => (
                    <View key={feature} style={styles.featureRow}>
                      <Text style={[styles.featureCheck, { color: plan.accentColor }]}>✓</Text>
                      <Text style={[styles.featureText, { color: T.text }]}>{feature}</Text>
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
          disabled={isBusy || restoringPurchases}
          onPress={async () => {
            const restored = await restorePurchases();
            if (restored) router.back();
          }}
          accessibilityRole="button"
        >
          {restoringPurchases ? (
            <ActivityIndicator color={T.dim} />
          ) : (
            <Text style={[styles.restoreText, { color: T.dim }]}>Restore purchases</Text>
          )}
        </Pressable>

        {/* Legal links required by Apple Guideline 3.1.2 */}
        <View style={styles.legalLinksRow}>
          <Pressable onPress={() => router.push('/terms')}>
            <Text style={[styles.legalLink, { color: T.dim }]}>Terms of Service</Text>
          </Pressable>
          <Text style={[styles.legalDivider, { color: T.divider }]}>|</Text>
          <Pressable onPress={() => router.push('/privacy')}>
            <Text style={[styles.legalLink, { color: T.dim }]}>Privacy Policy</Text>
          </Pressable>
        </View>

        {/* Subscription Auto-renewing disclosures required by Apple Guideline 3.1.2 */}
        <View style={styles.disclosureContainer}>
          <Text style={[styles.disclosureText, { color: T.dim2 }]}>
            Payment will be charged to your iTunes Account at confirmation of purchase.
          </Text>
          <Text style={[styles.disclosureText, { color: T.dim2 }]}>
            Subscription automatically renews unless auto-renew is turned off at least 24 hours before the end of the current period.
          </Text>
          <Text style={[styles.disclosureText, { color: T.dim2 }]}>
            You can manage your subscriptions and turn off auto-renewal by going to your Account Settings on the App Store after purchase.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 16 },
  closeBtn: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 15 },
  title: { fontSize: 26, fontWeight: '800', marginTop: 4 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
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
  planPrice: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  planTagline: { fontSize: 14, marginBottom: 12 },
  featureList: { gap: 8, marginBottom: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureCheck: { fontSize: 14, fontWeight: '800' },
  featureText: { fontSize: 14, flexShrink: 1 },
  cta: { borderRadius: 24, paddingVertical: 14, alignItems: 'center' },
  ctaPressed: { opacity: 0.85 },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: '#1A1030', fontSize: 15, fontWeight: '800' },
  restoreText: { fontSize: 14, textAlign: 'center', marginTop: 4, textDecorationLine: 'underline' },

  // Loading Packages style
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
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
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    fontSize: 13,
  },

  // Disclosures
  disclosureContainer: {
    marginTop: 20,
    paddingHorizontal: 8,
    gap: 8,
  },
  disclosureText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});
