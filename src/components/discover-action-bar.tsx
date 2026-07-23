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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GlassContainer, GlassView } from 'expo-glass-effect';

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
        <GlassView
          glassEffectStyle="regular"
          isInteractive
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
        </GlassView>
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

  return (
    <GlassContainer spacing={16} style={styles.bar}>
      {/* Rewind */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={52}
          locked={rewindLocked}
          onPress={disabled ? undefined : onRewind}
          btnStyle={styles.rewindBtn}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 5 4 12l5 7M4 12h11a5 5 0 0 1 0 10h-1"
              stroke="#B385FF"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: '#B385FF' }]}>Rewind</Text>
      </View>

      {/* Pass */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={52}
          onPress={swipeBtnDisabled ? undefined : onPass}
          btnStyle={[styles.passBtn, !isDark && { backgroundColor: 'rgba(0,0,0,0.05)', borderColor: 'rgba(0,0,0,0.15)' }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M5 5 19 19M19 5 5 19" stroke={isDark ? '#FFFFFF' : '#1B1528'} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Pass</Text>
      </View>

      {/* Super Like */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={52}
          onPress={swipeBtnDisabled ? undefined : onSuperLike}
          btnStyle={styles.superLikeBtn}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 2.5 14.9 9l7.1.6-5.4 4.7 1.6 6.9-6.2-3.7-6.2 3.7 1.6-6.9L2 9.6 9.1 9z"
              fill="#3FC5F0"
              stroke="#3FC5F0"
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: '#3FC5F0' }]}>Super Like</Text>
      </View>

      {/* Like */}
      <View style={styles.btnWrapper}>
        <ActionButton
          size={52}
          onPress={swipeBtnDisabled ? undefined : onLike}
          btnStyle={styles.likeBtn}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
              fill="#E91E63"
            />
          </Svg>
        </ActionButton>
        <Text style={[styles.btnLabel, { color: '#E91E63' }]}>Like</Text>
      </View>
    </GlassContainer>
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
    width: 64,
  },
  btnLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  rewindBtn: {
    backgroundColor: 'rgba(179, 133, 255, 0.12)',
    borderColor: 'rgba(179, 133, 255, 0.35)',
  },
  passBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  superLikeBtn: {
    backgroundColor: 'rgba(63, 197, 240, 0.12)',
    borderColor: 'rgba(63, 197, 240, 0.35)',
  },
  likeBtn: {
    backgroundColor: 'rgba(233, 30, 99, 0.15)',
    borderColor: '#E91E63',
  },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.94 }] },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2A1B4A',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 168, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadgeIcon: { fontSize: 8, color: '#FFFFFF' },
});
