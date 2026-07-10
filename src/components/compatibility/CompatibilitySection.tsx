/**
 * CompatibilitySection
 *
 * Two side-by-side cards on the Discover profile card: the free Western
 * (sun-sign) score and the paid Vedic (Guna Milan) score. Deliberately two
 * different visual systems — see WesternCompatibilityCard and
 * VedicCompatibilityCard.
 */
import { StyleSheet, View } from 'react-native';

import { CompatibilityLayout } from '@/constants/compatibility-theme';
import { WesternCompatibilityCard } from './WesternCompatibilityCard';
import { VedicCompatibilityCard } from './VedicCompatibilityCard';

interface CompatibilitySectionProps {
  western: { score: number; caption?: string };
  vedic: { score: number; max: number; doshaFlagged?: boolean; pending?: boolean };
}

export function CompatibilitySection({ western, vedic }: CompatibilitySectionProps) {
  return (
    <View style={styles.row}>
      <WesternCompatibilityCard score={western.score} caption={western.caption} />
      <VedicCompatibilityCard score={vedic.score} max={vedic.max} doshaFlagged={vedic.doshaFlagged} pending={vedic.pending} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: CompatibilityLayout.gap,
  },
});
