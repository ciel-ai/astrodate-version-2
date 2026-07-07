/**
 * Shared color palette for the Daily Insights feature's components.
 * Derived from values already used elsewhere in the app rather than invented:
 * accent/screenBg match the tab bar's active-tint/background colors
 * (src/app/(tabs)/_layout.tsx), card surfaces match discover-card.tsx's
 * convention, and light-mode text colors match settings.tsx.
 */
export type InsightsPalette = ReturnType<typeof getInsightsPalette>;

export function getInsightsPalette(theme: 'light' | 'dark') {
  const isDark = theme === 'dark';
  return {
    screenBg: isDark ? '#0A051B' : '#F9F9FB',
    cardBg: isDark ? 'rgba(20, 12, 40, 0.55)' : '#FFFFFF',
    cardBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.12)',
    textPrimary: isDark ? '#FFFFFF' : '#1B1528',
    textSecondary: isDark ? '#B0A8C4' : '#6B7280',
    accent: isDark ? '#C4A0FF' : '#7C3AED',
    accentSoft: isDark ? 'rgba(196,160,255,0.16)' : 'rgba(124,58,237,0.10)',
    chipBg: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.08)',
    shadowColor: '#6A3FE0',
  };
}
