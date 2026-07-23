/**
 * Small line-icon set for the Settings screen rows -- replaces the emoji
 * that used to sit in front of each row (📱 🚪 🗑️ etc). Each icon is a plain
 * stroke-based SVG (same convention as chat/[channelId].tsx's call/camera
 * icons) so it can be themed with a single `color` prop instead of relying
 * on however each platform happens to render a given emoji glyph.
 */
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

type IconProps = { color: string; size?: number };

const STROKE = 1.8;

export function PhoneIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="7" y="2" width="10" height="20" rx="2.5" stroke={color} strokeWidth={STROKE} />
      <Line x1="11" y1="18.3" x2="13" y2="18.3" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function LogOutIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="10" y1="12" x2="21" y2="12" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M17.5 8.5 21 12l-3.5 3.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function TrashIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 7h16" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7a1.5 1.5 0 0 0 1.5-1.4l1-13" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="10" y1="11" x2="10.5" y2="17" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1="14" y1="11" x2="13.5" y2="17" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function DiamondIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 19 10 12 21 5 10Z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
      <Path d="M5 10h14M9 3l3 7 3-7" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function RefreshIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 12a8 8 0 0 1 14-5.3" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M20 12a8 8 0 0 1-14 5.3" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Path d="M18 3v4h-4" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6 21v-4h4" stroke={color} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function PinIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21Z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
      <Circle cx="12" cy="9.5" r="2.4" stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

export function ShieldIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l7 3v5.2c0 4.6-3 7.8-7 9.8-4-2-7-5.2-7-9.8V6Z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
    </Svg>
  );
}

export function LockIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5.5" y="10.5" width="13" height="9.5" rx="1.6" stroke={color} strokeWidth={STROKE} />
      <Path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx="12" cy="15" r="1.3" stroke={color} strokeWidth={STROKE} />
    </Svg>
  );
}

export function SparkleIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c.6 3.2 1.2 4.6 2.4 5.8C15.6 9.8 17 10.4 20 11c-3 .6-4.4 1.2-5.6 2.4C13.2 14.6 12.6 16 12 19c-.6-3-1.2-4.4-2.4-5.6C8.4 12.2 7 11.6 4 11c3-.6 4.4-1.2 5.6-2.2C10.8 7.6 11.4 6.2 12 3Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MessageIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5V14a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-4H6.5A2.5 2.5 0 0 1 4 14Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HeartIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MoonStarIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 13.5A7 7 0 1 1 10.5 4a5.6 5.6 0 0 0 6 9.5Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Path d="M19 4.5v3M17.5 6h3" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function PaletteIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3a9 8 0 0 0 0 16c1.2 0 1.6-.7 1.2-1.5-.3-.6-.1-1.3.6-1.5H15a6 5 0 0 0 6-5c0-4.4-4-8-9-8Z"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />
      <Circle cx="8" cy="10.5" r="1" fill={color} />
      <Circle cx="12" cy="8" r="1" fill={color} />
      <Circle cx="16" cy="10.5" r="1" fill={color} />
    </Svg>
  );
}

export function ScrollIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 3.5h10a1 1 0 0 1 1 1V19a2.5 2.5 0 0 1-2.5 2.5H8A2.5 2.5 0 0 1 5.5 19V6a2.5 2.5 0 0 1 2.5-2.5Z" stroke={color} strokeWidth={STROKE} strokeLinejoin="round" />
      <Line x1="8.5" y1="8" x2="15" y2="8" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1="8.5" y1="12" x2="15" y2="12" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Line x1="8.5" y1="16" x2="12" y2="16" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
    </Svg>
  );
}

export function InfoIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={STROKE} />
      <Line x1="12" y1="11" x2="12" y2="16" stroke={color} strokeWidth={STROKE} strokeLinecap="round" />
      <Circle cx="12" cy="7.7" r="1" fill={color} />
    </Svg>
  );
}
