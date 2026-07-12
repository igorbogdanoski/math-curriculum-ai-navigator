import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCallGeminiProxy = vi.fn();
vi.mock('./core.proxy', () => ({
  callGeminiProxy: (...args: unknown[]) => mockCallGeminiProxy(...args),
}));

const mockMarkDailyQuotaExhausted = vi.fn();
vi.mock('./core.quota', () => ({
  markDailyQuotaExhausted: () => mockMarkDailyQuotaExhausted(),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(async () => ({ exists: () => false })),
  setDoc: vi.fn(async () => {}),
  serverTimestamp: vi.fn(() => 'server-ts'),
}));
vi.mock('../indexedDBService', () => ({
  getAICache: vi.fn(async () => null),
  saveAICache: vi.fn(async () => {}),
}));

import { generateAndParseJSON, getCached, setCached } from './core.json';
import { z } from 'zod';

describe('generateAndParseJSON', () => {
  beforeEach(() => {
    mockCallGeminiProxy.mockReset();
    mockMarkDailyQuotaExhausted.mockReset();
    vi.stubGlobal('navigator', { onLine: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('throws OfflineError immediately when the browser is offline, without calling the proxy', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(generateAndParseJSON([{ text: 'hi' }], {})).rejects.toThrow(/network/i);
    expect(mockCallGeminiProxy).not.toHaveBeenCalled();
  });

  it('sends generationConfig with responseMimeType=application/json nested correctly', async () => {
    mockCallGeminiProxy.mockResolvedValue({ text: '{"ok":true}' });
    await generateAndParseJSON([{ text: 'prompt' }], { type: 'object' });
    const call = mockCallGeminiProxy.mock.calls[0][0];
    expect(call.generationConfig.responseMimeType).toBe('application/json');
    expect(call.generationConfig.temperature).toBe(0.7);
    expect(call.generationConfig.topP).toBe(0.95);
  });

  it('appends the JSON schema hint to the first content part', async () => {
    mockCallGeminiProxy.mockResolvedValue({ text: '{"ok":true}' });
    await generateAndParseJSON([{ text: 'prompt' }], { type: 'object', properties: {} });
    const call = mockCallGeminiProxy.mock.calls[0][0];
    expect(call.contents[0].text).toContain('prompt');
    expect(call.contents[0].text).toContain('Follow this JSON schema exactly');
  });

  it('parses a well-formed JSON response and returns it', async () => {
    mockCallGeminiProxy.mockResolvedValue({ text: '{"title":"Test"}' });
    const result = await generateAndParseJSON<{ title: string }>([{ text: 'x' }], {});
    expect(result.title).toBe('Test');
  });

  it('validates against a provided zod schema and throws AIServiceError on mismatch', async () => {
    mockCallGeminiProxy.mockResolvedValue({ text: '{"title":123}' });
    const schema = z.object({ title: z.string() });
    await expect(
      generateAndParseJSON([{ text: 'x' }], {}, undefined, schema, 0)
    ).rejects.toThrow(/validation failed/i);
  });

  it('recovers a truncated/malformed JSON response and marks it partial', async () => {
    // A response cut off mid-string inside a trailing array element — JSON.parse rejects
    // it outright, but recoverTruncatedJson drops the incomplete element and closes the
    // brackets — regression guard for the truncation-recovery path.
    mockCallGeminiProxy.mockResolvedValue({ text: '{"items":["a","b","unterm' });
    const result = await generateAndParseJSON<{ items?: string[]; _isPartial?: boolean }>([{ text: 'x' }], {});
    expect(result.items).toEqual(['a', 'b']);
    expect(result._isPartial).toBe(true);
  });

  it('throws when the response is empty', async () => {
    mockCallGeminiProxy.mockResolvedValue({ text: '' });
    await expect(generateAndParseJSON([{ text: 'x' }], {}, undefined, undefined, 0)).rejects.toThrow(/empty/i);
  });

  it('retries on a transient (retryable) error and eventually succeeds', async () => {
    mockCallGeminiProxy
      .mockRejectedValueOnce(new Error('503 Service Unavailable'))
      .mockResolvedValueOnce({ text: '{"ok":true}' });
    const result = await generateAndParseJSON<{ ok: boolean }>([{ text: 'x' }], {}, undefined, undefined, 1);
    expect(result.ok).toBe(true);
    expect(mockCallGeminiProxy).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable error (400) and rethrows it immediately', async () => {
    mockCallGeminiProxy.mockRejectedValue(new Error('400 Bad Request: invalid argument'));
    await expect(
      generateAndParseJSON([{ text: 'x' }], {}, undefined, undefined, 2)
    ).rejects.toThrow(/400/);
    expect(mockCallGeminiProxy).toHaveBeenCalledTimes(1);
  });

  it('converts a daily-quota 429 into a RateLimitError and marks the quota exhausted', async () => {
    mockCallGeminiProxy.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED: requests_per_day quota'));
    await expect(
      generateAndParseJSON([{ text: 'x' }], {}, undefined, undefined, 2)
    ).rejects.toThrow(/дневната ai квота/i);
    expect(mockMarkDailyQuotaExhausted).toHaveBeenCalled();
    expect(mockCallGeminiProxy).toHaveBeenCalledTimes(1);
  });

  it('gives up and surfaces the error once retries are exhausted', async () => {
    mockCallGeminiProxy.mockRejectedValue(new Error('503 overloaded'));
    await expect(
      generateAndParseJSON([{ text: 'x' }], {}, undefined, undefined, 0)
    ).rejects.toThrow();
    expect(mockCallGeminiProxy).toHaveBeenCalledTimes(1);
  });

  it('forwards costKey and timeoutMs overrides through to the proxy call', async () => {
    mockCallGeminiProxy.mockResolvedValue({ text: '{"ok":true}' });
    await generateAndParseJSON([{ text: 'x' }], {}, undefined, undefined, 0, false, undefined, undefined, {
      costKey: 'ILLUSTRATION', timeoutMs: 90_000,
    });
    const call = mockCallGeminiProxy.mock.calls[0][0];
    expect(call.costKey).toBe('ILLUSTRATION');
    expect(call.timeoutMs).toBe(90_000);
  });
});

describe('getCached / setCached', () => {
  it('setCached does not throw when the underlying Firestore write fails', async () => {
    await expect(setCached('key', { a: 1 })).resolves.toBeUndefined();
  });

  it('getCached returns null when nothing is cached anywhere', async () => {
    expect(await getCached('missing-key')).toBeNull();
  });
});
