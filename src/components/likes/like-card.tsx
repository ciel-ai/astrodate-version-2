import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

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

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
        fill={filled ? '#FFFFFF' : 'none'}
        stroke="#FFFFFF"
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
}: LikeCardProps) {
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

  return (
    <View style={styles.card}>
      <View style={styles.photoWrap}>
        {locked ? (
          <View style={styles.lockedPlaceholder}>
            <LockIcon />
          </View>
        ) : item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={styles.lockedPlaceholder}>
            <Text style={styles.initialsFallback}>{(item.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
          </View>
        )}

        {item.compatibility_score != null && (
          <View style={styles.scoreBadgeWrap}>
            <ScoreBadge score={item.compatibility_score} />
          </View>
        )}

        {showFreePeekTag && (
          <View style={styles.freePeekTag}>
            <Text style={styles.freePeekText}>✨ Free peek</Text>
          </View>
        )}

        <Pressable
          onPress={handleHeartPress}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={locked ? 'Unlock to match instantly' : 'Like back'}
          style={({ pressed }) => [styles.heartBtn, pressed && styles.heartBtnPressed, busy && styles.heartBtnBusy]}
        >
          <HeartIcon filled={!locked} />
        </Pressable>

        {locked && !isPaid && freeRevealAvailable && (
          <Pressable
            onPress={handleFreeRevealPress}
            disabled={busy}
            style={({ pressed }) => [styles.freeRevealPill, pressed && styles.freeRevealPillPressed]}
          >
            <Text style={styles.freeRevealText}>Use your free reveal</Text>
          </Pressable>
        )}

        {showSubscriptionRevealPill && (
          <Pressable
            onPress={handleSubscriptionRevealPress}
            disabled={busy}
            style={({ pressed }) => [styles.freeRevealPill, pressed && styles.freeRevealPillPressed]}
          >
            <Text style={styles.freeRevealText}>Reveal ({subscriptionRevealsRemaining} left)</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {locked ? 'Someone liked you' : item.full_name}
        </Text>
        {!locked && onOpenMenu && (
          <Pressable
            onPress={() => onOpenMenu(item.user_id, item.full_name)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`Report or block ${item.full_name ?? 'this person'}`}
          >
            <Text style={styles.menuDots}>⋯</Text>
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

  scoreBadgeWrap: { position: 'absolute', top: 10, left: 10 },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(246, 185, 59, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(246, 185, 59, 0.45)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  freePeekText: { color: '#F6B93B', fontSize: 10, fontWeight: '700' },

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

  freeRevealPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(168, 85, 247, 0.85)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  freeRevealPillPressed: { opacity: 0.85 },
  freeRevealText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

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
