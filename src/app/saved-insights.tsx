import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { useAppTheme } from '@/lib/theme-context';
import { listSavedInsights, type SavedInsight } from '@/lib/saved-insights';
import { CATEGORY_LABELS, type InsightCategory } from '@/components/insights/category-icons';
import { getInsightsPalette } from '@/components/insights/palette';

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category as InsightCategory] ?? category;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SavedInsightsScreen() {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = getInsightsPalette(theme);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SavedInsight[]>([]);

  useEffect(() => {
    if (!user) return;
    listSavedInsights(user.id).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, [user]);

  return (
    <View style={[styles.container, { backgroundColor: palette.screenBg }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      <Pressable
        onPress={() => router.back()}
        style={[
          styles.backBtn,
          {
            top: insets.top + 8,
            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
            borderColor: theme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.1)',
          },
        ]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={[styles.backIcon, { color: palette.textPrimary }]}>‹</Text>
      </Pressable>

      <View style={[styles.content, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>Saved Insights</Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={palette.accent} size="large" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              No saved insights yet. Bookmark a category on the Daily Insights tab to save it here.
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: palette.cardBg, borderColor: palette.cardBorder }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardCategory, { color: palette.accent }]}>
                    {categoryLabel(item.category)}
                  </Text>
                  <Text style={[styles.cardDate, { color: palette.textSecondary }]}>
                    {formatDate(item.prediction_date)}
                  </Text>
                </View>
                <Text style={[styles.cardContent, { color: palette.textPrimary }]}>{item.content}</Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { fontSize: 22, fontWeight: '700', marginTop: -2 },
  content: { flex: 1, paddingHorizontal: 20 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  list: { gap: 12, paddingBottom: 24 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCategory: { fontSize: 13, fontWeight: '700' },
  cardDate: { fontSize: 12, fontWeight: '500' },
  cardContent: { fontSize: 14, lineHeight: 20, marginTop: 8 },
});
