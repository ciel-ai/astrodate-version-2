import { Platform } from 'react-native';
import { Tabs } from 'expo-router';

import { TabBarIcon } from '@/components/tab-bar-icon';
import { LikesTabIcon } from '@/components/likes/likes-tab-icon';
import { ChatsTabIcon } from '@/components/chats/chats-tab-icon';
import { LikesProvider } from '@/context/likes';
import { ChatsProvider } from '@/context/chats';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Every tab screen is mounted once and frozen (not unmounted) when it loses
// focus — switching tabs is instant and background tabs never re-render or
// re-fetch. This is what keeps social-app-style tab bars feeling native.
export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <LikesProvider>
      <ChatsProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
            freezeOnBlur: true,
            lazy: true,
            tabBarActiveTintColor: isDark ? '#C4A0FF' : '#7C3AED',
            tabBarInactiveTintColor: isDark ? '#6B6478' : '#8B8D99',
            tabBarStyle: {
              backgroundColor: isDark ? '#0A051B' : '#F9F9FB',
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              borderTopWidth: 1,
              height: Platform.select({ ios: 88, android: 64, default: 64 }),
              paddingTop: 8,
            },
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: '600',
            },
          }}
        >
          <Tabs.Screen
            name="discover"
            options={{
              title: 'Discover',
              tabBarIcon: ({ color, focused }) => <TabBarIcon name="discover" color={color} focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="insights"
            options={{
              title: 'Daily Insights',
              tabBarIcon: ({ color, focused }) => <TabBarIcon name="insights" color={color} focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="likes"
            options={{
              title: 'Likes',
              tabBarIcon: ({ color, focused }) => <LikesTabIcon color={color} focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="chats"
            options={{
              title: 'Chats',
              tabBarIcon: ({ color, focused }) => <ChatsTabIcon color={color} focused={focused} />,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              tabBarIcon: ({ color, focused }) => <TabBarIcon name="profile" color={color} focused={focused} />,
            }}
          />
        </Tabs>
      </ChatsProvider>
    </LikesProvider>
  );
}
