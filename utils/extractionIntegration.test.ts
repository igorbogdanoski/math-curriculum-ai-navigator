import { describe, expect, it } from 'vitest';
import type { ExtractedContentBundle } from './extractionBundle';
import {
  extractionToQuizPrompt,
  extractionToAssignmentDraft,
  extractionToFlashcards,
  extractionToLibraryDraft,
  extractionToAnnualPlanHint,
  extractionToConceptMatchText,
  type ExtractedTaskLike,
} from './extractionIntegration';

const bundle: ExtractedContentBundle = {
  formulas: ['a^2 + b^2 = c^2', 'y = mx + b'],
  theories: ['Дефиниција: Линеарна функција e y = mx + b.', 'Теорема: Питагора a^2+b^2=c^2'],
  tasks: ['Задача 1: Реши y при x=2', 'Задача 2: Најди ја хипотенузата.', 'Докажи дека триаголникот е правоаголен.'],
  rawSnippet: 'Mixed content with линеарна функција and правоаголен триаголник.',
};

const tasks: ExtractedTaskLike[] = [
  { title: 't1', statement: 'Solve y=mx+b for x=2', difficulty: 'basic', topicMk: 'Алгебра', dokLevel: 2 },
  { title: 't2', statement: 'Докажи Питагорова теорема.', difficulty: 'advanced', topicMk: 'Геометрија', dokLevel: 3 },
];

describe('extractionToQuizPrompt', () => {
  it('includes formulas, theory and tasks in the prompt', () => {
    const p = extractionToQuizPrompt(bundle, tasks, { targetCount: 5, gradeLevel: 8 });
    expect(p).toMatch(/a\^2 \+ b\^2 = c\^2/);
    expect(p).toMatch(/Дефиниција: Линеарна функција/);
    expect(p).toMatch(/Задача 1: Реши/);
    expect(p).toMatch(/5-question quiz/);
  });

  it('clamps target count to [1, 20]', () => {
    const pHigh = extractionToQuizPrompt(bundle, [], { targetCount: 999 });
    expect(pHigh).toMatch(/20-question quiz/);
    const pLow = extractionToQuizPrompt(bundle, [], { targetCount: -5 });
    expect(pLow).toMatch(/1-question quiz/);
  });

  it('respects explicit language and difficulty', () => {
    const en = extractionToQuizPrompt(bundle, [], { language: 'en', difficulty: 'advanced' });
    expect(en).toMatch(/English/);
    expect(en).toMatch(/must be advanced/);
  });
});

describe('extractionToAssignmentDraft', () => {
  it('derives a title from dominant topic when no seed provided', () => {
    const d = extractionToAssignmentDraft(bundle, tasks);
    expect(d.topics.length).toBeGreaterThan(0);
    expect(d.title).toMatch(/(Алгебра|Геометрија)/);
    expect(d.gradeLevel).toBe(8);
  });

  it('honours titleSeed when provided', () => {
    const d = extractionToAssignmentDraft(bundle, tasks, { titleSeed: 'Mојот наслов' });
    expect(d.title).toBe('Mојот наслов');
  });

  it('caps tasks at 25', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...tasks[0], title: `t${i}` }));
    const d = extractionToAssignmentDraft(bundle, many);
    expect(d.tasks.length).toBe(25);
  });
});

describe('extractionToFlashcards', () => {
  it('builds a mix of theory/formula/task cards', () => {
    const cards = extractionToFlashcards(bundle, { maxCards: 10 });
    expect(cards.length).toBeGreaterThan(2);
    const kinds = new Set(cards.map((c) => c.kind));
    expect(kinds.has('theory')).toBe(true);
    expect(kinds.has('formula')).toBe(true);
    expect(kinds.has('task')).toBe(true);
  });

  it('splits "term : definition" theory lines into front/back', () => {
    const b: ExtractedContentBundle = { ...bundle, formulas: [], tasks: [] };
    const cards = extractionToFlashcards(b);
    const first = cards[0];
    expect(first.front.length).toBeGreaterThan(0);
    expect(first.back.length).toBeGreaterThan(0);
    expect(first.back).not.toBe(first.front);
  });

  it('respects maxCards cap', () => {
    const cards = extractionToFlashcards(bundle, { maxCards: 3 });
    expect(cards.length).toBe(3);
  });
});

describe('extractionToLibraryDraft', () => {
  it('produces a non-empty body containing all sections', () => {
    const d = extractionToLibraryDraft(bundle, tasks);
    expect(d.body).toMatch(/Теорија/);
    expect(d.body).toMatch(/Формули/);
    expect(d.body).toMatch(/Задачи/);
    expect(d.topics.length).toBeGreaterThan(0);
  });

  it('uses provided title if given', () => {
    const d = extractionToLibraryDraft(bundle, tasks, { title: 'Moj naslov' });
    expect(d.title).toBe('Moj naslov');
  });
});

describe('extractionToAnnualPlanHint', () => {
  it('returns the dominant topic and a positive confidence', () => {
    const many: ExtractedTaskLike[] = [
      ...tasks,
      { title: 'x', statement: 's', difficulty: 'basic', topicMk: 'Алгебра' },
      { title: 'y', statement: 's', difficulty: 'basic', topicMk: 'Алгебра' },
    ];
    const h = extractionToAnnualPlanHint(bundle, many);
    expect(h.suggestedTopicMk).toBe('Алгебра');
    expect(h.confidence).toBeGreaterThan(0);
  });

  it('degrades gracefully when no topic info is available', () => {
    const h = extractionToAnnualPlanHint(bundle, []);
    expect(h.suggestedTopicMk).toBeUndefined();
    expect(h.rationale).toMatch(/Недоволен сигнал/);
  });
});

describe('extractionToConceptMatchText', () => {
  it('returns a lower-cased flattened string for concept mapping', () => {
    const s = extractionToConceptMatchText(bundle);
    expect(s).toBe(s.toLowerCase());
    expect(s).toMatch(/линеарна функција/);
    expect(s).toMatch(/триаголник/);
  });
});
