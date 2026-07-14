/**
 * Generic single-select bottom sheet used by Basic Info's chip rows
 * (height / education / drinking / smoking). One reusable modal instead of
 * four near-identical ones.
 */
import { FlatList, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface ChipOption {
  label: string;
  value: string;
}

interface ChipPickerSheetProps {
  title: string;
  options: ChipOption[];
  selected: string;
  onSelect: (value: string) => void;
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
}

export function ChipPickerSheet({ title, options, selected, onSelect, visible, onClose, isDark }: ChipPickerSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View style={[styles.content, { backgroundColor: isDark ? '#140E28' : '#FFFFFF' }]}>
          <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : '#E9E3F8' }]}>
            <Text style={[styles.title, { color: isDark ? '#FFFFFF' : '#1A0A2E' }]}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>

          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = item.value === selected;
              return (
                <TouchableOpacity
                  id={`chip-option-${item.value}`}
                  style={[styles.item, { borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : '#F3ECFF' }]}
                  onPress={() => onSelect(item.value)}
                >
                  <Text
                    style={[
                      styles.itemText,
                      { color: isSelected ? (isDark ? '#D4B8FF' : '#7C3AED') : (isDark ? '#EDE9FF' : '#2D2D2D') },
                      isSelected && styles.itemTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {isSelected ? <Text style={styles.check}>✓</Text> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  content: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '60%', width: '100%', paddingTop: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  closeText: { fontSize: 14, fontWeight: '600', color: '#B57BFF' },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemText: { fontSize: 15, fontWeight: '500', lineHeight: 20 },
  itemTextSelected: { fontWeight: '700' },
  check: { fontSize: 15, fontWeight: '800', color: '#A855F7' },
});
