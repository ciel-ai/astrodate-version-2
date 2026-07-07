import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

export type InsightCategory = 'health' | 'emotions' | 'profession' | 'luck' | 'personal_life' | 'travel';

type CategoryIconProps = {
  category: InsightCategory;
  color: ColorValue;
  size?: number;
};

// Same hand-drawn SVG-path convention as tab-bar-icon.tsx (24x24 viewBox,
// stroke={color}, light fill tint) — no icon-font dependency.
export function CategoryIcon({ category, color, size = 22 }: CategoryIconProps) {
  const strokeWidth = 1.8;
  const fillOpacity = 0.14;

  switch (category) {
    case 'health':
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
    case 'emotions':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={fillOpacity} />
          <Path d="M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <Circle cx="9" cy="10" r="1" fill={color} />
          <Circle cx="15" cy="10" r="1" fill={color} />
        </Svg>
      );
    case 'profession':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 8.5h16v10H4z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            fill={color}
            fillOpacity={fillOpacity}
          />
          <Path d="M9 8.5V6.3c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v2.2" stroke={color} strokeWidth={strokeWidth} fill="none" />
        </Svg>
      );
    case 'luck':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 3.5 14 9.3 20 10.2 15.6 14.1 16.9 20 12 16.9 7.1 20 8.4 14.1 4 10.2 10 9.3z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            fill={color}
            fillOpacity={fillOpacity}
          />
        </Svg>
      );
    case 'personal_life':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="9" cy="8.5" r="3" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={fillOpacity} />
          <Circle cx="16" cy="9.5" r="2.4" stroke={color} strokeWidth={strokeWidth} fill={color} fillOpacity={fillOpacity} />
          <Path d="M3.3 19c1-3 3-4.6 5.7-4.6s4.7 1.6 5.7 4.6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <Path d="M14.8 14.9c2.3.2 4 1.8 4.9 4.1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
        </Svg>
      );
    case 'travel':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3.5 15.2 20 8.7c1-.4 1.9.6 1.5 1.6l-.4 1-6 2.2-.7 5.4-1.7.7-1.2-4.8-4.2 1.5-.9 2-1.4.5.3-2.2-2-1.2z"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={color}
            fillOpacity={fillOpacity}
          />
        </Svg>
      );
  }
}

export const CATEGORY_LABELS: Record<InsightCategory, string> = {
  health: 'Health',
  emotions: 'Emotions',
  profession: 'Profession',
  luck: 'Luck',
  personal_life: 'Personal Life',
  travel: 'Travel',
};
