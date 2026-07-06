import { describe, it, expect, vi } from 'vitest';
import { estimatePercentileFromHistogram, fetchAiFleetLatency } from './slo-summary';

describe('estimatePercentileFromHistogram', () => {
  it('returns null when there are no samples', () => {
    expect(estimatePercentileFromHistogram({}, 0, 50)).toBeNull();
  });

  it('estimates p50 within the bucket containing the median rank', () => {
    // 10 samples, all in bucket_0_500 → p50 must resolve to that bucket's upper bound
    const buckets = { bucket_0_500: 10 };
    expect(estimatePercentileFromHistogram(buckets, 10, 50)).toBe(500);
  });

  it('estimates p95 in a higher bucket than p50 when the tail is slow', () => {
    const buckets = { bucket_0_500: 90, bucket_8000_16000: 10 };
    const p50 = estimatePercentileFromHistogram(buckets, 100, 50);
    const p95 = estimatePercentileFromHistogram(buckets, 100, 95);
    expect(p50).toBe(500);
    expect(p95).toBe(16000);
  });

  it('falls back to the open-ended bucket for a rank beyond every finite boundary', () => {
    const buckets = { bucket_16000_plus: 5 };
    expect(estimatePercentileFromHistogram(buckets, 5, 95)).toBe(16000);
  });
});

describe('fetchAiFleetLatency — merges hourly histogram docs per route', () => {
  function makeDoc(data: Record<string, unknown>) {
    return { data: () => data };
  }

  it('merges multiple hourly docs for the same route into one aggregate', async () => {
    const db = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            docs: [
              makeDoc({ route: 'gemini-proxy', count: 10, bucket_0_500: 10 }),
              makeDoc({ route: 'gemini-proxy', count: 5, bucket_500_1000: 5 }),
              makeDoc({ route: 'embed-proxy', count: 3, bucket_0_500: 3 }),
            ],
          }),
        })),
      })),
    } as never;

    const result = await fetchAiFleetLatency(db);

    expect(result.available).toBe(true);
    const gemini = result.routes.find(r => r.route === 'gemini-proxy');
    expect(gemini?.count).toBe(15);
    const embed = result.routes.find(r => r.route === 'embed-proxy');
    expect(embed?.count).toBe(3);
  });

  it('returns available=false when the Firestore query throws', async () => {
    const db = {
      collection: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockRejectedValue(new Error('unavailable')),
        })),
      })),
    } as never;

    const result = await fetchAiFleetLatency(db);
    expect(result.available).toBe(false);
    expect(result.routes).toEqual([]);
  });
});
