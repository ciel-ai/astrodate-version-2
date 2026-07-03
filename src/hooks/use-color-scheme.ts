import { useAppTheme } from '@/lib/theme-context';

export function useColorScheme() {
  const { theme } = useAppTheme();
  return theme;
}
