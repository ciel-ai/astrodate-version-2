import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconName = 'discover' | 'insights' | 'likes' | 'chats' | 'profile';

type TabBarIconProps = {
  name: TabIconName;
  color: ColorValue;
  focused: boolean;
  size?: number;
};

// Minimal outline icons (24×24 viewBox), filled slightly when focused —
// kept as hand-drawn SVG paths so the tab bar needs no icon-font dependency.
export function TabBarIcon({ name, color, focused, size = 24 }: TabBarIconProps) {
  const strokeWidth = focused ? 2 : 1.6;
  const fillOpacity = focused ? 0.18 : 0;

  switch (name) {
    case 'discover':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={fillOpacity} />
          <Path
            d="M15.5 8.5 13.2 13.2 8.5 15.5 10.8 10.8z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            fill={focused ? color : 'none'}
            fillOpacity={focused ? 0.9 : 0}
          />
        </Svg>
      );
    case 'insights':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5 14 8.3 20 9.2 15.6 13.1 16.9 19 12 15.9 7.1 19 8.4 13.1 4 9.2 10 8.3z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            fill={color}
            fillOpacity={fillOpacity}
          />
        </Svg>
      );
    case 'likes':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={color}
            fillOpacity={fillOpacity}
          />
        </Svg>
      );
    case 'chats':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 5.5h16v10.5H9.2L5.2 19v-3H4z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={color}
            fillOpacity={fillOpacity}
          />
        </Svg>
      );
    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="8.3" r="3.6" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={fillOpacity} />
          <Path
            d="M4.8 19.5c1.2-3.4 4-5.3 7.2-5.3s6 1.9 7.2 5.3"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      );
  }
}
