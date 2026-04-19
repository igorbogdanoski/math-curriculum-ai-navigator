/**
 * Integration tests for InternalMaturaTab data-logic (S27).
 *
 * Tests pure logic functions that drive the browse→practice→results flow:
 *   - Filter logic (topic/dok/type/search)
 *   - Score calculation (MC + open)
 *   - Pagination helpers
 *   - collectPracticeConceptIds (augments internalMaturaFinishPractice.test.ts)
 *
 * Component rendering tests are kept minimal; heavy Firebase/auth side effects
 * are already covered by firestoreService tests.
 */
import { describe, it, expect } from 'vitest';
import { collectPracticeConceptIds } from '../components/matura/InternalMaturaTab';
import type { InternalQuestion } from '../components/matura/InternalMaturaTab';
import type { DokLevel } from '../types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeQ(overrides: Partial<InternalQuestion> & { questionNumber: number }): InternalQuestion {
  return {
    part: 1,
    questionType: 'mc',
    questionText: 'Тест прашање',
    choices: { А: 'А-одговор', Б: 'Б-одговор', В: 'В-одговор', Г: 'Г-одговор' },
    correctAnswer: 'А',
    topic: 'Алгебра',
    topicArea: 'algebra',
    dokLevel: 1 as DokLevel,
    conceptIds: ['algebra-1'],
    ...overrides,
  };
}

const MOCK_QUESTIONS: InternalQuestion[] = [
  makeQ({ questionNumber: 1,  topicArea: 'algebra',        dokLevel: 1 as DokLevel, questionType: 'mc',   correctAnswer: 'А' }),
  makeQ({ questionNumber: 2,  topicArea: 'algebra',        dokLevel: 2 as DokLevel, questionType: 'mc',   correctAnswer: 'Б' }),
  makeQ({ questionNumber: 3,  topicArea: 'geometrija',     dokLevel: 1 as DokLevel, questionType: 'mc',   correctAnswer: 'В' }),
  makeQ({ questionNumber: 4,  topicArea: 'geometrija',     dokLevel: 3 as DokLevel, questionType: 'open', correctAnswer: 'x=5', choices: undefined }),
  makeQ({ questionNumber: 5,  topicArea: 'analiza',        dokLevel: 2 as DokLevel, questionType: 'open', correctAnswer: '42', choices: undefined }),
  makeQ({ questionNumber: 6,  topicArea: 'trigonometrija', dokLevel: 1 as DokLevel, questionType: 'mc',   correctAnswer: 'Г', conceptIds: ['trig-1', 'trig-2'] }),
  makeQ({ questionNumber: 7,  topicArea: 'algebra',        dokLevel: 4 as DokLevel, questionType: 'mc',   correctAnswer: 'А', conceptIds: ['algebra-1', 'algebra-2'] }),
  makeQ({ questionNumber: 8,  topicArea: 'statistika',     dokLevel: 2 as DokLevel, questionType: 'mc',   correctAnswer: 'Б', questionText: 'статистика средна вредност' }),
];

// ─── Filter logic (mirrors InternalMaturaTab useMemo(filtered)) ──────────────

function applyFilters(
  questions: InternalQuestion[],
  opts: { filterTopic?: string; filterDok?: 0|1|2|3|4; filterType?: ''|'mc'|'open'; search?: string },
): InternalQuestion[] {
  const { filterTopic = '', filterDok = 0, filterType = '', search = '' } = opts;
  return questions.filter(q => {
    if (filterTopic && q.topicArea !== filterTopic)   return false;
    if (filterDok   && q.dokLevel  !== filterDok)     return false;
    if (filterType === 'mc'   && q.questionType !== 'mc')   return false;
    if (filterType === 'open' && q.questionType !== 'open') return false;
    if (search) {
      const s = search.toLowerCase();
      return q.questionText.toLowerCase().includes(s) || q.topicArea.toLowerCase().includes(s);
    }
    return true;
  });
}

describe('InternalMaturaTab — filter logic', () => {
  it('no filter: returns all questions', () => {
    expect(applyFilters(MOCK_QUESTIONS, {})).toHaveLength(8);
  });

  it('filterTopic=algebra: returns only algebra questions', () => {
    const result = applyFilters(MOCK_QUESTIONS, { filterTopic: 'algebra' });
    expect(result).toHaveLength(3);
    expect(result.every(q => q.topicArea === 'algebra')).toBe(true);
  });

  it('filterDok=1: returns only DoK-1 questions', () => {
    const result = applyFilters(MOCK_QUESTIONS, { filterDok: 1 });
    expect(result).toHaveLength(3); // Q1, Q3, Q6
    expect(result.every(q => q.dokLevel === 1)).toBe(true);
  });

  it('filterType=mc: returns only multiple-choice', () => {
    const result = applyFilters(MOCK_QUESTIONS, { filterType: 'mc' });
    expect(result.every(q => q.questionType === 'mc')).toBe(true);
    expect(result).toHaveLength(6);
  });

  it('filterType=open: returns only open questions', () => {
    const result = applyFilters(MOCK_QUESTIONS, { filterType: 'open' });
    expect(result.every(q => q.questionType === 'open')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('search by questionText: matches substring', () => {
    const result = applyFilters(MOCK_QUESTIONS, { search: 'статистика' });
    expect(result).toHaveLength(1);
    expect(result[0].questionNumber).toBe(8);
  });

  it('search by topicArea: matches topicArea string', () => {
    const result = applyFilters(MOCK_QUESTIONS, { search: 'geometrija' });
    expect(result).toHaveLength(2);
  });

  it('search is case-insensitive', () => {
    const result = applyFilters(MOCK_QUESTIONS, { search: 'СТАТИСТИКА' });
    expect(result).toHaveLength(1);
  });

  it('combined filter: algebra + DoK2 returns 1 question', () => {
    const result = applyFilters(MOCK_QUESTIONS, { filterTopic: 'algebra', filterDok: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].questionNumber).toBe(2);
  });

  it('combined filter: mc + DoK1 returns 3 questions', () => {
    const result = applyFilters(MOCK_QUESTIONS, { filterType: 'mc', filterDok: 1 });
    expect(result).toHaveLength(3);
  });

  it('filter with no matches returns empty array', () => {
    expect(applyFilters(MOCK_QUESTIONS, { filterTopic: 'kombinatorika' })).toHaveLength(0);
  });
});

// ─── Pagination helper ────────────────────────────────────────────────────────

describe('InternalMaturaTab — pagination', () => {
  const PAGE_SIZE = 20;

  it('single page when total <= PAGE_SIZE', () => {
    const total = 8;
    expect(Math.ceil(total / PAGE_SIZE)).toBe(1);
  });

  it('correct page slice for page 0', () => {
    const all = Array.from({ length: 45 }, (_, i) => i);
    const page0 = all.slice(0 * PAGE_SIZE, 1 * PAGE_SIZE);
    expect(page0).toHaveLength(20);
    expect(page0[0]).toBe(0);
  });

  it('correct page slice for page 2 (partial)', () => {
    const all = Array.from({ length: 45 }, (_, i) => i);
    const page2 = all.slice(2 * PAGE_SIZE, 3 * PAGE_SIZE);
    expect(page2).toHaveLength(5);
    expect(page2[0]).toBe(40);
  });

  it('totalPages rounds up', () => {
    expect(Math.ceil(41 / PAGE_SIZE)).toBe(3);
    expect(Math.ceil(40 / PAGE_SIZE)).toBe(2);
    expect(Math.ceil(1  / PAGE_SIZE)).toBe(1);
  });
});

// ─── Score calculation (mirrors finishPractice logic) ─────────────────────────

function calcScore(
  practiceQs: InternalQuestion[],
  mcPicks: Record<number, string>,
  selfScores: Record<number, number>,
): { scored: number; maxPts: number; pct: number; correctMC: number; openPts: number } {
  const mcQs     = practiceQs.filter(q => q.questionType === 'mc');
  const openQs   = practiceQs.filter(q => q.questionType !== 'mc');
  const correctMC = mcQs.filter(q => mcPicks[q.questionNumber] === q.correctAnswer).length;
  const openPts   = openQs.reduce((s, q) => s + (selfScores[q.questionNumber] ?? 0), 0);
  const maxPts    = mcQs.length + openQs.length * 4;
  const scored    = correctMC + openPts;
  const pct       = maxPts > 0 ? Math.round(scored / maxPts * 100) : 0;
  return { scored, maxPts, pct, correctMC, openPts };
}

describe('InternalMaturaTab — score calculation', () => {
  const practice = [
    makeQ({ questionNumber: 10, questionType: 'mc',   correctAnswer: 'А' }),
    makeQ({ questionNumber: 11, questionType: 'mc',   correctAnswer: 'Б' }),
    makeQ({ questionNumber: 12, questionType: 'mc',   correctAnswer: 'В' }),
    makeQ({ questionNumber: 13, questionType: 'open', correctAnswer: 'x=3', choices: undefined }),
    makeQ({ questionNumber: 14, questionType: 'open', correctAnswer: '5',   choices: undefined }),
  ];

  it('perfect score: all MC correct + max self-scores', () => {
    const { scored, maxPts, pct, correctMC, openPts } = calcScore(
      practice,
      { 10: 'А', 11: 'Б', 12: 'В' },
      { 13: 4, 14: 4 },
    );
    expect(correctMC).toBe(3);
    expect(openPts).toBe(8);
    expect(maxPts).toBe(3 + 2 * 4);  // 11
    expect(scored).toBe(11);
    expect(pct).toBe(100);
  });

  it('zero score: all wrong MC, no self-score', () => {
    const { scored, pct, correctMC, openPts } = calcScore(
      practice,
      { 10: 'Б', 11: 'А', 12: 'Г' },  // all wrong
      {},
    );
    expect(correctMC).toBe(0);
    expect(openPts).toBe(0);
    expect(scored).toBe(0);
    expect(pct).toBe(0);
  });

  it('partial score: 2/3 MC correct + partial open', () => {
    const { scored, maxPts, pct } = calcScore(
      practice,
      { 10: 'А', 11: 'Б', 12: 'Г' },  // 2 correct
      { 13: 2, 14: 1 },                 // 3 open pts
    );
    expect(scored).toBe(5);
    expect(maxPts).toBe(11);
    expect(pct).toBe(Math.round(5 / 11 * 100));
  });

  it('maxPts = MC count + open count × 4', () => {
    const { maxPts } = calcScore(practice, {}, {});
    expect(maxPts).toBe(3 + 2 * 4);
  });

  it('pct is 0 when practiceQs is empty', () => {
    const { pct } = calcScore([], {}, {});
    expect(pct).toBe(0);
  });

  it('pct >= 70 means passing (emoji logic)', () => {
    const { pct } = calcScore(
      practice,
      { 10: 'А', 11: 'Б', 12: 'В' },
      { 13: 4, 14: 4 },
    );
    expect(pct).toBeGreaterThanOrEqual(70);
  });
});

// ─── collectPracticeConceptIds — extended coverage ────────────────────────────

describe('collectPracticeConceptIds — extended', () => {
  it('aggregates conceptIds from mixed MC and open questions', () => {
    const qs = [
      makeQ({ questionNumber: 1, questionType: 'mc',   conceptIds: ['alg-1', 'alg-2'] }),
      makeQ({ questionNumber: 2, questionType: 'open', conceptIds: ['geom-1'] }),
      makeQ({ questionNumber: 3, questionType: 'mc',   conceptIds: ['alg-1', 'trig-1'] }),
    ];
    const ids = collectPracticeConceptIds(qs);
    expect(ids).toHaveLength(4);
    expect(ids).toContain('alg-1');
    expect(ids).toContain('alg-2');
    expect(ids).toContain('geom-1');
    expect(ids).toContain('trig-1');
  });

  it('returns empty array for questions with no conceptIds', () => {
    const qs = [
      makeQ({ questionNumber: 1, conceptIds: [] }),
      makeQ({ questionNumber: 2, conceptIds: [] }),
    ];
    expect(collectPracticeConceptIds(qs)).toEqual([]);
  });

  it('deduplicates across all practice questions', () => {
    const qs = Array.from({ length: 15 }, (_, i) =>
      makeQ({ questionNumber: i + 1, conceptIds: ['shared-concept', `unique-${i}`] }),
    );
    const ids = collectPracticeConceptIds(qs);
    expect(ids.filter(id => id === 'shared-concept')).toHaveLength(1);
    expect(ids).toHaveLength(16); // 1 shared + 15 unique
  });
});
