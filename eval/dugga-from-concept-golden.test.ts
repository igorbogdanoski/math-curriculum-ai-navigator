/**
 * S61-F1 — Schema-only validation for the dugga-from-concept golden dataset.
 *
 * This is the regression gate for `duggaAPI.generateFromConcept`. It does not
 * call the live model (cost / flakiness); instead it asserts that the dataset
 * itself is well-formed, that every concept points at a curriculum-valid
 * grade/track tuple, and that the parser+normaliser pipeline (which IS pure)
 * yields the contractual shape for representative AI outputs.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  parseGeneratedQuestionsJson,
  normaliseGeneratedQuestion,
} from '../services/gemini/dugga';
import type { DuggaQuestionType } from '../services/firestoreService.dugga';

interface ConceptCase {
  conceptId: string;
  conceptLabel: string;
  gradeLevel: number;
  track: string;
  topics: string[];
  expectedKeywordsAny: string[];
  minSolutionLengthChars: number;
}

interface Golden {
  version: string;
  expectedQuestionCount: number;
  expectedDokDistribution: Record<'1' | '2' | '3' | '4', number>;
  globalForbiddenPhrases: string[];
  globalAllowedTypes: DuggaQuestionType[];
  concepts: ConceptCase[];
}

const golden: Golden = JSON.parse(
  readFileSync(resolve(__dirname, 'dugga-from-concept-golden.json'), 'utf8'),
);

describe('dugga-from-concept-golden.json (schema)', () => {
  it('contains exactly 15 concepts (per S61-F1 spec)', () => {
    expect(golden.concepts.length).toBe(15);
  });

  it('expectedQuestionCount × concepts equals 75', () => {
    expect(golden.expectedQuestionCount * golden.concepts.length).toBe(75);
  });

  it('every concept has a unique conceptId', () => {
    const ids = new Set(golden.concepts.map((c) => c.conceptId));
    expect(ids.size).toBe(golden.concepts.length);
  });

  it('every concept declares a Macedonian Cyrillic label', () => {
    const cyr = /[\u0400-\u04FF]/;
    for (const c of golden.concepts) {
      expect(cyr.test(c.conceptLabel), `concept ${c.conceptId}`).toBe(true);
    }
  });

  it('grade levels fall within the supported curriculum range (1–13)', () => {
    for (const c of golden.concepts) {
      expect(c.gradeLevel, c.conceptId).toBeGreaterThanOrEqual(1);
      expect(c.gradeLevel, c.conceptId).toBeLessThanOrEqual(13);
    }
  });

  it('track is one of the recognised curriculum tracks', () => {
    const allowed = new Set(['primary', 'gymnasium', 'vocational-it', 'vocational-econ', 'vocational']);
    for (const c of golden.concepts) {
      expect(allowed.has(c.track), `concept ${c.conceptId} track=${c.track}`).toBe(true);
    }
  });

  it('every concept has at least one expected keyword and one topic', () => {
    for (const c of golden.concepts) {
      expect(c.expectedKeywordsAny.length, c.conceptId).toBeGreaterThan(0);
      expect(c.topics.length, c.conceptId).toBeGreaterThan(0);
    }
  });

  it('expectedDokDistribution sums to expectedQuestionCount', () => {
    const sum =
      golden.expectedDokDistribution['1'] +
      golden.expectedDokDistribution['2'] +
      golden.expectedDokDistribution['3'] +
      golden.expectedDokDistribution['4'];
    expect(sum).toBe(golden.expectedQuestionCount);
  });

  it('globalAllowedTypes is a subset of DuggaQuestionType union', () => {
    const allowed: ReadonlySet<DuggaQuestionType> = new Set<DuggaQuestionType>([
      'multiple_choice', 'checklist', 'true_false', 'inline_select', 'multi_match',
      'fill_blanks', 'short_answer', 'list_items', 'essay', 'multi_part',
      'ordering', 'diagram_annotate', 'statement_eval', 'interactive_table',
      'table_completion', 'student_chart', 'function_match', 'unit_circle_pick',
      'proof_steps', 'section_header',
    ]);
    for (const t of golden.globalAllowedTypes) {
      expect(allowed.has(t), `unknown type "${t}"`).toBe(true);
    }
  });
});

describe('dugga-from-concept-golden — pipeline contract (parser + normaliser)', () => {
  it('parses + normalises a representative AI payload for every concept', () => {
    for (const c of golden.concepts) {
      // Synthesise a model-style JSON array honouring the concept context.
      const payload = JSON.stringify(
        Array.from({ length: golden.expectedQuestionCount }, (_, i) => ({
          type: golden.globalAllowedTypes[i % golden.globalAllowedTypes.length],
          dok: ((i % 3) + 1),
          points: 2 + (i % 3),
          text: `Прашање за ${c.conceptLabel} (${c.expectedKeywordsAny[0]}) — №${i + 1}`,
          options: [
            { id: 'a', text: 'Опција 1', isCorrect: i === 0 },
            { id: 'b', text: 'Опција 2' },
          ],
          correctAnswer: 'Опција 1',
          solution: `Решение со клучен термин: ${c.expectedKeywordsAny[0]} — детално објаснување на чекорите.`,
          hint: `Совет: размисли за ${c.expectedKeywordsAny[0]}.`,
        })),
      );

      const parsed = parseGeneratedQuestionsJson(payload);
      expect(parsed.length, c.conceptId).toBe(golden.expectedQuestionCount);

      const questions = parsed.map((q, i) =>
        normaliseGeneratedQuestion(q, c.conceptId, i),
      );

      // Contract: every normalised question must be tagged with the concept,
      // have a positive points value, a recognised type, and respect the
      // dataset's keyword + forbidden-phrase rules.
      for (const q of questions) {
        expect(q.linkedConceptIds, c.conceptId).toEqual([c.conceptId]);
        expect(q.points, c.conceptId).toBeGreaterThan(0);
        expect([1, 2, 3, 4]).toContain(q.dok);
        expect(golden.globalAllowedTypes).toContain(q.type);
        expect(q.text.length, c.conceptId).toBeGreaterThan(0);

        // At least one keyword must appear in either the question text or solution.
        const haystack = `${q.text} ${q.solution ?? ''}`.toLowerCase();
        const hits = c.expectedKeywordsAny.filter((kw) =>
          haystack.includes(kw.toLowerCase()),
        );
        expect(hits.length, `${c.conceptId}: keyword in "${haystack}"`).toBeGreaterThan(0);

        // No forbidden phrase may appear anywhere.
        for (const bad of golden.globalForbiddenPhrases) {
          expect(haystack.includes(bad.toLowerCase()), `${c.conceptId} forbidden=${bad}`).toBe(false);
        }

        // Solution must meet the minimum length contract.
        if (q.solution) {
          expect(q.solution.length, c.conceptId).toBeGreaterThanOrEqual(c.minSolutionLengthChars);
        }
      }
    }
  });
});
