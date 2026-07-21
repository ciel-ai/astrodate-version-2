import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { getScoreTier } from '@/lib/score-tier';
import type { SentLikeData } from '@/lib/likes';

// "Your likes" cards are always fully visible to their owner -- no reveal
// logic, no lock states, no heart action (nothing to do here but see who
// you've already liked).
export function SentLikeCard({ item }: { item: SentLikeData }) {
  const tier = item.compatibility_score != null ? getScoreTier(item.compatibility_score) : null;

  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.initials}>{item.full_name.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        {(item.compatibility_score != null || item.action_type === 'super_like') && (
          <View style={styles.topBadgeStack}>
            {item.compatibility_score != null && tier && (
              <View style={styles.scoreChip}>
                <View style={[styles.scoreDot, { backgroundColor: tier.color }]} />
                <Text style={styles.scoreText}>{Math.round(item.compatibility_score)}% match</Text>
              </View>
            )}
            {item.action_type === 'super_like' && (
              <View style={styles.superLikeTag}>
                <Text style={styles.superLikeText}>⭐ Super like</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.full_name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: 'rgba(13, 9, 32, 0.80)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#6A3FE0', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
      web: { boxShadow: '0 6px 18px rgba(106,63,224,0.22)' } as any,
    }),
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: 'rgba(30, 15, 60, 0.70)',
    position: 'relative',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: 'rgba(255,255,255,0.25)', fontSize: 44, fontWeight: '700' },

  // Score and super-like badges stack in one top-left column instead of
  // opposing corners -- this card renders at 48% width in the Likes grid,
  // too narrow for both to coexist without overlapping (same fix as
  // like-card.tsx's topBadgeStack).
  topBadgeStack: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    alignItems: 'flex-start',
    gap: 6,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    backgroundColor: 'rgba(9, 3, 28, 0.75)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.30)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  scoreDot: { width: 7, height: 7, borderRadius: 4 },
  scoreText: { color: '#D4B8FF', fontSize: 11, fontWeight: '700' },

  superLikeTag: {
    maxWidth: '100%',
    backgroundColor: 'rgba(74, 127, 255, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(74, 127, 255, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  superLikeText: { color: '#8CA9E8', fontSize: 10, fontWeight: '700' },

  info: { paddingHorizontal: 12, paddingVertical: 10 },
  name: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
