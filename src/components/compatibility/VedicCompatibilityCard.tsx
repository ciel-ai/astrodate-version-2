/**
 * VedicCompatibilityCard
 *
 * Right half of the Discover compatibility row. Uses pure View-based
 * approximations instead of expo-linear-gradient / expo-blur so the card
 * renders on any APK — including dev builds that were compiled before those
 * native modules were added. Once the native APK is rebuilt with
 * `npx expo run:android` the gradients and blur will be restored.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';

import { CompatibilityLayout, VedicTheme } from '@/constants/compatibility-theme';

interface VedicCompatibilityCardProps {
  score: number;
  max: number;
  doshaFlagged?: boolean;
  /** True when indian_score is genuinely unscored (synastry not yet computed
   * for this pair) rather than a real 0/max -- a real 0 is an extremely poor
   * Guna Milan match, so the two must not look identical. */
  pending?: boolean;
}

function LockIcon() {
  return (
    <Svg width={9} height={9} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke={VedicTheme.decor}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Path
        d="M5.5 11h13a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-7A1.5 1.5 0 0 1 5.5 11z"
        stroke={VedicTheme.decor}
        strokeWidth={2.2}
        fill="rgba(216,179,106,0.14)"
      />
    </Svg>
  );
}

/** Plain View approximation of a horizontal gold divider gradient */
function SacredDivider() {
  return <View style={styles.divider} />;
}

/** Plain View approximation of BlurView lock badge */
function LockBadge({ children }: { children: React.ReactNode }) {
  return <View style={styles.lockBadge}>{children}</View>;
}

export function VedicCompatibilityCard({ score, max, doshaFlagged = false, pending = false }: VedicCompatibilityCardProps) {
  return (
    <View style={styles.shadowWrap}>
      <View style={styles.card}>
        <Image
          source={require('@/assets/images/cards/vedic-card-bg.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="right"
          transition={150}
        />

        {/* Scrim approximation — replaces LinearGradient bottom fade */}
        <View style={styles.scrim} />

        <View style={styles.topRow}>
          <Text style={styles.kicker}>Vedic</Text>
          <LockBadge>
            <LockIcon />
          </LockBadge>
        </View>

        <Text style={styles.scoreRow}>
          <Text style={styles.scoreMain}>{pending ? '--' : score}</Text>
          <Text style={styles.scoreMax}>/{max}</Text>
        </Text>

        {pending ? (
          <View>
            <SacredDivider />
            <Text style={styles.gunaText}>Not yet scored</Text>
          </View>
        ) : doshaFlagged ? (
          <View>
            <SacredDivider />
            <View style={styles.doshaRow}>
              <Text style={styles.doshaIcon}>⚠</Text>
              <Text style={styles.doshaText}>Dosha flagged</Text>
            </View>
          </View>
        ) : (
          <View>
            <SacredDivider />
            <Text style={styles.gunaText}>Guna Milan</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    flex: 1,
    height: CompatibilityLayout.height,
    borderRadius: CompatibilityLayout.borderRadius,
    backgroundColor: VedicTheme.gradient[1],
    ...Platform.select({
      ios: {
        shadowColor: VedicTheme.glow,
        shadowOpacity: 0.35,
        shadowRadius: 11,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 7 },
      web: { boxShadow: `0 0 11px ${VedicTheme.glow}4d` } as any,
    }),
  },
  card: {
    flex: 1,
    borderRadius: CompatibilityLayout.borderRadius,
    borderWidth: 1,
    borderColor: VedicTheme.border,
    overflow: 'hidden',
    padding: CompatibilityLayout.padding,
    justifyContent: 'space-between',
  },
  /** Replaces LinearGradient bottom scrim */
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(23,8,36,0.45)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    color: VedicTheme.kicker,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  /** Replaces BlurView — dark semi-transparent circle */
  lockBadge: {
    width: 17,
    height: 17,
    borderRadius: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: VedicTheme.lockBorder,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scoreRow: {
    marginTop: -2,
  },
  scoreMain: {
    color: VedicTheme.scoreMain,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  scoreMax: {
    color: VedicTheme.scoreMax,
    fontSize: 16,
    fontWeight: '700',
  },
  /** Replaces LinearGradient — solid gold tint line */
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 4,
    backgroundColor: 'rgba(216,179,106,0.55)',
  },
  doshaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  doshaIcon: {
    color: VedicTheme.dosha,
    fontSize: 10,
  },
  doshaText: {
    color: VedicTheme.dosha,
    fontSize: 11,
    fontWeight: '600',
  },
  gunaText: {
    color: VedicTheme.guna,
    fontSize: 11,
    fontWeight: '500',
  },
});
