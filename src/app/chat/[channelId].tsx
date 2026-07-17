import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView, useKeyboardState } from '@/lib/keyboard-controller';
import { BlurView } from 'expo-blur';
import { WebView } from 'react-native-webview';
import { AppState, type AppStateStatus } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Line, Rect, Polyline } from 'react-native-svg';

import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { Asset } from 'expo-asset';

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
  sendMediaMessage,
  type Message,
} from '@/lib/chats';
import { base64ToArrayBuffer } from '@/lib/user-photos';
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
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inputText, setInputText] = useState('');
  const [showEmojiTray, setShowEmojiTray] = useState(false);
  const [showStickerTray, setShowStickerTray] = useState(false);

  // Call State
  const [activeCall, setActiveCall] = useState<{
    kind: 'audio' | 'video';
    status: 'ringing' | 'incoming' | 'connected';
    duration: number;
    callerId: string;
    isMuted: boolean;
    isSpeaker: boolean;
    isCameraOff: boolean;
  } | null>(null);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const webViewRef = useRef<WebView | null>(null);

  // Call ringtone player using a stable mixkit ringing sound
  const ringtonePlayer = useAudioPlayer({
    uri: 'https://assets.mixkit.co/active_storage/sfx/1359/1359-84.wav',
  });

  // Animation values for calling
  const [ringingAnim] = useState(() => new Animated.Value(1));
  const [waveAnim1] = useState(() => new Animated.Value(1));
  const [waveAnim2] = useState(() => new Animated.Value(1));
  const [waveAnim3] = useState(() => new Animated.Value(1));

  // Voice recording. The recorder writes to a temp file; on stop we read its
  // bytes and hand them to sendMediaMessage. recorderState gives a reactive
  // isRecording + durationMillis for the recording UI.
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

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
    }, [debouncedMarkRead, loadInitial])
  );

  const deliverCallLogMessage = useCallback(async (callKind: 'audio' | 'video', durationSec: number) => {
    if (!otherUser || !user) return;
    const id = generateUUID();
    const min = Math.floor(durationSec / 60);
    const sec = durationSec % 60;
    const durationStr = `${min}:${sec.toString().padStart(2, '0')}`;
    const text = callKind === 'audio'
      ? `📞 Call ended (${durationStr})`
      : `📹 Video call ended (${durationStr})`;

    const optimistic: DisplayMessage = {
      id,
      sender_id: user.id,
      receiver_id: otherUser.id,
      message_text: text,
      is_read: false,
      channel_id: channelId,
      moderation_status: 'SAFE',
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);

    await sendMessage(id, channelId, otherUser.id, text);
    void refreshChatsList();
  }, [channelId, otherUser, user, refreshChatsList]);

  const handleIncomingCallSignal = useCallback((signal: any) => {
    if (!user) return;
    switch (signal.type) {
      case 'ringing':
        if (signal.callerId !== user.id) {
          setActiveCall({
            kind: signal.kind,
            status: 'incoming',
            duration: 0,
            callerId: signal.callerId,
            isMuted: false,
            isSpeaker: false,
            isCameraOff: false,
          });
        }
        break;
      case 'accept':
        setActiveCall((prev) => {
          if (prev && prev.callerId === user.id && prev.status === 'ringing') {
            return { ...prev, status: 'connected' };
          }
          return prev;
        });
        break;
      case 'decline':
        setActiveCall(null);
        break;
      case 'hangup':
        setActiveCall((prev) => {
          if (prev) {
            const duration = prev.duration;
            const kind = prev.kind;
            const callerId = prev.callerId;
            if (callerId === user.id && duration > 0 && prev.status === 'connected') {
              void deliverCallLogMessage(kind, duration);
            }
          }
          return null;
        });
        break;
    }
  }, [user, deliverCallLogMessage]);

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
      const existing = supabase.getChannels().find(c => c.topic === channelName);
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
        .on('broadcast', { event: 'call-signal' }, (payload) => {
          handleIncomingCallSignal(payload.payload);
        })
        .subscribe();

      channelRef.current = channel;
    };

    void setup();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, user?.id, debouncedMarkRead, handleIncomingCallSignal]);

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

  // Ringing animation effect
  useEffect(() => {
    let ringLoop: Animated.CompositeAnimation | null = null;
    const callStatus = activeCall?.status;
    if (callStatus === 'ringing') {
      ringLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(ringingAnim, {
            toValue: 1.25,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(ringingAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      ringLoop.start();
    } else {
      ringingAnim.setValue(1);
    }
    return () => ringLoop?.stop();
  }, [activeCall?.status, ringingAnim]);

  // Voice waves animation effect
  useEffect(() => {
    let waveLoops: Animated.CompositeAnimation[] = [];
    const callStatus = activeCall?.status;
    const callKind = activeCall?.kind;
    if (callKind === 'audio' && callStatus === 'connected') {
      const createWaveLoop = (anim: Animated.Value, toVal: number, duration: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: toVal,
              duration: duration,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: duration,
              useNativeDriver: true,
            }),
          ])
        );
      };
      waveLoops = [
        createWaveLoop(waveAnim1, 1.8, 400),
        createWaveLoop(waveAnim2, 2.2, 550),
        createWaveLoop(waveAnim3, 1.6, 480),
      ];
      waveLoops.forEach((l) => l.start());
    } else {
      waveAnim1.setValue(1);
      waveAnim2.setValue(1);
      waveAnim3.setValue(1);
    }
    return () => waveLoops.forEach((l) => l.stop());
  }, [activeCall?.status, activeCall?.kind, waveAnim1, waveAnim2, waveAnim3]);

  // Call simulation timer & ringing transition
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    if (activeCall?.status === 'connected') {
      timer = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null));
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeCall?.status]);

  // Call ringtone player manager
  useEffect(() => {
    const callStatus = activeCall?.status;
    try {
      if (callStatus === 'ringing' || callStatus === 'incoming') {
        // eslint-disable-next-line react-hooks/immutability
        ringtonePlayer.loop = true;
        ringtonePlayer.seekTo(0);
        ringtonePlayer.play();
      } else {
        ringtonePlayer.pause();
      }
    } catch (err) {
      console.warn('[ringtonePlayer] Error playing/pausing ringtone:', err);
    }
    return () => {
      try {
        ringtonePlayer.pause();
      } catch {
        // Ignored: player might have been already released during unmount
      }
    };
  }, [activeCall?.status, ringtonePlayer]);

  const toggleMute = () => {
    if (!activeCall) return;
    const nextMuted = !activeCall.isMuted;
    setActiveCall((prev) => prev ? { ...prev, isMuted: nextMuted } : null);
    if (webViewRef.current) {
      const js = `
        var e = new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', keyCode: 77, bubbles: true });
        document.dispatchEvent(e);
      `;
      webViewRef.current.injectJavaScript(js);
    }
  };

  const toggleCamera = () => {
    if (!activeCall) return;
    const nextCameraOff = !activeCall.isCameraOff;
    setActiveCall((prev) => prev ? { ...prev, isCameraOff: nextCameraOff } : null);
    if (webViewRef.current) {
      const js = `
        var e = new KeyboardEvent('keydown', { key: 'v', code: 'KeyV', keyCode: 86, bubbles: true });
        document.dispatchEvent(e);
      `;
      webViewRef.current.injectJavaScript(js);
    }
  };

  const toggleSpeaker = async () => {
    if (!activeCall) return;
    const nextSpeaker = !activeCall.isSpeaker;
    setActiveCall((prev) => prev ? { ...prev, isSpeaker: nextSpeaker } : null);
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: true,
    }).catch(() => {});
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const startCall = (kind: 'audio' | 'video') => {
    if (!user || !channelRef.current) return;
    setShowEmojiTray(false);
    setShowStickerTray(false);

    const newCall = {
      kind,
      status: 'ringing' as const,
      duration: 0,
      callerId: user.id,
      isMuted: false,
      isSpeaker: false,
      isCameraOff: false,
    };
    setActiveCall(newCall);

    channelRef.current.send({
      type: 'broadcast',
      event: 'call-signal',
      payload: {
        type: 'ringing',
        callerId: user.id,
        kind,
      },
    });
  };

  const acceptCall = () => {
    if (!user || !channelRef.current || !activeCall) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'call-signal',
      payload: {
        type: 'accept',
        receiverId: user.id,
      },
    });

    setActiveCall((prev) => prev ? { ...prev, status: 'connected' } : null);
  };

  const declineCall = () => {
    if (!user || !channelRef.current) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'call-signal',
      payload: {
        type: 'decline',
        receiverId: user.id,
      },
    });

    setActiveCall(null);
  };

  const endCall = async () => {
    if (!user || !channelRef.current || !activeCall) return;

    const duration = activeCall.duration;
    const kind = activeCall.kind;
    const callerId = activeCall.callerId;
    const isConnected = activeCall.status === 'connected';

    channelRef.current.send({
      type: 'broadcast',
      event: 'call-signal',
      payload: {
        type: 'hangup',
      },
    });

    setActiveCall(null);

    if (callerId === user.id && duration > 0 && isConnected) {
      await deliverCallLogMessage(kind, duration);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !otherUser || !user) return;
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

    // Media retry: after a failed send the bubble's media_url is still the
    // local file uri, so we can re-read and re-upload it.
    const kind = msg.message_type;
    if ((kind === 'image' || kind === 'audio') && msg.media_url) {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' } : m)));
      const ext = inferExt(msg.media_url, kind === 'image' ? 'jpg' : 'm4a');
      const contentType = kind === 'image' ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'audio/mp4';
      const uri = msg.media_url;
      // On retry the original base64 is gone; re-read bytes from the local file.
      await deliverMedia(msg.id, kind, () => new File(uri).arrayBuffer(), ext, contentType, msg.media_duration_ms ?? undefined);
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: 'sending' } : m)));
    const result = await sendMessage(msg.id, channelId, otherUser.id, msg.message_text ?? '');
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
    if (!otherUser) return;
    try {
      const bytes = await getBytes();
      const result = await sendMediaMessage(id, channelId, otherUser.id, { kind, bytes, ext, contentType, durationMs });
      void refreshChatsList();
      if (!result.success) {
        console.warn('[chat] media send failed:', result.reason);
        Alert.alert("Couldn't send", result.reason);
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'failed' } : m)));
        return;
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: 'sent', media_url: result.mediaUrl } : m))
      );
    } catch (e: any) {
      console.warn('[chat] media read/upload threw:', e?.message ?? e);
      Alert.alert("Couldn't send", e?.message ?? 'Failed to read the file.');
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
    if (!otherUser || !user) return;
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
    setShowEmojiTray(false);
    const ImagePicker = getImagePicker();
    if (!ImagePicker) {
      Alert.alert('Unavailable', 'Please update the app to send photos.');
      return;
    }
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Enable ${source === 'camera' ? 'camera' : 'photo'} access in Settings to continue.`);
      return;
    }
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    if (!asset.base64) {
      Alert.alert("Couldn't send", 'Could not read the selected image.');
      return;
    }
    const ext = inferExt(asset.uri, 'jpg');
    const base64 = asset.base64;
    await startMediaSend('image', asset.uri, ext, `image/${ext === 'jpg' ? 'jpeg' : ext}`, () =>
      Promise.resolve(base64ToArrayBuffer(base64))
    );
  };

  const sendSticker = async (stickerSource: string | number) => {
    setShowEmojiTray(false);
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
      Alert.alert("Couldn't send sticker", e?.message ?? 'Failed to process sticker asset.');
    }
  };

  const startRecording = async () => {
    setShowEmojiTray(false);
    setShowStickerTray(false);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone needed', 'Enable microphone access to record voice messages.');
      return;
    }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
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
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    // Drop cancelled or accidental sub-half-second taps.
    if (cancel || !uri || durationMs < 500) return;
    const ext = inferExt(uri, 'm4a');
    await startMediaSend('audio', uri, ext, 'audio/mp4', () => new File(uri).arrayBuffer(), durationMs);
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
      // react-native-keyboard-controller's KeyboardAvoidingView tracks the
      // real keyboard frame via native insets, so `behavior="padding"` lifts
      // the input bar identically on iOS and on Android edge-to-edge (SDK 56),
      // where the core RN KeyboardAvoidingView has nothing to resize against.
      behavior="padding"
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



        <Pressable onPress={handleOpenMenu} hitSlop={8} style={styles.headerIconBtn}>
          <Svg viewBox="0 0 24 24" width={24} height={24}>
            <Circle cx="12" cy="12" r="10" fill="none" stroke="#FFFFFF" strokeWidth={2} />
            <Line x1="12" y1="16" x2="12" y2="12" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
            <Line x1="12" y1="8" x2="12.01" y2="8" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
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

      {showEmojiTray && !recorderState.isRecording && (
        <EmojiPicker
          mode="emoji"
          onSelectEmoji={(emoji) => setInputText((t) => t + emoji)}
        />
      )}

      {showStickerTray && !recorderState.isRecording && (
        <EmojiPicker
          mode="sticker"
          onSelectSticker={sendSticker}
          onSelectEmoji={() => {}}
        />
      )}

      <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 18 : insets.bottom + 12 }]}>
        {recorderState.isRecording ? (
          <View style={styles.recordingBar}>
            <Pressable onPress={() => stopRecording(true)} hitSlop={10} style={styles.recCancelBtn}>
              <Svg viewBox="0 0 24 24" width={22} height={22}>
                <Polyline points="3 6 5 6 21 6" fill="none" stroke="#FF6B6B" strokeWidth={2} strokeLinecap="round" />
                <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="#FF6B6B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>

            <View style={styles.recDot} />
            <Text style={styles.recTimer}>
              {`${Math.floor(recorderState.durationMillis / 60000)}:${Math.floor((recorderState.durationMillis % 60000) / 1000)
                .toString()
                .padStart(2, '0')}`}
            </Text>
            <Text style={styles.recHint}>Recording…</Text>

            <View style={{ flex: 1 }} />

            <Pressable onPress={() => stopRecording(false)} style={styles.recSendBtn}>
              <Svg viewBox="0 0 24 24" width={20} height={20}>
                <Line x1="12" y1="19" x2="12" y2="5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" />
                <Polyline points="6 11 12 5 18 11" fill="none" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable style={styles.cameraBtn} onPress={() => pickAndSendImage('camera')}>
              <Svg viewBox="0 0 24 24" width={20} height={20}>
                <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="none" stroke="white" strokeWidth={2} />
                <Circle cx="12" cy="13" r="4" fill="none" stroke="white" strokeWidth={2} />
              </Svg>
            </Pressable>

            <View style={styles.inputCapsule}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                onFocus={() => {
                  setShowEmojiTray(false);
                  setShowStickerTray(false);
                }}
                placeholder="Message..."
                placeholderTextColor="#8C8896"
                style={styles.capsuleInput}
                multiline
                maxLength={1000}
              />

              {!inputText.trim() ? (
                <View style={styles.utilityIconsRow}>
                  <Pressable style={styles.iconBtn} onPress={startRecording}>
                    <Svg viewBox="0 0 24 24" width={20} height={20}>
                      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="none" stroke="#A3A0AB" strokeWidth={2} />
                      <Path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="#A3A0AB" strokeWidth={2} />
                      <Line x1="12" y1="19" x2="12" y2="23" stroke="#A3A0AB" strokeWidth={2} />
                      <Line x1="8" y1="23" x2="16" y2="23" stroke="#A3A0AB" strokeWidth={2} />
                    </Svg>
                  </Pressable>

                  <Pressable style={styles.iconBtn} onPress={() => pickAndSendImage('library')}>
                    <Svg viewBox="0 0 24 24" width={20} height={20}>
                      <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="#A3A0AB" strokeWidth={2} />
                      <Circle cx="8.5" cy="8.5" r="1.5" fill="#A3A0AB" />
                      <Polyline points="21 15 16 10 5 21" fill="none" stroke="#A3A0AB" strokeWidth={2} />
                    </Svg>
                  </Pressable>

                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => {
                      if (showEmojiTray) {
                        setShowEmojiTray(false);
                      } else {
                        setShowStickerTray(false);
                        Keyboard.dismiss();
                        setShowEmojiTray(true);
                      }
                    }}
                  >
                    <Svg viewBox="0 0 24 24" width={20} height={20}>
                      <Circle cx="12" cy="12" r="10" fill="none" stroke="#A3A0AB" strokeWidth={2} />
                      <Path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="#A3A0AB" strokeWidth={2} />
                      <Circle cx="9" cy="9" r="1" fill="#A3A0AB" />
                      <Circle cx="15" cy="9" r="1" fill="#A3A0AB" />
                    </Svg>
                  </Pressable>

                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => {
                      if (showStickerTray) {
                        setShowStickerTray(false);
                      } else {
                        setShowEmojiTray(false);
                        Keyboard.dismiss();
                        setShowStickerTray(true);
                      }
                    }}
                  >
                    <Svg viewBox="0 0 24 24" width={20} height={20}>
                      <Path
                        d="M12 3a9 9 0 0 0-9 9 9 9 0 0 0 9 9c1.9 0 3.7-.6 5.2-1.6l2.4-2.4c1-.8 1.4-2 1.4-3a9 9 0 0 0-9-9z"
                        fill="none"
                        stroke="#A3A0AB"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d="M17.2 19.4c.5-.5 1-1.2 1.2-1.9h-2.2v2.2c.7-.2 1-.3 1-.3z"
                        fill="#A3A0AB"
                      />
                      <Circle cx="9.5" cy="10.5" r="1.2" fill="#A3A0AB" />
                      <Circle cx="14.5" cy="10.5" r="1.2" fill="#A3A0AB" />
                      <Path
                        d="M9 14.5c1 1.5 3 1.5 4 0"
                        fill="none"
                        stroke="#A3A0AB"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                      />
                    </Svg>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={handleSend} style={styles.capsuleSendBtn}>
                  <Text style={styles.capsuleSendBtnText}>Send</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>

      {/* Call Overlay */}
      {activeCall && (
        <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill}>
          <View style={styles.callOverlayContainer}>
            {activeCall.status === 'connected' ? (
              // Connected state: Full-screen WebRTC WebView Jitsi Meet room
              <View style={styles.webContainer}>
                <WebView
                  ref={webViewRef}
                  source={{
                    uri: activeCall.kind === 'video'
                      ? `https://meet.jit.si/AstroDateCall_${channelId}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.toolbarButtons=["microphone","camera","hangup"]&userInfo.displayName="${user?.email?.split('@')[0] || 'User'}"`
                      : `https://meet.jit.si/AstroDateCall_${channelId}#config.prejoinPageEnabled=false&config.disableDeepLinking=true&config.toolbarButtons=["microphone","camera","hangup"]&config.startWithVideoMuted=true&userInfo.displayName="${user?.email?.split('@')[0] || 'User'}"`
                  }}
                  style={styles.webView}
                  mediaPlaybackRequiresUserAction={false}
                  allowsInlineMediaPlayback={true}
                  domStorageEnabled={true}
                  javaScriptEnabled={true}
                  onNavigationStateChange={(navState) => {
                    if (!navState.url.includes(`AstroDateCall_${channelId}`)) {
                      endCall();
                    }
                  }}
                />
                
                {/* Overlay control toolbar on top of WebRTC WebView */}
                <View style={styles.floatingControlsOverlay}>
                  {/* Mute Button */}
                  <Pressable
                    style={[styles.floatingControlBtn, activeCall.isMuted && styles.callControlBtnActive]}
                    onPress={toggleMute}
                  >
                    <Svg viewBox="0 0 24 24" width={22} height={22}>
                      <Path
                        d={activeCall.isMuted 
                          ? "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M1 1l22 22" 
                          : "M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8"}
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Pressable>

                  {/* End Call Button */}
                  <Pressable style={styles.floatingEndCallCircleBtn} onPress={endCall}>
                    <Svg viewBox="0 0 24 24" width={24} height={24}>
                      <Path
                        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                        fill="none"
                        stroke="#FFFFFF"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        transform="rotate(135 12 12)"
                      />
                    </Svg>
                  </Pressable>

                  {/* Speaker or Camera Button */}
                  {activeCall.kind === 'video' ? (
                    <Pressable
                      style={[styles.floatingControlBtn, activeCall.isCameraOff && styles.callControlBtnActive]}
                      onPress={toggleCamera}
                    >
                      <Svg viewBox="0 0 24 24" width={22} height={22}>
                        <Polyline points="23 7 16 12 23 17 23 7" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        {activeCall.isCameraOff && <Line x1="1" y1="1" x2="23" y2="23" stroke="#FFFFFF" strokeWidth={2} />}
                      </Svg>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={[styles.floatingControlBtn, activeCall.isSpeaker && styles.callControlBtnActive]}
                      onPress={toggleSpeaker}
                    >
                      <Svg viewBox="0 0 24 24" width={22} height={22}>
                        <Path
                          d="M12 18.27c3.24 0 6.14-1.78 7.68-4.52a10.007 10.007 0 0 0-15.35 0c1.53 2.74 4.43 4.52 7.67 4.52z"
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <Circle cx="12" cy="12" r="10" fill="none" stroke="#FFFFFF" strokeWidth={2} />
                      </Svg>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : (
              // Ringing or Incoming call UI
              <>
                {/* Call Header */}
                <View style={styles.callHeader}>
                  <Text style={styles.callStatus}>
                    {activeCall.status === 'ringing' 
                      ? (activeCall.kind === 'video' ? 'Outgoing Video Call...' : 'Outgoing Call...') 
                      : (activeCall.kind === 'video' ? 'Incoming Video Call...' : 'Incoming Call...')}
                  </Text>
                </View>

                {/* Call Content */}
                <View style={styles.callContent}>
                  <View style={styles.avatarCallCenter}>
                    <Animated.View
                      style={[
                        styles.pulsingRing,
                        {
                          transform: [{ scale: ringingAnim }],
                          opacity: ringingAnim.interpolate({
                            inputRange: [1, 1.25],
                            outputRange: [0.6, 0],
                          }),
                        },
                      ]}
                    />
                    {otherUser?.photo ? (
                      <Image source={{ uri: otherUser.photo }} style={styles.callAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.callAvatar, styles.callAvatarFallback]}>
                        <Text style={styles.callAvatarInitials}>
                          {(otherUser?.name ?? '?').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.callName}>{otherUser?.name ?? 'Someone'}</Text>
                  </View>
                </View>

                {/* Call Controls Footer */}
                <View style={styles.callFooterContainer}>
                  {activeCall.status === 'incoming' ? (
                    // Incoming buttons row: Accept (Green) and Decline (Red)
                    <View style={styles.incomingButtonsRow}>
                      <Pressable style={styles.incomingDeclineBtn} onPress={declineCall}>
                        <Svg viewBox="0 0 24 24" width={26} height={26}>
                          <Path
                            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform="rotate(135 12 12)"
                          />
                        </Svg>
                      </Pressable>

                      <Pressable style={styles.incomingAnswerBtn} onPress={acceptCall}>
                        <Svg viewBox="0 0 24 24" width={26} height={26}>
                          <Path
                            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </Pressable>
                    </View>
                  ) : (
                    // Ringing (Outgoing) buttons row: Decline/Cancel Call
                    <View style={styles.incomingButtonsRow}>
                      <Pressable style={styles.incomingDeclineBtn} onPress={endCall}>
                        <Svg viewBox="0 0 24 24" width={26} height={26}>
                          <Path
                            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                            fill="none"
                            stroke="#FFFFFF"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform="rotate(135 12 12)"
                          />
                        </Svg>
                      </Pressable>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </BlurView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09031C' },

  // Connected WebView Overlay Controls
  floatingControlsOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(9, 3, 28, 0.82)',
    borderRadius: 36,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  floatingControlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  floatingEndCallCircleBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Jitsi WebView Call Styling
  webContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
  },
  floatingEndCallBtn: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    elevation: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingEndCallText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  callFooterContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  incomingButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 30,
  },
  incomingAnswerBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  incomingDeclineBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

  // Call Overlay Styling
  callOverlayContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(9, 3, 28, 0.85)',
  },
  callHeader: {
    alignItems: 'center',
  },
  callStatus: {
    color: '#A855F7',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  callTimer: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  callContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCallCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  callAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#A855F7',
  },
  callAvatarFallback: {
    backgroundColor: '#3b1564',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callAvatarInitials: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '600',
  },
  callName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
  },
  pulsingRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.8)',
  },
  voiceWavesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 60,
    marginTop: 30,
  },
  voiceWaveBar: {
    width: 4,
    height: 25,
    borderRadius: 2,
    backgroundColor: '#A855F7',
  },
  videoStreamContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#0F082A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  constellationBg: {
    width: '100%',
    height: '100%',
  },
  pipWindow: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 90,
    height: 130,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#1E0E3D',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  pipImage: {
    width: '100%',
    height: '100%',
  },
  pipFallback: {
    backgroundColor: '#3b1564',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipFallbackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  callFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  callControlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  callControlBtnActive: {
    backgroundColor: '#A855F7',
    borderColor: '#A855F7',
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },

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

  emptyThreadWrap: { padding: 40, alignItems: 'center', transform: [{ scaleY: -1 }] },
  emptyThreadText: { color: '#8B8D99', fontSize: 14 },

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
