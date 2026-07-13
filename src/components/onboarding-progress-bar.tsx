import { StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface OnboardingProgressBarProps {
  /** 1-indexed current page. */
  current: number;
  total?: number;
}

/** Shared step indicator for the onboarding-ques-01..10 wizard -- was
 * duplicated verbatim (only `current`/`total` varying) across all 10 screens. */
export function OnboardingProgressBar({ current, total = 10 }: OnboardingProgressBarProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.progressSection}>
      <View style={styles.progressRow}>
        {Array.from({ length: total }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.progressSegment,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' },
              idx < current && styles.progressSegmentActive,
            ]}
          />
        ))}
      </View>
      <Text style={[styles.progressText, { color: isDark ? '#9A93B5' : '#6B7280' }]}>
        Page {current} of {total}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  progressSection: {
    width: '100%',
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 32,
  },
  progressRow: {
    flexDirection: 'row',
    width: '100%',
    height: 4,
    gap: 6,
    marginBottom: 8,
  },
  progressSegment: {
    flex: 1,
    height: '100%',
    borderRadius: 2,
  },
  progressSegmentActive: {
    backgroundColor: '#B57BFF',
  },
  progressText: {
    color: '#9A93B5',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.8,
  },
});
