/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView as RNKeyboardAvoidingView } from 'react-native';

let RealController: any = null;
try {
  RealController = require('react-native-keyboard-controller');
} catch {
  // Fall back to built-in components when native modules are not linked (e.g. under Expo Go)
}

// Fallback Provider
export function KeyboardProvider({ children }: { children: React.ReactNode }) {
  if (RealController?.KeyboardProvider) {
    return <RealController.KeyboardProvider>{children}</RealController.KeyboardProvider>;
  }
  return <>{children}</>;
}

// Fallback KeyboardAvoidingView
export function KeyboardAvoidingView(props: any) {
  if (RealController?.KeyboardAvoidingView) {
    return <RealController.KeyboardAvoidingView {...props} />;
  }
  // Fall back to React Native's built-in KeyboardAvoidingView
  const { children, ...rest } = props;
  return <RNKeyboardAvoidingView {...rest}>{children}</RNKeyboardAvoidingView>;
}

// Fallback useKeyboardState hook
export function useKeyboardState(selector?: (state: { isVisible: boolean }) => boolean): any {
  if (RealController?.useKeyboardState) {
    try {
      return RealController.useKeyboardState(selector);
    } catch {
      // If it throws at runtime, fallback
    }
  }

  // React Native built-in keyboard state tracking fallback
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setIsVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setIsVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const state = { isVisible };
  if (selector) {
    return selector(state);
  }
  return state;
}
