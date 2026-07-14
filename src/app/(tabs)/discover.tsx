import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { DiscoverCard } from '@/components/discover-card';
import { useAuth } from '@/context/auth';
import {
  getDiscoverDeck,
  getRewindsRemaining,
  recordSwipe,
  rewindLastSwipe,
  type DiscoverCardData,
  type DiscoverDeckMeta,
} from '@/lib/discover';

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
  personality_score: 74,
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
};

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

  // Gated behind __DEV__ build-time flag. In production, this always evaluates to false.
  const [useMockDinesh, setUseMockDinesh] = useState(!!__DEV__);

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

  // Determine current card: Mock profile if dev toggle is on, otherwise live card
  const currentCard = useMockDinesh ? DINESH_MOCK_CARD : (cards?.[index] ?? null);

  // If in mock dev mode, let the tier default to AstroX so we can preview the full screen
  const currentTier = useMockDinesh ? 'astro_x' : tier;

  // Without this, scrolling down into one candidate's photos/prompts before
  // swiping leaves the next candidate's card rendered already scrolled to
  // that same depth, instead of starting at the top.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [index]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      <>
        <DiscoverCard card={currentCard} tier={currentTier} />
        <View style={styles.actionBarSpacer} />
      </>
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
          { paddingTop: 8, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {body}
      </ScrollView>

      {/* Fixed action bar — only shown when a card is visible */}
      {currentCard && (
        <View style={[styles.actionBarWrap, { bottom: insets.bottom + 16 }]}>
          <View style={styles.actionBar}>
            {/* Rewind */}
            <View style={styles.btnWrapper}>
              <Pressable
                style={[styles.actionBtn, styles.rewindBtn]}
                onPress={() => handleRewind()}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 5 4 12l5 7M4 12h11a5 5 0 0 1 0 10h-1"
                    stroke="#B385FF"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
              <Text style={[styles.btnLabel, { color: '#B385FF' }]}>Rewind</Text>
            </View>

            {/* Pass */}
            <View style={styles.btnWrapper}>
              <Pressable
                style={[styles.actionBtn, styles.passBtn]}
                onPress={() => handleSwipe('pass')}
                disabled={swiping}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path d="M5 5 19 19M19 5 5 19" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
                </Svg>
              </Pressable>
              <Text style={[styles.btnLabel, { color: '#9CA3AF' }]}>Pass</Text>
            </View>

            {/* Super Like */}
            <View style={styles.btnWrapper}>
              <Pressable
                style={[styles.actionBtn, styles.superLikeBtn]}
                onPress={() => handleSwipe('super_like')}
                disabled={swiping}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 2.5 14.9 9l7.1.6-5.4 4.7 1.6 6.9-6.2-3.7-6.2 3.7 1.6-6.9L2 9.6 9.1 9z"
                    fill="#3FC5F0"
                    stroke="#3FC5F0"
                    strokeWidth={1.2}
                    strokeLinejoin="round"
                  />
                </Svg>
              </Pressable>
              <Text style={[styles.btnLabel, { color: '#3FC5F0' }]}>Super Like</Text>
            </View>

            {/* Like */}
            <View style={styles.btnWrapper}>
              <Pressable
                style={[styles.actionBtn, styles.likeBtn]}
                onPress={() => handleSwipe('like')}
                disabled={swiping}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
                    fill="#E91E63"
                  />
                </Svg>
              </Pressable>
              <Text style={[styles.btnLabel, { color: '#E91E63' }]}>Like</Text>
            </View>
          </View>
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
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(9, 3, 28, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 40,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  btnWrapper: { alignItems: 'center', width: 64 },
  btnLabel: { fontSize: 10, fontWeight: '600', marginTop: 5, textAlign: 'center' },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  rewindBtn: { backgroundColor: 'rgba(179,133,255,0.12)', borderColor: 'rgba(179,133,255,0.35)' },
  passBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' },
  superLikeBtn: { backgroundColor: 'rgba(63,197,240,0.12)', borderColor: 'rgba(63,197,240,0.35)' },
  likeBtn: { backgroundColor: 'rgba(233,30,99,0.15)', borderColor: '#E91E63' },
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
