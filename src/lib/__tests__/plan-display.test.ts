import { lightenPlanColor, darkenPlanColor, planCardShadow, PLANS } from '../plan-display';

describe('lightenPlanColor / darkenPlanColor', () => {
  it('leaves the color unchanged at amount=0', () => {
    expect(lightenPlanColor('#A855F7', 0)).toBe('#a855f7');
    expect(darkenPlanColor('#A855F7', 0)).toBe('#a855f7');
  });

  it('blends fully to white at amount=1', () => {
    expect(lightenPlanColor('#A855F7', 1)).toBe('#ffffff');
  });

  it('blends fully to black at amount=1', () => {
    expect(darkenPlanColor('#A855F7', 1)).toBe('#000000');
  });

  it('uses the documented default amounts when none is passed', () => {
    // lightenPlanColor default 0.32, darkenPlanColor default 0.28 -- pin
    // the exact output so a change to those constants is a visible diff,
    // not a silent gradient shift on the plan cards.
    expect(lightenPlanColor('#A855F7')).toBe('#c48bfa');
    expect(darkenPlanColor('#A855F7')).toBe('#793db2');
  });

  it('produces a well-formed 7-char hex string for every seeded plan accent color', () => {
    for (const plan of PLANS) {
      expect(lightenPlanColor(plan.accentColor)).toMatch(/^#[0-9a-f]{6}$/);
      expect(darkenPlanColor(plan.accentColor)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('planCardShadow', () => {
  // react-native's jest preset resolves Platform.select statically from a
  // platform-specific module (Platform.ios.js) at require time -- mutating
  // Platform.OS at runtime does not change which branch it takes. Spying on
  // Platform.select directly is what actually exercises each branch here.
  const Platform = require('react-native').Platform;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds a tinted, colored shadow spec for iOS', () => {
    jest.spyOn(Platform, 'select').mockImplementation((spec: any) => spec.ios);
    expect(planCardShadow('#A855F7')).toEqual({
      shadowColor: '#A855F7',
      shadowOpacity: 0.35,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    });
  });

  it('falls back to plain elevation for Android since elevation cannot be tinted', () => {
    jest.spyOn(Platform, 'select').mockImplementation((spec: any) => spec.android);
    expect(planCardShadow('#A855F7')).toEqual({ elevation: 8 });
  });

  it('builds a CSS box-shadow string for web', () => {
    jest.spyOn(Platform, 'select').mockImplementation((spec: any) => spec.web);
    expect(planCardShadow('#A855F7')).toEqual({ boxShadow: '0 8px 24px #A855F759' });
  });
});

describe('PLANS', () => {
  it('only lists feature bullets for the two real, currently-sold plans', () => {
    const slugs = PLANS.map((p) => p.slug);
    expect(slugs).toEqual(['astro_plus', 'astro_x']);
  });

  it('gives every plan a non-empty feature list and accent color', () => {
    for (const plan of PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
      expect(plan.accentColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
