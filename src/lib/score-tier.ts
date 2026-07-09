export interface ScoreTier {
  label: string;
  color: string;
}

// Matches the server's actual band cutoffs exactly (get_discover_deck /
// build plan Section 6: High >= 80, Medium >= 50, Low otherwise) -- these
// used to be different, arbitrary "suggested" cutoffs (86/66/41), which
// meant a card the backend counted as a guaranteed "high" match (score 82,
// say) could render a "GOOD" label instead of anything indicating it was
// the day's top pick. This is the one tier definition used everywhere in
// the app; don't retune it independently of get_discover_deck's CASE.
const TIERS: { min: number; label: string; color: string }[] = [
  { min: 80, label: 'EXCELLENT', color: '#14B8A6' },
  { min: 50, label: 'GOOD', color: '#F59E0B' },
  { min: 0, label: 'LOW', color: '#EF4444' },
];

export function getScoreTier(score: number): ScoreTier {
  const tier = TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
  return { label: tier.label, color: tier.color };
}
