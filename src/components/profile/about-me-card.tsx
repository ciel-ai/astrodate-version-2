import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { alert } from '@/lib/themed-alert';

interface AboutMeCardProps {
  bio: string;
  isDark: boolean;
  onSave: (bio: string) => Promise<{ success: boolean; error?: string }>;
}

export function AboutMeCard({ bio, isDark, onSave }: AboutMeCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [saving, setSaving] = useState(false);

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#EDE9FF' : '#1B1528',
    label: isDark ? '#7C7796' : '#8A7BA0',
    inputBg: isDark ? 'rgba(0, 0, 0, 0.2)' : '#F9F7FD',
  };

  const startEditing = () => {
    setDraft(bio);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(bio);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    const result = await onSave(draft.trim());
    setSaving(false);
    if (!result.success) {
      alert('Save Failed', result.error || 'Could not save your bio.');
      return;
    }
    setEditing(false);
  };

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: T.label }]}>ABOUT ME</Text>
        {!editing ? (
          <Pressable
            id="btn-about-me-edit"
            onPress={startEditing}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Edit About Me"
          >
            <Text style={styles.editIcon}>✎</Text>
          </Pressable>
        ) : null}
      </View>

      {editing ? (
        <>
          <TextInput
            style={[styles.input, { color: T.text, backgroundColor: T.inputBg, borderColor: T.border }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Tell people about yourself..."
            placeholderTextColor={T.label}
            multiline
            maxLength={500}
            editable={!saving}
          />
          <View style={styles.actionsRow}>
            <Pressable id="btn-about-me-cancel" onPress={cancel} disabled={saving} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: T.label }]}>Cancel</Text>
            </Pressable>
            <Pressable id="btn-about-me-save" onPress={save} disabled={saving} style={styles.saveBtn}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </>
      ) : bio ? (
        <Text style={[styles.bio, { color: T.text }]}>{bio}</Text>
      ) : (
        <Text style={[styles.empty, { color: T.label }]}>No bio yet — tap ✎ to add one.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 8,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  editIcon: { fontSize: 15, color: '#A855F7' },
  bio: { fontSize: 14.5, lineHeight: 21 },
  empty: { fontSize: 13.5, lineHeight: 19, fontStyle: 'italic' },

  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
    fontSize: 14.5,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 2 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14 },
  cancelText: { fontSize: 13, fontWeight: '600' },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    minWidth: 64,
    alignItems: 'center',
  },
  saveText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});
