import { getScoreTier } from '../score-tier';

describe('getScoreTier', () => {
  // These cutoffs must mirror get_discover_deck's server-side CASE exactly
  // (High >= 80, Medium >= 50, Low otherwise) -- a past bug used different
  // client-side cutoffs (86/66/41), so a card the backend already counted
  // as "high" could render a lower label. Pin the boundaries explicitly so
  // that regression can't silently come back.
  it('labels a score of exactly 80 as EXCELLENT (boundary is inclusive)', () => {
    expect(getScoreTier(80)).toEqual({ label: 'EXCELLENT', color: '#14B8A6' });
  });

  it('labels a score of 79 as GOOD, not EXCELLENT', () => {
    expect(getScoreTier(79)).toEqual({ label: 'GOOD', color: '#F59E0B' });
  });

  it('labels a score of exactly 50 as GOOD (boundary is inclusive)', () => {
    expect(getScoreTier(50)).toEqual({ label: 'GOOD', color: '#F59E0B' });
  });

  it('labels a score of 49 as LOW, not GOOD', () => {
    expect(getScoreTier(49)).toEqual({ label: 'LOW', color: '#EF4444' });
  });

  it('labels a score of 0 as LOW', () => {
    expect(getScoreTier(0)).toEqual({ label: 'LOW', color: '#EF4444' });
  });

  it('labels a perfect score of 100 as EXCELLENT', () => {
    expect(getScoreTier(100)).toEqual({ label: 'EXCELLENT', color: '#14B8A6' });
  });

  it('falls back to the lowest tier for an out-of-range negative score rather than throwing', () => {
    expect(getScoreTier(-5)).toEqual({ label: 'LOW', color: '#EF4444' });
  });
});
