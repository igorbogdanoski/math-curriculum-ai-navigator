import { describe, it, expect, vi, beforeEach } from 'vitest';
import { feynmanScoreToPoints, gradeFeynmanAnswer, type FeynmanGrade } from './duggaFeynmanGrading';

// ─── feynmanScoreToPoints ─────────────────────────────────────────────────────
describe('feynmanScoreToPoints', () => {
  const grade = (total: number): FeynmanGrade => ({
    accuracy: 0, simplicity: 0, completeness: 0, noJargon: 0,
    feedback: '', total,
  });

  it('100/100 on 10-pt question → 10', () => {
    expect(feynmanScoreToPoints(grade(100), 10)).toBe(10);
  });

  it('50/100 on 20-pt question → 10', () => {
    expect(feynmanScoreToPoints(grade(50), 20)).toBe(10);
  });

  it('0/100 → 0', () => {
    expect(feynmanScoreToPoints(grade(0), 10)).toBe(0);
  });

  it('rounds to one decimal place', () => {
    // 33/100 × 10 = 3.3
    expect(feynmanScoreToPoints(grade(33), 10)).toBe(3.3);
  });

  it('75/100 on 4-pt question → 3', () => {
    expect(feynmanScoreToPoints(grade(75), 4)).toBe(3);
  });
});

// ─── gradeFeynmanAnswer (mocked AI) ──────────────────────────────────────────
vi.mock('../services/gemini/core', () => ({
  callGeminiProxy: vi.fn(),
  sanitizePromptInput: (text: string, max: number) => text.slice(0, max),
  DEFAULT_MODEL: 'gemini-mock',
}));

import { callGeminiProxy } from '../services/gemini/core';
const mockCallGemini = vi.mocked(callGeminiProxy);

describe('gradeFeynmanAnswer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('parses valid JSON response into FeynmanGrade', async () => {
    mockCallGemini.mockResolvedValueOnce({
      text: JSON.stringify({
        accuracy: 30, simplicity: 20, completeness: 18, noJargon: 8,
        feedback: 'Добро објаснување. Обиди се со аналогија.',
      }),
      usageMetadata: undefined,
    } as any);

    const result = await gradeFeynmanAnswer('Питагорова теорема', 'a² + b² = c²', 10);
    expect(result.accuracy).toBe(30);
    expect(result.simplicity).toBe(20);
    expect(result.completeness).toBe(18);
    expect(result.noJargon).toBe(8);
    expect(result.total).toBe(76);
    expect(result.feedback).toBe('Добро објаснување. Обиди се со аналогија.');
  });

  it('clamps scores to defined max per dimension', async () => {
    mockCallGemini.mockResolvedValueOnce({
      text: JSON.stringify({
        accuracy: 999, simplicity: 999, completeness: 999, noJargon: 999,
        feedback: 'тест',
      }),
    } as any);

    const result = await gradeFeynmanAnswer('concept', 'text', 10);
    expect(result.accuracy).toBe(40);
    expect(result.simplicity).toBe(25);
    expect(result.completeness).toBe(25);
    expect(result.noJargon).toBe(10);
    expect(result.total).toBe(100);
  });

  it('clamps negative scores to 0', async () => {
    mockCallGemini.mockResolvedValueOnce({
      text: JSON.stringify({
        accuracy: -10, simplicity: -5, completeness: -3, noJargon: -1,
        feedback: 'тест',
      }),
    } as any);

    const result = await gradeFeynmanAnswer('concept', 'text', 10);
    expect(result.accuracy).toBe(0);
    expect(result.total).toBe(0);
  });

  it('falls back gracefully on malformed JSON', async () => {
    mockCallGemini.mockResolvedValueOnce({ text: 'NOT JSON' } as any);

    const result = await gradeFeynmanAnswer('concept', 'text', 10);
    expect(result.total).toBe(0);
    expect(result.feedback).toBe('Нема повратна информација.');
  });

  it('falls back on empty response text', async () => {
    mockCallGemini.mockResolvedValueOnce({ text: '' } as any);
    const result = await gradeFeynmanAnswer('concept', 'text', 10);
    expect(result.total).toBe(0);
  });

  it('handles missing feedback field', async () => {
    mockCallGemini.mockResolvedValueOnce({
      text: JSON.stringify({ accuracy: 20, simplicity: 10, completeness: 10, noJargon: 5 }),
    } as any);
    const result = await gradeFeynmanAnswer('concept', 'text', 10);
    expect(result.feedback).toBe('Нема повратна информација.');
    expect(result.total).toBe(45);
  });
});
