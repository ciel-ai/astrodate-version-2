/**
 * Horizontally swipeable row of category cards. No carousel library exists
 * in this repo (and none is needed here) — plain ScrollView with
 * snapToInterval + decelerationRate="fast" gives a "peek next card" feel
 * using only React Native core.
 */
import { useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { DailyPrediction } from '@/lib/astro';
import { saveInsight } from '@/lib/saved-insights';
import { getInsightsPalette } from './palette';
import { BookmarkButton } from './bookmark-button';
import { CATEGORY_LABELS, CategoryIcon, type InsightCategory } from './category-icons';

const CATEGORY_ORDER: InsightCategory[] = [
  'health',
  'emotions',
  'profession',
  'luck',
  'personal_life',
  'travel',
];

const SCREEN_PADDING = 16;
const GAP = 12;
const CARD_WIDTH = Dimensions.get('window').width - SCREEN_PADDING * 2 - 32;

export function CategoryCardRow({
  prediction,
  predictionDate,
  userId,
  theme,
}: {
  prediction: DailyPrediction;
  predictionDate: string;
  userId: string;
  theme: 'light' | 'dark';
}) {
  const palette = getInsightsPalette(theme);
  const [savedLocally, setSavedLocally] = useState<Partial<Record<InsightCategory, boolean>>>({});

  const handleBookmark = async (category: InsightCategory) => {
    if (savedLocally[category]) return; // one-way per screen load — see Phase 3 plan note
    setSavedLocally((prev) => ({ ...prev, [category]: true }));
    const ok = await saveInsight(userId, category, predictionDate, prediction[category]);
    if (!ok) {
      // Revert optimistic state on failure so the user can retry.
      setSavedLocally((prev) => ({ ...prev, [category]: false }));
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + GAP}
      snapToAlignment="start"
      contentContainerStyle={styles.content}
    >
      {CATEGORY_ORDER.map((category) => (
        <View
          key={category}
          style={[
            styles.card,
            { width: CARD_WIDTH, backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <CategoryIcon category={category} color={palette.accent} />
              <Text style={[styles.title, { color: palette.textPrimary }]}>
                {CATEGORY_LABELS[category]}
              </Text>
            </View>
            <BookmarkButton
              saved={!!savedLocally[category]}
              onPress={() => handleBookmark(category)}
              color={palette.accent}
            />
          </View>
          <Text style={[styles.body, { color: palette.textSecondary }]}>{prediction[category]}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingRight: SCREEN_PADDING, gap: GAP },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    minHeight: 140,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20, marginTop: 10 },
});
