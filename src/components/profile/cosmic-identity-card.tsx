/**
 * Profile tab — Cosmic Identity card
 *
 * Deliberately fixed-dark regardless of device theme, matching the precedent
 * already set by insights.tsx and constants/compatibility-theme.ts (both
 * "sit on the app's deep-purple background" as a deliberate ritual-moment
 * design choice, not theme-reactive). Does NOT take an `isDark` prop --
 * that's the point.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileData } from '@/hooks/use-profile-data';

function formatSign(val: string | null): string {
  if (!val) return '—';
  return val.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface CosmicIdentityCardProps {
  profile: ProfileData;
}

export function CosmicIdentityCard({ profile }: CosmicIdentityCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasAnyChart = profile.westernSign || profile.indianSign || profile.nakshatraName;
  if (!hasAnyChart) return null;

  const fullChartRows: { label: string; value: string | null }[] = [
    { label: 'Venus', value: profile.venusSign },
    { label: 'Mars', value: profile.marsSign },
    { label: 'Mercury', value: profile.mercurySign },
    { label: 'Rising', value: profile.risingSign },
    { label: 'Element', value: profile.dominantElement },
  ];
  const hasFullChart = fullChartRows.some((r) => r.value);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>COSMIC IDENTITY</Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Text style={styles.chipIcon}>☀️</Text>
          <Text style={styles.chipLabel}>Western</Text>
          <Text style={styles.chipValue}>{formatSign(profile.westernSign)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipIcon}>💠</Text>
          <Text style={styles.chipLabel}>Vedic</Text>
          <Text style={styles.chipValue}>{formatSign(profile.indianSign)}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipIcon}>✨</Text>
          <Text style={styles.chipLabel}>Nakshatra</Text>
          <Text style={styles.chipValue}>{formatSign(profile.nakshatraName)}</Text>
        </View>
      </View>

      {hasFullChart ? (
        <>
          <Pressable
            id="btn-cosmic-identity-toggle"
            onPress={() => setExpanded((v) => !v)}
            style={({ pressed }) => [styles.expandToggle, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Hide full chart' : 'View full chart'}
          >
            <Text style={styles.expandText}>{expanded ? 'Hide full chart' : 'View full chart'}</Text>
            <Text style={styles.expandChevron}>{expanded ? '︿' : '﹀'}</Text>
          </Pressable>

          {expanded ? (
            <View style={styles.fullChartGrid}>
              {fullChartRows.map((row) =>
                row.value ? (
                  <View key={row.label} style={styles.fullChartItem}>
                    <Text style={styles.fullChartLabel}>{row.label}</Text>
                    <Text style={styles.fullChartValue}>{formatSign(row.value)}</Text>
                  </View>
                ) : null
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(216, 179, 106, 0.28)',
    backgroundColor: '#1B1130',
    padding: 20,
    gap: 14,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrowDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#D8B36A' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, color: '#C9AB78' },

  chipRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  chipIcon: { fontSize: 16, marginBottom: 2 },
  chipLabel: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.8, color: '#8F84AC', textTransform: 'uppercase' },
  chipValue: { fontSize: 12.5, fontWeight: '700', color: '#EDE9FF', textAlign: 'center' },

  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.75 },
  expandText: { fontSize: 12.5, fontWeight: '700', color: '#D8B36A' },
  expandChevron: { fontSize: 11, color: '#D8B36A' },

  fullChartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fullChartItem: {
    flexBasis: '31%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(216, 179, 106, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(216, 179, 106, 0.18)',
  },
  fullChartLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, color: '#8F84AC', textTransform: 'uppercase' },
  fullChartValue: { fontSize: 12, fontWeight: '700', color: '#F2D9A0', textAlign: 'center' },
});
