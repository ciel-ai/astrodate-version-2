import type { ColorValue } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { TabBarIcon } from '@/components/tab-bar-icon';
import { useChats } from '@/context/chats';

/** Wraps the shared TabBarIcon with an unread-count dot for the Chats tab,
 *  driven by get_my_conversations()'s per-conversation unread_count sum
 *  (see ChatsProvider.totalUnread). Mirrors LikesTabIcon. */
export function ChatsTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { totalUnread } = useChats();
  const hasUnread = totalUnread > 0;

  return (
    <View style={styles.wrap}>
      <TabBarIcon name="chats" color={color} focused={focused} />
      {hasUnread && <View style={styles.dot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 24, height: 24 },
  dot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF5CA8',
    borderWidth: 1.5,
    borderColor: '#0A051B',
  },
});
