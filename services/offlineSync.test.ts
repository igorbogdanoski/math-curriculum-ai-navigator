import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeBackoffMs,
  isTransientError,
  partitionFlushOutcome,
  flushPendingQuizzes,
  type FlushOutcome,
} from './offlineSync';

// ─── Mock the IDB layer ──────────────────────────────────────────────────────
const mockGetPending = vi.fn();
const mockClearPending = vi.fn();
vi.mock('./indexedDBService', () => ({
  getPendingQuizzes: (...a: unknown[]) => mockGetPending(...a),
  clearPendingQuiz: (...a: unknown[]) => mockClearPending(...a),
}));

beforeEach(() => {
  mockGetPending.mockReset();
  mockClearPending.mockReset();
});

describe('computeBackoffMs', () => {
  it('grows exponentially with attempt', () => {
    const a = computeBackoffMs(0, { random: () => 0.5 });
    const b = computeBackoffMs(2, { random: () => 0.5 });
    expect(b).toBeGreaterThan(a);
  });

  it('is capped by maxMs', () => {
    expect(computeBackoffMs(50, { random: () => 1, maxMs: 1000 })).toBe(1000);
  });

  it('never returns less than baseMs', () => {
    const v = computeBackoffMs(0, { random: () => 0, baseMs: 200 });
    expect(v).toBeGreaterThanOrEqual(200);
  });
});

describe('isTransientError', () => {
  it('treats network errors as transient', () => {
    expect(isTransientError(new Error('Failed to fetch'))).toBe(true);
    expect(isTransientError(new Error('Network unavailable'))).toBe(true);
    expect(isTransientError(new Error('QUIC timeout'))).toBe(true);
    expect(isTransientError(new Error('503 Service Unavailable'))).toBe(true);
  });

  it('treats auth/permission errors as permanent', () => {
    expect(isTransientError(new Error('Permission denied'))).toBe(false);
    expect(isTransientError(new Error('Validation failed'))).toBe(false);
    expect(isTransientError(null)).toBe(false);
  });
});

describe('partitionFlushOutcome', () => {
  it('buckets uploaded / transient / permanent', () => {
    const outcomes: FlushOutcome[] = [
      { id: '1', status: 'uploaded' },
      { id: '2', status: 'transient-fail' },
      { id: '3', status: 'permanent-fail' },
      { id: '4', status: 'uploaded' },
    ];
    const p = partitionFlushOutcome(outcomes);
    expect(p.uploaded).toEqual(['1', '4']);
    expect(p.transientFails).toHaveLength(1);
    expect(p.permanentFails).toHaveLength(1);
  });
});

describe('flushPendingQuizzes', () => {
  const noSleep = () => Promise.resolve();
  const fakeQuiz = { studentName: 'A', percentage: 80, conceptId: 'c1' } as any;

  it('uploads each pending entry and clears it on success', async () => {
    mockGetPending.mockResolvedValue([
      { id: 'q1', quizResult: fakeQuiz, timestamp: 1 },
      { id: 'q2', quizResult: fakeQuiz, timestamp: 2 },
    ]);
    const uploader = vi.fn().mockResolvedValue(undefined);

    const out = await flushPendingQuizzes(uploader, { sleep: noSleep });

    expect(uploader).toHaveBeenCalledTimes(2);
    expect(mockClearPending).toHaveBeenCalledTimes(2);
    expect(out.every(o => o.status === 'uploaded')).toBe(true);
  });

  it('retries on transient error then succeeds', async () => {
    mockGetPending.mockResolvedValue([{ id: 'q1', quizResult: fakeQuiz, timestamp: 1 }]);
    const uploader = vi.fn()
      .mockRejectedValueOnce(new Error('Failed to fetch'))
      .mockResolvedValueOnce(undefined);

    const out = await flushPendingQuizzes(uploader, { sleep: noSleep, random: () => 0 });

    expect(uploader).toHaveBeenCalledTimes(2);
    expect(out[0].status).toBe('uploaded');
    expect(mockClearPending).toHaveBeenCalledWith('q1');
  });

  it('marks permanent failure without clearing', async () => {
    mockGetPending.mockResolvedValue([{ id: 'q1', quizResult: fakeQuiz, timestamp: 1 }]);
    const uploader = vi.fn().mockRejectedValue(new Error('Permission denied'));

    const out = await flushPendingQuizzes(uploader, { sleep: noSleep });

    expect(uploader).toHaveBeenCalledTimes(1);
    expect(mockClearPending).not.toHaveBeenCalled();
    expect(out[0].status).toBe('permanent-fail');
  });

  it('gives up after maxAttempts on persistent transient errors', async () => {
    mockGetPending.mockResolvedValue([{ id: 'q1', quizResult: fakeQuiz, timestamp: 1 }]);
    const uploader = vi.fn().mockRejectedValue(new Error('Network unavailable'));

    const out = await flushPendingQuizzes(uploader, {
      sleep: noSleep, random: () => 0, maxAttempts: 3,
    });

    expect(uploader).toHaveBeenCalledTimes(3);
    expect(mockClearPending).not.toHaveBeenCalled();
    expect(out[0].status).toBe('transient-fail');
  });

  it('returns empty list when queue is empty', async () => {
    mockGetPending.mockResolvedValue([]);
    const uploader = vi.fn();

    const out = await flushPendingQuizzes(uploader, { sleep: noSleep });
    expect(out).toEqual([]);
    expect(uploader).not.toHaveBeenCalled();
  });
});
