import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MembershipSummary } from '@/lib/subscription';

const PLAN_ACCENT: Record<string, string> = {
  astro_x: '#60A5FA',
  astro_plus: '#A855F7',
};

interface MembershipCardProps {
  membership: MembershipSummary | null;
  isDark: boolean;
}

export function MembershipCard({ membership, isDark }: MembershipCardProps) {
  const router = useRouter();
  const isActive = Boolean(membership?.is_active);
  const accent = isActive
    ? PLAN_ACCENT[String(membership?.plan_slug ?? '').toLowerCase()] ?? '#94A3B8'
    : '#A855F7';

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#7C7796' : '#6B7280',
  };

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.left}>
        <View style={[styles.badgeDot, { backgroundColor: accent }]} />
        <View>
          <Text style={[styles.planName, { color: T.text }]}>
            {isActive ? membership?.plan_badge ?? membership?.plan_name ?? 'Member' : 'Free plan'}
          </Text>
          <Text style={[styles.planSub, { color: T.dim }]}>
            {isActive ? 'Your subscription is active' : 'Upgrade for more matches & likes'}
          </Text>
        </View>
      </View>

      <Pressable
        id="btn-membership-cta"
        onPress={() => router.push('/subscription')}
        style={({ pressed }) => [styles.cta, { borderColor: accent }, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={isActive ? 'Manage subscription' : 'Upgrade'}
      >
        <Text style={[styles.ctaText, { color: accent }]}>{isActive ? 'Manage' : 'Upgrade'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  badgeDot: { width: 10, height: 10, borderRadius: 5 },
  planName: { fontSize: 15, fontWeight: '700' },
  planSub: { fontSize: 12, marginTop: 2 },
  cta: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  ctaText: { fontSize: 12.5, fontWeight: '700' },
  pressed: { opacity: 0.8 },
});
