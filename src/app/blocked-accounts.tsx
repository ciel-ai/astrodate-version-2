/**
 * Blocked Accounts screen
 *
 * Reached from Settings > Privacy & Location. Lets a user see who they've
 * blocked and undo it -- get_my_blocked_users()/unblock_user() (see
 * supabase/migrations/20260716140000_blocked_users_management.sql).
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { alert } from '@/lib/themed-alert';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/theme-context';

import { getMyBlockedUsers, unblockUser, type BlockedUser } from '@/lib/chats';

export default function BlockedAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();

  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await getMyBlockedUsers();
    setBlocked(list ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleUnblock = (item: BlockedUser) => {
    alert(
      `Unblock ${item.full_name ?? 'this person'}?`,
      "You'll be able to see each other again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setUnblockingId(item.user_id);
            const ok = await unblockUser(item.user_id);
            setUnblockingId(null);
            if (ok) {
              setBlocked((prev) => prev?.filter((b) => b.user_id !== item.user_id) ?? null);
            } else {
              alert("Couldn't unblock", 'Please check your connection and try again.');
            }
          },
        },
      ]
    );
  };

  const isDark = theme === 'dark';
  const bgSource = isDark
    ? require('@/assets/images/create-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  return (
    <ImageBackground source={bgSource} style={styles.bg} resizeMode="cover">
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <Pressable
        onPress={() => router.back()}
        style={[
          styles.backBtn,
          {
            top: insets.top + 8,
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.1)',
          },
        ]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <View style={[styles.backChevron, { borderColor: isDark ? '#FFFFFF' : '#1B1528' }]} />
      </Pressable>

      <View style={[styles.container, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>Blocked Accounts</Text>

        {blocked === null ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#A855F7" size="large" />
          </View>
        ) : blocked.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={[styles.emptyTitle, { color: isDark ? '#FFFFFF' : '#1B1528' }]}>No blocked accounts</Text>
            <Text style={[styles.emptyBody, { color: isDark ? '#7C7796' : '#6B7280' }]}>
              People you block won&apos;t be able to see you or contact you, and you won&apos;t see them either.
            </Text>
          </View>
        ) : (
          <FlatList
            data={blocked}
            keyExtractor={(item) => item.user_id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.row,
                  {
                    backgroundColor: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                  },
                ]}
              >
                <View style={styles.rowLeft}>
                  {item.photo_url ? (
                    <Image source={{ uri: item.photo_url }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarInitial}>{(item.full_name ?? '?').slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[styles.name, { color: isDark ? '#FFFFFF' : '#1B1528' }]} numberOfLines={1}>
                    {item.full_name ?? 'Unknown'}
                  </Text>
                </View>

                <Pressable
                  onPress={() => handleUnblock(item)}
                  disabled={unblockingId === item.user_id}
                  style={({ pressed }) => [styles.unblockBtn, pressed && styles.unblockBtnPressed]}
                >
                  {unblockingId === item.user_id ? (
                    <ActivityIndicator size="small" color="#A855F7" />
                  ) : (
                    <Text style={styles.unblockText}>Unblock</Text>
                  )}
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },
  container: { flex: 1, paddingHorizontal: 20 },

  backBtn: {
    position: 'absolute',
    left: 18,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },

  title: { fontSize: 22, fontWeight: '800', marginBottom: 20 },

  loadingWrap: { paddingTop: 80, alignItems: 'center' },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 36, marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    gap: 10,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: {
    backgroundColor: 'rgba(30, 15, 60, 0.70)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '700' },
  name: { fontSize: 15, fontWeight: '600', flexShrink: 1 },

  unblockBtn: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.45)',
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
  },
  unblockBtnPressed: { opacity: 0.7 },
  unblockText: { color: '#D4B8FF', fontSize: 13, fontWeight: '700' },
});
