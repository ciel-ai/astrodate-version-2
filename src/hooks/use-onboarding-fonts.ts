import { useFonts } from 'expo-font';

/** Shared serif font used across the onboarding wizard's screens (name kept
 * internal since nothing currently applies it as a fontFamily -- only the
 * useFonts registration itself is duplicated across screens). */
const SERIF = 'Baskerville-Old-Face';

/** Loads the onboarding wizard's font and returns whether it's ready. */
export function useOnboardingFonts(): boolean {
  const [fontsLoaded] = useFonts({
    [SERIF]: require('@/assets/fonts/LibreBaskerville-Regular.ttf'),
  });
  return fontsLoaded;
}
