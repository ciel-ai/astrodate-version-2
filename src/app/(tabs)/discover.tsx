import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverCard } from '@/components/discover-card';
import { DiscoverActionBar } from '@/components/discover-action-bar';
import { useAuth } from '@/context/auth';
import {
  getDiscoverDeck,
  getRewindsRemaining,
  recordSwipe,
  rewindLastSwipe,
  type DiscoverCardData,
  type DiscoverDeckMeta,
} from '@/lib/discover';

function openPaywall(reason: string) {
  router.push({ pathname: '/paywall', params: { reason } } as any);
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [cards, setCards] = useState<DiscoverCardData[] | null>(null);
  const [meta, setMeta] = useState<DiscoverDeckMeta | null>(null);
  const [tier, setTier] = useState<string>('free');
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [rewindLocked, setRewindLocked] = useState(true);

  const loadDeck = useCallback(async () => {
    setLoadError(false);
    setCards(null);
    setLimitReached(false);
    const deck = await getDiscoverDeck();
    if (!deck) {
      setLoadError(true);
      return;
    }
    setCards(deck.cards);
    setMeta(deck.meta);
    setTier(deck.tier);
    setIndex(0);

    // A tier check alone can't tell "Astro+ who hasn't rewound today" apart
    // from "Astro+ who already spent their 1/day in an earlier session" --
    // ask the server for the real remaining count instead of assuming
    // unlocked-unless-free. Falls back to locked (not optimistically
    // unlocked) if the check itself fails.
    if (user?.id) {
      const remaining = await getRewindsRemaining(user.id);
      setRewindLocked((remaining ?? 0) <= 0);
    } else {
      setRewindLocked(true);
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeck();
  }, [loadDeck]);

  const currentCard = cards?.[index] ?? null;

  const handleSwipe = useCallback(
    async (action: 'like' | 'pass' | 'super_like') => {
      if (!currentCard || swiping) return;
      setSwiping(true);
      const result = await recordSwipe(currentCard.user_id, action);
      setSwiping(false);

      if (!result) {
        // Network/timeout -- leave the card in place so the user can retry
        // the same swipe rather than silently skipping someone.
        return;
      }

      if (!result.success) {
        if (result.reason === 'swipe_limit_reached') {
          setLimitReached(true);
        } else if (result.reason === 'super_like_limit_reached') {
          Alert.alert(
            "You're out of super likes this week",
            'Astro+ gets 3 a week, AstroX gets 5 — yours refresh soon either way.',
            [{ text: 'OK' }, { text: 'See plans', onPress: () => openPaywall('super_like_limit') }]
          );
        } else {
          // invalid_target/invalid_action shouldn't be reachable from this
          // UI (TypeScript's SwipeAction type and currentCard.user_id both
          // rule them out) -- but silently doing nothing on an unrecognized
          // reason leaves the user tapping a dead button with no feedback,
          // so fall back to a generic message rather than assume the list
          // above is exhaustive forever.
          Alert.alert('Something went wrong', 'Please try again.');
        }
        return;
      }

      if (result.matched) {
        Alert.alert("It's a match!", `You and ${currentCard.full_name ?? 'this person'} liked each other.`);
      }

      setIndex((i) => i + 1);
    },
    [currentCard, swiping]
  );

  const handleRewind = useCallback(async () => {
    if (swiping) return;
    if (rewindLocked) {
      openPaywall('rewind_not_available');
      return;
    }
    // No index===0 short-circuit here: index only counts swipes made in the
    // current in-memory session and resets to 0 on every loadDeck() call
    // (app reopen, "Try again"). It says nothing about whether a real last
    // swipe exists server-side -- only rewind_last_swipe() knows that, so
    // the request always goes through and lets the server decide.

    setSwiping(true);
    const result = await rewindLastSwipe();
    setSwiping(false);

    if (!result) return; // network/timeout -- stay put, let them retry

    if (!result.success) {
      if (result.reason === 'rewind_limit_reached') {
        setRewindLocked(true);
        Alert.alert("You're out of rewinds for today", 'Come back tomorrow for another one.');
      } else if (result.reason === 'already_matched') {
        Alert.alert("Can't rewind a match", 'That swipe already turned into a mutual match.');
      } else if (result.reason === 'nothing_to_rewind') {
        Alert.alert("Nothing to undo", "You haven't swiped on anyone yet today.");
      } else if (result.reason === 'rewind_not_available') {
        // Reachable despite the rewindLocked pre-check above: a subscription
        // can lapse between this deck's load (when rewindLocked was set) and
        // this tap, so the server's answer can legitimately differ from the
        // client's stale guess.
        setRewindLocked(true);
        openPaywall('rewind_not_available');
      } else {
        Alert.alert('Something went wrong', 'Please try again.');
      }
      return;
    }

    setLimitReached(false);

    if (index > 0) {
      // The RPC undid exactly the swipe that took us from index-1 to index --
      // stepping back one card re-shows that same restored person without an
      // extra round-trip.
      setIndex((i) => i - 1);
    } else {
      // index===0: the restored swipe predates this session's loaded deck
      // (app was just reopened, or this is the first action taken), so
      // there's no "previous card" in the current in-memory array to step
      // back to -- refetch instead of guessing at a position.
      await loadDeck();
    }
  }, [swiping, rewindLocked, index, loadDeck]);

  let body: React.ReactNode;

  if (loadError) {
    body = (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Couldn&apos;t load your deck</Text>
        <Pressable onPress={loadDeck}>
          <Text style={styles.retryLink}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (cards === null) {
    body = (
      <View style={styles.stateBox}>
        <ActivityIndicator color="#B57BFF" />
      </View>
    );
  } else if (limitReached || (!currentCard && meta?.swipes_exhausted)) {
    // Two ways to land here: a swipe attempt got explicitly REJECTED
    // (limitReached), or the deck simply ran out of cards at the exact
    // moment today's swipes ran out (the now-common case, since the deck is
    // capped to remaining swipes -- see meta.swipes_exhausted). Both are the
    // same real situation from the user's perspective, so they share one
    // message instead of the rejected-only path getting the informative
    // copy and the successful-exhaustion path getting a generic fallback.
    // A flat "come back tomorrow" wastes the one thing we actually know: how
    // many genuinely excellent matches were sitting just out of reach when
    // the quota ran out. Use that real, server-computed count (never a
    // fabricated one) instead of a flat dead-end message.
    const lockedCount = meta?.more_high_locked_count ?? 0;
    body = (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>
          {lockedCount > 0
            ? `You're out of swipes — ${lockedCount} more excellent ${lockedCount === 1 ? 'match was' : 'matches were'} waiting today`
            : "You're out of swipes for today"}
        </Text>
        <Text style={styles.stateBody}>
          {lockedCount > 0
            ? 'Upgrade to unlock them right now instead of waiting until tomorrow.'
            : 'Come back tomorrow, or upgrade for more daily swipes.'}
        </Text>
        <Pressable onPress={() => openPaywall(lockedCount > 0 ? 'swipe_limit_with_locked_matches' : 'swipe_limit')}>
          <Text style={styles.retryLink}>See plans</Text>
        </Pressable>
      </View>
    );
  } else if (currentCard) {
    body = (
      <>
        <DiscoverCard card={currentCard} tier={tier} />
      </>
    );
  } else if (meta && meta.more_high_locked_count > 0) {
    body = (
      <Pressable
        style={styles.lockedCard}
        onPress={() => openPaywall('more_high_matches')}
      >
        <Text style={styles.lockedIcon}>✦</Text>
        <Text style={styles.stateTitle}>
          {meta.more_high_locked_count} more excellent {meta.more_high_locked_count === 1 ? 'match' : 'matches'} today
        </Text>
        <Text style={styles.stateBody}>Upgrade to see them now.</Text>
      </Pressable>
    );
  } else {
    body = (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>No more profiles right now</Text>
        <Text style={styles.stateBody}>Check back later for new matches.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Discover</Text>
        {body}
      </ScrollView>

      {/* Shown whenever the deck has actually loaded, independent of
          currentCard/limitReached -- rewind_last_swipe() undoes the
          database's last swipe regardless of whether a card is on screen,
          so it must stay reachable even after the deck empties or a swipe
          gets rejected for being over quota. Pass/like/super-like disable
          via swipeDisabled in those same cases since there's nothing to
          act on, but rewind does not. */}
      {!loadError && cards !== null && (
        <View style={[styles.actionBarWrap, { bottom: insets.bottom + 16 }]}>
          <DiscoverActionBar
            disabled={swiping}
            swipeDisabled={!currentCard || limitReached}
            onPass={() => handleSwipe('pass')}
            onLike={() => handleSwipe('like')}
            onSuperLike={() => handleSwipe('super_like')}
            onRewind={handleRewind}
            rewindLocked={rewindLocked}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09031C' },
  scrollContent: { paddingHorizontal: 16 },
  header: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  actionBarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 8 },
  stateTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  stateBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  retryLink: { color: '#B57BFF', fontSize: 15, fontWeight: '700', marginTop: 8 },
  lockedCard: {
    marginTop: 40,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(246, 185, 59, 0.4)',
    backgroundColor: 'rgba(246, 185, 59, 0.08)',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  lockedIcon: { fontSize: 28, marginBottom: 4 },
});
