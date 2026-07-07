import { StyleSheet, Text, View } from 'react-native';
import { getInsightsPalette } from './palette';

export function MoonPhaseDayRulerTags({
  moonPhase,
  dayRuler,
  theme,
}: {
  moonPhase: string;
  dayRuler: string;
  theme: 'light' | 'dark';
}) {
  const palette = getInsightsPalette(theme);

  return (
    <View style={styles.row}>
      <View style={[styles.tag, { backgroundColor: palette.chipBg, borderColor: palette.cardBorder }]}>
        <Text style={styles.emoji}>🌙</Text>
        <View>
          <Text style={[styles.label, { color: palette.textSecondary }]}>Moon Phase</Text>
          <Text style={[styles.value, { color: palette.textPrimary }]}>{moonPhase}</Text>
        </View>
      </View>
      <View style={[styles.tag, { backgroundColor: palette.chipBg, borderColor: palette.cardBorder }]}>
        <Text style={styles.emoji}>☉</Text>
        <View>
          <Text style={[styles.label, { color: palette.textSecondary }]}>Day Ruler</Text>
          <Text style={[styles.value, { color: palette.textPrimary }]}>{dayRuler}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  tag: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 11, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '700', marginTop: 1 },
});
