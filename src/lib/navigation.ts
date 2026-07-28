import type { Href, ImperativeRouter } from 'expo-router';

// Avoids the "GO_BACK not handled" warning/no-op when a screen has no back history (deep link, cold start).
export function safeBack(router: ImperativeRouter, fallbackHref: Href = '/') {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
