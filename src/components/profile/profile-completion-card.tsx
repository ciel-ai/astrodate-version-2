import { StyleSheet, Text, View } from 'react-native';

interface ProfileCompletionCardProps {
  percent: number;
  isDark: boolean;
}

/** Hidden entirely at 100% by the caller (profile.tsx) -- this component
 *  just renders the bar, it doesn't decide whether to show itself. */
export function ProfileCompletionCard({ percent, isDark }: ProfileCompletionCardProps) {
  const T = {
    card: isDark ? 'rgba(168, 85, 247, 0.08)' : 'rgba(124, 58, 237, 0.06)',
    border: isDark ? 'rgba(168, 85, 247, 0.22)' : 'rgba(124, 58, 237, 0.18)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#B9AFD1' : '#6B5E85',
    track: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(0, 0, 0, 0.06)',
  };

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.headerRow}>
        <Text style={styles.sparkle}>✨</Text>
        <Text style={[styles.title, { color: T.text }]}>Your profile is {percent}% complete</Text>
      </View>
      <View style={[styles.track, { backgroundColor: T.track }]}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
      <Text style={[styles.subtitle, { color: T.dim }]}>Complete it to get more meaningful matches!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sparkle: { fontSize: 15 },
  title: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: '#A855F7' },
  subtitle: { fontSize: 12, lineHeight: 17 },
});
