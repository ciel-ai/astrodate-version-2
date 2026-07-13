import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatRelativeTime, type Message } from '@/lib/chats';

/** A message plus optional client-only send-state, used only for the bubble
 *  the local user just sent (see chat/[channelId].tsx's optimistic flow).
 *  Messages that arrived from the server (initial load, realtime, or a
 *  confirmed send) simply have no `status`, which renders identically to
 *  'sent'. */
export type DisplayMessage = Message & { status?: 'sending' | 'sent' | 'failed' };

interface MessageBubbleProps {
  message: DisplayMessage;
  isMine: boolean;
  /** Whether to render a small timestamp above this bubble -- only shown
   *  when the gap since the previous message is large enough (see the
   *  thread screen's grouping logic), matching every chat app's convention
   *  of not stamping every single bubble. */
  showTimestamp: boolean;
  onRetry?: () => void;
}

function MessageBubbleImpl({ message, isMine, showTimestamp, onRetry }: MessageBubbleProps) {
  const isFailed = message.status === 'failed';
  const isSending = message.status === 'sending';
  const isFlagged = message.moderation_status === 'SPAM' || message.moderation_status === 'HARASSMENT';

  return (
    <View style={styles.wrap}>
      {showTimestamp && (
        <Text style={styles.timestamp}>{formatRelativeTime(message.created_at)}</Text>
      )}

      <View style={[styles.row, isMine ? styles.rowMine : styles.rowTheirs]}>
        <Pressable
          disabled={!isFailed}
          onPress={onRetry}
          style={[
            styles.bubble,
            isMine ? styles.bubbleMine : styles.bubbleTheirs,
            isSending && styles.bubbleSending,
            isFailed && styles.bubbleFailed,
          ]}
        >
          <Text style={[styles.text, isMine ? styles.textMine : styles.textTheirs]}>
            {message.message_text}
          </Text>
        </Pressable>

        {isSending && <ActivityIndicator size="small" color="#8B8D99" style={styles.statusIcon} />}
        {isFailed && <Text style={styles.retryText}>Tap to retry</Text>}
      </View>

      {isFlagged && isMine && (
        <Text style={styles.flaggedNote}>This message was flagged during review.</Text>
      )}
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);

const styles = StyleSheet.create({
  // Counter-transform: the parent FlatList uses `inverted` (scaleY: -1 on
  // the whole list, RN's standard trick for anchoring chat scroll to the
  // bottom) -- without flipping each item back, bubble content would render
  // upside-down.
  wrap: { marginVertical: 3, paddingHorizontal: 12, transform: [{ scaleY: -1 }] },
  timestamp: {
    color: '#6B6478',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 6,
  },
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleMine: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderBottomLeftRadius: 4,
  },
  bubbleSending: { opacity: 0.6 },
  bubbleFailed: { borderWidth: 1, borderColor: '#FF5C5C', opacity: 0.75 },

  text: { fontSize: 15, lineHeight: 20 },
  textMine: { color: '#FFFFFF' },
  textTheirs: { color: '#EDE9FF' },

  statusIcon: { marginLeft: 6, marginBottom: 4 },
  retryText: { color: '#FF5C5C', fontSize: 11, fontWeight: '700', marginLeft: 8, marginBottom: 4 },
  flaggedNote: {
    color: '#6B6478',
    fontSize: 10,
    textAlign: 'right',
    marginTop: 2,
    marginRight: 4,
  },
});
