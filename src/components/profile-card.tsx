/**
 * ProfileCard
 *
 * Renders a single profile from the `get_fallback_feed` / discovery feed.
 * The `distance_label` field is a pre-formatted string from the backend
 * (e.g. "3 km away", "< 1 km away") — we just render it, never raw coords.
 */
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export interface FeedProfile {
  id: string;
  display_name: string;
  /** Sun-sign or zodiac label, e.g. "♏ Scorpio" */
  zodiac_label?: string;
  /** Fuzzed distance string from the backend, e.g. "4 km away". Null when
   *  the user has not enabled location sharing on either side. */
  distance_label?: string | null;
  /** 0-100 compatibility score */
  compatibility_score?: number | null;
}

interface ProfileCardProps {
  profile: FeedProfile;
  onPress?: (id: string) => void;
}

export function ProfileCard({ profile, onPress }: ProfileCardProps) {
  const initials = profile.display_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Pressable
      id={`profile-card-${profile.id}`}
      onPress={() => onPress?.(profile.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`View profile of ${profile.display_name}`}
    >
      {/* Avatar placeholder */}
      <View style={styles.avatarWrap}>
        <Text style={styles.avatarInitials}>{initials}</Text>

        {/* Distance badge — only shown when the backend provides a label */}
        {!!profile.distance_label && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distancePin}>📍</Text>
            <Text style={styles.distanceText}>{profile.distance_label}</Text>
          </View>
        )}
      </View>

      {/* Info row */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {profile.display_name}
        </Text>

        <View style={styles.metaRow}>
          {!!profile.zodiac_label && (
            <Text style={styles.metaChip}>{profile.zodiac_label}</Text>
          )}

          {profile.compatibility_score != null && (
            <View style={styles.scoreChip}>
              <Text style={styles.scoreText}>
                {profile.compatibility_score}% match
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
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
      ios: {
        shadowColor: '#6A3FE0',
        shadowOpacity: 0.22,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
      web: { boxShadow: '0 6px 18px rgba(106,63,224,0.22)' } as any,
    }),
  },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },

  // ── Avatar ──
  avatarWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    backgroundColor: 'rgba(30, 15, 60, 0.70)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarInitials: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: 2,
  },

  // ── Distance badge ──
  distanceBadge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(9, 3, 28, 0.75)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    ...Platform.select({
      ios: {
        shadowColor: '#A855F7',
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 4 },
      web: { backdropFilter: 'blur(8px)' } as any,
    }),
  },
  distancePin: { fontSize: 11 },
  distanceText: {
    color: '#D4B8FF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // ── Info section ──
  info: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    color: '#B57BFF',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
  },
  scoreChip: {
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.30)',
  },
  scoreText: {
    color: '#D4B8FF',
    fontSize: 12,
    fontWeight: '600',
  },
});
