import { StyleSheet, Text, View } from 'react-native';
import { getInsightsPalette } from './palette';

export function LuckyChips({
  luckyColor,
  luckyNumber,
  theme,
}: {
  luckyColor: string;
  luckyNumber: number;
  theme: 'light' | 'dark';
}) {
  const palette = getInsightsPalette(theme);

  return (
    <View style={styles.row}>
      <View style={[styles.chip, { backgroundColor: palette.chipBg, borderColor: palette.cardBorder }]}>
        <Text style={[styles.chipLabel, { color: palette.textSecondary }]}>Lucky Color</Text>
        <Text style={[styles.chipValue, { color: palette.textPrimary }]}>{luckyColor}</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: palette.chipBg, borderColor: palette.cardBorder }]}>
        <Text style={[styles.chipLabel, { color: palette.textSecondary }]}>Lucky Number</Text>
        <Text style={[styles.chipValue, { color: palette.textPrimary }]}>{luckyNumber}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  chip: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  chipLabel: { fontSize: 11, fontWeight: '600' },
  chipValue: { fontSize: 15, fontWeight: '700', marginTop: 2 },
});
