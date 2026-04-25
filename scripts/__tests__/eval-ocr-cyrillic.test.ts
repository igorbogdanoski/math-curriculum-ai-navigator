/**
 * scripts/__tests__/eval-ocr-cyrillic.test.ts — S41-D6
 *
 * Validates the pure helpers used by the OCR evaluator. The script itself
 * is a Node CLI (.mjs) so we re-implement the tokenize / recall logic here
 * and assert the same contract; if the CLI drifts the gate test will fail.
 */
import { describe, expect, it } from 'vitest';

function tokenize(latex: string): string[] {
  return String(latex || '')
    .toLowerCase()
    .replace(/[{}\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function tokenRecall(groundTruth: string, ocr: string): number {
  const gt = tokenize(groundTruth);
  if (gt.length === 0) return 0;
  const ocrSet = new Set(tokenize(ocr));
  let hit = 0;
  for (const t of gt) if (ocrSet.has(t)) hit++;
  return hit / gt.length;
}

describe('eval-ocr-cyrillic.tokenRecall', () => {
  it('returns 1.0 for an exact match (whitespace insensitive)', () => {
    expect(tokenRecall('x^2 + 2x + 1', 'x^2  +  2x  +  1')).toBeCloseTo(1, 5);
  });

  it('returns 0 when ground truth is empty', () => {
    expect(tokenRecall('', 'anything')).toBe(0);
  });

  it('returns 0 when OCR is unrelated', () => {
    expect(tokenRecall('a + b = c', 'foo bar baz')).toBe(0);
  });

  it('handles partial overlap proportionally', () => {
    // 2 of 4 tokens recovered → 0.5
    expect(tokenRecall('a + b = c', 'a = c')).toBeCloseTo(0.6, 1);
  });

  it('is case-insensitive and ignores braces', () => {
    expect(tokenRecall('\\frac{a}{b}', '\\FRAC a b')).toBeGreaterThan(0.6);
  });
});
