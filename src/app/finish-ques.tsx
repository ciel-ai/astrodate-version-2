import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useColorScheme } from '@/hooks/use-color-scheme';

import Glitters from '@/components/glitters';
import { supabase } from '@/lib/supabase';

const SERIF = 'Baskerville-Old-Face';

const ChevronDownIcon = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);



const QUESTIONS = [
  "My greatest strength is...",
  "I value honesty, empathy, and...",
  "A perfect Sunday starts with...",
  "I'm looking for someone who...",
  "Believe it or not, I...",
  "My friends tell me I'm...",
  "Most spontaneous thing I've done...",
  "My love language is...",
  "Let's debate: is pineapple on pizza...",
];

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

  const [slot1, setSlot1] = useState({ question: '', answer: '' });
  const [slot2, setSlot2] = useState({ question: '', answer: '' });
  const [slot3, setSlot3] = useState({ question: '', answer: '' });

  const [activeSlot, setActiveSlot] = useState<'slot1' | 'slot2' | 'slot3' | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadPrompts() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('user_prompts')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        if (data) {
          const s1 = data.find(p => p.prompt_id === 'slot1');
          const s2 = data.find(p => p.prompt_id === 'slot2');
          const s3 = data.find(p => p.prompt_id === 'slot3');

          if (s1) setSlot1({ question: s1.question, answer: s1.answer });
          if (s2) setSlot2({ question: s2.question, answer: s2.answer });
          if (s3) setSlot3({ question: s3.question, answer: s3.answer });
        }
      } catch (err) {
        console.warn('Failed to load user prompts:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPrompts();
  }, []);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#09031C' : '#F0E6FF' }} />;
  }

  const openPicker = (slot: 'slot1' | 'slot2' | 'slot3') => {
    setActiveSlot(slot);
    setModalVisible(true);
  };

  const selectQuestion = (q: string) => {
    if (activeSlot === 'slot1') setSlot1({ ...slot1, question: q });
    if (activeSlot === 'slot2') setSlot2({ ...slot2, question: q });
    if (activeSlot === 'slot3') setSlot3({ ...slot3, question: q });
    setModalVisible(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const upsertData = [];
      if (slot1.question) {
        upsertData.push({ user_id: user.id, prompt_id: 'slot1', question: slot1.question, answer: slot1.answer, is_custom: false });
      }
      if (slot2.question) {
        upsertData.push({ user_id: user.id, prompt_id: 'slot2', question: slot2.question, answer: slot2.answer, is_custom: false });
      }
      if (slot3.question) {
        upsertData.push({ user_id: user.id, prompt_id: 'slot3', question: slot3.question, answer: slot3.answer, is_custom: false });
      }

      if (upsertData.length > 0) {
        const { error } = await supabase
          .from('user_prompts')
          .upsert(upsertData, { onConflict: 'user_id,prompt_id' });

        if (error) throw error;
      }

      router.replace('/(tabs)/discover');
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save prompts.');
    } finally {
      setSaving(false);
    }
  };

  const renderSlot = (
    slotKey: 'slot1' | 'slot2' | 'slot3',
    title: string,
    slotData: { question: string; answer: string },
    setSlot: React.Dispatch<React.SetStateAction<{ question: string; answer: string }>>
  ) => {
    return (
      <View style={[styles.slotCard, { backgroundColor: isDark ? 'rgba(25, 18, 48, 0.55)' : '#FFFFFF', borderColor: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0,0,0,0.06)' }]}>
        <Text style={[styles.slotTitle, { color: isDark ? '#D4B8FF' : '#7C3AED' }]}>{title}</Text>

        <Pressable
          style={[
            styles.dropdownSelector,
            {
              backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : '#F9F7FD',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E9E3F8',
            },
          ]}
          onPress={() => openPicker(slotKey)}
        >
          <Text
            style={[
              styles.dropdownText,
              { color: slotData.question ? (isDark ? '#FFFFFF' : '#1A0A2E') : (isDark ? '#7E7A91' : '#9CA3AF') }
            ]}
            numberOfLines={1}
          >
            {slotData.question || 'Select a question...'}
          </Text>
          <ChevronDownIcon color={isDark ? '#A855F7' : '#7B6A9B'} />
        </Pressable>

        {slotData.question ? (
          <View
            style={[
              styles.answerContainer,
              {
                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.15)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E9E3F8',
              },
            ]}
          >
            <TextInput
              style={[styles.answerInput, { color: isDark ? '#EDE9FF' : '#1A0A2E' }]}
              placeholder="Write your answer here..."
              placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)'}
              value={slotData.answer}
              onChangeText={(txt) => setSlot({ ...slotData, answer: txt })}
              multiline
              maxLength={300}
            />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <ImageBackground source={bgSource} style={[styles.bg, { backgroundColor: isDark ? '#09031C' : '#F5F3FF' }]} resizeMode="cover">
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Glitters count={16} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20) + 38, paddingBottom: 40 }
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
          <View style={styles.slotsContainer}>
            {renderSlot('slot1', 'PROMPT SLOT 1', slot1, setSlot1)}
            {renderSlot('slot2', 'PROMPT SLOT 2', slot2, setSlot2)}
            {renderSlot('slot3', 'PROMPT SLOT 3', slot3, setSlot3)}
          </View>
        )}
      </ScrollView>

      {/* Continue Button at the bottom */}
      <View style={styles.footerContainer}>
        <Pressable
          id="btn-finish-ques-continue"
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.actionPressed,
          ]}
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

      {/* Dropdown Question Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: isDark ? '#140E28' : '#FFFFFF' },
            ]}
          >
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E9E3F8' }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#1A0A2E' }]}>Select a Prompt Question</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: '#B57BFF' }]}>Close</Text>
              </Pressable>
            </View>

            <FlatList
              data={QUESTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.questionsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.questionItem,
                    { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3ECFF' },
                  ]}
                  onPress={() => selectQuestion(item)}
                >
                  <Text style={[styles.questionText, { color: isDark ? '#EDE9FF' : '#2D2D2D' }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
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
  slotsContainer: {
    gap: 16,
  },
  slotCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 0 },
      web: { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } as any,
    }),
  },
  slotTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dropdownSelector: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  answerContainer: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 80,
  },
  answerInput: {
    fontSize: 14.5,
    lineHeight: 20,
    paddingTop: 0,
    textAlignVertical: 'top',
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '60%',
    width: '100%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
  },
  questionsList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  questionItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
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
