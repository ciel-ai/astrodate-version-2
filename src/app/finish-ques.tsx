import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

import Glitters from '@/components/glitters';
import { PromptEditorForm } from '@/components/prompts/prompt-editor-form';
import { EMPTY_PROMPT_SLOTS, getUserPrompts, saveUserPrompts, type PromptSlots } from '@/lib/user-prompts';

const SERIF = 'Baskerville-Old-Face';

export default function FinishQuesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });

  const [slots, setSlots] = useState<PromptSlots>(EMPTY_PROMPT_SLOTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPrompts() {
      const result = await getUserPrompts();
      if (result.success && result.data) {
        setSlots(result.data);
      }
      setLoading(false);
    }
    loadPrompts();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09031C' : '#F0E6FF' }} />;
  }

  const handleSave = async () => {
    setSaving(true);
    const result = await saveUserPrompts(slots);
    setSaving(false);

    if (!result.success) {
      Alert.alert('Save Failed', result.error || 'Could not save prompts.');
      return;
    }
    router.push('/(tabs)/discover');
  };

  return (
    <ImageBackground source={bgSource} style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#F5F3FF' }]} resizeMode="cover">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={16} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 38, paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.heading, { color: isDark ? '#FFFFFF' : '#1A0A2E' }]}>Edit Prompts</Text>
          <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#4B5563' }]}>
            Select questions that tell your story. Write your answers, or use our secure ✨ AI Optimizer to polish them.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A855F7" />
          </View>
        ) : (
          <PromptEditorForm slots={slots} onChange={setSlots} isDark={isDark} />
        )}
      </ScrollView>

      {/* Continue Button at the bottom */}
      <View style={styles.footerContainer}>
        <Pressable
          id="btn-finish-ques-continue"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [styles.actionButton, pressed && styles.actionPressed]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.actionButtonContent}>
              <Text style={styles.actionText}>Continue</Text>
              <Text style={styles.actionArrow}>→</Text>
            </View>
          )}
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },

  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 20,
  },
  header: { alignItems: 'center', width: '100%', marginBottom: 10 },
  heading: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  footerContainer: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 64,
  },
  actionButton: {
    height: 54,
    width: '100%',
    maxWidth: 320,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    ...Platform.select({
      ios: { shadowColor: '#7C3AED', shadowOpacity: 0.4, shadowRadius: 15, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
      web: { boxShadow: '0 6px 20px rgba(124,58,237,0.4)' } as any,
    }),
  },
  actionPressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  actionArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: -4,
  },
});
