import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth';
import { useAppTheme } from '@/lib/theme-context';
import { getDailyInsight, type DailyInsight } from '@/lib/astro';
import { getTodaysMatchNudge, type TodaysMatchNudge } from '@/lib/match-nudge';
import { getLastDrawnAt, isSameLocalDay, recordOracleDraw } from '@/lib/oracle';

import { getInsightsPalette } from '@/components/insights/palette';
import { OracleSealedCard } from '@/components/insights/oracle-sealed-card';
import { CosmicWeatherDial } from '@/components/insights/cosmic-weather-dial';
import { MoonPhaseDayRulerTags } from '@/components/insights/moon-phase-day-ruler-tags';
import { LuckyChips } from '@/components/insights/lucky-chips';
import { MatchNudgeBanner } from '@/components/insights/match-nudge-banner';
import { CategoryCardRow } from '@/components/insights/category-card-row';

type ScreenState = 'loading' | 'sealed' | 'revealed' | 'error';

export default function InsightsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const palette = getInsightsPalette(theme);

  const [state, setState] = useState<ScreenState>('loading');
  const [drawing, setDrawing] = useState(false);
  const [insight, setInsight] = useState<DailyInsight | null>(null);
  const [nudge, setNudge] = useState<TodaysMatchNudge | null>(null);

  const reveal = useCallback(async (userId: string) => {
    const [dailyInsight, matchNudge] = await Promise.all([
      getDailyInsight(userId),
      getTodaysMatchNudge(userId),
    ]);
    setInsight(dailyInsight);
    setNudge(matchNudge);
    setState(dailyInsight ? 'revealed' : 'error');
  }, []);

  useEffect(() => {
    // Wait for auth to actually resolve (one way or the other) — don't just
    // sit on `!user` forever. Once authLoading is false, either proceed with
    // a real user or land on a terminal (non-spinner) state.
    if (authLoading) return;
    if (!user) {
      setState('error');
      return;
    }

    (async () => {
      const lastDrawnAt = await getLastDrawnAt(user.id);
      if (isSameLocalDay(lastDrawnAt)) {
        await reveal(user.id);
      } else {
        setState('sealed');
      }
    })();
  }, [user, authLoading, reveal]);

  const handleDraw = async () => {
    if (!user || drawing) return;
    setDrawing(true);
    await recordOracleDraw(user.id);
    await reveal(user.id);
    setDrawing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.screenBg }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

      {state === 'loading' && (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.accent} size="large" />
        </View>
      )}

      {state === 'sealed' && (
        <ScrollView
          contentContainerStyle={[styles.sealedContent, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 }]}
        >
          <OracleSealedCard onDraw={handleDraw} drawing={drawing} theme={theme} />
        </ScrollView>
      )}

      {state === 'error' && (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: palette.textPrimary }]}>
            Couldn't load today's insight.
          </Text>
          <Pressable
            onPress={() => user && reveal(user.id)}
            style={[styles.retryBtn, { backgroundColor: palette.accent }]}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      )}

      {state === 'revealed' && insight && (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.header, { color: palette.textPrimary }]}>Daily Insights</Text>

          <View style={styles.dialWrap}>
            <CosmicWeatherDial score={insight.cosmic_weather_score ?? 0} theme={theme} />
          </View>

          <View style={styles.section}>
            <MoonPhaseDayRulerTags moonPhase={insight.moon_phase} dayRuler={insight.day_ruler} theme={theme} />
          </View>

          <View style={styles.section}>
            <LuckyChips luckyColor={insight.lucky_color} luckyNumber={insight.lucky_number} theme={theme} />
          </View>

          {nudge && (
            <View style={styles.section}>
              <MatchNudgeBanner nudge={nudge} theme={theme} />
            </View>
          )}

          {insight.prediction && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>Today's Forecast</Text>
              <CategoryCardRow
                prediction={insight.prediction}
                predictionDate={insight.prediction_date}
                userId={user!.id}
                theme={theme}
              />
            </View>
          )}

          <Pressable
            onPress={() => router.push('/saved-insights' as any)}
            style={({ pressed }) => [
              styles.savedBtn,
              { backgroundColor: palette.chipBg, borderColor: palette.cardBorder },
              pressed && styles.savedBtnPressed,
            ]}
          >
            <Text style={[styles.savedBtnText, { color: palette.accent }]}>View Saved Insights</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 16 },
  sealedContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  content: { paddingHorizontal: 16 },
  header: { fontSize: 20, fontWeight: '800', marginBottom: 16 },
  dialWrap: { alignItems: 'center', marginBottom: 8 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  errorText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  retryBtn: { borderRadius: 999, paddingVertical: 12, paddingHorizontal: 28 },
  retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  savedBtn: {
    marginTop: 20,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  savedBtnPressed: { opacity: 0.85 },
  savedBtnText: { fontSize: 14, fontWeight: '700' },
});
