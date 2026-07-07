import { describe, it, expect } from 'vitest';
import { buildKahootExportRows } from './exportKahootXlsx';
import type { KahootQuestion } from '../services/gemini/kahootGenerator';

function makeQuestion(overrides: Partial<KahootQuestion>): KahootQuestion {
  return {
    id: 'q1',
    question: 'Колку е 2+2?',
    options: ['3', '4', '5', '6'],
    correctIndex: 1,
    difficulty: 'basic',
    ...overrides,
  };
}

describe('buildKahootExportRows', () => {
  it('produces the header row kahoot.com\'s "Import from spreadsheet" expects', () => {
    const rows = buildKahootExportRows([]);
    expect(rows[0]).toEqual(['Question', 'Answer 1', 'Answer 2', 'Answer 3', 'Answer 4', 'Time limit (sec)', 'Correct answer(s)']);
  });

  it('maps each question to a row with all 4 options and a 1-indexed correct answer number', () => {
    const rows = buildKahootExportRows([makeQuestion({})], 30);
    expect(rows[1]).toEqual(['Колку е 2+2?', '3', '4', '5', '6', '30', '2']);
  });

  it('defaults the time limit to 20s when no timer was set', () => {
    const rows = buildKahootExportRows([makeQuestion({})]);
    expect(rows[1][5]).toBe('20');
  });

  it('handles correctIndex 0 (first option) correctly as answer "1", not falsy/blank', () => {
    const rows = buildKahootExportRows([makeQuestion({ correctIndex: 0 })]);
    expect(rows[1][6]).toBe('1');
  });

  it('produces one row per question, in order', () => {
    const rows = buildKahootExportRows([
      makeQuestion({ id: 'q1', question: 'A' }),
      makeQuestion({ id: 'q2', question: 'B' }),
    ]);
    expect(rows).toHaveLength(3); // header + 2
    expect(rows[1][0]).toBe('A');
    expect(rows[2][0]).toBe('B');
  });
});
