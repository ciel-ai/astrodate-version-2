import { Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

// Same hand-drawn SVG-path + stroke/fillOpacity convention as tab-bar-icon.tsx.
export function BookmarkButton({
  saved,
  onPress,
  color,
}: {
  saved: boolean;
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved insights' : 'Save to journal'}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 3.8h12v16.4l-6-4-6 4z"
          stroke={color}
          strokeWidth={saved ? 2 : 1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
          fill={saved ? color : 'none'}
          fillOpacity={saved ? 0.9 : 0}
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 4 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
});
