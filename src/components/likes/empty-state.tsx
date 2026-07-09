import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

// A bare empty grid reads as discouraging ("nobody likes you") rather than
// motivating, so both variants point somewhere actionable instead.
type EmptyStateProps = { variant: 'liked-you' | 'your-likes' };

export function EmptyState({ variant }: EmptyStateProps) {
  if (variant === 'liked-you') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.emoji}>✨</Text>
        <Text style={styles.title}>No likes yet — let&apos;s fix that</Text>
        <Text style={styles.body}>
          Complete your Cosmic Blueprint to get noticed by more people who match your energy.
        </Text>
        <Pressable
          onPress={() => router.push('/profile')}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>Complete your profile</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>💫</Text>
      <Text style={styles.title}>You haven&apos;t liked anyone yet</Text>
      <Text style={styles.body}>Head to Discover and start finding your matches.</Text>
      <Pressable
        onPress={() => router.push('/discover')}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaText}>Go to Discover</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 56, gap: 10 },
  emoji: { fontSize: 40, marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', textAlign: 'center' },
  body: { color: '#B0A8C4', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  cta: {
    marginTop: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.85)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
