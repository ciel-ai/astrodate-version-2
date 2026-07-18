/**
 * Profile tab — Hero card
 *
 * No card background by design -- photo, name + age, location, then the
 * verified/get-verified pill, stacked directly on the screen background.
 * Read-only (Phase 2) -- tapping the photo/edit affordances is wired up in
 * Phase 3.
 */
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileData } from '@/hooks/use-profile-data';
import type { MembershipSummary } from '@/lib/subscription';

interface HeroCardProps {
  profile: ProfileData;
  membership: MembershipSummary | null;
  isDark: boolean;
  onGetVerified: () => void;
  onEditPhoto?: () => void;
}

export function HeroCard({ profile, isDark, onGetVerified, onEditPhoto }: HeroCardProps) {
  const primaryPhoto = profile.photos.find((p) => p.is_primary) ?? profile.photos[0] ?? null;
  const initials = profile.fullName
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const T = {
    text: isDark ? '#FFFFFF' : '#1B1528',
    avatarBg: isDark ? 'rgba(168, 85, 247, 0.14)' : 'rgba(124, 58, 237, 0.10)',
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatarWrap}>
          {primaryPhoto ? (
            <Image source={{ uri: primaryPhoto.photo_url }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: T.avatarBg }]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>

        <Pressable
          id="btn-edit-avatar-photo"
          style={({ pressed }) => [styles.editPencilBtn, pressed && styles.pressed]}
          onPress={onEditPhoto}
          accessibilityRole="button"
          accessibilityLabel="Edit profile photo"
        >
          <Text style={styles.editPencilIcon}>✏️</Text>
        </Pressable>
      </View>

      <Text style={[styles.name, { color: T.text }]} numberOfLines={1}>
        {profile.fullName || 'Your Profile'}
        {profile.age ? `, ${profile.age}` : ''}
      </Text>

      {profile.location ? (
        <View style={styles.pill}>
          <Text style={styles.pillIcon}>📍</Text>
          <Text style={styles.pillText}>{profile.location}</Text>
        </View>
      ) : null}

      {profile.isVerified ? (
        <View style={[styles.pill, styles.verifiedPill]}>
          <Text style={styles.verifiedPillIcon}>✓</Text>
          <Text style={styles.verifiedPillText}>Verified</Text>
        </View>
      ) : (
        <Pressable
          id="btn-hero-get-verified"
          onPress={onGetVerified}
          style={({ pressed }) => [styles.pill, styles.getVerifiedPill, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Get verified"
        >
          <Text style={styles.getVerifiedText}>Get verified</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#A855F7', shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 6 },
      web: { boxShadow: '0 4px 20px rgba(168,85,247,0.3)' } as any,
    }),
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 30, fontWeight: '700', color: '#A855F7' },

  name: { fontSize: 20, fontWeight: '700', maxWidth: 280, textAlign: 'center' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.22)',
  },
  pillIcon: { fontSize: 12 },
  pillText: { fontSize: 12.5, fontWeight: '600', color: '#B57BFF' },

  verifiedPill: { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.30)' },
  verifiedPillIcon: { fontSize: 11, color: '#34D399', fontWeight: '800' },
  verifiedPillText: { fontSize: 12.5, fontWeight: '700', color: '#34D399' },

  getVerifiedPill: { backgroundColor: 'rgba(96, 165, 250, 0.12)', borderColor: 'rgba(96, 165, 250, 0.30)' },
  getVerifiedText: { fontSize: 12.5, fontWeight: '700', color: '#60A5FA' },
  pressed: { opacity: 0.85 },
  avatarContainer: {
    position: 'relative',
    width: 92,
    height: 92,
    overflow: 'visible',
    zIndex: 10,
  },
  editPencilBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF', // White border to pop out clearly against dark avatar/bg
    zIndex: 99,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 3, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 6 },
    }),
  },
  editPencilIcon: {
    fontSize: 13,
    color: '#FFF',
    lineHeight: Platform.OS === 'ios' ? 16 : 18,
  },
});
