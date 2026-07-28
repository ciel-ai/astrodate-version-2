const mockRpc = jest.fn();

// See synastry.test.ts / chats.test.ts for why this can't reference mockRpc
// directly: jest.mock's factory is hoisted above the `const mockRpc` line.
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: [string, unknown?]) => mockRpc(...args) },
}));

import { getDiscoverDeck, recordSwipe, getRewindsRemaining, rewindLastSwipe } from '../discover';

beforeEach(() => {
  jest.clearAllMocks();
});

// discover.ts is intentionally thin: get_discover_deck / record_swipe /
// rewind_last_swipe enforce all real business rules (quota composition,
// cold-start fallback, anti-reroll state) server-side in Postgres -- this
// file just calls the RPC and passes the shape through. That logic belongs
// under pgTAP/SQL tests against the migrations, not here; what's worth
// pinning on the JS side is the null-vs-{success:false} distinction each
// function promises its caller, since screens branch on that difference.

describe('getDiscoverDeck', () => {
  it('returns the deck payload unchanged on success', async () => {
    const deck = { tier: 'astro_plus', cards: [], meta: { deck_size: 0 } };
    mockRpc.mockResolvedValue({ data: deck, error: null });
    await expect(getDiscoverDeck()).resolves.toEqual(deck);
  });

  it('returns null (not a rejection) on an RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'deck build failed' } });
    await expect(getDiscoverDeck()).resolves.toBeNull();
  });

  it('returns null on a thrown exception', async () => {
    mockRpc.mockRejectedValue(new Error('offline'));
    await expect(getDiscoverDeck()).resolves.toBeNull();
  });
});

describe('recordSwipe', () => {
  it('passes the target and action through to record_swipe', async () => {
    mockRpc.mockResolvedValue({
      data: { success: true, action: 'like', matched: false, match_id: null, channel_id: null },
      error: null,
    });

    await recordSwipe('user-2', 'like');
    expect(mockRpc).toHaveBeenCalledWith('record_swipe', { p_target_user_id: 'user-2', p_action: 'like' });
  });

  it('surfaces a mutual match result unchanged', async () => {
    const matchResult = {
      success: true,
      action: 'super_like' as const,
      matched: true,
      match_id: 'match-1',
      channel_id: 'chan-1',
    };
    mockRpc.mockResolvedValue({ data: matchResult, error: null });
    await expect(recordSwipe('user-2', 'super_like')).resolves.toEqual(matchResult);
  });

  it('distinguishes a business rejection (quota hit) from a network failure', async () => {
    mockRpc.mockResolvedValue({ data: { success: false, reason: 'swipe_limit_reached' }, error: null });
    await expect(recordSwipe('user-2', 'like')).resolves.toEqual({
      success: false,
      reason: 'swipe_limit_reached',
    });
  });

  it('returns null (distinct from a {success:false} rejection) on an RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    await expect(recordSwipe('user-2', 'like')).resolves.toBeNull();
  });
});

describe('getRewindsRemaining', () => {
  it('returns the unlimited sentinel value for AstroX unchanged', async () => {
    mockRpc.mockResolvedValue({ data: 999, error: null });
    await expect(getRewindsRemaining('user-1')).resolves.toBe(999);
  });

  it('returns null on error so callers fall back to "locked" rather than assuming 0', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    await expect(getRewindsRemaining('user-1')).resolves.toBeNull();
  });
});

describe('rewindLastSwipe', () => {
  it('returns the restored swipe on success', async () => {
    const result = { success: true, restored_user_id: 'user-2', restored_action: 'pass' };
    mockRpc.mockResolvedValue({ data: result, error: null });
    await expect(rewindLastSwipe()).resolves.toEqual(result);
  });

  it('surfaces each distinct business rejection reason unchanged', async () => {
    for (const reason of ['rewind_not_available', 'rewind_limit_reached', 'nothing_to_rewind', 'already_matched'] as const) {
      mockRpc.mockResolvedValue({ data: { success: false, reason }, error: null });
      await expect(rewindLastSwipe()).resolves.toEqual({ success: false, reason });
    }
  });

  it('returns null on an RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    await expect(rewindLastSwipe()).resolves.toBeNull();
  });
});
