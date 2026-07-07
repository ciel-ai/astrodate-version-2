import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

const PALETTE = ['#FFFFFF', '#E6D8FF', '#D38BFF', '#C77DFF'];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

interface GlittersProps {
  /** number of glitter particles */
  count?: number;
}

/**
 * A soft layer of twinkling glitter — tiny glowing dots and ✦ sparkles that
 * fade and pulse in and out. Purely decorative, non-interactive.
 */
export default function Glitters({ count = 28 }: GlittersProps) {
  const [particles] = useState(() =>
    Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${rand(3, 97)}%`,
      top: `${rand(3, 97)}%`,
      color: pick(PALETTE),
      sparkle: Math.random() < 0.35,
      size: rand(2, 4.6),
      glyphSize: rand(10, 20),
      duration: rand(1200, 2800),
      delay: rand(0, 2400),
      maxOpacity: rand(0.6, 1),
    })),
  );

  const [anims] = useState(() => particles.map(() => new Animated.Value(0)));

  useEffect(() => {
    const loops = particles.map((p, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(anims[i], {
            toValue: 1,
            duration: p.duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anims[i], {
            toValue: 0,
            duration: p.duration,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims, particles]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const opacity = anims[i].interpolate({
          inputRange: [0, 1],
          outputRange: [0.14, p.maxOpacity],
        });
        const scale = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
        const glow = Platform.select({
          ios: {
            shadowColor: p.color,
            shadowOpacity: 0.9,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 0 },
          },
          android: {},
          default: { boxShadow: `0 0 6px ${p.color}` },
        }) as object;

        if (p.sparkle) {
          return (
            <Animated.Text
              key={p.id}
              style={[
                styles.sparkle,
                glow,
                {
                  left: p.left as any,
                  top: p.top as any,
                  color: p.color,
                  fontSize: p.glyphSize,
                  opacity,
                  transform: [{ scale }],
                },
              ]}
            >
              ✦
            </Animated.Text>
          );
        }
        return (
          <Animated.View
            key={p.id}
            style={[
              glow,
              {
                position: 'absolute',
                left: p.left as any,
                top: p.top as any,
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                opacity,
                transform: [{ scale }],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sparkle: { position: 'absolute', backgroundColor: 'transparent' },
});
