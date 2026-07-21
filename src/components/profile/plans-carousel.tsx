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

export function PlansCarousel({ isDark }: PlansCarouselProps) {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth - PAGE_MARGIN * 2;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
      setActiveIndex(Math.max(0, Math.min(PLANS.length - 1, index)));
    },
    [cardWidth]
  );

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#7C7796' : '#6B7280',
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
        snapToInterval={cardWidth}
        onMomentumScrollEnd={handleMomentumEnd}
        style={{ marginHorizontal: -PAGE_MARGIN }}
        contentContainerStyle={{ paddingHorizontal: PAGE_MARGIN }}
      >
        {PLANS.map((plan) => (
          <Pressable
            key={plan.slug}
            id={`btn-plan-carousel-${plan.slug}`}
            onPress={() => router.push('/subscription')}
            style={({ pressed }) => [
              styles.card,
              { width: cardWidth, backgroundColor: T.card, borderColor: plan.borderColor },
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`View ${plan.name} plan`}
          >
            {plan.popular && (
              <View style={[styles.popularTag, { backgroundColor: plan.accentColor }]}>
                <Text style={styles.popularTagText}>MOST POPULAR</Text>
              </View>
            )}

            <Text style={[styles.badge, { color: plan.accentColor }]}>{plan.badge}</Text>
            <Text style={[styles.price, { color: T.text }]}>{plan.price}</Text>
            <Text style={[styles.tagline, { color: T.dim }]}>{plan.tagline}</Text>

            <View style={styles.features}>
              {plan.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <Text style={[styles.checkmark, { color: plan.accentColor }]}>✓</Text>
                  <Text style={[styles.featureText, { color: T.text }]}>{feature}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.cta, { backgroundColor: plan.accentColor }]}>
              <Text style={styles.ctaText}>Upgrade to {plan.name}</Text>
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
    borderWidth: 1,
    padding: 20,
  },
  pressed: { opacity: 0.92 },
  popularTag: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  popularTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  badge: { fontSize: 18, fontWeight: '800' },
  price: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  tagline: { fontSize: 13, marginTop: 2, marginBottom: 14 },
  features: { gap: 8, marginBottom: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkmark: { fontSize: 13, fontWeight: '800', marginTop: 1 },
  featureText: { fontSize: 13, lineHeight: 18, flex: 1 },
  cta: {
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
