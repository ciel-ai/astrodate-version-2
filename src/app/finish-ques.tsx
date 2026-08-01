import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ImageBackground } from 'expo-image';
import { alert } from '@/lib/themed-alert';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

import Glitters from '@/components/glitters';
import { PromptEditorForm } from '@/components/prompts/prompt-editor-form';
import { arePromptSlotsComplete, EMPTY_PROMPT_SLOTS, getUserPrompts, saveUserPrompts, type PromptSlots } from '@/lib/user-prompts';
import { KeyboardAwareScrollView } from '@/lib/keyboard-controller';

const SERIF = 'Baskerville-Old-Face';

export default function FinishQuesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.webp')
    : require('@/assets/images/onboard-light-bg.webp');

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

  const promptsComplete = arePromptSlotsComplete(slots);

  const handleSave = async () => {
    if (!promptsComplete) return;

    setSaving(true);
    const result = await saveUserPrompts(slots);
    setSaving(false);

    if (!result.success) {
      alert('Save Failed', result.error || 'Could not save prompts.');
      return;
    }
    router.push('/(tabs)/discover');
  };

  return (
    <ImageBackground source={bgSource} style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#F5F3FF' }]} resizeMode="cover">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={16} />

      {/* Back button */}
      <Pressable
        onPress={() => {
          // /finish-ques is now also an onboarding resume-route target
          // (getOnboardingResumeRoute in lib/user-profile.ts), reached via
          // router.replace when prompts are the first incomplete step for a
          // returning user -- that leaves no history entry for back() to go
          // to. Fall back to the previous step in the flow instead.
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/upload-photos');
          }
        }}
        style={[
          styles.backBtn,
          {
            top: Math.max(insets.top, 16),
            backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)',
            borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
          },
        ]}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <View style={[styles.backChevron, { borderColor: isDark ? '#FFFFFF' : '#1B1528' }]} />
      </Pressable>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 60, paddingBottom: 40 },
        ]}
        showsVerticalScrollIndicator={false}
        bottomOffset={24}
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
      </KeyboardAwareScrollView>

      {/* Continue Button at the bottom */}
      <View style={styles.footerContainer}>
        <Pressable
          id="btn-finish-ques-continue"
          onPress={handleSave}
          disabled={saving || !promptsComplete}
          style={({ pressed }) => [
            styles.actionButton,
            !promptsComplete && {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#D1D5DB',
              shadowOpacity: 0,
              elevation: 0,
            },
            pressed && styles.actionPressed,
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.actionButtonContent}>
              <Text
                style={[
                  styles.actionText,
                  !promptsComplete && { color: isDark ? '#5A5478' : '#6B7280' },
                ]}
              >
                {promptsComplete ? 'Continue' : 'Complete All 3 Prompts'}
              </Text>
              {promptsComplete && <Text style={styles.actionArrow}>→</Text>}
            </View>
          )}
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%', backgroundColor: '#09031C' },

  backBtn: {
    position: 'absolute',
    left: 18,
    zIndex: 10,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    transform: [{ rotate: '45deg' }],
    marginLeft: 4,
  },

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
