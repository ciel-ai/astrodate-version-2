import { Pressable, StyleSheet, Text, View } from 'react-native';

type SortControlProps = {
  /** Only AstroX (not Astro+, not free) gets a working sort -- deliberately
   *  narrower than `isPaid`. Shown-but-locked for everyone else, since
   *  visibility of what's missing is the point. */
  unlocked: boolean;
  active: boolean;
  onToggle: () => void;
  onLockedPress: () => void;
};

export function SortControl({ unlocked, active, onToggle, onLockedPress }: SortControlProps) {
  return (
    <Pressable
      onPress={unlocked ? onToggle : onLockedPress}
      accessibilityRole="button"
      accessibilityLabel="Sort by compatibility"
      style={({ pressed }) => [
        styles.control,
        active && unlocked && styles.controlActive,
        pressed && styles.controlPressed,
      ]}
    >
      <Text style={[styles.label, active && unlocked && styles.labelActive]}>Sort by compatibility</Text>
      {!unlocked && (
        <View style={styles.lockBadge}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  controlActive: { borderColor: '#A855F7', backgroundColor: 'rgba(168, 85, 247, 0.18)' },
  controlPressed: { opacity: 0.85 },
  label: { color: '#C9A6E8', fontSize: 12, fontWeight: '600' },
  labelActive: { color: '#D4B8FF' },
  lockBadge: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  lockIcon: { fontSize: 10 },
});
