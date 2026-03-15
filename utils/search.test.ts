import { describe, it, expect } from 'vitest';
import { stripMd, bm25Score, cosineSimilarity, hybridScore } from './search';

// ─── stripMd ─────────────────────────────────────────────────────────────────
describe('stripMd', () => {
    it('removes markdown decoration characters', () => {
        // Each stripped char becomes a space; _italic_ → ' italic ' (leading+trailing space from two underscores)
        const result = stripMd('**bold** _italic_ `code`');
        expect(result).toContain('bold');
        expect(result).toContain('italic');
        expect(result).toContain('code');
        expect(result).not.toMatch(/[*_`~[\]#>]/);
    });
    it('passes plain text unchanged', () => {
        expect(stripMd('hello world 123')).toBe('hello world 123');
    });
    it('handles empty string', () => {
        expect(stripMd('')).toBe('');
    });
});

// ─── bm25Score ───────────────────────────────────────────────────────────────
describe('bm25Score', () => {
    it('returns 0 for empty query', () => {
        expect(bm25Score('', 'some document text')).toBe(0);
    });

    it('returns 0 when no query term appears in document', () => {
        expect(bm25Score('квиз', 'планета земја')).toBe(0);
    });

    it('returns positive score for exact match', () => {
        expect(bm25Score('квиз', 'квиз по математика')).toBeGreaterThan(0);
    });

    it('returns positive score for partial match (substring)', () => {
        // "одделение" contains "одд"
        expect(bm25Score('одд', '7. одделение математика')).toBeGreaterThan(0);
    });

    it('ranks exact match higher than partial match', () => {
        const exactScore   = bm25Score('математика', 'математика квиз');
        const partialScore = bm25Score('матем', 'математика квиз');
        expect(exactScore).toBeGreaterThanOrEqual(partialScore);
    });

    it('returns a higher score for more term occurrences', () => {
        const scoreOnce  = bm25Score('квиз', 'квиз по математика');
        const scoreTwice = bm25Score('квиз', 'квиз квиз по математика');
        expect(scoreTwice).toBeGreaterThan(scoreOnce);
    });

    it('handles multi-term query — averages across terms', () => {
        const score = bm25Score('квиз математика', 'квиз по математика');
        expect(score).toBeGreaterThan(0);
        // Score can exceed 1 because BM25 is unbounded before hybrid capping
        expect(Number.isFinite(score)).toBe(true);
    });

    it('handles empty document gracefully (no division by zero)', () => {
        expect(() => bm25Score('квиз', '')).not.toThrow();
        expect(bm25Score('квиз', '')).toBe(0);
    });

    it('returns 0 for both empty query and document', () => {
        expect(bm25Score('', '')).toBe(0);
    });
});

// ─── cosineSimilarity ────────────────────────────────────────────────────────
describe('cosineSimilarity', () => {
    it('returns 1 for identical vectors', () => {
        expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it('returns 0 for orthogonal vectors', () => {
        expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });

    it('returns 0 for zero vector', () => {
        expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it('returns 0 for mismatched lengths', () => {
        expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });

    it('returns 0 for empty arrays', () => {
        expect(cosineSimilarity([], [])).toBe(0);
    });
});

// ─── hybridScore ─────────────────────────────────────────────────────────────
describe('hybridScore', () => {
    it('is 60% cosine + 40% bm25 when bm25 ≤ 1', () => {
        const cosine = 0.8;
        const bm25   = 0.5;
        expect(hybridScore(cosine, bm25)).toBeCloseTo(0.6 * 0.8 + 0.4 * 0.5);
    });

    it('caps bm25 contribution at 1.0', () => {
        const cosine = 0.0;
        const bm25   = 5.0; // over-saturated keyword hit
        expect(hybridScore(cosine, bm25)).toBeCloseTo(0.4); // capped at 0.4 * 1
    });

    it('returns 0 when both inputs are 0', () => {
        expect(hybridScore(0, 0)).toBe(0);
    });

    it('returns 1 when cosine=1 and bm25≥1', () => {
        expect(hybridScore(1, 1)).toBeCloseTo(1);
    });
});
