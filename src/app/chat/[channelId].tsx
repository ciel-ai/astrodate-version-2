import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { alert } from '@/lib/themed-alert';
import { KeyboardAvoidingView, useKeyboardState } from '@/lib/keyboard-controller';
import { AppState, type AppStateStatus } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';

import type * as ExpoAudio from 'expo-audio';
import { File } from 'expo-file-system';
import { Asset } from 'expo-asset';

import { useAuth } from '@/context/auth';
import { useChats } from '@/context/chats';
import { useAppTheme } from '@/lib/theme-context';
import { supabase } from '@/lib/supabase';
import {
  blockAndLeave,
  getConversations,
  getMessages,
  markThreadRead,
  reportUser,
  sendMessage,
  sendMediaMessage,
  type Message,
} from '@/lib/chats';
import { base64ToArrayBuffer } from '@/lib/user-photos';
import { getIcebreakerForChannel } from '@/lib/icebreaker';
import { MessageBubble, type DisplayMessage } from '@/components/chats/message-bubble';
import { EmojiPicker } from '@/components/chats/emoji-picker';

// expo-image-picker's native module can be absent from an out-of-date dev
// client; load it lazily so the screen still renders and picking fails with a
// friendly message instead of crashing the bundle (same guard as
// upload-photos.tsx). Permanent fix: rebuild the dev client.
function getImagePicker(): typeof import('expo-image-picker') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

// expo-audio's own module-scope init throws immediately on import when its
// native module is absent (Expo Go, or a dev client built before expo-audio
// was added) -- unlike expo-image-picker above, that means a plain top-level
// `import` from 'expo-audio' takes down this entire file before the default
// export ever runs (Expo Router then reports "missing the required default
// export", which is really this crash one level up). Loading it the same
// lazy, try/catch way fixes the crash, but useAudioRecorder/useAudioPlayer
// are hooks, so the component can't call them conditionally per Rules of
// Hooks -- AUDIO is decided once here, before the component function is even
// defined, and stays constant for the process's lifetime, so branching on it
// inside the wrapper hooks below is safe (the same hooks fire in the same
// order on every render of any given app instance).
let AUDIO: typeof ExpoAudio | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  AUDIO = require('expo-audio');
} catch {
  AUDIO = null;
}

type SafeRecorder = {
  prepareToRecordAsync: () => Promise<void>;
  record: () => void;
  stop: () => Promise<void>;
  uri: string | null;
};
type SafeRecorderState = { isRecording: boolean; durationMillis: number };

const NOOP_RECORDER: SafeRecorder = {
  prepareToRecordAsync: async () => {},
  record: () => {},
  stop: async () => {},
  uri: null,
};
const NOOP_RECORDER_STATE: SafeRecorderState = { isRecording: false, durationMillis: 0 };
const SAFE_RECORDING_PRESETS = AUDIO ? AUDIO.RecordingPresets : ({ HIGH_QUALITY: {} } as any);

function useSafeAudioRecorder(preset: any): SafeRecorder {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- AUDIO is fixed at module load, see comment above
  return AUDIO ? AUDIO.useAudioRecorder(preset) : NOOP_RECORDER;
}
function useSafeAudioRecorderState(recorder: any): SafeRecorderState {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- AUDIO is fixed at module load, see comment above
  return AUDIO ? AUDIO.useAudioRecorderState(recorder) : NOOP_RECORDER_STATE;
}
async function safeRequestRecordingPermissionsAsync(): Promise<{ granted: boolean }> {
  return AUDIO ? AUDIO.requestRecordingPermissionsAsync() : { granted: false };
}
async function safeSetAudioModeAsync(mode: Partial<ExpoAudio.AudioMode>): Promise<void> {
  if (AUDIO) await AUDIO.setAudioModeAsync(mode);
}

// Gap (ms) above which a new timestamp label is shown between two messages,
// same convention as most chat apps ("group by ~15 minutes of silence").
const TIMESTAMP_GROUP_GAP_MS = 15 * 60 * 1000;
// Gap (ms) above which consecutive same-sender messages stop hugging into one
// Instagram-style visual group (a new group starts and, if the sender is the
// receiver, its own avatar is drawn).
const GROUP_GAP_MS = 60 * 1000;
const MARK_READ_DEBOUNCE_MS = 500;

// Pure JS UUID v4 generator to avoid native module dependencies in dev-clients
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';
  const T = {
    bg: isDark ? '#09031C' : '#F9F9FB',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    surfaceBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    surfaceBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    dim: isDark ? '#8B8D99' : '#6B7280',
    dim2: isDark ? '#8C8896' : '#6B7280',
    backBtnBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  };
  const { user } = useAuth();
  const { refresh: refreshChatsList } = useChats();

  // While the keyboard is up, KeyboardAvoidingView already lifts the bar to
  // the keyboard's top edge, so the bottom safe-area inset (nav-bar space) is
  // redundant -- keeping it would leave a visible gap between the bar and the
  // keyboard. Collapse to a small constant when the keyboard is visible.
  const keyboardVisible = useKeyboardState((s) => s.isVisible);

  const [otherUser, setOtherUser] = useState<OtherUser | null>(
    params.otherUserId
      ? { id: params.otherUserId, name: params.otherUserName || 'Someone', photo: params.otherUserPhoto || null }
      : null
  );
  // Set when we arrived without params (e.g. a push-notification tap) and the
  // getConversations() fallback lookup below completes without finding a
  // match -- the other user may have blocked us since the notification fired,
  // or the lookup itself failed. Without this, the header is stuck on
  // "Loading…" forever and Send silently no-ops with zero feedback.
  const [resolveFailed, setResolveFailed] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  // getMessages() returns null (not []) on a network/timeout failure -- without
  // tracking that distinctly, loadInitial collapsed both to an empty array, so
  // opening an existing, populated conversation while offline rendered the
  // "You matched! Say hello" empty-state copy instead of any load-failure hint.
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inputText, setInputText] = useState('');
  const [showStickerTray, setShowStickerTray] = useState(false);
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const [icebreakerDismissed, setIcebreakerDismissed] = useState(false);

  // Voice recording. The recorder writes to a temp file; on stop we read its
  // bytes and hand them to sendMediaMessage. recorderState gives a reactive
  // isRecording + durationMillis for the recording UI.
  const recorder = useSafeAudioRecorder(SAFE_RECORDING_PRESETS.HIGH_QUALITY);
  const recorderState = useSafeAudioRecorderState(recorder);
  const isRecordingRef = useRef(false);
  useEffect(() => {
    isRecordingRef.current = recorderState.isRecording;
  }, [recorderState.isRecording]);

  const isFocusedRef = useRef(false);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // setInputText('') only takes effect on the next render/commit, so two Send
  // taps landing before that commit both read the same inputText and would
  // otherwise fire two separate sendMessage calls with identical text.
  const sendingRef = useRef(false);

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
      } else {
        setResolveFailed(true);
      }
    })();
  }, [channelId, otherUser]);

  // Reads whatever generate-icebreaker already wrote to user_matches (see
  // discover.tsx / likes.tsx match handlers) -- this screen never triggers
  // generation itself, only displays it once it exists. Only worth fetching
  // for a genuinely empty thread, since it's meant as a first-message nudge.
  useEffect(() => {
    if (messages.length > 0 || loadingInitial) return;
    let cancelled = false;
    getIcebreakerForChannel(channelId).then((text) => {
      if (!cancelled && text) setIcebreaker(text);
    });
    return () => {
      cancelled = true;
    };
  }, [channelId, messages.length, loadingInitial]);

  const loadInitial = useCallback(async () => {
    setLoadingInitial(true);
    const page = await getMessages(channelId);
    setMessages(page ?? []);
    setHasMore((page?.length ?? 0) === 30);
    setLoadFailed(page === null);
    setLoadingInitial(false);
  }, [channelId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1];
    const page = await getMessages(channelId, oldest.created_at, oldest.id);
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
    }, [debouncedMarkRead, loadInitial])
  );

  // Realtime: new messages from the other participant. My own sends are
  // handled by the optimistic flow in handleSend, so this ignores anything
  // where sender_id === me -- no dedupe logic needed.
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const channelName = `chat-thread-${channelId}`;
    let active = true;
    let channel: any = null;

    const setup = async () => {
      // supabase.channel() always registers under a "realtime:" prefixed
      // topic (see context/chats.tsx) -- comparing against the bare
      // channelName here always misses, so the stale-channel-removal guard
      // below never ran, and re-entering a thread quickly (removeChannel is
      // async) could hand back the still-joining old channel object, whose
      // .on() throws and silently kills live delivery for that mount.
      const topic = `realtime:${channelName}`;
      const existing = supabase.getChannels().find(c => c.topic === topic);
      if (existing) {
        await supabase.removeChannel(existing);
      }
      if (!active) return;

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
          (payload) => {
            const row = payload.new as Message;
            if (row.sender_id === userId) return;
            setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
            if (isFocusedRef.current) debouncedMarkRead();
          }
        )
        .subscribe();
    };

    void setup();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
    // See context/chats.tsx: keyed on user.id, not the user object, so a token refresh
    // (new session/user reference, same id) doesn't tear down and race-rebuild this channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, user?.id, debouncedMarkRead]);

  // Realtime websockets commonly drop when the app backgrounds -- reload +
  // resubscribe on foreground return (same AppState pattern as ChatsProvider
  // and context/auth.tsx).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && isFocusedRef.current) {
        void loadInitial();
      } else if (state !== 'active' && isRecordingRef.current) {
        // Backgrounded mid-recording -- discard rather than leave the native
        // audio session open (stuck mic indicator, lost/corrupt recording).
        recorder.stop().catch(() => {});
        safeSetAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [loadInitial, recorder]);

  // Same discard-in-progress-recording logic for unmount (user navigates
  // away mid-recording via back gesture/tab switch rather than backgrounding).
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        recorder.stop().catch(() => {});
        safeSetAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !user) return;
    if (!otherUser) {
      alert("Couldn't send", 'This conversation is unavailable right now.');
      return;
    }
    if (sendingRef.current) return;
    sendingRef.current = true;
    setInputText('');

    const id = generateUUID();
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

    try {
      const result = await sendMessage(id, channelId, otherUser.id, text);
      void refreshChatsList();

      if (!result.success) {
        if (result.blocked) {
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'blocked' } : m)));
        } else {
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
        }
        return;
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'sent', moderation_status: result.moderationStatus } : m))
      );
    } finally {
      sendingRef.current = false;
    }
  };

  const handleRetry = async (msg: DisplayMessage) => {
    if (!otherUser) return;

    // Media retry: after a failed send the bubble's media_url is usually the
    // local file uri, so we can re-read and re-upload it -- except stickers,
    // whose media_url can be a remote URL (e.g. dicebear.com) sent straight
    // through as message_type 'image' with no local file backing it at all.
    // File() only reads local filesystem paths, so a remote URL needs fetch()
    // instead (same as sendSticker's own initial-send path).
    const kind = msg.message_type;
    if ((kind === 'image' || kind === 'audio') && msg.media_url) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' } : m)));
      const ext = inferExt(msg.media_url, kind === 'image' ? 'jpg' : 'm4a');
      const contentType = kind === 'image' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'audio/mp4';
      const uri = msg.media_url;
      const isRemoteUrl = /^https?:\/\//i.test(uri);
      // On retry the original base64 is gone; re-read bytes from the local
      // file (or re-fetch, for a remote sticker URL).
      const getBytes = isRemoteUrl
        ? () => fetch(uri).then((res) => res.arrayBuffer())
        : () => new File(uri).arrayBuffer();
      await deliverMedia(msg.id, kind, getBytes, ext, contentType, msg.media_duration_ms ?? undefined);
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' } : m)));
    const result = await sendMessage(msg.id, channelId, otherUser.id, msg.message_text ?? '');
    void refreshChatsList();

    if (!result.success) {
      if (result.blocked) {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'blocked' } : m)));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'failed' } : m)));
      }
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, status: 'sent', moderation_status: result.moderationStatus } : m))
    );
  };

  // ---- Media (photos + voice notes) --------------------------------------

  const inferExt = (uri: string, fallback: string) =>
    uri.split('.').pop()?.split('?')[0]?.toLowerCase() || fallback;

  // Uploads the local file behind an already-rendered optimistic bubble, then
  // swaps its local uri for the public bucket URL (or marks it failed).
  // `getBytes` differs per source: images use the proven base64 path (same as
  // uploadUserPhoto), audio reads the recording file via expo-file-system.
  const deliverMedia = async (
    id: string,
    kind: 'image' | 'audio',
    getBytes: () => Promise<ArrayBuffer>,
    ext: string,
    contentType: string,
    durationMs?: number
  ) => {
    if (!otherUser) {
      alert("Couldn't send", 'This conversation is unavailable right now.');
      return;
    }
    try {
      const bytes = await getBytes();
      const result = await sendMediaMessage(id, channelId, otherUser.id, { kind, bytes, ext, contentType, durationMs });
      void refreshChatsList();
      if (!result.success) {
        console.warn('[chat] media send failed:', result.reason);
        alert("Couldn't send", result.reason);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'sent', media_url: result.mediaUrl } : m))
      );
    } catch (e: any) {
      console.warn('[chat] media read/upload threw:', e?.message ?? e);
      alert("Couldn't send", e?.message ?? 'Failed to read the file.');
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
    }
  };

  // Renders an optimistic media bubble immediately (local uri), then delivers.
  const startMediaSend = async (
    kind: 'image' | 'audio',
    localUri: string,
    ext: string,
    contentType: string,
    getBytes: () => Promise<ArrayBuffer>,
    durationMs?: number
  ) => {
    if (!user) return;
    if (!otherUser) {
      alert("Couldn't send", 'This conversation is unavailable right now.');
      return;
    }
    const id = generateUUID();
    const optimistic: DisplayMessage = {
      id,
      sender_id: user.id,
      receiver_id: otherUser.id,
      message_text: null,
      is_read: false,
      channel_id: channelId,
      moderation_status: 'SAFE',
      created_at: new Date().toISOString(),
      message_type: kind,
      media_url: localUri,
      media_duration_ms: durationMs ?? null,
      status: 'sending',
    };
    setMessages((prev) => [optimistic, ...prev]);
    await deliverMedia(id, kind, getBytes, ext, contentType, durationMs);
  };

  const pickAndSendImage = async (source: 'camera' | 'library') => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      alert('Unavailable', 'Please update the app to send photos.');
      return;
    }
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert('Permission needed', `Enable ${source === 'camera' ? 'camera' : 'photo'} access in Settings to continue.`);
      return;
    }
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (!asset.base64) {
      alert("Couldn't send", 'Could not read the selected image.');
      return;
    }
    const ext = inferExt(asset.uri, 'jpg');
    const base64 = asset.base64;
    await startMediaSend('image', asset.uri, ext, `image/${ext === 'jpg' ? 'jpeg' : ext}`, () =>
      Promise.resolve(base64ToArrayBuffer(base64))
    );
  };

  const sendSticker = async (stickerSource: string | number) => {
    setShowStickerTray(false);
    try {
      let localUri = typeof stickerSource === 'string' ? stickerSource : '';
      if (typeof stickerSource === 'number') {
        const asset = Asset.fromModule(stickerSource);
        await asset.downloadAsync();
        localUri = asset.localUri || asset.uri;
      }
      const ext = 'png';
      const contentType = 'image/png';

      const getBytes = async () => {
        const response = await fetch(localUri);
        return await response.arrayBuffer();
      };

      await startMediaSend('image', localUri, ext, contentType, getBytes);
    } catch (e: any) {
      console.warn('[chat] sendSticker threw:', e?.message ?? e);
      alert("Couldn't send sticker", e?.message ?? 'Failed to process sticker asset.');
    }
  };

  const startRecording = async () => {
    setShowStickerTray(false);
    if (!AUDIO) {
      alert('Unavailable', 'Please update the app to send voice messages.');
      return;
    }
    const perm = await safeRequestRecordingPermissionsAsync();
    if (!perm.granted) {
      alert('Microphone needed', 'Enable microphone access to record voice messages.');
      return;
    }
    await safeSetAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async (cancel: boolean) => {
    const durationMs = recorderState.durationMillis;
    try {
      await recorder.stop();
    } catch {
      // ignore -- recorder may already be stopped
    }
    const uri = recorder.uri;
    await safeSetAudioModeAsync({ allowsRecording: false }).catch(() => {});
    // Drop cancelled or accidental sub-half-second taps.
    if (cancel || !uri || durationMs < 500) return;
    const ext = inferExt(uri, 'm4a');
    await startMediaSend('audio', uri, ext, 'audio/mp4', () => new File(uri).arrayBuffer(), durationMs);
  };


  const handleOpenMenu = () => {
    if (!otherUser) return;
    alert(otherUser.name, undefined, [
      { text: 'Report', style: 'destructive', onPress: handleReport },
      { text: 'Block', style: 'destructive', onPress: handleBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBlock = () => {
    if (!otherUser) return;
    alert('Block this person?', `You won't see each other or be able to message anymore.`, [
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
            alert("Couldn't block", 'Please check your connection and try again.');
          }
        },
      },
    ]);
  };

  const handleReport = () => {
    if (!otherUser) return;
    alert('Report reason', undefined, [
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
    alert(ok ? 'Report submitted' : "Couldn't submit report", ok ? 'Thanks for letting us know.' : 'Please try again.');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: T.bg }]}
      // react-native-keyboard-controller's KeyboardAvoidingView tracks the
      // real keyboard frame via native insets, so `behavior="padding"` lifts
      // the input bar identically on iOS and on Android edge-to-edge (SDK 56),
      // where the core RN KeyboardAvoidingView has nothing to resize against.
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: T.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: T.backBtnBg }]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <View style={[styles.backChevron, { borderColor: T.text }]} />
        </Pressable>

        {otherUser?.photo ? (
          <Image source={{ uri: otherUser.photo }} style={styles.headerAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
            <Text style={styles.headerAvatarInitials}>{(otherUser?.name ?? '?').slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <Text style={[styles.headerName, { color: T.text }]} numberOfLines={1}>
          {otherUser?.name ?? (resolveFailed ? 'Conversation unavailable' : 'Loading…')}
        </Text>

        <View style={{ flex: 1 }} />



        <Pressable
          onPress={handleOpenMenu}
          hitSlop={8}
          style={styles.headerIconBtn}
          accessibilityRole="button"
          accessibilityLabel="Chat options"
        >
          <Svg viewBox="0 0 24 24" width={24} height={24}>
            <Circle cx="12" cy="12" r="10" fill="none" stroke={T.text} strokeWidth={2} />
            <Line x1="12" y1="16" x2="12" y2="12" stroke={T.text} strokeWidth={2} strokeLinecap="round" />
            <Line x1="12" y1="8" x2="12.01" y2="8" stroke={T.text} strokeWidth={2} strokeLinecap="round" />
          </Svg>
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
            // Inverted list: index+1 is the older (visually-above) message,
            // index-1 the newer (visually-below) one.
            const older = messages[index + 1];
            const newer = messages[index - 1];
            const t = new Date(item.created_at).getTime();

            const showTimestamp =
              !older || t - new Date(older.created_at).getTime() > TIMESTAMP_GROUP_GAP_MS;

            // A group breaks on sender change or a >GROUP_GAP silence. A shown
            // timestamp always starts a fresh group (its gap already exceeds
            // GROUP_GAP), so it doubles as a group boundary.
            const isFirstInGroup =
              showTimestamp ||
              !older ||
              older.sender_id !== item.sender_id ||
              t - new Date(older.created_at).getTime() > GROUP_GAP_MS;
            const isLastInGroup =
              !newer ||
              newer.sender_id !== item.sender_id ||
              new Date(newer.created_at).getTime() - t > GROUP_GAP_MS;

            return (
              <MessageBubble
                message={item}
                isMine={item.sender_id === user?.id}
                showTimestamp={showTimestamp}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                otherPhoto={otherUser?.photo}
                otherName={otherUser?.name}
                onRetry={() => handleRetry(item)}
                isDark={isDark}
              />
            );
          }}
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={T.dim} style={{ marginVertical: 12 }} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyThreadWrap}>
              {loadFailed ? (
                <>
                  <Text style={[styles.emptyThreadText, { color: T.dim }]}>Couldn&apos;t load messages</Text>
                  <Pressable onPress={() => void loadInitial()} style={styles.icebreakerDismiss}>
                    <Text style={[styles.icebreakerDismissText, { color: T.dim }]}>Tap to retry</Text>
                  </Pressable>
                </>
              ) : icebreaker && !icebreakerDismissed ? (
                <>
                  <Text style={[styles.icebreakerLabel, { color: T.dim }]}>✦ COSMIC ICEBREAKER ✦</Text>
                  <Pressable
                    onPress={() => setInputText(icebreaker)}
                    style={styles.icebreakerChip}
                  >
                    <Text style={[styles.icebreakerText, { color: isDark ? 'rgba(255,255,255,0.88)' : '#1B1528' }]}>&quot;{icebreaker}&quot;</Text>
                    <View style={styles.icebreakerTapBtn}>
                      <Text style={styles.icebreakerTapBtnText}>Tap to use this opener ✨</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => setIcebreakerDismissed(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}
                    style={styles.icebreakerDismiss}
                  >
                    <Text style={[styles.icebreakerDismissText, { color: T.dim }]}>dismiss</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.emptyThreadText, { color: T.dim }]}>You matched! Say hello 👋</Text>
              )}
            </View>
          }
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          showsVerticalScrollIndicator={false}
        />
      )}

      {showStickerTray && !recorderState.isRecording && (
        <EmojiPicker onSelectSticker={sendSticker} isDark={isDark} />
      )}

      <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 18 : insets.bottom + 12, borderTopColor: T.border, backgroundColor: T.bg }]}>
        {recorderState.isRecording ? (
          <View style={styles.recordingBar}>
            <Pressable
              onPress={() => stopRecording(true)}
              hitSlop={10}
              style={styles.recCancelBtn}
              accessibilityRole="button"
              accessibilityLabel="Cancel recording"
            >
              <Svg viewBox="0 0 24 24" width={22} height={22}>
                <Polyline points="3 6 5 6 21 6" fill="none" stroke="#FF6B6B" strokeWidth={2} strokeLinecap="round" />
                <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="#FF6B6B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>

            <View style={styles.recDot} />
            <Text style={[styles.recTimer, { color: T.text }]}>
              {`${Math.floor(recorderState.durationMillis / 60000)}:${Math.floor((recorderState.durationMillis % 60000) / 1000)
                .toString()
                .padStart(2, '0')}`}
            </Text>
            <Text style={[styles.recHint, { color: T.dim2 }]}>Recording…</Text>

            <View style={{ flex: 1 }} />

            <Pressable
              onPress={() => stopRecording(false)}
              style={styles.recSendBtn}
              accessibilityRole="button"
              accessibilityLabel="Send voice message"
            >
              <Svg viewBox="0 0 24 24" width={20} height={20}>
                <Line x1="12" y1="19" x2="12" y2="5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
                <Polyline points="6 11 12 5 18 11" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={styles.cameraBtn}
              onPress={() => pickAndSendImage('camera')}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
            >
              <Svg viewBox="0 0 24 24" width={20} height={20}>
                <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="none" stroke="white" strokeWidth={2} />
                <Circle cx="12" cy="13" r="4" fill="none" stroke="white" strokeWidth={2} />
              </Svg>
            </Pressable>

            <View style={[styles.inputCapsule, { backgroundColor: T.surfaceBg }]}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => setShowStickerTray(false)}
                placeholder="Message..."
                placeholderTextColor={T.dim2}
                style={[styles.capsuleInput, { color: T.text }]}
                multiline
                maxLength={1000}
              />

              {!inputText.trim() ? (
                <View style={styles.utilityIconsRow}>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={startRecording}
                    accessibilityRole="button"
                    accessibilityLabel="Record voice message"
                  >
                    <Svg viewBox="0 0 24 24" width={20} height={20}>
                      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="none" stroke={T.dim2} strokeWidth={2} />
                      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke={T.dim2} strokeWidth={2} />
                      <Line x1="12" y1="19" x2="12" y2="23" stroke={T.dim2} strokeWidth={2} />
                      <Line x1="8" y1="23" x2="16" y2="23" stroke={T.dim2} strokeWidth={2} />
                    </Svg>
                  </Pressable>

                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => pickAndSendImage('library')}
                    accessibilityRole="button"
                    accessibilityLabel="Choose photo from library"
                  >
                    <Svg viewBox="0 0 24 24" width={20} height={20}>
                      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke={T.dim2} strokeWidth={2} />
                      <Circle cx="8.5" cy="8.5" r="1.5" fill={T.dim2} />
                      <Polyline points="21 15 16 10 5 21" fill="none" stroke={T.dim2} strokeWidth={2} />
                    </Svg>
                  </Pressable>

                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => {
                      if (showStickerTray) {
                        setShowStickerTray(false);
                      } else {
                        Keyboard.dismiss();
                        setShowStickerTray(true);
                      }
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={showStickerTray ? 'Close stickers' : 'Open stickers'}
                  >
                    <Svg viewBox="0 0 24 24" width={20} height={20}>
                      <Path
                        d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9c1.9 0 3.7-.6 5.2-1.6l2.4-2.4c1-.8 1.4-2 1.4-3a9 9 0 0 0-9-9z"
                        fill="none"
                        stroke={T.dim2}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M17.2 19.4c.5-.5 1-1.2 1.2-1.9h-2.2v2.2c.7-.2 1-.3 1-.3z"
                        fill={T.dim2}
                      />
                      <Circle cx="9.5" cy="10.5" r="1.2" fill={T.dim2} />
                      <Circle cx="14.5" cy="10.5" r="1.2" fill={T.dim2} />
                      <Path
                        d="M9 14.5c1 1.5 3 1.5 4 0"
                        fill="none"
                        stroke={T.dim2}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={handleSend}
                  style={styles.capsuleSendBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                >
                  <Text style={styles.capsuleSendBtnText}>Send</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
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
  headerIconBtn: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingVertical: 12 },

  // No counter-flip needed here: unlike renderItem cells, this inverted
  // FlatList's ListEmptyComponent already renders upright on its own -- a
  // manual scaleY: -1 here was flipping it upside down instead of fixing it.
  emptyThreadWrap: { padding: 40, alignItems: 'center' },
  emptyThreadText: { color: '#8B8D99', fontSize: 14 },

  icebreakerLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 1, marginBottom: 10 },
  icebreakerChip: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    borderRadius: 16,
    padding: 14,
    maxWidth: 280,
    alignItems: 'center',
  },
  icebreakerText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  icebreakerTapBtn: {
    marginTop: 10,
    backgroundColor: '#8B5CF6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  icebreakerTapBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  icebreakerDismiss: { marginTop: 8 },
  icebreakerDismissText: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#09031C',
  },
  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inputCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 2,
    minHeight: 44,
  },
  capsuleInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 40,
  },
  utilityIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
  },
  iconBtn: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capsuleSendBtn: {
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  capsuleSendBtnText: {
    color: '#A855F7',
    fontSize: 15,
    fontWeight: '700',
  },



  // Voice recording bar (replaces the input row while recording)
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 10,
  },
  recCancelBtn: { padding: 4 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF5C5C' },
  recTimer: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', minWidth: 44 },
  recHint: { color: '#8C8896', fontSize: 13 },
  recSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
