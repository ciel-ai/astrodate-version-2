/**
 * Design tokens for the Discover compatibility section — the Western and
 * Vedic cards are deliberately two different visual systems (cool/scientific
 * vs warm/mystical) that both sit on the app's deep-purple background.
 */

export const CompatibilityLayout = {
  height: 112,
  borderRadius: 18,
  padding: 14,
  gap: 12,
} as const;

export const WesternTheme = {
  gradient: ['#0F1533', '#131A45', '#172E61'] as const,
  gradientStart: { x: 0, y: 0 },
  gradientEnd: { x: 1, y: 1 },
  border: 'rgba(74, 127, 255, 0.4)',
  glow: '#4A7FFF',
  kicker: '#8CA9E8',
  score: '#FFFFFF',
  subtitle: '#B3C3FF',
  decor: '#8FB4FF',
  decorStrong: '#DCE8FF',
} as const;

export const VedicTheme = {
  gradient: ['#251036', '#32144B', '#451B64'] as const,
  gradientStart: { x: 0, y: 0 },
  gradientEnd: { x: 1, y: 1 },
  border: 'rgba(216, 179, 106, 0.5)',
  glow: '#D8B36A',
  kicker: '#C9AB78',
  scoreMain: '#F2D9A0',
  scoreMax: '#D3B16A',
  dosha: '#E0B660',
  guna: '#C9AB78',
  decor: '#D8B36A',
  lockBorder: 'rgba(216, 179, 106, 0.35)',
} as const;
