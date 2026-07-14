/**
 * Profile's prompts editor -- pushed from the Profile tab's PromptsCard.
 * Reuses PromptEditorForm, the same component finish-ques.tsx uses during
 * onboarding, rather than a forked copy. Differs from finish-ques.tsx only
 * in what happens after Save: back to Profile instead of continuing the
 * onboarding wizard into Discover.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Glitters from '@/components/glitters';
import { PromptEditorForm } from '@/components/prompts/prompt-editor-form';
import { useAppTheme } from '@/lib/theme-context';
import { EMPTY_PROMPT_SLOTS, getUserPrompts, saveUserPrompts, type PromptSlots } from '@/lib/user-prompts';

export default function EditPromptsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';

  const bgSource = isDark
    ? require('@/assets/images/onboard-bg.png')
    : require('@/assets/images/onboard-light-bg.png');

  const [slots, setSlots] = useState<PromptSlots>(EMPTY_PROMPT_SLOTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const result = await getUserPrompts();
      if (result.success && result.data) {
        setSlots(result.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveUserPrompts(slots);
    setSaving(false);

    if (!result.success) {
      Alert.alert('Save Failed', result.error || 'Could not save prompts.');
      return;
    }
    router.back();
  };

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
  };

  return (
    <ImageBackground
      source={bgSource}
      style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#F5F3FF' }]}
      resizeMode="cover"
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={12} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            id="btn-edit-prompts-back"
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: T.card, borderColor: T.border }]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={[styles.backChevron, { color: T.text }]}>‹</Text>
          </Pressable>
          <Text style={[styles.title, { color: T.text }]}>Edit Prompts</Text>
          <View style={styles.backBtn} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A855F7" />
          </View>
        ) : (
          <PromptEditorForm slots={slots} onChange={setSlots} isDark={isDark} />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          id="btn-edit-prompts-save"
          onPress={handleSave}
          disabled={saving || loading}
          style={({ pressed }) => [styles.saveButton, pressed && styles.savePressed]}
        >
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}
        </Pressable>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, width: '100%', height: '100%' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevron: { fontSize: 22, fontWeight: '700', marginTop: -2 },
  title: { fontSize: 18, fontWeight: '700' },
  loadingContainer: { paddingVertical: 80, alignItems: 'center' },

  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
  },
  saveButton: {
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
  },
  savePressed: { opacity: 0.9 },
  saveText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
