/**
 * Unit tests for AI1 Vector RAG — ragService refactor.
 * Tests pure functions only; Firestore and embed API are not called.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cosineSimilarity, SIMILARITY_THRESHOLD, CACHE_KEY, CACHE_TTL_MS } from '../services/ragService';

// ── cosineSimilarity ──────────────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1.0 for identical non-zero vectors', () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.0 for orthogonal vectors', () => {
    const v1 = [1, 0, 0];
    const v2 = [0, 1, 0];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0, 5);
  });

  it('returns close to 1 for nearly identical vectors', () => {
    const base = new Array(768).fill(0).map((_, i) => Math.sin(i));
    const near = base.map(x => x + (Math.random() - 0.5) * 0.01);
    expect(cosineSimilarity(base, near)).toBeGreaterThan(0.9);
  });

  it('returns 0 for zero vectors', () => {
    const zero = new Array(4).fill(0);
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(zero, v)).toBe(0);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for mismatched lengths (safety guard)', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('handles negative values correctly', () => {
    const v1 = [1, -1];
    const v2 = [-1, 1];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0, 5);
  });
});

// ── Feature flag (VITE_ENABLE_VECTOR_RAG) ────────────────────────────────────

describe('SIMILARITY_THRESHOLD', () => {
  it('is set to 0.7', () => {
    expect(SIMILARITY_THRESHOLD).toBe(0.7);
  });
});

describe('CACHE constants', () => {
  it('CACHE_KEY is a non-empty string', () => {
    expect(typeof CACHE_KEY).toBe('string');
    expect(CACHE_KEY.length).toBeGreaterThan(0);
  });

  it('CACHE_TTL_MS is 30 minutes', () => {
    expect(CACHE_TTL_MS).toBe(30 * 60 * 1000);
  });
});

// ── Cosine similarity applied to retrieval logic ──────────────────────────────

describe('retrieval ranking logic', () => {
  it('higher cosine score means closer semantic match', () => {
    const queryVec = [1, 0, 0, 0];
    const closeVec  = [0.99, 0.14, 0, 0];
    const farVec    = [0, 0, 1, 0];

    const scoreClose = cosineSimilarity(queryVec, closeVec);
    const scoreFar   = cosineSimilarity(queryVec, farVec);

    expect(scoreClose).toBeGreaterThan(scoreFar);
    expect(scoreClose).toBeGreaterThan(SIMILARITY_THRESHOLD);
    expect(scoreFar).toBeLessThan(SIMILARITY_THRESHOLD);
  });

  it('filters below threshold — only items above 0.7 pass', () => {
    const query = [1, 0, 0];
    const candidates = [
      { id: 'c1', vec: [1, 0, 0] },         // similarity ≈ 1.0 → pass
      { id: 'c2', vec: [0.5, 0.866, 0] },   // similarity ≈ 0.5 → filtered
      { id: 'c3', vec: [0.8, 0.6, 0] },     // similarity ≈ 0.8 → pass
    ];

    const results = candidates
      .map(c => ({ id: c.id, similarity: cosineSimilarity(query, c.vec) }))
      .filter(r => r.similarity > SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('c1');
    expect(results[1].id).toBe('c3');
  });
});
