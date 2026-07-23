import { useCallback, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PLANS } from '@/lib/plan-display';

interface PlansCarouselProps {
  isDark: boolean;
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
              styles.card,
              {
                width: cardWidth,
                marginRight: index < PLANS.length - 1 ? CARD_GAP : 0,
                backgroundColor: plan.accentColor,
              },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`View ${plan.name} plan`}
          >
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
  card: {
    borderRadius: 20,
    padding: 20,
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
