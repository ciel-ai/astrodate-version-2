/**
 * Profile tab — Basic Info card
 *
 * Height / Education / Drinking / Smoking as tappable chip-rows, each
 * opening a ChipPickerSheet. Height writes to section1_qns; the other three
 * write to onboarding_responses -- both had zero edit UI anywhere before
 * this (confirmed no onboarding screen ever wrote education/drinking/smoking).
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChipPickerSheet, type ChipOption } from './chip-picker-sheet';

export type BasicInfoField = 'height' | 'education' | 'drinking' | 'smoking';

const HEIGHT_OPTIONS: ChipOption[] = [
  { label: '<150 cm', value: '<150' },
  { label: '150–165 cm', value: '150-165' },
  { label: '165–180 cm', value: '165-180' },
  { label: '180 cm+', value: '180+' },
];
const EDUCATION_OPTIONS: ChipOption[] = ['High School', 'Bachelor', 'Master', 'PhD', 'Other'].map((v) => ({ label: v, value: v }));
const DRINKING_OPTIONS: ChipOption[] = ['Never', 'Sometimes', 'Often', 'Socially'].map((v) => ({ label: v, value: v }));
const SMOKING_OPTIONS: ChipOption[] = ['Never', 'Sometimes', 'Regularly', 'Trying to quit'].map((v) => ({ label: v, value: v }));

const ROWS: { field: BasicInfoField; icon: string; label: string; options: ChipOption[]; title: string }[] = [
  { field: 'height', icon: '📏', label: 'Height', options: HEIGHT_OPTIONS, title: 'Select Height' },
  { field: 'education', icon: '🎓', label: 'Education', options: EDUCATION_OPTIONS, title: 'Select Education' },
  { field: 'drinking', icon: '🍷', label: 'Drinking', options: DRINKING_OPTIONS, title: 'Select Drinking' },
  { field: 'smoking', icon: '🚬', label: 'Smoking', options: SMOKING_OPTIONS, title: 'Select Smoking' },
];

interface BasicInfoCardProps {
  values: Record<BasicInfoField, string>;
  isDark: boolean;
  onSaveField: (field: BasicInfoField, value: string) => Promise<{ success: boolean; error?: string }>;
}

function displayLabel(field: BasicInfoField, options: ChipOption[], value: string): string {
  if (field === 'height') return options.find((o) => o.value === value)?.label ?? 'Not set';
  return value || 'Not set';
}

export function BasicInfoCard({ values, isDark, onSaveField }: BasicInfoCardProps) {
  const [openField, setOpenField] = useState<BasicInfoField | null>(null);
  const [savingField, setSavingField] = useState<BasicInfoField | null>(null);

  const T = {
    card: isDark ? 'rgba(13, 9, 32, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
    text: isDark ? '#FFFFFF' : '#1B1528',
    label: isDark ? '#7C7796' : '#8A7BA0',
    accent: isDark ? '#D4B8FF' : '#7C3AED',
  };

  const activeRow = ROWS.find((r) => r.field === openField);

  const handleSelect = async (field: BasicInfoField, value: string) => {
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
      <Text style={[styles.header, { color: T.label }]}>BASIC INFO</Text>

      {ROWS.map((row, i) => (
        <Pressable
          key={row.field}
          id={`btn-basic-info-${row.field}`}
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
              <Text style={[styles.rowValue, { color: T.accent }]}>
                {displayLabel(row.field, row.options, values[row.field])}
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
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 16 },
  rowLabel: { fontSize: 14.5, fontWeight: '600' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13.5, fontWeight: '600' },
  chevron: { color: '#6B6785', fontSize: 18 },
});
