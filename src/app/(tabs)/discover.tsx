import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

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

// Mock Dinesh profile data — full realistic profile for UI preview & testing
const DINESH_MOCK_CARD: DiscoverCardData = {
  user_id: 'dinesh-mock-id',
  full_name: 'Dinesh',
  gender: 'Male',
  age: 28,
  location: 'Chennai, India',
  score: 81,
  band: 'high',
  is_top_match_of_day: true,
  western_sign: 'Pisces',
  distance_label: 'Less than 1 km away',
  fully_computed: true,
  personality_score: 7.4,
  indian_score: 28,
  western_score: 36,
  manglik_status: true,
  nadi_dosha: false,
  bhakoot_dosha: false,
  why_you_match: 'Exceptional match across Western, Vedic & Personality astrology.',
  vedic_sign: 'Meena (Pisces)',
  nakshatra: 'Revati',
  height_cm: 178,
  looking_for: 'Long-term relationship',
  job_title: 'Software Engineer',
  hometown: 'Chennai',
  photos: [
    {
      // Primary hero — local asset
      url: require('@/assets/images/dinesh.png'),
      is_primary: true,
    },
    {
      url: require('@/assets/images/dinesh_2.png'),
      is_primary: false,
    },
    {
      url: require('@/assets/images/dinesh_3.png'),
      is_primary: false,
    },
    {
      url: require('@/assets/images/dinesh_4.png'),
      is_primary: false,
    },
    {
      url: require('@/assets/images/dinesh_5.png'),
      is_primary: false,
    },
    {
      url: require('@/assets/images/dinesh_6.png'),
      is_primary: false,
    },
  ],
  prompts: [
    {
      question: 'A boundary I have is...',
      answer: 'Communication and honesty. Being upfront about what you want from the start saves everyone time and feelings.',
    },
    {
      question: 'The way to my heart is...',
      answer: 'Late-night conversations about the cosmos, sharing a good meal, and someone who actually remembers the small things I mention in passing.',
    },
    {
      question: 'My love language is...',
      answer: 'Quality time — I believe presence is the rarest and most meaningful gift you can give someone.',
    },
  ],
  about: 'Software engineer by day, stargazer by night 🌌. I grew up in Chennai and I genuinely believe your birth chart says more about you than your Instagram does. I love trying new restaurants, getting lost on long drives, and deep conversations that go way past midnight. Looking for someone who is equally comfortable being spontaneous and staying in on a rainy Sunday. Pisces sun ♓, Scorpio moon 🦂 — make of that what you will.',
  education: 'Post Graduate',
  drinking: 'Socially',
  smoking: 'Non-smoker',
  weed: 'Never',
  religion: 'Hindu',
  sexual_orientation: 'Straight',
  have_children: 'No',
  want_children: 'Someday',
  relationship_style: 'Monogamous',
  workout: 'Daily',
  diet: 'Vegetarian',
  pets: 'Dog lover',
  languages: ['English', 'Tamil'],
  travel: 'Love traveling',
  relationship_status: 'single',
  interest: ['women'],
  hobbies: ['Stargazing', 'Trekking', 'Long Drives', 'Foodie'],
  introvert_extrovert: 'introvert',
  personality_factors: {
    relationship_goals: 100,
    hobbies: 95,
    lifestyle: 90,
    personality_traits: 88,
    communication: 85,
  },
};

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

  const [isCosmicOpen, setIsCosmicOpen] = useState(false);

  // Gated behind __DEV__ build-time flag. In production, this always evaluates to false.
  const [useMockDinesh, setUseMockDinesh] = useState(!!__DEV__);

  // Determine current card: Mock profile if dev toggle is on, otherwise live card
  const currentCard = useMockDinesh ? DINESH_MOCK_CARD : (cards?.[index] ?? null);





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

  // (currentCard is declared above)

  // If in mock dev mode, let the tier default to AstroX so we can preview the full screen
  const currentTier = useMockDinesh ? 'astro_x' : tier;

  // Without this, scrolling down into one candidate's photos/prompts before
  // swiping leaves the next candidate's card rendered already scrolled to
  // that same depth, instead of starting at the top.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);


  const handleSwipe = useCallback(
    async (action: 'like' | 'pass' | 'super_like') => {
      if (useMockDinesh) {
        // Dev mode simulation
        if (action === 'like') {
          Alert.alert("It's a match!", `You and Dinesh liked each other.`);
        }
        Alert.alert('Dev Swipe Action', `Mock action: ${action}`);
        return;
      }

      if (!currentCard || swiping) return;
      setSwiping(true);
      const result = await recordSwipe(currentCard.user_id, action);
      setSwiping(false);

      if (!result) return;

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
          Alert.alert('Something went wrong', 'Please try again.');
        }
        return;
      }

      if (result.matched) {
        Alert.alert("It's a match!", `You and ${currentCard.full_name ?? 'this person'} liked each other.`);
      }

      setIndex((i) => i + 1);
    },
    [currentCard, swiping, useMockDinesh]
  );


  const handleRewind = useCallback(async () => {
    if (useMockDinesh) {
      Alert.alert('Dev Action', 'Rewind triggered in mock mode');
      return;
    }

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
        Alert.alert("You're out of rewinds for today", 'Come back tomorrow for another one.');
      } else if (result.reason === 'already_matched') {
        Alert.alert("Can't rewind a match", 'That swipe already turned into a mutual match.');
      } else if (result.reason === 'nothing_to_rewind') {
        Alert.alert("Nothing to undo", "You haven't swiped on anyone yet today.");
      } else if (result.reason === 'rewind_not_available') {
        setRewindLocked(true);
        openPaywall('rewind_not_available');
      } else {
        Alert.alert('Something went wrong', 'Please try again.');
      }
      return;
    }

    setLimitReached(false);

    if (index > 0) {
      setIndex((i) => i - 1);
    } else {
      await loadDeck();
    }
  }, [swiping, rewindLocked, index, loadDeck, useMockDinesh]);

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

  if (loadError && !useMockDinesh) {
    body = (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>Couldn&apos;t load your deck</Text>
        <Pressable onPress={loadDeck}>
          <Text style={styles.retryLink}>Try again</Text>
        </Pressable>
      </View>
    );
  } else if (cards === null && !useMockDinesh) {
    body = (
      <View style={styles.stateBox}>
        <ActivityIndicator color="#B57BFF" />
      </View>
    );
  } else if ((limitReached || (!currentCard && meta?.swipes_exhausted)) && !useMockDinesh) {
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
      <DiscoverCard
        card={currentCard}
        tier={currentTier}
        isFlipped={isCosmicOpen}
        onFlipChange={setIsCosmicOpen}
        extraDetails={currentCard}
      />
    );
  } else if (meta && meta.more_high_locked_count > 0 && !useMockDinesh) {
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

      {/* Development environment toggle for testing the Dinesh mockup */}
      {!!__DEV__ && (
        <Pressable
          style={styles.devToggle}
          onPress={() => setUseMockDinesh((prev) => !prev)}
        >
          <Text style={styles.devToggleText}>
            {useMockDinesh ? '🔌 Switch to Live Feed' : '🧪 Preview Mock Dinesh'}
          </Text>
        </Pressable>
      )}

      {/* Main header row */}
      <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Discover</Text>
          <Text style={styles.sparkleIcon}>✨</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Settings / Filter Button */}
          <Pressable style={styles.filterButton} onPress={() => Alert.alert('Filters', 'Filter settings coming soon.')}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>

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
          />
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09031C' },
  scrollContent: { paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#09031C',
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
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
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

  devToggle: {
    position: 'absolute',
    top: 110,
    right: 16,
    zIndex: 9999,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    ...Platform.select({
      ios: { shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 4 },
      android: { elevation: 6 },
    }),
  },
  devToggleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
