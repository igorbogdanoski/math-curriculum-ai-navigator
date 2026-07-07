import { describe, it, expect } from 'vitest';
import { extractGradeLevelFromLabel, resolveGradeByLabel, findTopicByFuzzyTitle } from './gradeMatch';
import type { Grade, Topic } from '../types';

describe('extractGradeLevelFromLabel', () => {
  it('extracts a level from a pure Roman numeral label with no digit at all', () => {
    expect(extractGradeLevelFromLabel('VI')).toBe(6);
    expect(extractGradeLevelFromLabel('X')).toBe(10);
    expect(extractGradeLevelFromLabel('IX')).toBe(9);
  });

  it('extracts a level from a plain digit label', () => {
    expect(extractGradeLevelFromLabel('7')).toBe(7);
    expect(extractGradeLevelFromLabel('7. одделение')).toBe(7);
  });

  it('returns null for garbage/missing input', () => {
    expect(extractGradeLevelFromLabel('')).toBeNull();
    expect(extractGradeLevelFromLabel(undefined)).toBeNull();
    expect(extractGradeLevelFromLabel(null)).toBeNull();
    expect(extractGradeLevelFromLabel('нема одделение')).toBeNull();
  });
});

describe('resolveGradeByLabel — still resolves a full Grade via the shared token extractor', () => {
  const grades: Grade[] = [
    { id: 'g6', title: 'VI Одделение', level: 6, topics: [] } as unknown as Grade,
    { id: 'g10', title: 'X Одделение', level: 10, topics: [] } as unknown as Grade,
  ];

  it('resolves a Roman-numeral-only label to the matching Grade by level', () => {
    expect(resolveGradeByLabel(grades, 'X')?.id).toBe('g10');
  });
});

describe('findTopicByFuzzyTitle', () => {
  const topics: Topic[] = [
    { id: 't1', title: 'Дропки' } as unknown as Topic,
    { id: 't2', title: 'Триаголници и агли' } as unknown as Topic,
  ];

  it('matches when the label is a substring of the topic title', () => {
    expect(findTopicByFuzzyTitle(topics, 'Триаголници')?.id).toBe('t2');
  });

  it('matches when the topic title is a substring of the label', () => {
    expect(findTopicByFuzzyTitle(topics, 'Дропки — собирање и одземање')?.id).toBe('t1');
  });

  it('falls back to the first topic when nothing matches or the label is missing', () => {
    expect(findTopicByFuzzyTitle(topics, 'нешто сосема друго')?.id).toBe('t1');
    expect(findTopicByFuzzyTitle(topics, undefined)?.id).toBe('t1');
  });
});
