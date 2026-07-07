/**
 * "Today Favors [sign]" banner. Avatars are initials-placeholders (same
 * convention as profile-card.tsx / discover-card.tsx — this app has no real
 * photo-URL rendering anywhere yet), built straight from
 * getTodaysMatchNudge's sample_names, no extra fetch needed.
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TodaysMatchNudge } from '@/lib/match-nudge';
import { getInsightsPalette } from './palette';

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function MatchNudgeBanner({
  nudge,
  theme,
}: {
  nudge: TodaysMatchNudge;
  theme: 'light' | 'dark';
}) {
  const palette = getInsightsPalette(theme);
  const router = useRouter();

  if (!nudge.favored_sign) return null;

  const extraCount = Math.max(0, nudge.match_count - nudge.sample_names.length);

  return (
    <Pressable
      onPress={() => router.push('/discover')}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Today favors ${nudge.favored_sign}. Go to Discover.`}
    >
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>
          Today Favors {nudge.favored_sign}
        </Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Great day to connect with those born under {nudge.favored_sign}
        </Text>
      </View>

      <View style={styles.avatarRow}>
        {nudge.sample_names.map((name, i) => (
          <View
            key={i}
            style={[
              styles.avatar,
              { backgroundColor: palette.accentSoft, borderColor: palette.screenBg, marginLeft: i === 0 ? 0 : -10 },
            ]}
          >
            <Text style={[styles.avatarText, { color: palette.accent }]}>{initialsOf(name)}</Text>
          </View>
        ))}
        {extraCount > 0 && (
          <View style={[styles.avatar, styles.extraAvatar, { borderColor: palette.screenBg }]}>
            <Text style={styles.extraText}>+{extraCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  textCol: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500' },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700' },
  extraAvatar: { backgroundColor: '#FF5CA8', marginLeft: -10 },
  extraText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
});
