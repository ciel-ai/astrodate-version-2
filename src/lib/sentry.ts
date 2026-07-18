import * as Sentry from '@sentry/react-native';

// EXPO_PUBLIC_SENTRY_DSN is unset until a Sentry project exists (see
// .env.example) -- Sentry.init() is simply never called in that case, so the
// SDK stays fully inert rather than erroring or sending anywhere.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!dsn) {
    if (__DEV__) console.info('[sentry] EXPO_PUBLIC_SENTRY_DSN not set -- crash reporting disabled');
    return;
  }

  Sentry.init({
    dsn,
    // Traces are for perf monitoring, not crash reporting -- kept low so this
    // stays free-tier friendly. Crash/error capture is unaffected by this.
    tracesSampleRate: 0.2,
    enabled: !__DEV__,
  });
}
