import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/theme-context';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
};

type AlertState = {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
};

const EMPTY_STATE: AlertState = { visible: false, title: '', buttons: [] };

// Module-level so `alert()` can be called from anywhere (screens, libs, deep
// callbacks) without prop-drilling or a hook -- same ergonomics as RN's own
// Alert.alert, which is why every call site across the app can swap to this
// with just an import + rename, not a rewrite. Registered once by
// ThemedAlertHost when it mounts (see _layout.tsx).
let showFn: ((title: string, message?: string, buttons?: AlertButton[]) => void) | null = null;

/** Drop-in replacement for React Native's Alert.alert -- same signature
 *  (title, message?, buttons?), but rendered as a themed in-app modal instead
 *  of the native OS dialog (which can't be restyled at all). Omitting
 *  `buttons` shows a single "OK" dismiss button, matching Alert.alert. */
export function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (!showFn) {
    console.warn('[themed-alert] alert() called before ThemedAlertHost mounted:', title);
    return;
  }
  showFn(title, message, buttons);
}

export function ThemedAlertHost() {
  const { theme } = useAppTheme();
  const isDark = theme === 'dark';
  const [state, setState] = useState<AlertState>(EMPTY_STATE);

  const show = useCallback((title: string, message?: string, buttons?: AlertButton[]) => {
    setState({
      visible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
    });
  }, []);

  // Registering the module-level ref is a side effect, so it belongs in an
  // effect, not render (this app has reactCompiler enabled, which assumes
  // render bodies are pure). `show` is stable (empty useCallback deps), so
  // this only actually runs once, on mount.
  useEffect(() => {
    showFn = show;
  }, [show]);

  const handlePress = (btn: AlertButton) => {
    setState(EMPTY_STATE);
    btn.onPress?.();
  };

  const T = {
    overlay: 'rgba(4, 2, 16, 0.72)',
    card: isDark ? '#150C2E' : '#FFFFFF',
    border: isDark ? 'rgba(168, 85, 247, 0.30)' : 'rgba(168, 85, 247, 0.22)',
    title: isDark ? '#FFFFFF' : '#1B1528',
    message: isDark ? '#B7AFD1' : '#6B7280',
    divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    default: '#A855F7',
    cancel: isDark ? '#B7AFD1' : '#6B7280',
    destructive: '#F87171',
  };

  const buttonTextColor = (style?: AlertButtonStyle) =>
    style === 'destructive' ? T.destructive : style === 'cancel' ? T.cancel : T.default;

  // 3+ buttons stack vertically (action-sheet style, e.g. "Report reason"
  // pickers) -- a horizontal row of that many labels wouldn't fit sensibly.
  const stacked = state.buttons.length > 2;

  return (
    <Modal
      visible={state.visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => handlePress(state.buttons[state.buttons.length - 1])}
    >
      <View style={[styles.overlay, { backgroundColor: T.overlay }]}>
        <View style={[styles.card, { backgroundColor: T.card, borderColor: T.border }]}>
          <Text style={[styles.title, { color: T.title }]}>{state.title}</Text>
          {state.message ? <Text style={[styles.message, { color: T.message }]}>{state.message}</Text> : null}

          <View style={[styles.buttonsWrap, stacked ? styles.buttonsColumn : styles.buttonsRow]}>
            {state.buttons.map((btn, i) => (
              <Pressable
                key={`${btn.text}-${i}`}
                onPress={() => handlePress(btn)}
                style={({ pressed }) => [
                  stacked ? styles.buttonStacked : styles.buttonInline,
                  stacked && i > 0 && { borderTopWidth: 1, borderTopColor: T.divider },
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={btn.text}
              >
                <Text style={[styles.buttonText, { color: buttonTextColor(btn.style) }]}>{btn.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 22,
    paddingHorizontal: 22,
    overflow: 'hidden',
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  buttonsWrap: { marginTop: 20, marginHorizontal: -22 },
  buttonsRow: { flexDirection: 'row-reverse', paddingHorizontal: 10, paddingBottom: 14, gap: 8 },
  buttonsColumn: { flexDirection: 'column' },
  buttonInline: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  buttonStacked: { paddingVertical: 14, alignItems: 'center' },
  buttonPressed: { opacity: 0.6 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
