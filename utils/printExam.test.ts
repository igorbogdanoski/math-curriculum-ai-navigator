import { describe, it, expect } from 'vitest';
import { parseInlineSelection, buildZipGradeCSV, extractMCAnswer } from './printExam';
import type { ExamQuestion } from '../services/firestoreService.types';

// ─── parseInlineSelection ─────────────────────────────────────────────────────

describe('parseInlineSelection', () => {
  it('returns single text segment when no braces', () => {
    const result = parseInlineSelection('Plain text without braces.');
    expect(result).toEqual([{ type: 'text', value: 'Plain text without braces.' }]);
  });

  it('parses a single inline choice in the middle', () => {
    const result = parseInlineSelection('Квадратот има {4|3} страни.');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ type: 'text', value: 'Квадратот има ' });
    expect(result[1]).toEqual({ type: 'choice', options: ['4', '3'], correctIndex: 0 });
    expect(result[2]).toEqual({ type: 'text', value: ' страни.' });
  });

  it('marks the first option as correct (correctIndex: 0)', () => {
    const result = parseInlineSelection('{точно|погрешно}');
    expect(result).toHaveLength(1);
    const seg = result[0];
    expect(seg.type).toBe('choice');
    if (seg.type === 'choice') {
      expect(seg.correctIndex).toBe(0);
      expect(seg.options).toEqual(['точно', 'погрешно']);
    }
  });

  it('handles multiple inline choices in one string', () => {
    const result = parseInlineSelection('{A|B} и {C|D} се точни.');
    expect(result).toHaveLength(4);
    expect(result[0].type).toBe('choice');
    expect(result[1]).toEqual({ type: 'text', value: ' и ' });
    expect(result[2].type).toBe('choice');
    expect(result[3]).toEqual({ type: 'text', value: ' се точни.' });
  });

  it('handles choice at start of string (no leading text segment)', () => {
    const result = parseInlineSelection('{да|не} е точно.');
    expect(result[0].type).toBe('choice');
    expect(result[1]).toEqual({ type: 'text', value: ' е точно.' });
  });

  it('handles choice at end of string (no trailing text segment)', () => {
    const result = parseInlineSelection('Одговорот е {5|4}');
    expect(result[result.length - 1].type).toBe('choice');
  });

  it('returns empty array for empty string', () => {
    expect(parseInlineSelection('')).toEqual([]);
  });

  it('handles choices with more than two options', () => {
    const result = parseInlineSelection('{A|B|C|D}');
    expect(result).toHaveLength(1);
    const seg = result[0];
    if (seg.type === 'choice') {
      expect(seg.options).toEqual(['A', 'B', 'C', 'D']);
    }
  });
});

// ─── buildZipGradeCSV ─────────────────────────────────────────────────────────

describe('buildZipGradeCSV', () => {
  it('produces correct CSV header and rows', () => {
    const csv = buildZipGradeCSV('Математика тест', 'A', [
      { number: 1, answer: 'A', points: 2 },
      { number: 2, answer: 'C', points: 3 },
    ]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Математика тест — Варијанта A"');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('Question,Correct Answer,Points');
    expect(lines[3]).toBe('1,"A",2');
    expect(lines[4]).toBe('2,"C",3');
  });

  it('handles empty question list', () => {
    const csv = buildZipGradeCSV('Test', 'B', []);
    expect(csv).toContain('Question,Correct Answer,Points');
    // Only header rows, no data rows
    const dataRows = csv.split('\n').slice(3);
    expect(dataRows.every(r => r === '')).toBe(true);
  });

  it('includes variant key in title line', () => {
    const csv = buildZipGradeCSV('Quiz', 'G', []);
    expect(csv).toContain('Варијанта G');
  });
});

// ─── extractMCAnswer ──────────────────────────────────────────────────────────

describe('extractMCAnswer', () => {
  const makeQ = (options: string[]): ExamQuestion => ({
    id: 'q1',
    type: 'multiple_choice',
    question: 'Q?',
    options,
    answer: options[0] ?? '',
    points: 1,
  });

  it('maps matching option text to letter label', () => {
    const q = makeQ(['Париз', 'Берлин', 'Рим', 'Лондон']);
    expect(extractMCAnswer(q, 'Берлин')).toBe('B');
    expect(extractMCAnswer(q, 'Париз')).toBe('A');
    expect(extractMCAnswer(q, 'Рим')).toBe('C');
    expect(extractMCAnswer(q, 'Лондон')).toBe('D');
  });

  it('is case-insensitive', () => {
    const q = makeQ(['точно', 'погрешно']);
    expect(extractMCAnswer(q, 'ТОЧНО')).toBe('A');
    expect(extractMCAnswer(q, 'Погрешно')).toBe('B');
  });

  it('trims whitespace before matching', () => {
    const q = makeQ(['Опција А', 'Опција Б']);
    expect(extractMCAnswer(q, '  Опција А  ')).toBe('A');
  });

  it('returns raw answerText if no matching option found', () => {
    const q = makeQ(['A', 'B']);
    expect(extractMCAnswer(q, 'X')).toBe('X');
  });

  it('returns answerText unchanged when question has no options', () => {
    const q = makeQ([]);
    expect(extractMCAnswer(q, 'some text')).toBe('some text');
  });

  it('handles missing options field gracefully', () => {
    const q: ExamQuestion = { id: 'q1', type: 'short_answer', question: 'Q?', answer: '', points: 1 };
    expect(extractMCAnswer(q, 'answer')).toBe('answer');
  });
});
