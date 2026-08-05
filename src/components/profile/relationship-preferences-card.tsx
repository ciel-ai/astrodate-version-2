/**
 * Profile tab — Relationship & Preferences card
 */
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChipPickerSheet, type ChipOption } from './chip-picker-sheet';

export type RelationshipPreferencesField =
  | 'sexualOrientation'
  | 'haveChildren'
  | 'wantChildren'
  | 'relationshipStyle';

const SEXUAL_ORIENTATION_OPTIONS: ChipOption[] = [
  'Straight',
  'Gay',
  'Lesbian',
  'Bisexual',
  'Pansexual',
  'Asexual',
  'Demisexual',
  'Queer',
  'Questioning',
  'Prefer not to say',
  'Other (Self describe)',
].map((v) => ({ label: v, value: v }));

const HAVE_CHILDREN_OPTIONS: ChipOption[] = [
  'No',
  'Yes, living with me',
  'Yes, not living with me',
  'Prefer not to say',
].map((v) => ({ label: v, value: v }));

const WANT_CHILDREN_OPTIONS: ChipOption[] = [
  'Definitely yes',
  'Someday',
  'Maybe',
  'No',
  'Already have children',
  'Not sure',
  'Prefer not to say',
].map((v) => ({ label: v, value: v }));

const RELATIONSHIP_STYLE_OPTIONS: ChipOption[] = [
  'Monogamous',
  'Ethically Non-Monogamous (ENM)',
  'Open Relationship',
  'Polyamorous',
  'Open to exploring',
  'Prefer not to say',
].map((v) => ({ label: v, value: v }));

const ROWS: {
  field: RelationshipPreferencesField;
  icon: string;
  label: string;
  options: ChipOption[];
  title: string;
}[] = [
  {
    field: 'sexualOrientation',
    icon: '❤️',
    label: 'Sexual Orientation',
    options: SEXUAL_ORIENTATION_OPTIONS,
    title: 'Select Orientation',
  },
  {
    field: 'haveChildren',
    icon: '👶',
    label: 'Do you have children?',
    options: HAVE_CHILDREN_OPTIONS,
    title: 'Do you have children?',
  },
  {
    field: 'wantChildren',
    icon: '🍼',
    label: 'Do you want children?',
    options: WANT_CHILDREN_OPTIONS,
    title: 'Do you want children?',
  },
  {
    field: 'relationshipStyle',
    icon: '💞',
    label: 'Relationship Style',
    options: RELATIONSHIP_STYLE_OPTIONS,
    title: 'Relationship Style',
  },
];

interface RelationshipPreferencesCardProps {
  values: Record<RelationshipPreferencesField, string>;
  isDark: boolean;
  onSaveField: (
    field: RelationshipPreferencesField,
    value: string
  ) => Promise<{ success: boolean; error?: string }>;
}

export function RelationshipPreferencesCard({
  values,
  isDark,
  onSaveField,
}: RelationshipPreferencesCardProps) {
  const [openField, setOpenField] = useState<RelationshipPreferencesField | null>(null);
  const [savingField, setSavingField] = useState<RelationshipPreferencesField | null>(null);

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    label: isDark ? '#7C7796' : '#8A7BA0',
    accent: isDark ? '#D4B8FF' : '#7C3AED',
  };

  const activeRow = ROWS.find((r) => r.field === openField);

  const handleSelect = async (field: RelationshipPreferencesField, value: string) => {
    setSavingField(field);
    const result = await onSaveField(field, value);
    setSavingField(null);
    setOpenField(null);
    if (!result.success) {
      Alert.alert('Save Failed', result.error || `Could not save ${field}.`);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
      <Text style={[styles.header, { color: T.label }]}>RELATIONSHIP PREFERENCES</Text>

      {ROWS.map((row, i) => (
        <Pressable
          key={row.field}
          id={`btn-rel-pref-${row.field}`}
          onPress={() => setOpenField(row.field)}
          style={({ pressed }) => [
            styles.row,
            i < ROWS.length - 1 && [styles.rowBorder, { borderBottomColor: T.border }],
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.rowLeft}>
            <Text style={styles.rowIcon}>{row.icon}</Text>
            <Text style={[styles.rowLabel, { color: T.text }]}>{row.label}</Text>
          </View>
          <View style={styles.rowRight}>
            {savingField === row.field ? (
              <ActivityIndicator size="small" color="#A855F7" />
            ) : (
              <Text style={[styles.rowValue, { color: T.accent }]} numberOfLines={1} ellipsizeMode="tail">
                {values[row.field] || 'Not set'}
              </Text>
            )}
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>
      ))}

      {activeRow ? (
        <ChipPickerSheet
          title={activeRow.title}
          options={activeRow.options}
          selected={values[activeRow.field]}
          onSelect={(value) => handleSelect(activeRow.field, value)}
          visible={openField !== null}
          onClose={() => setOpenField(null)}
          isDark={isDark}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  rowBorder: { borderBottomWidth: 1 },
  rowPressed: { opacity: 0.7 },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 16 },
  rowLabel: { fontSize: 14.5, fontWeight: '600', flexShrink: 1 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '50%' },
  rowValue: { fontSize: 13.5, fontWeight: '600', maxWidth: 140 },
  chevron: { fontSize: 18, color: '#9A93B5', marginTop: -2 },
});
