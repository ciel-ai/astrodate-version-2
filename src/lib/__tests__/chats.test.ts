const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockGetUser = jest.fn();
const mockFunctionsInvoke = jest.fn();
const mockStorageFrom = jest.fn();

// jest.mock's factory is hoisted above these `const mock*` declarations, so
// it must only close over them lazily (never reference them directly at the
// top level) -- see the same note in synastry.test.ts.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: [string, unknown?]) => mockRpc(...args),
    from: (table: string) => mockFrom(table),
    auth: { getUser: () => mockGetUser() },
    functions: { invoke: (...args: [string, unknown?]) => mockFunctionsInvoke(...args) },
    storage: { from: (bucket: string) => mockStorageFrom(bucket) },
  },
}));

import {
  formatRelativeTime,
  getConversations,
  getMessages,
  sendMessage,
  sendMediaMessage,
  markThreadRead,
  blockAndLeave,
  reportUser,
} from '../chats';

// A minimal stand-in for supabase-js's PostgrestFilterBuilder: every
// filter/order method just returns `this` for chaining, and the builder
// itself is thenable (matching real query builders, which resolve when
// awaited directly rather than through a terminal call like .single()).
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    or: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    update: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  return builder;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-07-28T12:00:00.000Z').getTime();

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows "now" for anything under a minute old', () => {
    expect(formatRelativeTime(new Date(NOW - 30_000).toISOString())).toBe('now');
  });

  it('shows minutes for under an hour', () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000).toISOString())).toBe('5m');
  });

  it('shows hours for under a day', () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 60 * 60_000).toISOString())).toBe('3h');
  });

  it('shows "Yesterday" for exactly one day ago', () => {
    expect(formatRelativeTime(new Date(NOW - 24 * 60 * 60_000).toISOString())).toBe('Yesterday');
  });

  it('shows a weekday name for 2-6 days ago', () => {
    const result = formatRelativeTime(new Date(NOW - 3 * 24 * 60 * 60_000).toISOString());
    expect(result).not.toBe('Yesterday');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/^\d/); // a weekday name, not a numeric date
  });

  it('shows a numeric date for 7+ days ago', () => {
    const result = formatRelativeTime(new Date(NOW - 10 * 24 * 60 * 60_000).toISOString());
    expect(result).toMatch(/\d+\/\d+/);
  });

  it('never shows a negative age for a timestamp slightly in the future (clock skew)', () => {
    expect(formatRelativeTime(new Date(NOW + 5_000).toISOString())).toBe('now');
  });
});

describe('getConversations', () => {
  it('returns the conversation list on success', async () => {
    mockRpc.mockResolvedValue({ data: [{ channel_id: 'c1' }], error: null });
    await expect(getConversations()).resolves.toEqual([{ channel_id: 'c1' }]);
  });

  it('returns an empty array when the RPC returns null data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await expect(getConversations()).resolves.toEqual([]);
  });

  it('returns null (not throw) when the RPC errors', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    await expect(getConversations()).resolves.toBeNull();
  });

  it('returns null when the call rejects outright', async () => {
    mockRpc.mockRejectedValue(new Error('network unreachable'));
    await expect(getConversations()).resolves.toBeNull();
  });
});

describe('getMessages', () => {
  it('applies no cursor on the first page', async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await getMessages('channel-1');

    expect(builder.eq).toHaveBeenCalledWith('channel_id', 'channel-1');
    expect(builder.lt).not.toHaveBeenCalled();
    expect(builder.or).not.toHaveBeenCalled();
  });

  it('applies a plain lt cursor when only `before` is given', async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await getMessages('channel-1', '2026-01-01T00:00:00Z');

    expect(builder.lt).toHaveBeenCalledWith('created_at', '2026-01-01T00:00:00Z');
    expect(builder.or).not.toHaveBeenCalled();
  });

  it('applies the compound tiebreaker filter when both `before` and `beforeId` are given', async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    await getMessages('channel-1', '2026-01-01T00:00:00Z', 'msg-42');

    expect(builder.or).toHaveBeenCalledWith(
      'created_at.lt.2026-01-01T00:00:00Z,and(created_at.eq.2026-01-01T00:00:00Z,id.lt.msg-42)'
    );
    expect(builder.lt).not.toHaveBeenCalled();
  });

  it('returns the page of messages on success', async () => {
    const rows = [{ id: 'm1' }, { id: 'm2' }];
    mockFrom.mockReturnValue(makeQueryBuilder({ data: rows, error: null }));
    await expect(getMessages('channel-1')).resolves.toEqual(rows);
  });

  it('returns null on a query error', async () => {
    mockFrom.mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'timeout' } }));
    await expect(getMessages('channel-1')).resolves.toBeNull();
  });
});

describe('sendMessage', () => {
  it('returns the moderation status on success', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: { success: true, moderationStatus: 'SAFE' }, error: null });

    await expect(sendMessage('id-1', 'chan-1', 'user-2', 'hey there')).resolves.toEqual({
      success: true,
      moderationStatus: 'SAFE',
    });
  });

  it('surfaces a blocked message instead of silently dropping it', async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: { success: false, blocked: true, reason: 'Message violates guidelines' },
      error: null,
    });

    await expect(sendMessage('id-1', 'chan-1', 'user-2', 'bad text')).resolves.toEqual({
      success: false,
      blocked: true,
      reason: 'Message violates guidelines',
    });
  });

  it('treats an invoke-level error as unblocked (infra failure, not a moderation decision)', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: { message: 'function crashed' } });

    await expect(sendMessage('id-1', 'chan-1', 'user-2', 'hey')).resolves.toEqual({
      success: false,
      blocked: false,
      reason: 'function crashed',
    });
  });

  it('handles a missing response body without throwing', async () => {
    mockFunctionsInvoke.mockResolvedValue({ data: null, error: null });
    await expect(sendMessage('id-1', 'chan-1', 'user-2', 'hey')).resolves.toEqual({
      success: false,
      blocked: false,
      reason: 'No response from server',
    });
  });

  it('catches a thrown exception and reports it as an unblocked failure', async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error('offline'));
    await expect(sendMessage('id-1', 'chan-1', 'user-2', 'hey')).resolves.toEqual({
      success: false,
      blocked: false,
      reason: 'offline',
    });
  });
});

describe('sendMediaMessage', () => {
  function makeStorageBucket(overrides: Partial<{ uploadError: { message: string } | null }> = {}) {
    return {
      upload: jest.fn().mockResolvedValue({ error: overrides.uploadError ?? null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/file.jpg' } }),
      remove: jest.fn().mockResolvedValue({ error: null }),
    };
  }

  const media = { kind: 'image' as const, bytes: new ArrayBuffer(4), ext: 'jpg', contentType: 'image/jpeg' };

  it('fails fast when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(sendMediaMessage('id-1', 'chan-1', 'user-2', media)).resolves.toEqual({
      success: false,
      reason: 'Not authenticated',
    });
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });

  it('uploads, inserts the row, and returns the public URL on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const bucket = makeStorageBucket();
    mockStorageFrom.mockReturnValue(bucket);
    mockFrom.mockReturnValue(makeQueryBuilder({ data: {}, error: null }));

    const result = await sendMediaMessage('id-1', 'chan-1', 'user-2', media);

    expect(result).toEqual({ success: true, mediaUrl: 'https://cdn.example.com/file.jpg' });
    expect(bucket.upload).toHaveBeenCalledWith('user-1/id-1.jpg', media.bytes, { contentType: 'image/jpeg' });
    expect(bucket.remove).not.toHaveBeenCalled();
  });

  it('stops before inserting when the upload itself fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const bucket = makeStorageBucket({ uploadError: { message: 'storage quota exceeded' } });
    mockStorageFrom.mockReturnValue(bucket);

    const result = await sendMediaMessage('id-1', 'chan-1', 'user-2', media);

    expect(result).toEqual({ success: false, reason: 'storage quota exceeded' });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('removes the orphaned storage object when the row insert fails after a successful upload', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const bucket = makeStorageBucket();
    mockStorageFrom.mockReturnValue(bucket);
    mockFrom.mockReturnValue(makeQueryBuilder({ data: null, error: { message: 'insert failed' } }));

    const result = await sendMediaMessage('id-1', 'chan-1', 'user-2', media);

    expect(result).toEqual({ success: false, reason: 'insert failed' });
    expect(bucket.remove).toHaveBeenCalledWith(['user-1/id-1.jpg']);
  });
});

describe('markThreadRead', () => {
  it('returns false without a query when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(markThreadRead('chan-1')).resolves.toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('returns true on a successful update', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockFrom.mockReturnValue(makeQueryBuilder({ data: null, error: null }));
    await expect(markThreadRead('chan-1')).resolves.toBe(true);
  });
});

describe('blockAndLeave', () => {
  it('returns true on success and false on RPC error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(blockAndLeave('user-2')).resolves.toBe(true);

    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'already blocked' } });
    await expect(blockAndLeave('user-2')).resolves.toBe(false);
  });
});

describe('reportUser', () => {
  it('returns false without inserting when there is no authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(reportUser('user-2', 'chan-1', 'harassment')).resolves.toBe(false);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('inserts the report and returns true on success', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    const builder = makeQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await expect(reportUser('user-2', 'chan-1', 'harassment', 'unwanted advances')).resolves.toBe(true);
    expect(builder.insert).toHaveBeenCalledWith({
      reporter_id: 'user-1',
      reported_user_id: 'user-2',
      channel_id: 'chan-1',
      category: 'harassment',
      subcategory: 'unwanted advances',
    });
  });
});
