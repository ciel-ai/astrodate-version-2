import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverCard } from '@/components/discover-card';
import { DiscoverActionBar } from '@/components/discover-action-bar';

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 110 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.header}>Discover</Text>
        <DiscoverCard />
      </ScrollView>

      <View style={[styles.actionBarWrap, { bottom: insets.bottom + 16 }]}>
        <DiscoverActionBar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09031C' },
  scrollContent: { paddingHorizontal: 16 },
  header: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  actionBarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
