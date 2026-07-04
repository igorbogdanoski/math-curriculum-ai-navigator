import { describe, it, expect } from 'vitest';
import { autoScore, needsAIGrade, buildAIGradingQuestionContext, parseAIEarnedPoints, percentageToMkGrade } from './duggaScoring';
import type { DuggaQuestion } from '../services/firestoreService.dugga';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQ(overrides: Partial<DuggaQuestion>): DuggaQuestion {
  return {
    id: 'q1', type: 'short_answer', text: 'Test?', dok: 1, points: 4,
    ...overrides,
  };
}

// ─── multiple_choice ──────────────────────────────────────────────────────────

describe('autoScore — multiple_choice', () => {
  const q = makeQ({
    type: 'multiple_choice',
    points: 2,
    correctAnswer: 'Paris',
    options: [
      { id: 'a', text: 'London', isCorrect: false },
      { id: 'b', text: 'Paris', isCorrect: true },
      { id: 'c', text: 'Berlin', isCorrect: false },
    ],
  });

  it('awards full points for correct option (by isCorrect flag)', () => {
    const r = autoScore(q, 'b');
    expect(r?.earned).toBe(2);
    expect(r?.correct).toBe(true);
  });

  it('awards 0 for wrong option', () => {
    const r = autoScore(q, 'a');
    expect(r?.earned).toBe(0);
    expect(r?.correct).toBe(false);
  });

  it('also matches by correctAnswer text when isCorrect is absent', () => {
    const q2 = makeQ({
      type: 'multiple_choice', points: 3,
      correctAnswer: 'Paris',
      options: [
        { id: 'a', text: 'London' },
        { id: 'b', text: 'Paris' },
      ],
    });
    expect(autoScore(q2, 'b')?.correct).toBe(true);
  });

  it('returns 0 for empty answer', () => {
    expect(autoScore(q, '')?.earned).toBe(0);
  });
});

// ─── checklist ────────────────────────────────────────────────────────────────

describe('autoScore — checklist', () => {
  const q = makeQ({
    type: 'checklist', points: 4,
    options: [
      { id: 'a', text: 'A', isCorrect: true },
      { id: 'b', text: 'B', isCorrect: true },
      { id: 'c', text: 'C', isCorrect: false },
    ],
  });

  it('awards full points when exactly all correct options selected', () => {
    expect(autoScore(q, 'a,b')?.earned).toBe(4);
    expect(autoScore(q, 'a,b')?.correct).toBe(true);
  });

  it('gives partial credit for one of two correct (no wrong)', () => {
    const r = autoScore(q, 'a');
    expect(r?.earned).toBeGreaterThan(0);
    expect(r?.earned).toBeLessThan(4);
    expect(r?.correct).toBe(false);
  });

  it('penalises for including wrong option', () => {
    const rWrong = autoScore(q, 'a,c');
    const rCorrect = autoScore(q, 'a');
    expect(rWrong!.earned).toBeLessThanOrEqual(rCorrect!.earned);
  });

  it('returns 0 for completely wrong selection', () => {
    expect(autoScore(q, 'c')?.earned).toBe(0);
  });

  it('returns null when no correctIds defined', () => {
    const q2 = makeQ({ type: 'checklist', options: [{ id: 'a', text: 'A' }] });
    expect(autoScore(q2, 'a')).toBeNull();
  });
});

// ─── true_false ───────────────────────────────────────────────────────────────

describe('autoScore — true_false', () => {
  const q = makeQ({ type: 'true_false', points: 1, correctAnswer: 'Точно' });

  it('case-insensitive correct match', () => {
    expect(autoScore(q, 'точно')?.correct).toBe(true);
    expect(autoScore(q, 'ТОЧНО')?.correct).toBe(true);
  });

  it('wrong answer gives 0', () => {
    expect(autoScore(q, 'Неточно')?.earned).toBe(0);
  });

  it('returns null when correctAnswer is missing', () => {
    expect(autoScore(makeQ({ type: 'true_false' }), 'Точно')).toBeNull();
  });
});

// ─── statement_eval ───────────────────────────────────────────────────────────

describe('autoScore — statement_eval', () => {
  const q = makeQ({ type: 'statement_eval', points: 2, correctAnswer: 'Делумно точно' });

  it('matches multi-word correct answer', () => {
    expect(autoScore(q, 'Делумно точно')?.correct).toBe(true);
    expect(autoScore(q, 'делумно точно')?.correct).toBe(true);
  });

  it('wrong answer gives 0', () => {
    expect(autoScore(q, 'Точно')?.earned).toBe(0);
  });
});

// ─── fill_blanks ──────────────────────────────────────────────────────────────

describe('autoScore — fill_blanks', () => {
  const q = makeQ({ type: 'fill_blanks', points: 3, correctAnswer: 'x=5' });

  it('exact match (case-insensitive, trimmed) is correct', () => {
    expect(autoScore(q, 'x=5')?.correct).toBe(true);
    expect(autoScore(q, ' x=5 ')?.correct).toBe(true);
    expect(autoScore(q, 'X=5')?.correct).toBe(true);
  });

  it('wrong value gives 0', () => {
    expect(autoScore(q, 'x=4')?.earned).toBe(0);
  });

  it('returns null without correctAnswer', () => {
    expect(autoScore(makeQ({ type: 'fill_blanks' }), 'anything')).toBeNull();
  });
});

describe('autoScore — fill_blanks/short_answer CAS fallback (the "2x+2 vs 2+2x" bug this closes)', () => {
  it('flips a literal-mismatch to correct when the answer is a differently-written equivalent expression', () => {
    const q = makeQ({ type: 'short_answer', points: 4, correctAnswer: '2+2x' });
    const r = autoScore(q, '2x+2');
    expect(r?.correct).toBe(true);
    expect(r?.earned).toBe(4);
    expect(r?.viaCas).toBe(true);
  });

  it('does not mark viaCas on a plain literal match', () => {
    const q = makeQ({ type: 'short_answer', points: 4, correctAnswer: '2+2x' });
    const r = autoScore(q, '2+2x');
    expect(r?.correct).toBe(true);
    expect(r?.viaCas).toBeUndefined();
  });

  it('stays wrong when the answer is genuinely a different value, not just differently written', () => {
    const q = makeQ({ type: 'fill_blanks', points: 3, correctAnswer: 'x=5' });
    const r = autoScore(q, 'x=4');
    expect(r?.correct).toBe(false);
    expect(r?.earned).toBe(0);
    expect(r?.viaCas).toBeUndefined();
  });

  it('stays wrong (not falsely flipped) when the answer is non-mathematical prose CAS cannot parse', () => {
    const q = makeQ({ type: 'short_answer', points: 2, correctAnswer: '42' });
    const r = autoScore(q, 'the answer is forty-two');
    expect(r?.correct).toBe(false);
    expect(r?.earned).toBe(0);
  });
});

// ─── ordering ────────────────────────────────────────────────────────────────

describe('autoScore — ordering', () => {
  // Use 6 points so partial-credit formula Math.floor(6 * ratio * 0.7) is non-zero for 1/3 hit
  const q = makeQ({
    type: 'ordering', points: 6,
    orderItems: ['Step 1', 'Step 2', 'Step 3'],
  });

  it('full score for correct order', () => {
    expect(autoScore(q, 'Step 1|Step 2|Step 3')?.earned).toBe(6);
    expect(autoScore(q, 'Step 1|Step 2|Step 3')?.correct).toBe(true);
  });

  it('partial credit for partial order', () => {
    const r = autoScore(q, 'Step 1|Step 3|Step 2');
    expect(r?.earned).toBeGreaterThan(0);
    expect(r?.earned).toBeLessThan(4);
    expect(r?.correct).toBe(false);
  });

  it('0 for completely wrong order (no position matches)', () => {
    // 'Step 2|Step 3|Step 1': pos 0→Step 2≠Step 1, pos 1→Step 3≠Step 2, pos 2→Step 1≠Step 3
    expect(autoScore(q, 'Step 2|Step 3|Step 1')?.earned).toBe(0);
  });

  it('returns null when orderItems is empty', () => {
    expect(autoScore(makeQ({ type: 'ordering', orderItems: [] }), 'x')).toBeNull();
  });
});

// ─── multi_match ──────────────────────────────────────────────────────────────

describe('autoScore — multi_match', () => {
  const q = makeQ({
    type: 'multi_match', points: 6,
    matchPairs: [
      { left: 'A', right: '1' },
      { left: 'B', right: '2' },
      { left: 'C', right: '3' },
    ],
  });

  it('full score for all correct', () => {
    const ans = JSON.stringify({ A: '1', B: '2', C: '3' });
    expect(autoScore(q, ans)?.earned).toBe(6);
    expect(autoScore(q, ans)?.correct).toBe(true);
  });

  it('partial credit for 2/3 correct', () => {
    const ans = JSON.stringify({ A: '1', B: '2', C: 'WRONG' });
    const r = autoScore(q, ans);
    expect(r?.earned).toBe(4); // floor(6 * 2/3)
    expect(r?.correct).toBe(false);
  });

  it('0 for no correct matches', () => {
    const ans = JSON.stringify({ A: '3', B: '1', C: '2' });
    expect(autoScore(q, ans)?.earned).toBe(0);
  });

  it('returns null when matchPairs is empty', () => {
    expect(autoScore(makeQ({ type: 'multi_match', matchPairs: [] }), '{}')).toBeNull();
  });
});

// ─── section_header ───────────────────────────────────────────────────────────

describe('autoScore — section_header', () => {
  it('returns maxPoints=0 and correct=true (not answerable)', () => {
    const r = autoScore(makeQ({ type: 'section_header' }), '');
    expect(r?.maxPoints).toBe(0);
    expect(r?.correct).toBe(true);
    expect(r?.earned).toBe(0);
  });
});

// ─── AI-graded types ──────────────────────────────────────────────────────────

describe('autoScore — AI-only types return null', () => {
  it.each(['essay', 'diagram_annotate', 'interactive_table', 'table_completion', 'multi_part', 'inline_select'] as const)(
    '%s returns null',
    (type) => {
      expect(autoScore(makeQ({ type }), 'some answer')).toBeNull();
    },
  );

  it('short_answer with correctAnswer is auto-scored', () => {
    const q = makeQ({ type: 'short_answer', points: 2, correctAnswer: '42' });
    expect(autoScore(q, '42')?.correct).toBe(true);
  });

  it('short_answer without correctAnswer returns null (needs AI)', () => {
    const q = makeQ({ type: 'short_answer' });
    expect(autoScore(q, 'anything')).toBeNull();
  });
});

// ─── list_items ───────────────────────────────────────────────────────────────

describe('autoScore — list_items', () => {
  const q = makeQ({ type: 'list_items', points: 4, correctAnswer: 'x=2, x=-3' });

  it('awards full points for an exact set match (order-independent)', () => {
    const r = autoScore(q, JSON.stringify(['x=-3', 'x=2']));
    expect(r?.correct).toBe(true);
    expect(r?.earned).toBe(4);
  });

  it('is case/whitespace-insensitive', () => {
    const r = autoScore(q, JSON.stringify([' X=2 ', 'X=-3']));
    expect(r?.correct).toBe(true);
  });

  it('awards partial credit for a subset of correct items', () => {
    const r = autoScore(q, JSON.stringify(['x=2']));
    expect(r?.correct).toBe(false);
    expect(r?.earned).toBeGreaterThan(0);
    expect(r?.earned).toBeLessThan(4);
  });

  it('penalizes extra incorrect items', () => {
    const withExtra = autoScore(q, JSON.stringify(['x=2', 'x=-3', 'x=99']));
    const clean = autoScore(q, JSON.stringify(['x=2', 'x=-3']));
    expect(withExtra?.correct).toBe(false);
    expect(clean?.correct).toBe(true);
  });

  it('returns 0 earned for an empty/unparseable answer', () => {
    const r = autoScore(q, '');
    expect(r?.correct).toBe(false);
    expect(r?.earned).toBe(0);
  });

  it('returns null when correctAnswer is missing (needs AI/manual)', () => {
    expect(autoScore(makeQ({ type: 'list_items' }), JSON.stringify(['x=2']))).toBeNull();
  });
});

// ─── needsAIGrade ─────────────────────────────────────────────────────────────

describe('needsAIGrade', () => {
  it('essay always needs AI', () => {
    expect(needsAIGrade(makeQ({ type: 'essay' }))).toBe(true);
  });

  it('short_answer without correctAnswer needs AI', () => {
    expect(needsAIGrade(makeQ({ type: 'short_answer' }))).toBe(true);
  });

  it('short_answer with correctAnswer does NOT need AI', () => {
    expect(needsAIGrade(makeQ({ type: 'short_answer', correctAnswer: 'x=3' }))).toBe(false);
  });

  it('multiple_choice does not need AI', () => {
    expect(needsAIGrade(makeQ({ type: 'multiple_choice' }))).toBe(false);
  });

  it.each(['table_completion', 'inline_select', 'multi_part', 'interactive_table', 'diagram_annotate'] as const)(
    '%s needs AI (no stored answer key)',
    (type) => {
      expect(needsAIGrade(makeQ({ type }))).toBe(true);
    },
  );

  it('list_items does NOT need AI (auto-scored via correctAnswer)', () => {
    expect(needsAIGrade(makeQ({ type: 'list_items', correctAnswer: 'a, b' }))).toBe(false);
  });
});

// ─── buildAIGradingQuestionContext ─────────────────────────────────────────────

describe('buildAIGradingQuestionContext', () => {
  it('returns plain text unchanged for types with no special context', () => {
    const q = makeQ({ type: 'essay', text: 'Објасни го Питагорината теорема.' });
    expect(buildAIGradingQuestionContext(q)).toBe('Објасни го Питагорината теорема.');
  });

  it('folds table headers/rows into context for table_completion', () => {
    const q = makeQ({
      type: 'table_completion', text: 'f(x) = 2x',
      tableHeaders: ['x', 'f(x)'], tableRows: [['1', '2'], ['2', '']],
    });
    const ctx = buildAIGradingQuestionContext(q);
    expect(ctx).toContain('f(x) = 2x');
    expect(ctx).toContain('x | f(x)');
    expect(ctx).toContain('празно поле');
  });

  it('folds row labels and column headers for interactive_table', () => {
    const q = makeQ({
      type: 'interactive_table', text: 'Означи кои функции се непарни.',
      tableHeaders: ['Непарна'], tableRows: [['f(x)=x^3'], ['f(x)=x^2']],
    });
    const ctx = buildAIGradingQuestionContext(q);
    expect(ctx).toContain('f(x)=x^3');
    expect(ctx).toContain('f(x)=x^2');
  });

  it('folds options for inline_select', () => {
    const q = makeQ({
      type: 'inline_select', text: 'Избери го точниот степен.',
      options: [{ id: 'a', text: 'x^2' }, { id: 'b', text: 'x^3' }],
    });
    expect(buildAIGradingQuestionContext(q)).toContain('x^2, x^3');
  });

  it('adds a leniency note for diagram_annotate when an image is present', () => {
    const q = makeQ({ type: 'diagram_annotate', text: 'Означи ги аглите.', imageUrl: 'https://x/y.png' });
    expect(buildAIGradingQuestionContext(q)).toContain('не е достапна за AI');
  });
});

// ─── parseAIEarnedPoints ──────────────────────────────────────────────────────

describe('parseAIEarnedPoints', () => {
  it('extracts X from "X/Y" pattern', () => {
    expect(parseAIEarnedPoints('Поени: 3/5', 5)).toBe(3);
    expect(parseAIEarnedPoints('4/4 — одличен', 4)).toBe(4);
  });

  it('caps at maxPoints', () => {
    expect(parseAIEarnedPoints('99/10', 10)).toBe(10);
  });

  it('returns 0 when no pattern found', () => {
    expect(parseAIEarnedPoints('No score here', 5)).toBe(0);
  });
});

// ─── percentageToMkGrade ─────────────────────────────────────────────────────

describe('percentageToMkGrade', () => {
  it.each([
    [95, 'Одличен (5)'],
    [90, 'Одличен (5)'],
    [80, 'Многу добар (4)'],
    [75, 'Многу добар (4)'],
    [65, 'Добар (3)'],
    [60, 'Добар (3)'],
    [55, 'Задоволителен (2)'],
    [50, 'Задоволителен (2)'],
    [49, 'Недоволен (1)'],
    [0, 'Недоволен (1)'],
  ])('%i%% → %s', (pct, expected) => {
    expect(percentageToMkGrade(pct)).toBe(expected);
  });
});
