import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { useAuth } from '@/context/auth';
import { useChats } from '@/context/chats';
import { supabase } from '@/lib/supabase';
import {
  blockAndLeave,
  getConversations,
  getMessages,
  markThreadRead,
  reportUser,
  sendMessage,
  type Message,
} from '@/lib/chats';
import { MessageBubble, type DisplayMessage } from '@/components/chats/message-bubble';

// Gap (ms) above which a new timestamp label is shown between two messages,
// same convention as most chat apps ("group by ~15 minutes of silence").
const TIMESTAMP_GROUP_GAP_MS = 15 * 60 * 1000;
const MARK_READ_DEBOUNCE_MS = 500;

type OtherUser = { id: string; name: string; photo: string | null };

export default function ChatThreadScreen() {
  const params = useLocalSearchParams<{
    channelId: string;
    otherUserId?: string;
    otherUserName?: string;
    otherUserPhoto?: string;
  }>();
  const channelId = params.channelId;

  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { refresh: refreshChatsList } = useChats();

  const [otherUser, setOtherUser] = useState<OtherUser | null>(
    params.otherUserId
      ? { id: params.otherUserId, name: params.otherUserName || 'Someone', photo: params.otherUserPhoto || null }
      : null
  );
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inputText, setInputText] = useState('');

  const isFocusedRef = useRef(false);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedMarkRead = useCallback(() => {
    if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
    markReadTimerRef.current = setTimeout(() => {
      markReadTimerRef.current = null;
      void markThreadRead(channelId).then(() => refreshChatsList());
    }, MARK_READ_DEBOUNCE_MS);
  }, [channelId, refreshChatsList]);

  // Resolve the other participant if we arrived without params (e.g. a
  // future deep link) -- get_my_conversations is a SECURITY DEFINER RPC and
  // the only way to read a matched user's name/photo (user_profiles/
  // user_photos RLS is owner-only), so it's reused here as a lookup rather
  // than adding a second RPC just for this fallback path.
  useEffect(() => {
    if (otherUser) return;
    (async () => {
      const conversations = await getConversations();
      const match = conversations?.find((c) => c.channel_id === channelId);
      if (match) {
        setOtherUser({ id: match.other_user_id, name: match.other_user_name ?? 'Someone', photo: match.other_user_photo });
      }
    })();
  }, [channelId, otherUser]);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    const page = await getMessages(channelId);
    setMessages(page ?? []);
    setHasMore((page?.length ?? 0) === 30);
    setLoadingInitial(false);
  }, [channelId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1];
    const page = await getMessages(channelId, oldest.created_at);
    if (page && page.length > 0) {
      setMessages((prev) => [...prev, ...page]);
      setHasMore(page.length === 30);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  }, [channelId, hasMore, loadingMore, messages]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      void loadInitial().then(() => debouncedMarkRead());
      return () => {
        isFocusedRef.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId])
  );

  // Realtime: new messages from the other participant. My own sends are
  // handled by the optimistic flow in handleSend, so this ignores anything
  // where sender_id === me -- no dedupe logic needed.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-thread-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const row = payload.new as Message;
          if (row.sender_id === user.id) return;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
          if (isFocusedRef.current) debouncedMarkRead();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, user, debouncedMarkRead]);

  // Realtime websockets commonly drop when the app backgrounds -- reload +
  // resubscribe on foreground return (same AppState pattern as ChatsProvider
  // and context/auth.tsx).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isFocusedRef.current) {
        void loadInitial();
      }
    });
    return () => sub.remove();
  }, [loadInitial]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !otherUser || !user) return;
    setInputText('');

    const id = Crypto.randomUUID();
    const optimistic: DisplayMessage = {
      id,
      sender_id: user.id,
      receiver_id: otherUser.id,
      message_text: text,
      is_read: false,
      channel_id: channelId,
      moderation_status: 'SAFE',
      created_at: new Date().toISOString(),
      status: 'sending',
    };
    setMessages((prev) => [optimistic, ...prev]);

    const result = await sendMessage(id, channelId, otherUser.id, text);
    void refreshChatsList();

    if (!result.success) {
      if (result.blocked) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        Alert.alert('Message blocked', result.reason);
      } else {
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
      }
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'sent', moderation_status: result.moderationStatus } : m))
    );
  };

  const handleRetry = async (msg: DisplayMessage) => {
    if (!otherUser) return;
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' } : m)));
    const result = await sendMessage(msg.id, channelId, otherUser.id, msg.message_text);
    void refreshChatsList();

    if (!result.success) {
      if (result.blocked) {
        setMessages((prev) => prev.filter((m) => m.id !== msg.id));
        Alert.alert('Message blocked', result.reason);
      } else {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' } : m)));
      }
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: 'sent', moderation_status: result.moderationStatus } : m))
    );
  };

  const handleOpenMenu = () => {
    if (!otherUser) return;
    Alert.alert(otherUser.name, undefined, [
      { text: 'Report', style: 'destructive', onPress: handleReport },
      { text: 'Block', style: 'destructive', onPress: handleBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBlock = () => {
    if (!otherUser) return;
    Alert.alert('Block this person?', `You won't see each other or be able to message anymore.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const ok = await blockAndLeave(otherUser.id);
          if (ok) {
            await refreshChatsList();
            router.back();
          } else {
            Alert.alert("Couldn't block", 'Please check your connection and try again.');
          }
        },
      },
    ]);
  };

  const handleReport = () => {
    if (!otherUser) return;
    Alert.alert('Report reason', undefined, [
      { text: 'Inappropriate content', onPress: () => submitReport('inappropriate_content') },
      { text: 'Spam', onPress: () => submitReport('spam') },
      { text: 'Harassment', onPress: () => submitReport('harassment') },
      { text: 'Other', onPress: () => submitReport('other') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitReport = async (category: string) => {
    if (!otherUser) return;
    const ok = await reportUser(otherUser.id, channelId, category);
    Alert.alert(ok ? 'Report submitted' : "Couldn't submit report", ok ? 'Thanks for letting us know.' : 'Please try again.');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <StatusBar style="light" />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <View style={styles.backChevron} />
        </Pressable>

        {otherUser?.photo ? (
          <Image source={{ uri: otherUser.photo }} style={styles.headerAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
            <Text style={styles.headerAvatarInitials}>{(otherUser?.name ?? '?').slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.headerName} numberOfLines={1}>
          {otherUser?.name ?? 'Loading…'}
        </Text>

        <View style={{ flex: 1 }} />

        <Pressable onPress={handleOpenMenu} hitSlop={10} style={styles.menuBtn}>
          <Text style={styles.menuDots}>•••</Text>
        </Pressable>
      </View>

      {loadingInitial ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#A855F7" size="large" />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          renderItem={({ item, index }) => {
            const older = messages[index + 1];
            const showTimestamp =
              !older || new Date(item.created_at).getTime() - new Date(older.created_at).getTime() > TIMESTAMP_GROUP_GAP_MS;
            return (
              <MessageBubble
                message={item}
                isMine={item.sender_id === user?.id}
                showTimestamp={showTimestamp}
                onRetry={() => handleRetry(item)}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#8B8D99" style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyThreadWrap}>
              <Text style={styles.emptyThreadText}>You matched! Say hello 👋</Text>
            </View>
          }
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Message..."
          placeholderTextColor="#6B6478"
          style={styles.input}
          multiline
          maxLength={1000}
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim()}
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
        >
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09031C' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backChevron: {
    width: 8,
    height: 8,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
  },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarFallback: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitials: { color: '#D4B8FF', fontSize: 13, fontWeight: '700' },
  headerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  menuBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  menuDots: { color: '#8B8D99', fontSize: 18, fontWeight: '800' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingVertical: 12 },

  emptyThreadWrap: { padding: 40, alignItems: 'center', transform: [{ scaleY: -1 }] },
  emptyThreadText: { color: '#8B8D99', fontSize: 14 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#09031C',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#FFFFFF',
    fontSize: 15,
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: 'rgba(124, 58, 237, 0.35)' },
  sendBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
