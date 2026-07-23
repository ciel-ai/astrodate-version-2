import { useCallback } from 'react';
import { FlatList, ImageBackground, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { useAppTheme } from '@/lib/theme-context';
import { useChats } from '@/context/chats';
import { formatRelativeTime, type ConversationSummary } from '@/lib/chats';

function ConversationRow({ item, isDark }: { item: ConversationSummary; isDark: boolean }) {
  const hasUnread = item.unread_count > 0;
  const initials = (item.other_user_name ?? '?').slice(0, 2).toUpperCase();
  const T = {
    card: isDark ? 'rgba(20, 12, 40, 0.45)' : 'rgba(255,255,255,0.85)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    name: isDark ? '#C9C3DE' : '#3B3552',
    nameUnread: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#6B6478' : '#6B7280',
    preview: isDark ? '#8B8D99' : '#6B7280',
    previewUnread: isDark ? '#EDE9FF' : '#1B1528',
  };

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/chat/[channelId]',
          params: {
            channelId: item.channel_id,
            otherUserId: item.other_user_id,
            otherUserName: item.other_user_name ?? '',
            otherUserPhoto: item.other_user_photo ?? '',
          },
        } as any)
      }
      style={({ pressed }) => [styles.row, { backgroundColor: T.card, borderColor: T.border }, pressed && styles.rowPressed]}
    >
      <View style={styles.avatarWrap}>
        {item.other_user_photo ? (
          <Image source={{ uri: item.other_user_photo }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        {hasUnread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, { color: T.name }, hasUnread && { color: T.nameUnread, fontWeight: '800' }]} numberOfLines={1}>
            {item.other_user_name ?? 'Someone'}
          </Text>
          {item.last_message_at && (
            <Text style={[styles.time, { color: T.dim }, hasUnread && styles.timeUnread]}>
              {formatRelativeTime(item.last_message_at)}
            </Text>
          )}
        </View>
        <Text style={[styles.preview, { color: T.preview }, hasUnread && { color: T.previewUnread, fontWeight: '600' }]} numberOfLines={1}>
          {item.last_message_text ?? "You matched — say hi!"}
        </Text>
      </View>

      {hasUnread && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
        </View>
      )}
    </Pressable>
  );
}

function EmptyChats({ isDark }: { isDark: boolean }) {
  const T = {
    title: isDark ? '#FFFFFF' : '#1B1528',
    body: isDark ? '#8B8D99' : '#6B7280',
  };
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyEmoji}>✦</Text>
      <Text style={[styles.emptyTitle, { color: T.title }]}>No conversations yet</Text>
      <Text style={[styles.emptyBody, { color: T.body }]}>When you match with someone, you&apos;ll be able to chat with them here.</Text>
      <Pressable
        onPress={() => router.push('/(tabs)/discover' as any)}
        style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
      >
        <Text style={styles.emptyCtaText}>Go to Discover</Text>
      </Pressable>
    </View>
  );
}

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';
  const { conversations, loading, refresh } = useChats();

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const content = (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.channel_id}
        renderItem={({ item }) => <ConversationRow item={item} isDark={isDark} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
          conversations.length === 0 && styles.listContentEmpty,
        ]}
        ListHeaderComponent={<Text style={[styles.header, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Chats</Text>}
        ListEmptyComponent={!loading ? <EmptyChats isDark={isDark} /> : null}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#A855F7" />
        }
        showsVerticalScrollIndicator={false}
        // Chat list rows are small/uniform -- default windowing tuning is
        // sufficient here; the heavier tuning lives on the message thread
        // (chat/[channelId].tsx), which is the screen that actually needs it.
      />
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
  listContent: { paddingHorizontal: 16 },
  listContentEmpty: { flexGrow: 1 },
  header: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 16 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(20, 12, 40, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  rowPressed: { opacity: 0.88 },

  avatarWrap: { position: 'relative' },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#D4B8FF', fontSize: 16, fontWeight: '700' },
  unreadDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF5CA8',
    borderWidth: 2,
    borderColor: '#0F0924',
  },

  rowBody: { flex: 1, marginLeft: 12, marginRight: 8 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: '#C9C3DE', fontSize: 15, fontWeight: '600', flexShrink: 1 },
  nameUnread: { color: '#FFFFFF', fontWeight: '800' },
  time: { color: '#6B6478', fontSize: 12, marginLeft: 8 },
  timeUnread: { color: '#B57BFF', fontWeight: '700' },
  preview: { color: '#8B8D99', fontSize: 13, marginTop: 3 },
  previewUnread: { color: '#EDE9FF', fontWeight: '600' },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#A855F7',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 32, color: '#B57BFF', marginBottom: 12 },
  emptyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  emptyBody: { color: '#8B8D99', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyCta: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(168, 85, 247, 0.85)',
  },
  emptyCtaPressed: { opacity: 0.85 },
  emptyCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
