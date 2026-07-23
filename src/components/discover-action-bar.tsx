/**
 * DiscoverActionBar
 *
 * Bottom swipe-action bar for the discover deck: rewind, pass, super-like,
 * like. All four call real RPCs (record_swipe / rewind_last_swipe) and are
 * disabled while a request is in flight. Rewind shows its padlock whenever
 * `rewindLocked` is true.
 *
 * Updated with button labels and customized colored gradients to match the
 * exact glassmorphism design from the mockup.
 */
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

function ActionButton({
  onPress,
  locked,
  size,
  btnStyle,
  children,
}: {
  onPress?: () => void;
  locked?: boolean;
  size: number;
  btnStyle?: any;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={[
            styles.btn,
            { width: size, height: size, borderRadius: size / 2 },
            btnStyle,
            pressed && styles.btnPressed,
          ]}
        >
          {children}
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
  isDark?: boolean;
}

export function DiscoverActionBar({
  onPass,
  onLike,
  onSuperLike,
  onRewind,
  rewindLocked = true,
  disabled,
  swipeDisabled,
  isDark = true,
}: DiscoverActionBarProps) {
  const swipeBtnDisabled = disabled || swipeDisabled;

  const C = {
    rewindBg: isDark ? 'rgba(168, 85, 247, 0.22)' : '#FFFFFF',
    rewindBorder: isDark ? '#C084FC' : '#7C3AED',
    rewindText: isDark ? '#D4B8FF' : '#7C3AED',

    passBg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
    passBorder: isDark ? 'rgba(255, 255, 255, 0.35)' : '#4B5563',
    passText: isDark ? '#D1D5DB' : '#374151',

    superLikeBg: isDark ? 'rgba(14, 165, 233, 0.22)' : '#FFFFFF',
    superLikeBorder: isDark ? '#38BDF8' : '#0284C7',
    superLikeText: isDark ? '#7DD3FC' : '#0369A1',

    likeBg: isDark ? 'rgba(244, 63, 94, 0.22)' : '#FFFFFF',
    likeBorder: isDark ? '#FB7185' : '#E11D48',
    likeText: isDark ? '#FDA4AF' : '#BE185D',
  };

  return (
    <View style={styles.bar}>
      {/* Rewind */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={54}
          locked={rewindLocked}
          onPress={disabled ? undefined : onRewind}
          btnStyle={{ backgroundColor: C.rewindBg, borderColor: C.rewindBorder, borderWidth: 2 }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 5 4 12l5 7M4 12h11a5 5 0 0 1 0 10h-1"
              stroke={C.rewindBorder}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: C.rewindText }]}>Rewind</Text>
      </View>

      {/* Pass */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={54}
          onPress={swipeBtnDisabled ? undefined : onPass}
          btnStyle={{ backgroundColor: C.passBg, borderColor: C.passBorder, borderWidth: 2 }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M5 5 19 19M19 5 5 19" stroke={C.passBorder} strokeWidth={2.6} strokeLinecap="round" />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: C.passText }]}>Pass</Text>
      </View>

      {/* Super Like */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={54}
          onPress={swipeBtnDisabled ? undefined : onSuperLike}
          btnStyle={{ backgroundColor: C.superLikeBg, borderColor: C.superLikeBorder, borderWidth: 2 }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2.5 14.9 9l7.1.6-5.4 4.7 1.6 6.9-6.2-3.7-6.2 3.7 1.6-6.9L2 9.6 9.1 9z"
              fill={C.superLikeBorder}
              stroke={C.superLikeBorder}
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: C.superLikeText }]}>Super Like</Text>
      </View>

      {/* Like */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={54}
          onPress={swipeBtnDisabled ? undefined : onLike}
          btnStyle={{ backgroundColor: C.likeBg, borderColor: C.likeBorder, borderWidth: 2 }}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
              fill={C.likeBorder}
            />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: C.likeText }]}>Like</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'transparent',
  },
  btnWrapper: {
    alignItems: 'center',
    width: 68,
  },
  btnLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 4 },
      default: { boxShadow: '0 3px 8px rgba(0,0,0,0.15)' } as any,
    }),
  },
  btnPressed: { opacity: 0.88, transform: [{ scale: 0.94 }] },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2A1B4A',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 92, 168, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadgeIcon: { fontSize: 8, color: '#FFFFFF' },
});
