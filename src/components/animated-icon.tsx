import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, { Easing, FadeOut, Keyframe } from 'react-native-reanimated';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const ENTER_DURATION = 350;
// Floor on how long the splash stays up, so a fast AsyncStorage read doesn't
// cut the entrance animation short -- independent of `ready`.
const MIN_VISIBLE_MS = 350;

// `ready` gates the exit: the saved theme preference (light/dark/system) is
// read from AsyncStorage asynchronously, so screens mounting underneath this
// overlay would otherwise briefly render with the device's system theme
// before flipping to the user's actual saved choice once that read resolves
// -- visible as background images swapping right after launch. Not hiding
// until the caller confirms that read is done means the swap always happens
// while still covered by the splash.
export function AnimatedSplashOverlay({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (ready && minTimeElapsed) setVisible(false);
  }, [ready, minTimeElapsed]);

  if (!visible) return null;

  const enterKeyframe = new Keyframe({
    0: {
      transform: [{ scale: INITIAL_SCALE_FACTOR }],
      opacity: 1,
    },
    100: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
  });

  return (
    <Animated.View
      entering={enterKeyframe.duration(ENTER_DURATION)}
      exiting={FadeOut.duration(400).easing(Easing.elastic(0.7))}
      style={styles.backgroundSolidColor}
    />
  );
}

const styles = StyleSheet.create({
  backgroundSolidColor: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#208AEF',
    zIndex: 1000,
  },
});
