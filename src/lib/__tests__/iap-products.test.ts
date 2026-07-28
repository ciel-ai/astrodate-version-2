import { matchesProductId } from '../iap-products';

describe('matchesProductId', () => {
  it('matches the bare product id (iOS shape -- no base plans)', () => {
    expect(matchesProductId('astro_plus_monthly', 'astro_plus_monthly')).toBe(true);
  });

  it('matches Android\'s "productId:basePlanId" shape', () => {
    expect(matchesProductId('astro_plus_monthly:monthly', 'astro_plus_monthly')).toBe(true);
  });

  it('does not match a different product entirely', () => {
    expect(matchesProductId('astro_x_monthly', 'astro_plus_monthly')).toBe(false);
  });

  it('does not match on a bare prefix without the ":" separator (avoids astro_plus_monthly_extra false-matching astro_plus_monthly)', () => {
    expect(matchesProductId('astro_plus_monthly_extra', 'astro_plus_monthly')).toBe(false);
  });
});
