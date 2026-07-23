import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { getScoreTier } from '@/lib/score-tier';
import type { LikeCardData } from '@/lib/likes';

function LockIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 10V7a5 5 0 0 1 10 0v3M5.5 10h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z"
        stroke="#E8DDFF"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HeartIcon({ filled, isDark }: { filled: boolean; isDark: boolean }) {
  const color = isDark ? '#FFFFFF' : '#1B1528';
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tier = getScoreTier(score);
  return (
    <View style={styles.scoreChip}>
      <View style={[styles.scoreDot, { backgroundColor: tier.color }]} />
      <Text style={styles.scoreText}>{Math.round(score)}% match</Text>
    </View>
  );
}

type LikeCardProps = {
  item: LikeCardData;
  isPaid: boolean;
  /** Account-level: whether the lifetime free reveal is still available at all. */
  freeRevealAvailable: boolean;
  /** Astro+ only: reveal slots left this billing period. null on free/AstroX (nothing to spend). */
  subscriptionRevealsRemaining: number | null;
  onSpendFreeReveal: (userId: string) => void;
  onSpendSubscriptionReveal: (userId: string) => void;
  onLikeBack: (userId: string) => void;
  onOpenPaywall: (reason: string) => void;
  /** Report/block menu -- only offered once the profile is actually visible
   *  (locked cards show neither photo nor name, so there's nothing to
   *  meaningfully report yet). */
  onOpenMenu?: (userId: string, name: string | null) => void;
  isDark?: boolean;
};

export function LikeCard({
  item,
  isPaid,
  freeRevealAvailable,
  subscriptionRevealsRemaining,
  onSpendFreeReveal,
  onSpendSubscriptionReveal,
  onLikeBack,
  onOpenPaywall,
  onOpenMenu,
  isDark = true,
}: LikeCardProps) {
  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.80)' : 'rgba(255,255,255,0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0,0,0,0.08)',
    photoPlaceholder: isDark ? 'rgba(30, 15, 60, 0.70)' : 'rgba(0,0,0,0.05)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? 'rgba(255,255,255,0.55)' : '#6B7280',
    initials: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(27,21,40,0.2)',
    heartBtnBg: isDark ? 'rgba(20, 12, 40, 0.65)' : 'rgba(255,255,255,0.85)',
    heartBtnBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)',
  };
  const [busy, setBusy] = useState(false);
  const locked = !item.is_visible;

  const handleHeartPress = async () => {
    if (busy) return;
    if (locked) {
      onOpenPaywall('instant_match');
      return;
    }
    setBusy(true);
    await onLikeBack(item.user_id);
    setBusy(false);
  };

  const handleFreeRevealPress = async () => {
    if (busy) return;
    setBusy(true);
    await onSpendFreeReveal(item.user_id);
    setBusy(false);
  };

  const handleSubscriptionRevealPress = async () => {
    if (busy) return;
    setBusy(true);
    await onSpendSubscriptionReveal(item.user_id);
    setBusy(false);
  };

  const showFreePeekTag = item.reveal_source === 'free_reveal' && !isPaid;
  const showSubscriptionRevealPill = locked && subscriptionRevealsRemaining != null && subscriptionRevealsRemaining > 0;
  // action_type is sent for locked cards too (not part of what reveal
  // gates), so this shows even before the profile itself unlocks -- a
  // super like is a stronger signal to entice the reveal, same reasoning
  // most dating apps use for "someone super liked you" teasers.
  const isSuperLike = item.action_type === 'super_like';

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={[styles.photoWrap, { backgroundColor: T.photoPlaceholder }]}>
        {locked ? (
          <View style={[styles.lockedPlaceholder, { backgroundColor: T.photoPlaceholder }]}>
            <LockIcon />
          </View>
        ) : item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[styles.lockedPlaceholder, { backgroundColor: T.photoPlaceholder }]}>
            <Text style={[styles.initialsFallback, { color: T.initials }]}>{(item.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        {(item.compatibility_score != null || isSuperLike || showFreePeekTag) && (
          <View style={styles.topBadgeStack}>
            {item.compatibility_score != null && <ScoreBadge score={item.compatibility_score} />}
            {isSuperLike && (
              <View style={styles.superLikeTag}>
                <Text style={styles.superLikeText}>⭐ Super liked</Text>
              </View>
            )}
            {showFreePeekTag && (
              <View style={styles.freePeekTag}>
                <Text style={styles.freePeekText}>✨ Free peek</Text>
              </View>
            )}
          </View>
        )}

        {(!locked || (!freeRevealAvailable && !showSubscriptionRevealPill)) && (
          <Pressable
            onPress={handleHeartPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={locked ? 'Unlock to match instantly' : 'Like back'}
            style={({ pressed }) => [
              styles.heartBtn,
              { backgroundColor: T.heartBtnBg, borderColor: T.heartBtnBorder },
              pressed && styles.heartBtnPressed,
              busy && styles.heartBtnBusy,
            ]}
          >
            <HeartIcon filled={!locked} isDark={isDark} />
          </Pressable>
        )}

        {locked && !isPaid && freeRevealAvailable && (
          <Pressable
            onPress={handleFreeRevealPress}
            disabled={busy}
            style={({ pressed }) => [styles.freeRevealPillContainer, pressed && styles.freeRevealPillPressed]}
          >
            <LinearGradient
              colors={['#C026D3', '#7C3AED', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.freeRevealPill}
            >
              <Text style={styles.freeRevealText} numberOfLines={1} ellipsizeMode="tail">Use your free reveal</Text>
            </LinearGradient>
          </Pressable>
        )}

        {showSubscriptionRevealPill && (
          <Pressable
            onPress={handleSubscriptionRevealPress}
            disabled={busy}
            style={({ pressed }) => [styles.freeRevealPillContainer, pressed && styles.freeRevealPillPressed]}
          >
            <LinearGradient
              colors={['#C026D3', '#7C3AED', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.freeRevealPill}
            >
              <Text style={styles.freeRevealText} numberOfLines={1} ellipsizeMode="tail">Reveal ({subscriptionRevealsRemaining} left)</Text>
            </LinearGradient>
          </Pressable>
        )}
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: T.text }]} numberOfLines={1}>
          {locked ? (isSuperLike ? 'Someone super liked you' : 'Someone liked you') : item.full_name}
        </Text>
        {!locked && onOpenMenu && (
          <Pressable
            onPress={() => onOpenMenu(item.user_id, item.full_name)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${item.full_name ?? 'this person'}`}
          >
            <Text style={[styles.menuDots, { color: T.dim }]}>⋯</Text>
          </Pressable>
        )}
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
  lockedPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 15, 60, 0.85)',
  },
  initialsFallback: { color: 'rgba(255,255,255,0.25)', fontSize: 44, fontWeight: '700' },

  // All top badges (score/super-like/free-peek) stack in one top-left column
  // instead of splitting into opposing corners -- this card renders at only
  // 48% width in the Likes grid (see likes.tsx), too narrow for a left-anchored
  // and a right-anchored badge group to coexist without overlapping.
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

  freePeekTag: {
    maxWidth: '100%',
    backgroundColor: 'rgba(246, 185, 59, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(246, 185, 59, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  freePeekText: { color: '#F6B93B', fontSize: 10, fontWeight: '700' },

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

  heartBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(20, 12, 40, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnPressed: { opacity: 0.8, transform: [{ scale: 0.94 }] },
  heartBtnBusy: { opacity: 0.5 },

  freeRevealPillContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    borderRadius: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
      default: { boxShadow: '0 4px 10px rgba(124, 58, 237, 0.3)' } as any,
    }),
  },
  freeRevealPill: {
    width: '100%',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeRevealPillPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  freeRevealText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  info: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  name: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  menuDots: { color: 'rgba(255,255,255,0.55)', fontSize: 18, fontWeight: '800', paddingHorizontal: 4 },
});
