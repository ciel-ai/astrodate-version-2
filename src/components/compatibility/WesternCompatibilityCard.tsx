/**
 * WesternCompatibilityCard
 *
 * Left half of the Discover compatibility row — a modern-astronomy read on
 * sun-sign compatibility. Uses a real cosmic photo (crescent planet, star
 * field, orbital light-trails) as the card art, cropped toward its right
 * edge so the planet stays in frame; a bottom scrim keeps the score legible.
 *
 * NOTE: expo-linear-gradient requires native binaries not present in the
 * current dev APK build. Using a plain View scrim until the native APK is
 * rebuilt with `npx expo run:android`.
 */
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { CompatibilityLayout, WesternTheme } from '@/constants/compatibility-theme';

interface WesternCompatibilityCardProps {
  score: number;
  caption?: string;
}

export function WesternCompatibilityCard({ score, caption = 'Sun compatibility' }: WesternCompatibilityCardProps) {
  return (
    <View style={styles.shadowWrap}>
      <View style={styles.card}>
        <Image
          source={require('@/assets/images/cards/western-card-bg.jpg')}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="right"
          transition={150}
        />

        {/* Scrim — plain View replaces LinearGradient until native APK rebuild */}
        <View style={styles.scrim} />

        <Text style={styles.kicker}>Western</Text>

        <Text style={styles.score}>{score}%</Text>

        <Text style={styles.subtitle}>{caption}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    flex: 1,
    height: CompatibilityLayout.height,
    borderRadius: CompatibilityLayout.borderRadius,
    backgroundColor: WesternTheme.gradient[1],
    ...Platform.select({
      ios: {
        shadowColor: WesternTheme.glow,
        shadowOpacity: 0.4,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 0 },
      },
      android: { elevation: 8 },
      web: { boxShadow: `0 0 12px ${WesternTheme.glow}55` } as any,
    }),
  },
  card: {
    flex: 1,
    borderRadius: CompatibilityLayout.borderRadius,
    borderWidth: 1,
    borderColor: WesternTheme.border,
    overflow: 'hidden',
    padding: CompatibilityLayout.padding,
    justifyContent: 'space-between',
  },
  /** Replaces LinearGradient bottom scrim */
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9,13,30,0.45)',
  },
  kicker: {
    color: WesternTheme.kicker,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  score: {
    color: WesternTheme.score,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: WesternTheme.subtitle,
    fontSize: 11,
    fontWeight: '500',
  },
});
