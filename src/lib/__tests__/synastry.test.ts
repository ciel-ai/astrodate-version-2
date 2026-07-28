const mockGetUser = jest.fn();
const mockMaybeSingle = jest.fn();

// synastry_cache_details is queried through a chained
// .from().select().eq().eq().maybeSingle() builder -- each link just needs
// to return `this` (or a further chainable stub) until the terminal call.
const mockEq2 = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEq1 = jest.fn(() => ({ eq: mockEq2 }));
const mockSelect = jest.fn(() => ({ eq: mockEq1 }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));

// jest.mock's factory is hoisted above these `const mock*` declarations (and
// runs as soon as `../synastry` is first required), so it must not reference
// mockGetUser/mockFrom directly -- only close over them inside a function
// that isn't invoked until a test actually calls getSynastryDetail(), by
// which point the real declarations below have run.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  },
}));

import { getSynastryDetail } from '../synastry';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getSynastryDetail', () => {
  it('returns null without querying when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(getSynastryDetail('other-user')).resolves.toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns null when the cache row does not exist yet (synastry not computed)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getSynastryDetail('other-user')).resolves.toBeNull();
  });

  it('returns null when the query errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });

    await expect(getSynastryDetail('other-user')).resolves.toBeNull();
  });

  it('orders the pair (user_a_id, user_b_id) lexicographically regardless of who is "me"', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'zzz-me' } } });
    mockMaybeSingle.mockResolvedValue({
      data: { ashtakoota_score: 28, ashtakoota_detail: {}, badges: '[]' },
      error: null,
    });

    await getSynastryDetail('aaa-other');

    // 'aaa-other' sorts before 'zzz-me', so it must land in user_a_id.
    expect(mockEq1).toHaveBeenCalledWith('user_a_id', 'aaa-other');
    expect(mockEq2).toHaveBeenCalledWith('user_b_id', 'zzz-me');
  });

  it('parses badges stored as a JSON-stringified array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValue({
      data: { ashtakoota_score: 24, ashtakoota_detail: {}, badges: '["Strong Nadi", "Guna Match"]' },
      error: null,
    });

    const result = await getSynastryDetail('other-user');
    expect(result?.badges).toEqual(['Strong Nadi', 'Guna Match']);
  });

  it('accepts badges already stored as a native array', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValue({
      data: { ashtakoota_score: 24, ashtakoota_detail: {}, badges: ['Strong Nadi'] },
      error: null,
    });

    const result = await getSynastryDetail('other-user');
    expect(result?.badges).toEqual(['Strong Nadi']);
  });

  it('degrades to an empty badge list instead of throwing on malformed JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValue({
      data: { ashtakoota_score: 24, ashtakoota_detail: {}, badges: '{not valid json' },
      error: null,
    });

    const result = await getSynastryDetail('other-user');
    expect(result?.badges).toEqual([]);
  });

  it('drops non-string entries out of a badges array instead of passing them through', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    mockMaybeSingle.mockResolvedValue({
      data: { ashtakoota_score: 24, ashtakoota_detail: {}, badges: ['Strong Nadi', 42, null] },
      error: null,
    });

    const result = await getSynastryDetail('other-user');
    expect(result?.badges).toEqual(['Strong Nadi']);
  });

  it('passes through the ashtakoota score and detail unchanged', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'me' } } });
    const detail = { varna: { total_points: 1, received_points: 1 } };
    mockMaybeSingle.mockResolvedValue({
      data: { ashtakoota_score: 32, ashtakoota_detail: detail, badges: '[]' },
      error: null,
    });

    const result = await getSynastryDetail('other-user');
    expect(result).toEqual({ ashtakoota_score: 32, ashtakoota_detail: detail, badges: [] });
  });
});
