const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: [string, unknown?]) => mockRpc(...args) },
}));

import { getWhoLikedMe, getMySentLikes, spendFreeReveal, likeBack, markLikesSeen } from '../likes';

beforeEach(() => {
  jest.clearAllMocks();
});

// Same shape as discover.ts: reveal eligibility, free-reveal accounting and
// paywall bypass prevention are all enforced server-side in the RPCs. What's
// worth pinning here is each function's error-shape contract, since it's
// not identical across all of them (see spendFreeReveal below).

describe('getWhoLikedMe', () => {
  it('returns the payload unchanged on success', async () => {
    const payload = { is_paid: false, plan_slug: 'free', count: 2, unseen_count: 1, likes: [] };
    mockRpc.mockResolvedValue({ data: payload, error: null });
    await expect(getWhoLikedMe()).resolves.toEqual(payload);
  });

  it('returns null on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    await expect(getWhoLikedMe()).resolves.toBeNull();
  });
});

describe('getMySentLikes', () => {
  it('unwraps the .likes array from the RPC envelope', async () => {
    const likes = [{ user_id: 'user-2', action_type: 'like' }];
    mockRpc.mockResolvedValue({ data: { likes }, error: null });
    await expect(getMySentLikes()).resolves.toEqual(likes);
  });

  it('returns an empty array rather than null/undefined when data has no .likes', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(getMySentLikes()).resolves.toEqual([]);
  });
});

describe('spendFreeReveal', () => {
  it('returns success on a successful reveal', async () => {
    mockRpc.mockResolvedValue({ data: { success: true }, error: null });
    await expect(spendFreeReveal('user-2')).resolves.toEqual({ success: true });
  });

  it('returns {success:false, reason} -- NOT null -- on an RPC error, unlike most other functions in this file', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'reveal already used' } });
    await expect(spendFreeReveal('user-2')).resolves.toEqual({
      success: false,
      reason: 'reveal already used',
    });
  });

  it('returns null (not {success:false}) on a thrown exception', async () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    await expect(spendFreeReveal('user-2')).resolves.toBeNull();
  });
});

describe('likeBack', () => {
  it('returns the match details on a mutual match', async () => {
    const result = {
      success: true,
      matched: true,
      match_id: 'match-1',
      channel_id: 'chan-1',
      liker_user_id: 'user-2',
    };
    mockRpc.mockResolvedValue({ data: result, error: null });
    await expect(likeBack('user-2')).resolves.toEqual(result);
  });

  it('surfaces a "locked" rejection so the caller opens the paywall instead of retrying', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, reason: 'locked' }, error: null });
    await expect(likeBack('user-2')).resolves.toEqual({ success: false, reason: 'locked' });
  });

  it('returns null on an RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    await expect(likeBack('user-2')).resolves.toBeNull();
  });
});

describe('markLikesSeen', () => {
  it('returns true on success and false on error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(markLikesSeen()).resolves.toBe(true);

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'db down' } });
    await expect(markLikesSeen()).resolves.toBe(false);
  });
});
