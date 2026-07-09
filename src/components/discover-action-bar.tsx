/**
 * DiscoverActionBar
 *
 * Bottom swipe-action bar for the discover deck: rewind, pass, super-like,
 * like. All four call real RPCs (record_swipe / rewind_last_swipe) and are
 * disabled while a request is in flight so a double-tap can't fire two for
 * one card. Rewind shows its padlock (and routes to the paywall instead of
 * the RPC) whenever `rewindLocked` is true -- Free tier per Section 3, or
 * Astro+/AstroX once today's rewind quota is spent.
 *
 * No Boost button -- deliberately out of scope (visibility-ranking feature
 * that would affect other users' decks, not just this one's own screen; see
 * 20260709140000_discover_rewind.sql's header comment for why that's a
 * materially bigger, separate piece of work).
 *
 * Buttons render as real iOS 26 Liquid Glass (GlassView inside a
 * GlassContainer, which lets nearby glass buttons morph together); on
 * Android/older iOS, GlassView falls back to a plain View styled by the
 * rgba backgrounds below.
 */
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GlassContainer, GlassView } from 'expo-glass-effect';

function ActionButton({
  onPress,
  locked,
  size,
  primary,
  children,
}: {
  onPress?: () => void;
  locked?: boolean;
  size: number;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <GlassView
          glassEffectStyle="regular"
          tintColor={primary ? '#F6B93B' : undefined}
          isInteractive
          style={[
            styles.btn,
            { width: size, height: size, borderRadius: size / 2 },
            primary && styles.btnPrimary,
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
  /** True when there's no current card to act on (deck exhausted, or the
   *  last swipe attempt was rejected for being over quota) -- disables only
   *  pass/like/super-like. Rewind stays independently reachable: it undoes
   *  the database's last swipe regardless of whether a card is on screen,
   *  so a mistaken swipe that emptied the deck (or hit the swipe limit)
   *  must still be fixable from here. */
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
    <GlassContainer spacing={16} style={styles.bar}>
      <ActionButton size={44} locked={rewindLocked} onPress={disabled ? undefined : onRewind}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 5 4 12l5 7M4 12h11a5 5 0 0 1 0 10h-1"
            stroke="#C9A6E8"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </ActionButton>

      <ActionButton size={52} onPress={swipeBtnDisabled ? undefined : onPass}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
          <Path d="M5 5 19 19M19 5 5 19" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
      </ActionButton>

      <ActionButton size={44} onPress={swipeBtnDisabled ? undefined : onSuperLike}>
        <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2.5 14.9 9l7.1.6-5.4 4.7 1.6 6.9-6.2-3.7-6.2 3.7 1.6-6.9L2 9.6 9.1 9z"
            fill="#3FC5F0"
            stroke="#3FC5F0"
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        </Svg>
      </ActionButton>

      <ActionButton size={64} primary onPress={swipeBtnDisabled ? undefined : onLike}>
        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 20.2 4.6 13c-2-2-2-5 0-6.9 2-2 5-2 6.9 0l.5.5.5-.5c2-2 5-2 6.9 0 2 2 2 4.9 0 6.9z"
            fill="#FFFFFF"
          />
        </Svg>
      </ActionButton>
    </GlassContainer>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 12, 40, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnPrimary: {
    backgroundColor: '#F6B93B',
    borderColor: 'rgba(255,255,255,0.3)',
    ...Platform.select({
      ios: { shadowColor: '#F6B93B', shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 8 },
      web: { boxShadow: '0 4px 20px rgba(246,185,59,0.5)' } as any,
    }),
  },
  btnPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2A1B4A',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 168, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadgeIcon: { fontSize: 9 },
});
