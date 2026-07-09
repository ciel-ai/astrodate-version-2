import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import ZodiacWheel from '@/components/zodiac-wheel';
import { getInsightsPalette } from './palette';

export function OracleSealedCard({
  onDraw,
  drawing,
  theme,
}: {
  onDraw: () => void;
  drawing: boolean;
  theme: 'light' | 'dark';
}) {
  const palette = getInsightsPalette(theme);

  return (
    <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
      <ZodiacWheel size={220} />

      <Text style={[styles.title, { color: palette.textPrimary }]}>Your Daily Insight Awaits</Text>
      <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
        The stars have something to say. Draw today&apos;s card to reveal it.
      </Text>

      <Pressable
        onPress={onDraw}
        disabled={drawing}
        style={({ pressed }) => [
          styles.cta,
          { backgroundColor: palette.accent },
          pressed && !drawing && styles.ctaPressed,
          drawing && styles.ctaDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Draw today's insight"
      >
        {drawing ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaText}>Draw Today&apos;s Insight</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
  cta: {
    marginTop: 24,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 220,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  ctaDisabled: { opacity: 0.7 },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
