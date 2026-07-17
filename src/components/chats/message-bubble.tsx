import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Svg, { Path } from 'react-native-svg';

import { formatRelativeTime, type Message } from '@/lib/chats';

/** A message plus optional client-only send-state, used only for the bubble
 *  the local user just sent (see chat/[channelId].tsx's optimistic flow).
 *  Messages that arrived from the server (initial load, realtime, or a
 *  confirmed send) simply have no `status`, which renders identically to
 *  'sent'. */
export type DisplayMessage = Message & { status?: 'sending' | 'sent' | 'failed' | 'blocked' };

interface MessageBubbleProps {
  message: DisplayMessage;
  isMine: boolean;
  /** Whether to render a small timestamp above this bubble -- only shown
   *  when the gap since the previous message is large enough (see the
   *  thread screen's grouping logic), matching every chat app's convention
   *  of not stamping every single bubble. */
  showTimestamp: boolean;
  /** Instagram-style grouping: consecutive same-sender messages hug together.
   *  `isFirstInGroup` is the oldest (top) bubble of a run, `isLastInGroup`
   *  the newest (bottom) one. The corners that face the rest of the group are
   *  squared off; the outer corners stay fully rounded. */
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  /** Avatar of the other participant, rendered only on the last bubble of a
   *  received group (Instagram anchors the avatar to the bottom of the run).
   *  A fixed-width gutter is reserved on every received bubble so grouped
   *  messages stay left-aligned even where no avatar is drawn. */
  otherPhoto?: string | null;
  otherName?: string;
  onRetry?: () => void;
}

// Instagram uses a large radius on bubbles and squares off the corner facing
// the rest of a group to ~6px.
const R_FULL = 20;
const R_GROUPED = 6;

const IMAGE_W = 210;
const IMAGE_H = 260;

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** A voice-note bubble: play/pause toggle, progress bar, elapsed/total time.
 *  Each bubble owns its own player -- fine for the handful of audio messages
 *  in a thread. `uri` may be a local file (optimistic, still sending) or the
 *  public bucket URL; useAudioPlayer accepts both. */
function AudioMessage({ uri, durationMs, mine }: { uri: string; durationMs?: number | null; mine: boolean }) {
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);

  const tint = mine ? '#FFFFFF' : '#D4B8FF';
  const trackBg = mine ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.18)';

  const totalSec = status.duration || (durationMs ? durationMs / 1000 : 0);
  const progress = totalSec > 0 ? Math.min(status.currentTime / totalSec, 1) : 0;
  const remainingMs = (totalSec - status.currentTime) * 1000;

  const onToggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    // Restart from the top if the last playback ran to the end.
    if (status.didJustFinish || (totalSec > 0 && status.currentTime >= totalSec - 0.05)) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <Pressable onPress={onToggle} style={styles.audioRow}>
      <View style={[styles.audioPlayBtn, { borderColor: tint }]}>
        {status.playing ? (
          <View style={styles.audioPauseIcon}>
            <View style={[styles.audioPauseBar, { backgroundColor: tint }]} />
            <View style={[styles.audioPauseBar, { backgroundColor: tint }]} />
          </View>
        ) : (
          <Svg viewBox="0 0 24 24" width={14} height={14}>
            <Path d="M8 5v14l11-7z" fill={tint} />
          </Svg>
        )}
      </View>

      <View style={styles.audioTrackWrap}>
        <View style={[styles.audioTrack, { backgroundColor: trackBg }]}>
          <View style={[styles.audioTrackFill, { backgroundColor: tint, width: `${progress * 100}%` }]} />
        </View>
      </View>

      <Text style={[styles.audioTime, { color: tint }]}>
        {formatDuration(status.playing || status.currentTime > 0 ? remainingMs : totalSec * 1000)}
      </Text>
    </Pressable>
  );
}

function MessageBubbleImpl({
  message,
  isMine,
  showTimestamp,
  isFirstInGroup,
  isLastInGroup,
  otherPhoto,
  otherName,
  onRetry,
}: MessageBubbleProps) {
  const isFailed = message.status === 'failed';
  const isBlocked = message.status === 'blocked';
  const isSending = message.status === 'sending';
  const isFlagged = message.moderation_status === 'SPAM' || message.moderation_status === 'HARASSMENT';
  const type = message.message_type ?? 'text';
  const isImage = type === 'image' && !!message.media_url;
  const isAudio = type === 'audio' && !!message.media_url;

  // Corner radii: the side of the bubble that touches the tail of the app
  // (right for mine, left for theirs) stays fully rounded; the group-facing
  // corners on the top/bottom collapse when this bubble has a same-sender
  // neighbour on that side.
  const cornerStyle = isMine
    ? {
        borderTopLeftRadius: R_FULL,
        borderBottomLeftRadius: R_FULL,
        borderTopRightRadius: isFirstInGroup ? R_FULL : R_GROUPED,
        borderBottomRightRadius: isLastInGroup ? R_FULL : R_GROUPED,
      }
    : {
        borderTopRightRadius: R_FULL,
        borderBottomRightRadius: R_FULL,
        borderTopLeftRadius: isFirstInGroup ? R_FULL : R_GROUPED,
        borderBottomLeftRadius: isLastInGroup ? R_FULL : R_GROUPED,
      };

  return (
    <View style={styles.wrap}>
      {showTimestamp && (
        <Text style={styles.timestamp}>{formatRelativeTime(message.created_at)}</Text>
      )}

      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        {!isMine && (
          <View style={styles.avatarGutter}>
            {isLastInGroup &&
              (otherPhoto ? (
                <Image source={{ uri: otherPhoto }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitials}>{(otherName ?? '?').slice(0, 1).toUpperCase()}</Text>
                </View>
              ))}
          </View>
        )}

        <Pressable
          disabled={!isFailed}
          onPress={onRetry}
          style={[
            isImage ? styles.imageBubble : styles.bubble,
            cornerStyle,
            !isImage && (isMine ? styles.bubbleMine : styles.bubbleTheirs),
            isSending && styles.bubbleSending,
            isFailed && styles.bubbleFailed,
            isBlocked && styles.bubbleBlocked,
          ]}
        >
          {isImage ? (
            <View>
              <Image
                source={{ uri: message.media_url! }}
                style={[styles.image, cornerStyle]}
                contentFit="cover"
              />
              {isSending && (
                <View style={[styles.imageSendingOverlay, cornerStyle]}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </View>
          ) : isAudio ? (
            <AudioMessage uri={message.media_url!} durationMs={message.media_duration_ms} mine={isMine} />
          ) : (
            <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>
              {message.message_text}
            </Text>
          )}
        </Pressable>

        {isSending && !isImage && <ActivityIndicator size="small" color="#8B8D99" style={styles.statusIcon} />}
        {isFailed && <Text style={styles.retryText}>Tap to retry</Text>}
        {isBlocked && <Text style={styles.blockedText}>Blocked</Text>}
      </View>

      {isFlagged && isMine && (
        <Text style={styles.flaggedNote}>This message was flagged during review.</Text>
      )}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

const AVATAR_SIZE = 26;

const styles = StyleSheet.create({
  // Tight vertical rhythm so grouped messages hug; the thread screen adds a
  // larger gap between groups by only stamping timestamps / avatars at the
  // boundaries. Parent FlatList is `inverted`, so items render bottom-up.
  wrap: { marginVertical: 1.5, paddingHorizontal: 10 },
  timestamp: {
    color: '#6B6478',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },

  // Reserved space so every received bubble lines up whether or not the
  // avatar is drawn on it.
  avatarGutter: { width: AVATAR_SIZE, marginRight: 8, alignSelf: 'flex-end' },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: {
    backgroundColor: 'rgba(168, 85, 247, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: { color: '#D4B8FF', fontSize: 11, fontWeight: '700' },

  bubble: {
    maxWidth: '76%',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  bubbleMine: {
    backgroundColor: '#7C3AED',
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  bubbleSending: { opacity: 0.6 },
  bubbleFailed: { borderWidth: 1, borderColor: '#FF5C5C', opacity: 0.75 },
  bubbleBlocked: { borderWidth: 1, borderColor: '#FF5C5C', opacity: 0.5 },

  // Images render edge-to-edge (no bubble padding/background).
  imageBubble: { overflow: 'hidden' },
  image: { width: IMAGE_W, height: IMAGE_H, backgroundColor: 'rgba(255,255,255,0.06)' },
  imageSendingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9,3,28,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  text: { fontSize: 15, lineHeight: 20 },
  textMine: { color: '#FFFFFF' },
  textTheirs: { color: '#EDE9FF' },

  // Voice note
  audioRow: { flexDirection: 'row', alignItems: 'center', minWidth: 180, paddingVertical: 2 },
  audioPlayBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  audioPauseIcon: { flexDirection: 'row', gap: 3 },
  audioPauseBar: { width: 3, height: 12, borderRadius: 1 },
  audioTrackWrap: { flex: 1, justifyContent: 'center' },
  audioTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  audioTrackFill: { height: 4, borderRadius: 2 },
  audioTime: { fontSize: 11, fontWeight: '600', marginLeft: 10, minWidth: 32, textAlign: 'right' },

  statusIcon: { marginLeft: 6, marginBottom: 4 },
  retryText: { color: '#FF5C5C', fontSize: 11, fontWeight: '700', marginLeft: 8, marginBottom: 4 },
  blockedText: { color: '#FF5C5C', fontSize: 11, fontWeight: '700', marginLeft: 8, marginBottom: 4, opacity: 0.8 },
  flaggedNote: {
    color: '#6B6478',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 2,
    marginRight: 4,
  },
});
