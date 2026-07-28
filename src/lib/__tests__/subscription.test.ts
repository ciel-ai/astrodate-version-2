const mockGetUser = jest.fn();
const mockRpc = jest.fn();

jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import { getCurrentMembership, hasFeature, getBadge, getMembershipOrFree } from '../subscription';
import type { MembershipSummary } from '../subscription';

const AUTHED_USER = { data: { user: { id: 'user-1' } }, error: null };

function membership(overrides: Partial<MembershipSummary> = {}): MembershipSummary {
  return {
    user_id: 'user-1',
    plan_id: 'plan-astro-plus',
    plan_slug: 'astro_plus',
    plan_name: 'Astro+',
    plan_badge: '✦ Astro+',
    features: {},
    status: 'active',
    current_period_end: null,
    is_active: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCurrentMembership', () => {
  it('fails when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getCurrentMembership();
    expect(result).toEqual({ success: false, error: 'User not authenticated' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('fails when the RPC returns an error', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db exploded' } });

    const result = await getCurrentMembership();
    expect(result).toEqual({ success: false, error: 'db exploded' });
  });

  it('returns the membership row on success', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    const row = membership();
    mockRpc.mockResolvedValue({ data: row, error: null });

    const result = await getCurrentMembership();
    expect(result).toEqual({ success: true, data: row });
  });

  it('treats a malformed RPC payload (missing user_id) as no membership rather than throwing', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: { plan_slug: 'astro_plus' }, error: null });

    const result = await getCurrentMembership();
    expect(result).toEqual({ success: true, data: null });
  });

  it('catches unexpected rejections and reports them as a failure instead of throwing', async () => {
    mockGetUser.mockRejectedValue(new Error('network unreachable'));

    const result = await getCurrentMembership();
    expect(result).toEqual({ success: false, error: 'network unreachable' });
  });
});

describe('hasFeature', () => {
  it('returns false when the user has no membership', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(hasFeature('see_who_likes_you')).resolves.toBe(false);
  });

  it('reads a boolean feature flag directly', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: membership({ features: { see_who_likes_you: true } }), error: null });
    await expect(hasFeature('see_who_likes_you')).resolves.toBe(true);
  });

  it('treats a positive numeric quota as truthy and zero as falsy', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: membership({ features: { daily_rewinds: 3 } }), error: null });
    await expect(hasFeature('daily_rewinds')).resolves.toBe(true);

    mockRpc.mockResolvedValue({ data: membership({ features: { daily_rewinds: 0 } }), error: null });
    await expect(hasFeature('daily_rewinds')).resolves.toBe(false);
  });

  it('parses a case-insensitive string flag', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: membership({ features: { high_match_quota: 'TRUE' } }), error: null });
    await expect(hasFeature('high_match_quota')).resolves.toBe(true);

    mockRpc.mockResolvedValue({ data: membership({ features: { high_match_quota: 'false' } }), error: null });
    await expect(hasFeature('high_match_quota')).resolves.toBe(false);
  });

  it('returns false for a feature key that is not present at all', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: membership({ features: {} }), error: null });
    await expect(hasFeature('top_match_of_day')).resolves.toBe(false);
  });
});

describe('getBadge', () => {
  it('returns Free when there is no membership', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(getBadge()).resolves.toBe('Free');
  });

  it('returns the plan badge when one is set', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: membership({ plan_badge: '✦ AstroX' }), error: null });
    await expect(getBadge()).resolves.toBe('✦ AstroX');
  });

  it('falls back to Member when active but the plan has no badge configured', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: membership({ plan_badge: null, is_active: true }), error: null });
    await expect(getBadge()).resolves.toBe('Member');
  });

  it('falls back to Free when inactive and the plan has no badge configured', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: membership({ plan_badge: null, is_active: false }), error: null });
    await expect(getBadge()).resolves.toBe('Free');
  });
});

describe('getMembershipOrFree', () => {
  it('returns the real membership when the lookup succeeds', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    const row = membership();
    mockRpc.mockResolvedValue({ data: row, error: null });

    await expect(getMembershipOrFree()).resolves.toEqual(row);
  });

  it('synthesizes a free membership (tied to the real user id) when the lookup fails', async () => {
    mockGetUser.mockResolvedValue(AUTHED_USER);
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc down' } });

    await expect(getMembershipOrFree()).resolves.toEqual({
      user_id: 'user-1',
      plan_id: null,
      plan_slug: 'free',
      plan_name: 'Free',
      plan_badge: 'Free',
      features: {},
      status: null,
      current_period_end: null,
      is_active: false,
    });
  });

  it('still synthesizes a free membership with an empty user id when there is no authenticated user at all', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getMembershipOrFree();
    expect(result.user_id).toBe('');
    expect(result.plan_slug).toBe('free');
  });
});
