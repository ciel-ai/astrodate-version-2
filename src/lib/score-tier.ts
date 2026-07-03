export interface ScoreTier {
  label: string;
  color: string;
}

// Suggested cutoffs for the blended score (45% Western + 45% Vedic + 10%
// personality) — tune once real score distributions come in.
const TIERS: Array<{ min: number; label: string; color: string }> = [
  { min: 86, label: 'EXCELLENT', color: '#14B8A6' },
  { min: 66, label: 'GOOD', color: '#22C55E' },
  { min: 41, label: 'OKAY', color: '#F59E0B' },
  { min: 0, label: 'LOW', color: '#EF4444' },
];

export function getScoreTier(score: number): ScoreTier {
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return { label: tier.label, color: tier.color };
}
