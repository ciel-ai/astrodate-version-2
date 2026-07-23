import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme-context';

// Explains *why* the user hit a wall, framed by `reason`. The actual plan
// picker + RevenueCat purchase flow lives in /subscription.
const COPY: Record<string, { title: string; body: string }> = {
  instant_match: {
    title: 'Unlock to match with them instantly',
    body: 'They already liked you — unlocking reveals who they are and matches you right away, guaranteed.',
  },
  sort_by_compatibility: {
    title: 'Sort by compatibility with AstroX',
    body: 'AstroX lets you sort everyone who liked you by cosmic compatibility, so the best matches rise to the top.',
  },
  see_who_likes_you: {
    title: 'See who likes you',
    body: 'Upgrade to reveal every profile that already liked you — no more guessing.',
  },
  swipe_limit: {
    title: "You're out of swipes for today",
    body: 'Astro+ gives you 40 daily swipes, AstroX unlimited — come back tomorrow or upgrade now.',
  },
  swipe_limit_with_locked_matches: {
    title: 'Your excellent matches are still waiting',
    body: "You're out of swipes, but not out of great matches — upgrade to unlock them right now instead of waiting until tomorrow.",
  },
  more_high_matches: {
    title: 'More excellent matches are ready for you',
    body: 'Your free deck only shows one great match a day — Astro+ shows ~12, AstroX shows over half your whole deck.',
  },
  rewind_not_available: {
    title: 'Undo your last swipe',
    body: 'Astro+ gives you 1 rewind a day, AstroX unlimited — never lose a match to a slipped finger again.',
  },
  super_like_limit: {
    title: 'Get more super likes',
    body: 'Free gives you 1 a week, Astro+ gives you 3, AstroX gives you 5 — stand out to the matches you want most.',
  },
  match_insights: {
    title: 'Unlock full match insights',
    body: 'See Manglik status, Nadi & Bhakoot dosha, your Ashtakoota breakdown, and a full personality compatibility report for every match.',
  },
};

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const copy = COPY[reason ?? ''] ?? COPY.see_who_likes_you;
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';
  const T = {
    bg: isDark ? '#09031C' : '#F9F9FB',
    closeBtnBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
    closeText: isDark ? '#FFFFFF' : '#1B1528',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#B0A8C4' : '#6B7280',
    notNow: isDark ? '#8B8D99' : '#6B7280',
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.content, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close" style={[styles.closeBtn, { backgroundColor: T.closeBtnBg }]}>
          <Text style={[styles.closeText, { color: T.closeText }]}>✕</Text>
        </Pressable>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>✨ AstroX</Text>
        </View>

        <Text style={[styles.title, { color: T.text }]}>{copy.title}</Text>
        <Text style={[styles.body, { color: T.dim }]}>{copy.body}</Text>

        <Pressable
          onPress={() => router.push('/subscription')}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>See plans</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} accessibilityRole="button">
          <Text style={[styles.notNow, { color: T.notNow }]}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 16 },
  closeBtn: {
    position: 'absolute',
    top: 0,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 15 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(246, 185, 59, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(246, 185, 59, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { color: '#F6B93B', fontSize: 13, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', lineHeight: 32 },
  body: { fontSize: 15, lineHeight: 22 },
  cta: {
    marginTop: 16,
    backgroundColor: '#F6B93B',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: '#1A1030', fontSize: 16, fontWeight: '800' },
  notNow: { fontSize: 14, textAlign: 'center', marginTop: 4 },
});
