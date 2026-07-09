import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverCard } from '@/components/discover-card';
import { DiscoverActionBar } from '@/components/discover-action-bar';
import {
  getDiscoverDeck,
  recordSwipe,
  type DiscoverCardData,
  type DiscoverDeckMeta,
} from '@/lib/discover';

function openPaywall(reason: string) {
  router.push({ pathname: '/paywall', params: { reason } } as any);
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const [cards, setCards] = useState<DiscoverCardData[] | null>(null);
  const [meta, setMeta] = useState<DiscoverDeckMeta | null>(null);
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

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
    setIndex(0);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDeck();
  }, [loadDeck]);

  const currentCard = cards?.[index] ?? null;

  const handleSwipe = useCallback(
    async (action: 'like' | 'pass') => {
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
  } else if (limitReached) {
    body = (
      <View style={styles.stateBox}>
        <Text style={styles.stateTitle}>You&apos;re out of swipes for today</Text>
        <Text style={styles.stateBody}>Come back tomorrow, or upgrade for more daily swipes.</Text>
        <Pressable onPress={() => openPaywall('swipe_limit')}>
          <Text style={styles.retryLink}>See plans</Text>
        </Pressable>
      </View>
    );
  } else if (currentCard) {
    body = (
      <>
        <DiscoverCard card={currentCard} />
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

      {currentCard && !loadError && !limitReached && (
        <View style={[styles.actionBarWrap, { bottom: insets.bottom + 16 }]}>
          <DiscoverActionBar
            disabled={swiping}
            onPass={() => handleSwipe('pass')}
            onLike={() => handleSwipe('like')}
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
