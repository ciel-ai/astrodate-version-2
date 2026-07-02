import { Platform } from 'react-native';
import { Tabs } from 'expo-router';

import { TabBarIcon } from '@/components/tab-bar-icon';

// Every tab screen is mounted once and frozen (not unmounted) when it loses
// focus — switching tabs is instant and background tabs never re-render or
// re-fetch. This is what keeps social-app-style tab bars feeling native.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        lazy: true,
        tabBarActiveTintColor: '#C4A0FF',
        tabBarInactiveTintColor: '#6B6478',
        tabBarStyle: {
          backgroundColor: '#0A051B',
          borderTopColor: 'rgba(255,255,255,0.08)',
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
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="likes" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="chats" color={color} focused={focused} />,
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
  );
}
