/**
 * Verification — placeholder entry point
 *
 * Linked from Profile's Hero card ("Get verified"). The actual capture/review
 * flow is out of scope for the Profile Tab plan; this just gives the badge
 * something real to link to instead of a dead end.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme-context';

export default function VerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';

  const T = {
    bg: isDark ? '#09031C' : '#F5F3FF',
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#7C7796' : '#6B7280',
  };

  return (
    <View style={[styles.container, { backgroundColor: T.bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable
        id="btn-verification-back"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backBtn, { backgroundColor: T.card, borderColor: T.border }, pressed && styles.pressed]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Text style={[styles.backChevron, { color: T.text }]}>‹</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.icon}>🛡️</Text>
        <Text style={[styles.title, { color: T.text }]}>Verification is coming soon</Text>
        <Text style={[styles.subtitle, { color: T.dim }]}>
          A quick selfie check to earn the verified badge on your profile — we&apos;re building this next.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pressed: { opacity: 0.85 },
  backChevron: { fontSize: 22, fontWeight: '700', marginTop: -2 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 },
  icon: { fontSize: 44, marginBottom: 4 },
  title: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
