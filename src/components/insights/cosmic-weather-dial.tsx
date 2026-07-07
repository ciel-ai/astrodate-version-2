/**
 * CosmicWeatherDial — SVG semicircle gauge, 0-100.
 *
 * Same stroke-dasharray + rotation technique as discover-card.tsx's ScoreRing
 * (full circle), adapted to a half circle: the track/fill circles are drawn
 * with a dasharray of [halfCircumference, circumference] so only half the
 * stroke ever renders, then rotated 180° so that half lands on top instead
 * of on the bottom — a standard SVG semicircle-gauge technique.
 */
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { getScoreTier } from '@/lib/score-tier';
import { getInsightsPalette } from './palette';

export function CosmicWeatherDial({
  score,
  theme,
}: {
  score: number;
  theme: 'light' | 'dark';
}) {
  const palette = getInsightsPalette(theme);
  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const halfCircumference = circumference / 2;
  const cx = size / 2;
  const cy = size / 2;
  const canvasHeight = size / 2 + strokeWidth;

  const clamped = Math.max(0, Math.min(100, score));
  const progressLength = halfCircumference * (clamped / 100);
  const tier = getScoreTier(clamped);

  return (
    <View style={styles.wrap}>
      <Svg width={size} height={canvasHeight}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={palette.chipBg}
          strokeWidth={strokeWidth}
          strokeDasharray={`${halfCircumference}, ${circumference}`}
          rotation={180}
          origin={`${cx}, ${cy}`}
          fill="none"
        />
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={tier.color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${progressLength}, ${circumference}`}
          rotation={180}
          origin={`${cx}, ${cy}`}
          fill="none"
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={[styles.score, { color: palette.textPrimary }]}>{Math.round(clamped)}</Text>
        <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
        <Text style={[styles.caption, { color: palette.textSecondary }]}>Cosmic Weather</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'flex-end' },
  center: {
    position: 'absolute',
    bottom: 4,
    alignItems: 'center',
  },
  score: { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  tierLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginTop: 2 },
  caption: { fontSize: 12, fontWeight: '600', marginTop: 4 },
});
