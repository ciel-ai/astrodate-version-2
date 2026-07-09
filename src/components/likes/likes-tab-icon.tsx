import type { ColorValue } from 'react-native';
import { StyleSheet, View } from 'react-native';

import { TabBarIcon } from '@/components/tab-bar-icon';
import { useLikes } from '@/context/likes';

/** Wraps the shared TabBarIcon with an unread-count dot for the Likes tab,
 *  driven by user_likes.seen (see get_who_liked_me().unseen_count). */
export function LikesTabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { data } = useLikes();
  const hasUnseen = (data?.unseen_count ?? 0) > 0;

  return (
    <View style={styles.wrap}>
      <TabBarIcon name="likes" color={color} focused={focused} />
      {hasUnseen && <View style={styles.dot} />}
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
