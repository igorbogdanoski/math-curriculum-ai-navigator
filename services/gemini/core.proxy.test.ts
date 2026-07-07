import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeContents } from './core.proxy';

vi.mock('firebase/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('firebase/auth')>()),
  getAuth: vi.fn(() => ({ currentUser: { getIdToken: vi.fn().mockResolvedValue('test-token') } })),
}));

describe('normalizeContents', () => {
  it('returns [] for null/undefined/empty input', () => {
    expect(normalizeContents(null)).toEqual([]);
    expect(normalizeContents(undefined)).toEqual([]);
    expect(normalizeContents('')).toEqual([]);
  });

  it('wraps a plain string as a single user Content', () => {
    expect(normalizeContents('Реши x + 2 = 5')).toEqual([
      { role: 'user', parts: [{ text: 'Реши x + 2 = 5' }] },
    ]);
  });

  it('wraps a non-string, non-array value via String()', () => {
    expect(normalizeContents(42)).toEqual([
      { role: 'user', parts: [{ text: '42' }] },
    ]);
  });

  it('passes through an already-normalized Content[] unchanged', () => {
    const contents = [{ role: 'user', parts: [{ text: 'hi' }] }];
    expect(normalizeContents(contents)).toBe(contents);
  });

  it('wraps a flat array of Part-like text objects into one user Content', () => {
    const result = normalizeContents([{ text: 'a' }, { text: 'b' }]);
    expect(result).toEqual([
      { role: 'user', parts: [{ text: 'a' }, { text: 'b' }] },
    ]);
  });

  it('normalizes inlineData (camelCase) parts', () => {
    const result = normalizeContents([{ inlineData: { mimeType: 'image/png', data: 'abc123' } }]);
    expect(result).toEqual([
      { role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: 'abc123' } }] },
    ]);
  });

  it('normalizes inline_data (snake_case legacy) parts to camelCase', () => {
    const result = normalizeContents([{ inline_data: { mime_type: 'image/png', data: 'abc123' } }]);
    expect(result).toEqual([
      { role: 'user', parts: [{ inlineData: { mimeType: 'image/png', data: 'abc123' } }] },
    ]);
  });

  it('maps a mixed array of raw strings into individual user Contents', () => {
    const result = normalizeContents(['first', 'second']);
    expect(result).toEqual([
      { role: 'user', parts: [{ text: 'first' }] },
      { role: 'user', parts: [{ text: 'second' }] },
    ]);
  });

  it('preserves objects that already have role+parts', () => {
    const item = { role: 'model', parts: [{ text: 'reply' }] };
    const result = normalizeContents([item]);
    expect(result).toEqual([item]);
  });

  it('passes an array through unchanged when its first item already has `.parts` (fast path)', () => {
    // This early-return fast path fires before the per-item mapping logic ever runs —
    // even though the first item here has no `role`, contents[0].parts alone is enough.
    const contents = [{ parts: [{ text: 'x' }] }];
    expect(normalizeContents(contents)).toBe(contents);
  });

  it('wraps a later item that only has `.parts` when the first item does not (per-item mapping path)', () => {
    // contents[0] lacks `.parts`, so the fast path above doesn't apply; contents[0].text
    // also makes isPartsArray false (item 1 has neither text/inlineData), so this falls
    // through to the per-item map — where the `if (c.parts)` branch is reachable.
    const result = normalizeContents([{ text: 'a' }, { parts: [{ text: 'b' }] }]);
    expect(result).toEqual([
      { role: 'user', parts: [{ text: 'a' }] },
      { role: 'user', parts: [{ text: 'b' }] },
    ]);
  });

  it('wraps an object with only `text` as a user Content', () => {
    const result = normalizeContents([{ text: 'plain' }, { role: 'model', parts: [{ text: 'r' }] }]);
    // Mixed shapes fall through to the final per-item mapping branch (not the
    // flat Part-array fast path, since not every item has text/inlineData only).
    expect(result[0]).toEqual({ role: 'user', parts: [{ text: 'plain' }] });
    expect(result[1]).toEqual({ role: 'model', parts: [{ text: 'r' }] });
  });

  it('falls back to JSON-stringifying unrecognized objects', () => {
    const weird = { foo: 'bar' };
    const result = normalizeContents([weird]);
    expect(result).toEqual([{ role: 'user', parts: [{ text: JSON.stringify(weird) }] }]);
  });
});

describe('callGeminiProxy — per-attempt timeout override', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted.');
        err.name = 'AbortError';
        reject(err);
      });
    })));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('honors a custom timeoutMs instead of silently capping every attempt at the default 60s', async () => {
    const { callGeminiProxy } = await import('./core.proxy');
    const call = callGeminiProxy({ model: 'test-model', contents: 'hi', timeoutMs: 90_000 });
    const settled = vi.fn();
    call.then(settled, settled);

    // Past the old hardcoded 60s default — must NOT have aborted yet.
    await vi.advanceTimersByTimeAsync(61_000);
    expect(settled).not.toHaveBeenCalled();

    // Past the custom 90s override — must abort now, with a message reflecting 90s.
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(call).rejects.toThrow(/aborted|90s/i);
  });

  it('still defaults to 60s when no timeoutMs override is given', async () => {
    const { callGeminiProxy } = await import('./core.proxy');
    const call = callGeminiProxy({ model: 'test-model', contents: 'hi' });
    const settled = vi.fn();
    call.then(settled, settled);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    await expect(call).rejects.toThrow();
  });
});
