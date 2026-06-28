import { describe, it, expect } from 'vitest';
import { detectCurriculumGaps } from './curriculumGapDetector';
import { MATH_STANDARDS } from '../data/allNationalStandardsComplete';

describe('detectCurriculumGaps', () => {
  it('returns all uncovered for secondary grades', () => {
    const result = detectCurriculumGaps(['Линеарни равенки', 'Функции'], 10);
    expect(result.covered).toHaveLength(0);
    expect(result.uncovered).toHaveLength(MATH_STANDARDS.length);
    expect(result.coveragePct).toBe(0);
  });

  it('returns all uncovered for empty topics', () => {
    const result = detectCurriculumGaps([], 8);
    expect(result.covered).toHaveLength(0);
    expect(result.coveragePct).toBe(0);
  });

  it('covered + uncovered = total standards', () => {
    const topics = ['Линеарни равенки', 'Триаголник', 'Дропки', 'Проценти', 'Функции', 'Статистика'];
    const result = detectCurriculumGaps(topics, 8);
    expect(result.covered.length + result.uncovered.length).toBe(MATH_STANDARDS.length);
  });

  it('coveragePct is between 0 and 100', () => {
    const topics = ['Линеарни равенки'];
    const result = detectCurriculumGaps(topics, 8);
    expect(result.coveragePct).toBeGreaterThanOrEqual(0);
    expect(result.coveragePct).toBeLessThanOrEqual(100);
  });

  it('more topics → higher coverage', () => {
    const few = detectCurriculumGaps(['Дропки'], 9);
    const many = detectCurriculumGaps([
      'Дропки', 'Проценти', 'Линеарни равенки', 'Триаголник', 'Функции',
      'Статистика', 'Веројатност', 'Размер', 'Степени', 'Векторска алгебра',
    ], 9);
    expect(many.coveragePct).toBeGreaterThanOrEqual(few.coveragePct);
  });

  it('standard III-А.10 (linear equations) covered by "Линеарни равенки"', () => {
    const result = detectCurriculumGaps(['Линеарни равенки'], 8);
    const std = result.covered.find(s => s.code === 'III-А.10');
    expect(std).toBeDefined();
  });

  it('returns correct codes in uncovered list', () => {
    const result = detectCurriculumGaps(['Линеарни равенки'], 8);
    const allCodes = [...result.covered, ...result.uncovered].map(s => s.code);
    const expectedCodes = MATH_STANDARDS.map(s => s.code);
    expect(new Set(allCodes)).toEqual(new Set(expectedCodes));
  });
});
