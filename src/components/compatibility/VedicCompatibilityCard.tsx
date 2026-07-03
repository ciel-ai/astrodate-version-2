/**
 * VedicCompatibilityCard
 *
 * Right half of the Discover compatibility row — ancient-astrology counterpart
 * to the Western card. Uses a real gold zodiac-wheel/mandala illustration as
 * the card art, cropped toward its right edge to keep the wheel in frame; a
 * bottom scrim keeps the score legible. Reinforced by the frosted lock badge
 * and the dosha warning beneath a gold divider.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';

import { CompatibilityLayout, VedicTheme } from '@/constants/compatibility-theme';

interface VedicCompatibilityCardProps {
  score: number;
  max: number;
  doshaFlagged?: boolean;
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

function SacredDivider() {
  return (
    <LinearGradient
      colors={['transparent', 'rgba(216,179,106,0.55)', 'transparent']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.divider}
    />
  );
}

export function VedicCompatibilityCard({ score, max, doshaFlagged = false }: VedicCompatibilityCardProps) {
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

        <LinearGradient
          colors={['transparent', 'rgba(23,8,36,0.55)']}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topRow}>
          <Text style={styles.kicker}>Vedic</Text>
          <BlurView intensity={40} tint="dark" style={styles.lockBadge}>
            <LockIcon />
          </BlurView>
        </View>

        <Text style={styles.scoreRow}>
          <Text style={styles.scoreMain}>{score}</Text>
          <Text style={styles.scoreMax}>/{max}</Text>
        </Text>

        {doshaFlagged ? (
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
  lockBadge: {
    width: 17,
    height: 17,
    borderRadius: 9,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: VedicTheme.lockBorder,
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
  divider: {
    height: 1,
    width: '100%',
    marginBottom: 4,
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
