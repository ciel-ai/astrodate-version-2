import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverCard } from '@/components/discover-card';
import { DiscoverActionBar } from '@/components/discover-action-bar';
import { useAuth } from '@/context/auth';
import { useChats } from '@/context/chats';
import {
  getDiscoverDeck,
  getRewindsRemaining,
  recordSwipe,
  rewindLastSwipe,
  type DiscoverCardData,
  type DiscoverDeckMeta,
} from '@/lib/discover';
import { blockAndLeave, getMyBlockedUsers, reportUser } from '@/lib/chats';

function openPaywall(reason: string) {
  router.push({ pathname: '/paywall', params: { reason } } as any);
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { conversations } = useChats();
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

  // Tab screens stay mounted when you switch away (see (tabs)/_layout.tsx),
  // so the plain mount-only effect above never re-runs -- a card already
  // sitting in `cards` from earlier in the session keeps showing even after
  // that person gets blocked (from Chats/Likes/Settings) or matched (a
  // like-back on the Likes tab) somewhere else. Every other data screen
  // (chats, likes, blocked-accounts) already refetches on focus; Discover
  // needs the equivalent, but a full loadDeck() reset would also discard
  // in-session swipe position and reshuffle the remainder (it's randomized
  // per call) for people who are still perfectly valid. Instead, prune only
  // the now-invalid (blocked or matched) entries out of the array already in
  // memory, using the two things that changed underneath it: the blocked
  // list and `useChats()`'s conversation list (already kept fresh by its own
  // realtime/focus/AppState listeners -- reusing it here needs no extra RPC).
  const pruneStaleCards = useCallback(async () => {
    if (cards === null) return; // initial load handles this case
    const blocked = await getMyBlockedUsers();
    const staleIds = new Set<string>(conversations.map((c) => c.other_user_id));
    for (const b of blocked ?? []) staleIds.add(b.user_id);
    if (staleIds.size === 0) return;

    setCards((prev) => {
      if (!prev) return prev;
      const filtered = prev.filter((c) => !staleIds.has(c.user_id));
      if (filtered.length === prev.length) return prev;
      setIndex((i) => Math.max(0, i - prev.slice(0, i).filter((c) => staleIds.has(c.user_id)).length));
      return filtered;
    });
  }, [cards, conversations]);

  useFocusEffect(
    useCallback(() => {
      void pruneStaleCards();
    }, [pruneStaleCards])
  );

  const currentCard = cards?.[index] ?? null;

  // Without this, scrolling down into one candidate's photos/prompts before
  // swiping leaves the next candidate's card rendered already scrolled to
  // that same depth, instead of starting at the top.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

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

  const submitReport = useCallback(async (targetId: string, category: string) => {
    const ok = await reportUser(targetId, null, category);
    Alert.alert(ok ? 'Report submitted' : "Couldn't submit report", ok ? 'Thanks for letting us know.' : 'Please try again.');
  }, []);

  const handleOpenMenu = useCallback(() => {
    if (!currentCard) return;
    const targetId = currentCard.user_id;
    const targetName = currentCard.full_name ?? 'this person';
    Alert.alert(targetName, undefined, [
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Report reason', undefined, [
            { text: 'Inappropriate content', onPress: () => submitReport(targetId, 'inappropriate_content') },
            { text: 'Spam', onPress: () => submitReport(targetId, 'spam') },
            { text: 'Fake profile', onPress: () => submitReport(targetId, 'fake_profile') },
            { text: 'Other', onPress: () => submitReport(targetId, 'other') },
            { text: 'Cancel', style: 'cancel' },
          ]),
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Block this person?', "You won't see each other anymore.", [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                const ok = await blockAndLeave(targetId);
                if (ok) {
                  setIndex((i) => i + 1);
                } else {
                  Alert.alert("Couldn't block", 'Please check your connection and try again.');
                }
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [currentCard, submitReport]);

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
        <DiscoverCard card={currentCard} tier={tier} onOpenMenu={handleOpenMenu} />
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
        ref={scrollRef}
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
