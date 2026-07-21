import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { alert } from '@/lib/themed-alert';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLikes } from '@/context/likes';
import { getMySentLikes, likeBack, spendFreeReveal, spendSubscriptionReveal, type SentLikeData } from '@/lib/likes';
import { blockAndLeave, reportUser } from '@/lib/chats';
import { triggerIcebreakerGeneration } from '@/lib/icebreaker';
import { LikeCard } from '@/components/likes/like-card';
import { SentLikeCard } from '@/components/likes/sent-like-card';
import { SortControl } from '@/components/likes/sort-control';
import { EmptyState } from '@/components/likes/empty-state';

type SubTab = 'liked-you' | 'your-likes';

function openPaywall(reason: string) {
  router.push({ pathname: '/paywall', params: { reason } } as any);
}

export default function LikesScreen() {
  const insets = useSafeAreaInsets();
  const { data, loading, refresh, markSeen } = useLikes();

  const [subTab, setSubTab] = useState<SubTab>('liked-you');
  const [sortActive, setSortActive] = useState(false);

  const [sentLikes, setSentLikes] = useState<SentLikeData[] | null>(null);
  const [sentLoading, setSentLoading] = useState(false);

  // Tracked via ref (not a useFocusEffect dep) so the focus effect below can
  // read the current tab without re-subscribing on every tab switch.
  const subTabRef = useRef<SubTab>('liked-you');
  useEffect(() => {
    subTabRef.current = subTab;
  }, [subTab]);

  const loadSentLikes = useCallback(async () => {
    setSentLoading(true);
    const result = await getMySentLikes();
    setSentLikes(result ?? []);
    setSentLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh().then(() => markSeen());
      if (subTabRef.current === 'your-likes') {
        loadSentLikes();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const handleSelectSubTab = (tab: SubTab) => {
    setSubTab(tab);
    // Refetch every time, not just the first time -- the previous
    // `sentLikes === null` guard meant a like/super-like sent from Discover
    // never showed up here if the user had already visited this tab once
    // before (sentLikes was `[]`, never null again, so it stayed stale for
    // the rest of the screen's lifetime). 'Liked you' doesn't have this
    // problem since useFocusEffect refreshes it on every focus; this makes
    // 'Your likes' just as fresh whenever it's actually opened.
    if (tab === 'your-likes') {
      loadSentLikes();
    }
  };

  const isAstroX = data?.plan_slug === 'astro_x';

  const sortedLikes = useMemo(() => {
    const likes = data?.likes ?? [];
    if (!sortActive || !isAstroX) return likes;
    return [...likes].sort((a, b) => (b.compatibility_score ?? -1) - (a.compatibility_score ?? -1));
  }, [data?.likes, sortActive, isAstroX]);

  const handleLikeBack = async (userId: string) => {
    const result = await likeBack(userId);
    if (!result) {
      alert("Couldn't do that", 'Please check your connection and try again.');
      return;
    }
    if (!result.success) {
      if (result.reason === 'locked') openPaywall('instant_match');
      return;
    }

    const likerProfile = data?.likes.find((l) => l.user_id === userId);
    const otherName = likerProfile?.full_name ?? 'Someone';
    const otherPhoto = likerProfile?.photo_url ?? '';
    const newChannelId = result.channel_id;

    void triggerIcebreakerGeneration(result.match_id);

    await refresh();
    alert("It's a match! ✨", 'Say hello — your chat is ready.', [
      { text: 'Later', style: 'cancel' },
      {
        text: 'Say hi',
        onPress: () =>
          router.push({
            pathname: '/chat/[channelId]',
            params: {
              channelId: newChannelId,
              otherUserId: userId,
              otherUserName: otherName,
              otherUserPhoto: otherPhoto,
            },
          } as any),
      },
    ]);
  };

  const handleSpendFreeReveal = async (userId: string) => {
    const result = await spendFreeReveal(userId);
    if (result && !result.success) {
      alert("Couldn't reveal", 'That free reveal may already be used, or this profile is no longer available.');
    }
    await refresh();
  };

  const handleSpendSubscriptionReveal = async (userId: string) => {
    const result = await spendSubscriptionReveal(userId);
    if (result && !result.success) {
      alert("Couldn't reveal", "You're out of reveals for this billing period, or this profile is no longer available.");
    }
    await refresh();
  };

  const submitReport = async (userId: string, category: string) => {
    const ok = await reportUser(userId, null, category);
    alert(ok ? 'Report submitted' : "Couldn't submit report", ok ? 'Thanks for letting us know.' : 'Please try again.');
  };

  const handleOpenMenu = (userId: string, name: string | null) => {
    const targetName = name ?? 'this person';
    alert(targetName, undefined, [
      {
        text: 'Report',
        style: 'destructive',
        onPress: () =>
          alert('Report reason', undefined, [
            { text: 'Inappropriate content', onPress: () => submitReport(userId, 'inappropriate_content') },
            { text: 'Spam', onPress: () => submitReport(userId, 'spam') },
            { text: 'Fake profile', onPress: () => submitReport(userId, 'fake_profile') },
            { text: 'Other', onPress: () => submitReport(userId, 'other') },
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
                const ok = await blockAndLeave(userId);
                if (ok) {
                  await refresh();
                } else {
                  alert("Couldn't block", 'Please check your connection and try again.');
                }
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Likes</Text>

        <View style={styles.tabRow}>
          <Pressable
            onPress={() => handleSelectSubTab('liked-you')}
            style={[styles.tabBtn, subTab === 'liked-you' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabLabel, subTab === 'liked-you' && styles.tabLabelActive]}>
              Liked you{data && data.count > 0 ? ` (${data.count})` : ''}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleSelectSubTab('your-likes')}
            style={[styles.tabBtn, subTab === 'your-likes' && styles.tabBtnActive]}
          >
            <Text style={[styles.tabLabel, subTab === 'your-likes' && styles.tabLabelActive]}>Your likes</Text>
          </Pressable>
        </View>

        {subTab === 'liked-you' ? (
          loading && !data ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#A855F7" size="large" />
            </View>
          ) : data && data.likes.length === 0 ? (
            <EmptyState variant="liked-you" />
          ) : (
            <>
              <View style={styles.sortRow}>
                <SortControl
                  unlocked={isAstroX}
                  active={sortActive}
                  onToggle={() => setSortActive((v) => !v)}
                  onLockedPress={() => openPaywall('sort_by_compatibility')}
                />
              </View>
              <View style={styles.grid}>
                {sortedLikes.map((item) => (
                  <View key={item.user_id} style={styles.cell}>
                    <LikeCard
                      item={item}
                      isPaid={data?.is_paid ?? false}
                      freeRevealAvailable={data?.free_reveal_available ?? false}
                      subscriptionRevealsRemaining={data?.subscription_reveals_remaining ?? null}
                      onSpendFreeReveal={handleSpendFreeReveal}
                      onSpendSubscriptionReveal={handleSpendSubscriptionReveal}
                      onLikeBack={handleLikeBack}
                      onOpenPaywall={openPaywall}
                      onOpenMenu={handleOpenMenu}
                    />
                  </View>
                ))}
              </View>
            </>
          )
        ) : sentLoading && sentLikes === null ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#A855F7" size="large" />
          </View>
        ) : sentLikes && sentLikes.length === 0 ? (
          <EmptyState variant="your-likes" />
        ) : (
          <View style={styles.grid}>
            {(sentLikes ?? []).map((item) => (
              <View key={item.user_id} style={styles.cell}>
                <SentLikeCard item={item} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09031C' },
  header: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 16, paddingHorizontal: 16 },
  tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  tabBtnActive: { backgroundColor: 'rgba(168, 85, 247, 0.22)', borderColor: '#A855F7' },
  tabLabel: { color: '#8B8D99', fontSize: 13, fontWeight: '700' },
  tabLabelActive: { color: '#FFFFFF' },
  loadingWrap: { paddingTop: 60, alignItems: 'center' },
  sortRow: { paddingHorizontal: 16, marginBottom: 12 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  cell: { width: '48%' },
});
