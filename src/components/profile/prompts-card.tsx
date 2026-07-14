import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PROMPT_SLOTS, type PromptSlots } from '@/lib/user-prompts';

interface PromptsCardProps {
  prompts: PromptSlots;
  isDark: boolean;
  onEdit: () => void;
}

export function PromptsCard({ prompts, isDark, onEdit }: PromptsCardProps) {
  const answeredCount = PROMPT_SLOTS.filter((id) => prompts[id].question).length;

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#EDE9FF' : '#1B1528',
    label: isDark ? '#7C7796' : '#8A7BA0',
    question: isDark ? '#D4B8FF' : '#7C3AED',
  };

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: T.label }]}>MY PROMPTS</Text>
        <Pressable
          id="btn-prompts-edit"
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit prompts"
        >
          <Text style={styles.editIcon}>✎</Text>
        </Pressable>
      </View>

      {answeredCount === 0 ? (
        <Text style={[styles.empty, { color: T.label }]}>No prompts yet — tap ✎ to add up to 3.</Text>
      ) : (
        <View style={styles.list}>
          {PROMPT_SLOTS.filter((id) => prompts[id].question).map((id) => (
            <View key={id} style={styles.item}>
              <Text style={[styles.question, { color: T.question }]} numberOfLines={1}>
                {prompts[id].question}
              </Text>
              <Text style={[styles.answer, { color: T.text }]} numberOfLines={2}>
                {prompts[id].answer || '—'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  editIcon: { fontSize: 15, color: '#A855F7' },
  empty: { fontSize: 13.5, lineHeight: 19, fontStyle: 'italic' },
  list: { gap: 12 },
  item: { gap: 3 },
  question: { fontSize: 12, fontWeight: '700' },
  answer: { fontSize: 14, lineHeight: 19 },
});
