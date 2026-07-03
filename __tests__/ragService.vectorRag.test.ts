/**
 * Unit tests for AI1 Vector RAG — ragService refactor.
 * Tests pure functions only; Firestore and embed API are not called.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cosineSimilarity,
  SIMILARITY_THRESHOLD,
  CACHE_KEY,
  CACHE_TTL_MS,
  getEffectiveSimilarityThreshold,
  getRagStats,
  _resetRagStatsForTests,
  federatedRank,
  type ScoredEmbedding,
} from '../services/ragService';

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

// ── Phase 2: deduplication logic (concept exclusion) ─────────────────────────

describe('deduplication — current concept excluded from similar results', () => {
  function simulateFilter(
    results: { conceptId: string; context: string; similarity: number }[],
    currentConceptId: string,
    topK: number,
  ) {
    return results.filter(r => r.conceptId !== currentConceptId).slice(0, topK);
  }

  it('removes exact current concept from results', () => {
    const results = [
      { conceptId: 'geom-pitagora', context: 'Питагорова теорема', similarity: 0.99 },
      { conceptId: 'geom-triagolnik', context: 'Триаголници', similarity: 0.85 },
      { conceptId: 'geom-agol', context: 'Агол и мерење', similarity: 0.75 },
    ];
    const filtered = simulateFilter(results, 'geom-pitagora', 4);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(r => r.conceptId !== 'geom-pitagora')).toBe(true);
  });

  it('respects topK=4 slice after exclusion', () => {
    const results = Array.from({ length: 10 }, (_, i) => ({
      conceptId: i === 0 ? 'current' : `other-${i}`,
      context: `Context ${i}`,
      similarity: 1 - i * 0.02,
    }));
    const filtered = simulateFilter(results, 'current', 4);
    expect(filtered).toHaveLength(4);
    expect(filtered[0].conceptId).toBe('other-1');
  });

  it('returns all results if current concept not in list', () => {
    const results = [
      { conceptId: 'a', context: 'A', similarity: 0.9 },
      { conceptId: 'b', context: 'B', similarity: 0.8 },
    ];
    const filtered = simulateFilter(results, 'not-present', 4);
    expect(filtered).toHaveLength(2);
  });
});

// ── Phase 2: vectorRagQuery building ─────────────────────────────────────────

describe('vectorRagQuery construction', () => {
  it('combines topic title with concept titles and descriptions', () => {
    const context = {
      topic: { title: 'Геометрија' },
      concepts: [
        { title: 'Питагорова теорема', description: 'Врска меѓу страните на правоаголен триаголник' },
        { title: 'Тупоаголен триаголник', description: '' },
      ],
    };
    const query = `${context.topic?.title ?? ''} ${context.concepts.map(c => `${c.title} ${c.description ?? ''}`).join(' ')}`.trim();
    expect(query).toContain('Геометрија');
    expect(query).toContain('Питагорова теорема');
    expect(query).toContain('Врска меѓу страните');
    expect(query).not.toMatch(/\s{2,}/); // no double spaces from trim
  });

  it('returns undefined-equivalent empty string when no concepts', () => {
    const context = { topic: { title: 'X' }, concepts: [] };
    const query = context.concepts?.length
      ? `${context.topic?.title ?? ''} ${context.concepts.map((c: { title: string }) => c.title).join(' ')}`.trim()
      : undefined;
    expect(query).toBeUndefined();
  });
});

// ── federatedRank — reserved scenario_bank slots + grade prefilter ───────────

describe('federatedRank', () => {
  function mk(overrides: Partial<ScoredEmbedding>): ScoredEmbedding {
    return { conceptId: 'x', context: 'ctx', similarity: 0.8, ...overrides };
  }

  it('reserves up to 2 slots for scenario_bank even when curriculum dominates by score', () => {
    const curriculum = Array.from({ length: 10 }, (_, i) =>
      mk({ conceptId: `c${i}`, source: 'curriculum', similarity: 0.95 - i * 0.01 }));
    const scenarios = [
      mk({ conceptId: 's1', source: 'scenario_bank', similarity: 0.75 }),
      mk({ conceptId: 's2', source: 'scenario_bank', similarity: 0.72 }),
    ];
    const results = federatedRank([...curriculum, ...scenarios], 5);
    expect(results.filter(r => r.source === 'scenario_bank')).toHaveLength(2);
    expect(results.map(r => r.conceptId)).toEqual(expect.arrayContaining(['s1', 's2']));
  });

  it('fills all slots from curriculum when no scenario_bank hits exist', () => {
    const curriculum = Array.from({ length: 5 }, (_, i) =>
      mk({ conceptId: `c${i}`, source: 'curriculum', similarity: 0.9 - i * 0.01 }));
    const results = federatedRank(curriculum, 5);
    expect(results).toHaveLength(5);
    expect(results.every(r => r.source === 'curriculum')).toBe(true);
  });

  it('takes fewer than 2 scenario slots when only 1 scenario hit is above threshold', () => {
    const curriculum = Array.from({ length: 5 }, (_, i) =>
      mk({ conceptId: `c${i}`, source: 'curriculum', similarity: 0.9 - i * 0.01 }));
    const scenarios = [mk({ conceptId: 's1', source: 'scenario_bank', similarity: 0.8 })];
    const results = federatedRank([...curriculum, ...scenarios], 5);
    expect(results.filter(r => r.source === 'scenario_bank')).toHaveLength(1);
    expect(results).toHaveLength(5);
  });

  it('excludes scenario_bank hits from a different grade when gradeLevel is known', () => {
    const scenarios = [
      mk({ conceptId: 's-g7', source: 'scenario_bank', grade: 7, similarity: 0.85 }),
      mk({ conceptId: 's-g9', source: 'scenario_bank', grade: 9, similarity: 0.9 }),
    ];
    const results = federatedRank(scenarios, 5, 7);
    expect(results.map(r => r.conceptId)).toEqual(['s-g7']);
  });

  it('permits scenario_bank hits with no grade set through the grade filter', () => {
    const scenarios = [mk({ conceptId: 's-nograde', source: 'scenario_bank', grade: null, similarity: 0.85 })];
    const results = federatedRank(scenarios, 5, 7);
    expect(results.map(r => r.conceptId)).toEqual(['s-nograde']);
  });

  it('passes all scenario_bank hits through unfiltered when gradeLevel is not provided', () => {
    const scenarios = [
      mk({ conceptId: 's-g7', source: 'scenario_bank', grade: 7, similarity: 0.85 }),
      mk({ conceptId: 's-g9', source: 'scenario_bank', grade: 9, similarity: 0.9 }),
    ];
    const results = federatedRank(scenarios, 5);
    expect(results).toHaveLength(2);
  });

  it('respects topK smaller than the scenario reserve (topK=1)', () => {
    const scenarios = [
      mk({ conceptId: 's1', source: 'scenario_bank', similarity: 0.9 }),
      mk({ conceptId: 's2', source: 'scenario_bank', similarity: 0.85 }),
    ];
    const results = federatedRank(scenarios, 1);
    expect(results).toHaveLength(1);
    expect(results[0].conceptId).toBe('s1');
  });

  it('returns the merged result sorted by similarity descending', () => {
    const items = [
      mk({ conceptId: 'a', source: 'curriculum', similarity: 0.72 }),
      mk({ conceptId: 'b', source: 'scenario_bank', similarity: 0.95 }),
      mk({ conceptId: 'c', source: 'curriculum', similarity: 0.88 }),
    ];
    const results = federatedRank(items, 5);
    const similarities = results.map(r => r.similarity);
    expect(similarities).toEqual([...similarities].sort((x, y) => y - x));
  });

  it('treats undefined source as non-scenario (curriculum bucket)', () => {
    const items = [mk({ conceptId: 'legacy', source: undefined, similarity: 0.9 })];
    const results = federatedRank(items, 5);
    expect(results).toHaveLength(1);
    expect(results[0].conceptId).toBe('legacy');
  });
});

// ── getEffectiveSimilarityThreshold (localStorage tuning) ────────────────────

describe('getEffectiveSimilarityThreshold', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  it('returns default 0.7 when override not set', () => {
    expect(getEffectiveSimilarityThreshold()).toBe(SIMILARITY_THRESHOLD);
  });

  it('honours a valid in-range override', () => {
    localStorage.setItem('VITE_VECTOR_RAG_THRESHOLD', '0.65');
    expect(getEffectiveSimilarityThreshold()).toBe(0.65);
  });

  it('falls back when override is not a number', () => {
    localStorage.setItem('VITE_VECTOR_RAG_THRESHOLD', 'abc');
    expect(getEffectiveSimilarityThreshold()).toBe(SIMILARITY_THRESHOLD);
  });

  it('falls back when override is negative', () => {
    localStorage.setItem('VITE_VECTOR_RAG_THRESHOLD', '-0.1');
    expect(getEffectiveSimilarityThreshold()).toBe(SIMILARITY_THRESHOLD);
  });

  it('falls back when override exceeds 1', () => {
    localStorage.setItem('VITE_VECTOR_RAG_THRESHOLD', '1.5');
    expect(getEffectiveSimilarityThreshold()).toBe(SIMILARITY_THRESHOLD);
  });

  it('accepts boundary value 0', () => {
    localStorage.setItem('VITE_VECTOR_RAG_THRESHOLD', '0');
    expect(getEffectiveSimilarityThreshold()).toBe(0);
  });

  it('accepts boundary value 1', () => {
    localStorage.setItem('VITE_VECTOR_RAG_THRESHOLD', '1');
    expect(getEffectiveSimilarityThreshold()).toBe(1);
  });
});

// ── getRagStats (latency ring) ───────────────────────────────────────────────

describe('getRagStats', () => {
  beforeEach(() => {
    _resetRagStatsForTests();
  });

  it('returns zero count when no samples have been recorded', () => {
    const s = getRagStats();
    expect(s.count).toBe(0);
    expect(Number.isNaN(s.totalP50)).toBe(true);
    expect(s.avgHits).toBe(0);
  });

  it('snapshot shape includes all expected keys', () => {
    const s = getRagStats();
    expect(s).toHaveProperty('embedP50');
    expect(s).toHaveProperty('embedP95');
    expect(s).toHaveProperty('fetchP50');
    expect(s).toHaveProperty('fetchP95');
    expect(s).toHaveProperty('totalP50');
    expect(s).toHaveProperty('totalP95');
    expect(s).toHaveProperty('avgHits');
    expect(s).toHaveProperty('avgDocs');
  });
});
