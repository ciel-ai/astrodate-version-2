/**
 * Shared prompt-slot editor -- the 3 dropdown-question + answer cards, plus
 * the question-picker modal. Extracted from finish-ques.tsx (onboarding) so
 * Profile's prompts editor reuses the exact same UI instead of forking it;
 * finish-ques.tsx now renders this component too. Any change to the question
 * list or slot-card look only needs to happen here.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { alert } from '@/lib/themed-alert';
import Svg, { Path } from 'react-native-svg';

import type { PromptSlotId, PromptSlots } from '@/lib/user-prompts';
import { PROMPT_SLOTS } from '@/lib/user-prompts';
import { optimizePromptAnswer } from '@/lib/prompt-optimizer';

export const PROMPT_QUESTIONS = [
  'My greatest strength is...',
  'I value honesty, empathy, and...',
  'A perfect Sunday starts with...',
  "I'm looking for someone who...",
  'Believe it or not, I...',
  'My friends tell me I\'m...',
  'Most spontaneous thing I\'ve done...',
  'My love language is...',
  'Let\'s debate: is pineapple on pizza...',
];

const SLOT_TITLES: Record<PromptSlotId, string> = {
  slot1: 'PROMPT SLOT 1',
  slot2: 'PROMPT SLOT 2',
  slot3: 'PROMPT SLOT 3',
};

const ChevronDownIcon = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6 9l6 6 6-6" />
  </Svg>
);

interface PromptEditorFormProps {
  slots: PromptSlots;
  onChange: (next: PromptSlots) => void;
  isDark: boolean;
}

export function PromptEditorForm({ slots, onChange, isDark }: PromptEditorFormProps) {
  const [activeSlot, setActiveSlot] = useState<PromptSlotId | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [optimizingSlot, setOptimizingSlot] = useState<PromptSlotId | null>(null);

  const openPicker = (slot: PromptSlotId) => {
    setActiveSlot(slot);
    setModalVisible(true);
  };

  const selectQuestion = (q: string) => {
    if (activeSlot) {
      onChange({ ...slots, [activeSlot]: { ...slots[activeSlot], question: q } });
    }
    setModalVisible(false);
  };

  const setAnswer = (slotId: PromptSlotId, answer: string) => {
    onChange({ ...slots, [slotId]: { ...slots[slotId], answer } });
  };

  const handleOptimize = async (slotId: PromptSlotId) => {
    const slotData = slots[slotId];
    if (!slotData.answer.trim() || optimizingSlot) return;

    setOptimizingSlot(slotId);
    const result = await optimizePromptAnswer(slotData.question, slotData.answer);
    setOptimizingSlot(null);

    if (result.success) {
      setAnswer(slotId, result.optimized);
    } else if (result.reason === 'quota_exceeded') {
      alert("You're out of optimizes for today", 'Try again tomorrow, or just edit it yourself for now.');
    } else {
      alert('Optimize failed', 'Something went wrong polishing your answer. Please try again.');
    }
  };

  return (
    <View style={styles.slotsContainer}>
      {PROMPT_SLOTS.map((slotId) => {
        const slotData = slots[slotId];
        return (
          <View
            key={slotId}
            style={[
              styles.slotCard,
              { backgroundColor: isDark ? 'rgba(25, 18, 48, 0.55)' : '#FFFFFF', borderColor: isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0,0,0,0.06)' },
            ]}
          >
            <Text style={[styles.slotTitle, { color: isDark ? '#D4B8FF' : '#7C3AED' }]}>{SLOT_TITLES[slotId]}</Text>

            <Pressable
              id={`btn-prompt-${slotId}-question`}
              style={[
                styles.dropdownSelector,
                {
                  backgroundColor: isDark ? 'rgba(0, 0, 0, 0.3)' : '#F9F7FD',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E9E3F8',
                },
              ]}
              onPress={() => openPicker(slotId)}
            >
              <Text
                style={[
                  styles.dropdownText,
                  { color: slotData.question ? (isDark ? '#FFFFFF' : '#1A0A2E') : (isDark ? '#7E7A91' : '#9CA3AF') },
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
                  onChangeText={(txt) => setAnswer(slotId, txt)}
                  multiline
                  maxLength={300}
                />

                {slotData.answer.trim().length > 0 && (
                  <Pressable
                    id={`btn-prompt-${slotId}-optimize`}
                    onPress={() => handleOptimize(slotId)}
                    disabled={optimizingSlot === slotId}
                    style={({ pressed }) => [
                      styles.optimizeBtn,
                      { borderColor: isDark ? 'rgba(168, 85, 247, 0.35)' : 'rgba(124, 58, 237, 0.25)' },
                      pressed && styles.optimizeBtnPressed,
                    ]}
                  >
                    {optimizingSlot === slotId ? (
                      <ActivityIndicator size="small" color={isDark ? '#D4B8FF' : '#7C3AED'} />
                    ) : (
                      <Text style={[styles.optimizeBtnText, { color: isDark ? '#D4B8FF' : '#7C3AED' }]}>
                        ✨ Optimize
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            ) : null}
          </View>
        );
      })}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#140E28' : '#FFFFFF' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E9E3F8' }]}>
              <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#1A0A2E' }]}>Select a Prompt Question</Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalCloseText, { color: '#B57BFF' }]}>Close</Text>
              </Pressable>
            </View>

            <FlatList
              data={PROMPT_QUESTIONS}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.questionsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.questionItem, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3ECFF' }]}
                  onPress={() => selectQuestion(item)}
                >
                  <Text style={[styles.questionText, { color: isDark ? '#EDE9FF' : '#2D2D2D' }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  slotsContainer: { gap: 16 },
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
  slotTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  dropdownSelector: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: { fontSize: 14, fontWeight: '500', flex: 1, marginRight: 10 },
  answerContainer: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, minHeight: 80 },
  answerInput: { fontSize: 14.5, lineHeight: 20, paddingTop: 0, textAlignVertical: 'top' },
  optimizeBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optimizeBtnPressed: { opacity: 0.7 },
  optimizeBtnText: { fontSize: 12, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '60%', width: '100%', paddingTop: 20 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalCloseText: { fontSize: 14, fontWeight: '600' },
  questionsList: { paddingHorizontal: 20, paddingBottom: 40 },
  questionItem: { paddingVertical: 16, borderBottomWidth: 1 },
  questionText: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
});
