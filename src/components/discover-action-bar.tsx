/**
 * DiscoverActionBar
 *
 * Bottom swipe-action bar for the discover deck: rewind, pass, super-like,
 * like. All four call real RPCs (record_swipe / rewind_last_swipe) and are
 * disabled while a request is in flight. Rewind shows its padlock whenever
 * `rewindLocked` is true.
 *
 * BOLD & PLAYFUL sticker style: every badge is rendered as one SVG (badge
 * shape + shadow + glyph + sparkles) rather than a colored View, because
 * Super Like is an actual 5-point star badge, not a circle with a star icon
 * inside -- a plain RN View/borderRadius can't produce that shape, so all
 * four are done the same way for consistency. This intentionally drops the
 * old glass-blur look: flat cartoon fills and translucent blur don't read
 * well together, so this is a straight swap, not an addition.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

const OUTLINE = '#17131F';

function RewindBadge() {
  return (
    <Svg width={64} height={76} viewBox="0 0 100 116">
      <Ellipse cx={50} cy={100} rx={32} ry={7.5} fill="#8B7FE8" opacity={0.22} />
      <Circle cx={50} cy={44} r={38} fill="#8B7FE8" stroke={OUTLINE} strokeWidth={3.6} />
      <Path
        d="M57 27 L41 44 L57 61"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={5.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M41 44 h22.5 a17.3 17.3 0 0 1 0 34.6 h-5.2"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={5.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M84 12 l2.6 6 6 2.6 -6 2.6 -2.6 6 -2.6-6-6-2.6 6-2.6z" fill={OUTLINE} />
      <Circle cx={18} cy={72} r={2.2} fill={OUTLINE} />
    </Svg>
  );
}

function PassBadge() {
  return (
    <Svg width={64} height={76} viewBox="0 0 100 116">
      <Ellipse cx={50} cy={100} rx={32} ry={7.5} fill="#F16B75" opacity={0.22} />
      <Circle cx={50} cy={44} r={38} fill="#F16B75" stroke={OUTLINE} strokeWidth={3.6} />
      <Path d="M37 31 L63 57 M63 31 L37 57" stroke="#FFFFFF" strokeWidth={5.6} strokeLinecap="round" />
      <Path d="M84 12 l2.6 5.2 5.2 2.6 -5.2 2.6 -2.6 5.2 -2.6-5.2-5.2-2.6 5.2-2.6z" fill={OUTLINE} />
      <Path d="M14 66 l2.6 5.2 5.2 2.6 -5.2 2.6 -2.6 5.2 -2.6-5.2-5.2-2.6 5.2-2.6z" fill={OUTLINE} />
    </Svg>
  );
}

function SuperLikeBadge() {
  return (
    <Svg width={68} height={76} viewBox="0 0 106 116">
      <Ellipse cx={53} cy={100} rx={34} ry={7.5} fill="#3FBFAE" opacity={0.22} />
      <Path
        d="M53 6 L64 34 L94 36 L70 55 L78.5 84 L53 67 L27.5 84 L36 55 L12 36 L42 34 Z"
        fill="#3FBFAE"
        stroke={OUTLINE}
        strokeWidth={3.9}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <Path
        d="M53 30 L59.2 46.5 L77 47.5 L63 58 L68 75 L53 65 L38 75 L43 58 L29 47.5 L46.8 46.5 Z"
        fill="#FFFFFF"
      />
      <Path d="M94 13 l2.6 5.2 5.2 2.6 -5.2 2.6 -2.6 5.2 -2.6-5.2-5.2-2.6 5.2-2.6z" fill={OUTLINE} />
      <Path d="M12 65 l2.2 4.4 4.4 2.2 -4.4 2.2 -2.2 4.4 -2.2-4.4-4.4-2.2 4.4-2.2z" fill={OUTLINE} />
    </Svg>
  );
}

function LikeBadge() {
  return (
    <Svg width={64} height={76} viewBox="0 0 100 116">
      <Ellipse cx={50} cy={100} rx={32} ry={7.5} fill="#F4B942" opacity={0.22} />
      <Circle cx={50} cy={44} r={38} fill="#F4B942" stroke={OUTLINE} strokeWidth={3.6} />
      <Path
        d="M50 61 l-17-16c-5.5-5.5-5.5-14 0-19.5 5.5-5.5 14-5.5 18 0l-1 0c4-5.5 12.5-5.5 18 0 5.5 5.5 5.5 14 0 19.5z"
        fill="#FFFFFF"
      />
      <Path d="M90 12 l2.6 5.2 5.2 2.6 -5.2 2.6 -2.6 5.2 -2.6-5.2-5.2-2.6 5.2-2.6z" fill={OUTLINE} />
      <Path d="M13 76 l2.6 5.2 5.2 2.6 -5.2 2.6 -2.6 5.2 -2.6-5.2-5.2-2.6 5.2-2.6z" fill={OUTLINE} />
    </Svg>
  );
}

function ActionButton({
  onPress,
  locked,
  badge,
}: {
  onPress?: () => void;
  locked?: boolean;
  badge: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[styles.btnWrap, pressed && styles.btnPressed]}>
          {badge}
          {locked && (
            <View style={styles.lockBadge}>
              <Text style={styles.lockBadgeIcon}>🔒</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

interface DiscoverActionBarProps {
  onPass?: () => void;
  onLike?: () => void;
  onSuperLike?: () => void;
  onRewind?: () => void;
  rewindLocked?: boolean;
  /** True while any request is in flight -- disables all four buttons. */
  disabled?: boolean;
  /** True when there's no current card to act on (deck exhausted) -- disables only pass/like/super-like. */
  swipeDisabled?: boolean;
}

export function DiscoverActionBar({
  onPass,
  onLike,
  onSuperLike,
  onRewind,
  rewindLocked = true,
  disabled,
  swipeDisabled,
}: DiscoverActionBarProps) {
  const swipeBtnDisabled = disabled || swipeDisabled;

  return (
    <View style={styles.bar}>
      <View style={styles.btnColumn}>
        <ActionButton locked={rewindLocked} onPress={disabled ? undefined : onRewind} badge={<RewindBadge />} />
        <Text style={styles.btnLabel}>Rewind</Text>
      </View>

      <View style={styles.btnColumn}>
        <ActionButton onPress={swipeBtnDisabled ? undefined : onPass} badge={<PassBadge />} />
        <Text style={styles.btnLabel}>Pass</Text>
      </View>

      <View style={styles.btnColumn}>
        <ActionButton onPress={swipeBtnDisabled ? undefined : onSuperLike} badge={<SuperLikeBadge />} />
        <Text style={styles.btnLabel}>Super Like</Text>
      </View>

      <View style={styles.btnColumn}>
        <ActionButton onPress={swipeBtnDisabled ? undefined : onLike} badge={<LikeBadge />} />
        <Text style={styles.btnLabel}>Like</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'transparent',
  },
  btnColumn: {
    alignItems: 'center',
    width: 72,
  },
  btnWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.94 }] },
  btnLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: -4,
    textAlign: 'center',
    color: '#f7f6f8',
  },
  lockBadge: {
    position: 'absolute',
    bottom: 14,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2A1B4A',
    borderWidth: 1,
    borderColor: OUTLINE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadgeIcon: { fontSize: 8, color: '#FFFFFF' },
});