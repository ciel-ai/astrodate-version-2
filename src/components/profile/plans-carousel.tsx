import { useCallback, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { PLANS } from '@/lib/plan-display';

interface PlansCarouselProps {
  isDark: boolean;
}

/** Mixes a hex color toward white (target=255) or black (target=0) by
 *  `amount` (0-1). Used to derive the gradient's light/dark stops from each
 *  plan's single accentColor instead of hand-picking a second color per plan. */
function mix(hex: string, target: number, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blend = (c: number) => Math.round(c + (target - c) * amount).toString(16).padStart(2, '0');
  return `#${blend(r)}${blend(g)}${blend(b)}`;
}
const lighten = (hex: string, amount = 0.32) => mix(hex, 255, amount);
const darken = (hex: string, amount = 0.28) => mix(hex, 0, amount);

/** Colored drop shadow behind the card, matching the pattern already used
 *  elsewhere in this app (e.g. hero-card.tsx's avatar glow) -- Android's
 *  elevation can't be tinted, so it falls back to a plain gray shadow there,
 *  same tradeoff already accepted throughout this codebase. */
function cardShadow(color: string) {
  return Platform.select({
    ios: { shadowColor: color, shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 8 },
    web: { boxShadow: `0 8px 24px ${color}59` } as any,
  });
}

// Matches profile.tsx's outer ScrollView contentContainerStyle paddingHorizontal
// -- the carousel breaks out to full screen width (negative margin) then
// re-applies this same inset so each card's edges line up with every other
// card on the page, one full card per swipe (Tinder-style single-card paging,
// not a peek-preview carousel).
const PAGE_MARGIN = 20;
// Visible breathing room between cards -- factored into snapToInterval below
// so paging still lands exactly on each card's left edge despite the gap.
const CARD_GAP = 14;

export function PlansCarousel({ isDark }: PlansCarouselProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - PAGE_MARGIN * 2;
  const [activeIndex, setActiveIndex] = useState(0);

  const snapInterval = cardWidth + CARD_GAP;

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
      setActiveIndex(Math.max(0, Math.min(PLANS.length - 1, index)));
    },
    [snapInterval]
  );

  const T = {
    dotOff: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
    dotOn: isDark ? '#FFFFFF' : '#1B1528',
  };

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        onMomentumScrollEnd={handleMomentumEnd}
        style={{ marginHorizontal: -PAGE_MARGIN }}
        contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN }}
      >
        {PLANS.map((plan, index) => (
          <Pressable
            key={plan.slug}
            id={`btn-plan-carousel-${plan.slug}`}
            onPress={() => router.push('/subscription')}
            style={({ pressed }) => [
              styles.cardShadowWrap,
              {
                width: cardWidth,
                marginRight: index < PLANS.length - 1 ? CARD_GAP : 0,
              },
              cardShadow(plan.accentColor),
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`View ${plan.name} plan`}
          >
            {/* Shadow needs an unclipped wrapper (above) -- overflow:hidden
                on the same view that casts an iOS shadow clips the shadow
                away entirely, so the gradient/rounded-corner clipping lives
                on this separate inner view instead. */}
            <View style={styles.card}>
              <LinearGradient
                colors={[lighten(plan.accentColor), plan.accentColor, darken(plan.accentColor)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Soft diagonal glass-sheen highlight, top-left corner */}
              <LinearGradient
                colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.7, y: 0.7 }}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />

              {/* Always rendered (just invisible when not popular) so every
                  card reserves the same vertical space -- otherwise the plan
                  without a badge is shorter and the cards visibly jump when
                  swiping between them. */}
              <View style={[styles.popularTag, !plan.popular && styles.hidden]}>
                <Text style={[styles.popularTagText, { color: plan.accentColor }]}>MOST POPULAR</Text>
              </View>

              <Text style={styles.badge}>{plan.badge}</Text>
              <Text style={styles.price}>{plan.price}</Text>
              <Text style={styles.tagline}>{plan.tagline}</Text>

              <View style={styles.features}>
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <Text style={styles.checkmark}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.cta}>
                <Text style={[styles.ctaText, { color: plan.accentColor }]}>Upgrade to {plan.name}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.dotsRow}>
        {PLANS.map((plan, i) => (
          <View
            key={plan.slug}
            style={[styles.dot, { backgroundColor: i === activeIndex ? T.dotOn : T.dotOff }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  cardShadowWrap: { borderRadius: 20 },
  card: {
    borderRadius: 20,
    padding: 20,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92 },
  hidden: { opacity: 0 },
  popularTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  popularTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  badge: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  price: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 4 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, marginBottom: 14 },
  features: { gap: 8, marginBottom: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginTop: 1 },
  featureText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, lineHeight: 18, flex: 1 },
  cta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: { fontSize: 14, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
