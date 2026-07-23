import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { alert } from '@/lib/themed-alert';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverCard } from '@/components/discover-card';
import { DiscoverActionBar } from '@/components/discover-action-bar';
import { useAuth } from '@/context/auth';
import { useChats } from '@/context/chats';
import { useAppTheme } from '@/lib/theme-context';
import {
  getDiscoverDeck,
  getRewindsRemaining,
  recordSwipe,
  rewindLastSwipe,
  type DiscoverCardData,
  type DiscoverDeckMeta,
} from '@/lib/discover';
import { blockAndLeave, getMyBlockedUsers, reportUser } from '@/lib/chats';
import { triggerIcebreakerGeneration } from '@/lib/icebreaker';

function openPaywall(reason: string) {
  router.push({ pathname: '/paywall', params: { reason } } as any);
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';
  const T = {
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? 'rgba(255,255,255,0.7)' : '#6B7280',
  };
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

  const [isCosmicOpen, setIsCosmicOpen] = useState(false);

  const currentCard = cards?.[index] ?? null;

  const loadDeck = useCallback(async () => {
    if (!user) return;
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

      if (!result) return;

      if (!result.success) {
        if (result.reason === 'swipe_limit_reached') {
          setLimitReached(true);
        } else if (result.reason === 'super_like_limit_reached') {
          alert(
            "You're out of super likes this week",
            'Astro+ gets 3 a week, AstroX gets 5 — yours refresh soon either way.',
            [{ text: 'OK' }, { text: 'See plans', onPress: () => openPaywall('super_like_limit') }]
          );
        } else {
          alert('Something went wrong', 'Please try again.');
        }
        return;
      }

      if (result.matched) {
        alert("It's a match!", `You and ${currentCard.full_name ?? 'this person'} liked each other.`);
        // Fire-and-forget: the chat screen reads whatever's in
        // user_matches.icebreaker_text whenever it loads, so this never
        // needs to block the swipe flow or be awaited here.
        if (result.match_id) {
          void triggerIcebreakerGeneration(result.match_id);
        }
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

    setSwiping(true);
    const result = await rewindLastSwipe();
    setSwiping(false);

    if (!result) return;

    if (!result.success) {
      if (result.reason === 'rewind_limit_reached') {
        setRewindLocked(true);
        alert("You're out of rewinds for today", 'Come back tomorrow for another one.');
      } else if (result.reason === 'already_matched') {
        alert("Can't rewind a match", 'That swipe already turned into a mutual match.');
      } else if (result.reason === 'nothing_to_rewind') {
        alert("Nothing to undo", "You haven't swiped on anyone yet today.");
      } else if (result.reason === 'rewind_not_available') {
        setRewindLocked(true);
        openPaywall('rewind_not_available');
      } else {
        alert('Something went wrong', 'Please try again.');
      }
      return;
    }

    setLimitReached(false);

    if (index > 0) {
      setIndex((i) => i - 1);
    } else {
      await loadDeck();
    }
  }, [swiping, rewindLocked, index, loadDeck]);

  const submitReport = useCallback(async (targetId: string, category: string) => {
    const ok = await reportUser(targetId, null, category);
    alert(ok ? 'Report submitted' : "Couldn't submit report", ok ? 'Thanks for letting us know.' : 'Please try again.');
  }, []);

  const handleOpenMenu = useCallback(() => {
    if (!currentCard) return;
    const targetId = currentCard.user_id;
    const targetName = currentCard.full_name ?? 'this person';
    alert(targetName, undefined, [
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          alert('Report reason', undefined, [
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
          alert('Block this person?', "You won't see each other anymore.", [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                const ok = await blockAndLeave(targetId);
                if (ok) {
                  setIndex((i) => i + 1);
                } else {
                  alert("Couldn't block", 'Please check your connection and try again.');
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
        <Text style={[styles.stateTitle, { color: T.text }]}>Couldn&apos;t load your deck</Text>
        <Pressable onPress={loadDeck}>
          <Text style={[styles.retryLink, { color: isDark ? '#B57BFF' : '#7C3AED' }]}>Try again</Text>
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
    const lockedCount = meta?.more_high_locked_count ?? 0;
    body = (
      <View style={styles.stateBox}>
        <Text style={[styles.stateTitle, { color: T.text }]}>
          {lockedCount > 0
            ? `You're out of swipes — ${lockedCount} more excellent ${lockedCount === 1 ? 'match was' : 'matches were'} waiting today`
            : "You're out of swipes for today"}
        </Text>
        <Text style={[styles.stateBody, { color: T.dim }]}>
          {lockedCount > 0
            ? 'Upgrade to unlock them right now instead of waiting until tomorrow.'
            : 'Come back tomorrow, or upgrade for more daily swipes.'}
        </Text>
        <Pressable onPress={() => openPaywall(lockedCount > 0 ? 'swipe_limit_with_locked_matches' : 'swipe_limit')}>
          <Text style={[styles.retryLink, { color: isDark ? '#B57BFF' : '#7C3AED' }]}>See plans</Text>
        </Pressable>
      </View>
    );
  } else if (currentCard) {
    body = (
      <DiscoverCard
        card={currentCard}
        tier={tier}
        isDark={isDark}
        isFlipped={isCosmicOpen}
        onFlipChange={setIsCosmicOpen}
        onOpenMenu={handleOpenMenu}
        extraDetails={currentCard}
      />
    );
  } else if (meta && meta.more_high_locked_count > 0) {
    body = (
      <Pressable
        style={styles.lockedCard}
        onPress={() => openPaywall('more_high_matches')}
      >
        <Text style={styles.lockedIcon}>✦</Text>
        <Text style={[styles.stateTitle, { color: T.text }]}>
          {meta.more_high_locked_count} more excellent {meta.more_high_locked_count === 1 ? 'match' : 'matches'} today
        </Text>
        <Text style={[styles.stateBody, { color: T.dim }]}>Upgrade to see them now.</Text>
      </Pressable>
    );
  } else {
    body = (
      <View style={styles.stateBox}>
        <Text style={[styles.stateTitle, { color: T.text }]}>No more profiles right now</Text>
        <Text style={[styles.stateBody, { color: T.dim }]}>Check back later for new matches.</Text>
      </View>
    );
  }

  const content = (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Main header row */}
      <View style={[styles.headerRow, isDark && { backgroundColor: '#09031C' }, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerText, { color: T.text }]}>Discover</Text>
          <Text style={styles.sparkleIcon}>✨</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Filter button removed -- it was a dead placeholder, its only
              action was an Alert saying "coming soon". */}

          {/* AstroX Premium Badge */}
          <Pressable style={styles.astroXBadge} onPress={() => openPaywall('discover_header_astrox')}>
            <Text style={styles.crownEmoji}>👑</Text>
            <Text style={styles.astroXBadgeText}>AstroX</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: 8, paddingBottom: 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>

      {/* Fixed action bar — only shown when a card is visible */}
      {currentCard && (
        <View style={[styles.actionBarWrap, { bottom: 10 }]}>
          <DiscoverActionBar
            onPass={() => handleSwipe('pass')}
            onLike={() => handleSwipe('like')}
            onSuperLike={() => handleSwipe('super_like')}
            onRewind={handleRewind}
            rewindLocked={rewindLocked}
            disabled={swiping}
            swipeDisabled={!currentCard}
            isDark={isDark}
          />
        </View>
      )}
    </>
  );

  return isDark ? (
    <View style={[styles.container, { backgroundColor: '#09031C' }]}>{content}</View>
  ) : (
    <ImageBackground source={require('@/assets/images/tabs-bg-light.jpg')} style={styles.container} resizeMode="cover">
      {content}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
  },
  sparkleIcon: {
    fontSize: 20,
    color: '#B385FF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  astroXBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.2,
    borderColor: '#F59E0B',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  crownEmoji: {
    fontSize: 12,
  },
  astroXBadgeText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },

  actionBarSpacer: { height: 100 },
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
