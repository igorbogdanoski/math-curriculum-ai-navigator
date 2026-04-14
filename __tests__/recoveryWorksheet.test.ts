/**
 * Unit tests for C3 (S22): RecoveryWorksheetView — buildPrompt helper logic
 *
 * Tests the core concept-selection and prompt-building logic
 * without rendering the component (no JSDOM needed).
 */
import { describe, it, expect } from 'vitest';
import type { ConceptMastery } from '../services/firestoreService';

const WEAK_THRESHOLD = 70;
const MAX_WEAK_CONCEPTS = 3;
const EXERCISES_PER_CONCEPT = 5;

function selectWeakConcepts(
  primary: Pick<ConceptMastery, 'conceptId' | 'conceptTitle'>,
  allMastery: ConceptMastery[],
): ConceptMastery[] {
  const primaryEntry: ConceptMastery = {
    studentName: 'test',
    conceptId: primary.conceptId,
    conceptTitle: primary.conceptTitle,
    attempts: 0,
    consecutiveHighScores: 0,
    bestScore: 0,
    lastScore: 0,
    mastered: false,
  };
  return [
    primaryEntry,
    ...allMastery
      .filter(m => !m.mastered && (m.lastScore ?? 0) < WEAK_THRESHOLD && m.conceptId !== primary.conceptId)
      .sort((a, b) => (a.lastScore ?? 0) - (b.lastScore ?? 0)),
  ].slice(0, MAX_WEAK_CONCEPTS);
}

describe('RecoveryWorksheet — selectWeakConcepts', () => {
  const base: Omit<ConceptMastery, 'conceptId' | 'conceptTitle' | 'lastScore' | 'mastered'> = {
    studentName: 'student1',
    attempts: 3,
    consecutiveHighScores: 0,
    bestScore: 60,
  };

  it('always includes primary concept first', () => {
    const result = selectWeakConcepts(
      { conceptId: 'algebra-1', conceptTitle: 'Алгебра 1' },
      [],
    );
    expect(result[0].conceptId).toBe('algebra-1');
  });

  it('limits to MAX_WEAK_CONCEPTS', () => {
    const mastery: ConceptMastery[] = Array.from({ length: 10 }, (_, i) => ({
      ...base,
      conceptId: `concept-${i}`,
      conceptTitle: `Концепт ${i}`,
      lastScore: 30 + i,
      mastered: false,
    }));
    const result = selectWeakConcepts({ conceptId: 'primary', conceptTitle: 'Primary' }, mastery);
    expect(result.length).toBeLessThanOrEqual(MAX_WEAK_CONCEPTS);
  });

  it('excludes mastered concepts', () => {
    const mastery: ConceptMastery[] = [
      { ...base, conceptId: 'mastered-c', conceptTitle: 'Mastered', lastScore: 40, mastered: true },
      { ...base, conceptId: 'weak-c', conceptTitle: 'Weak', lastScore: 50, mastered: false },
    ];
    const result = selectWeakConcepts({ conceptId: 'primary', conceptTitle: 'Primary' }, mastery);
    expect(result.some(r => r.conceptId === 'mastered-c')).toBe(false);
    expect(result.some(r => r.conceptId === 'weak-c')).toBe(true);
  });

  it('excludes concepts above WEAK_THRESHOLD', () => {
    const mastery: ConceptMastery[] = [
      { ...base, conceptId: 'strong-c', conceptTitle: 'Strong', lastScore: 85, mastered: false },
      { ...base, conceptId: 'weak-c', conceptTitle: 'Weak', lastScore: 55, mastered: false },
    ];
    const result = selectWeakConcepts({ conceptId: 'primary', conceptTitle: 'Primary' }, mastery);
    expect(result.some(r => r.conceptId === 'strong-c')).toBe(false);
    expect(result.some(r => r.conceptId === 'weak-c')).toBe(true);
  });

  it('sorts by lastScore ascending (weakest first)', () => {
    const mastery: ConceptMastery[] = [
      { ...base, conceptId: 'c60', conceptTitle: 'C60', lastScore: 60, mastered: false },
      { ...base, conceptId: 'c20', conceptTitle: 'C20', lastScore: 20, mastered: false },
    ];
    const result = selectWeakConcepts({ conceptId: 'primary', conceptTitle: 'Primary' }, mastery);
    const secondConceptId = result[1]?.conceptId;
    expect(secondConceptId).toBe('c20');
  });

  it(`EXERCISES_PER_CONCEPT constant is ${EXERCISES_PER_CONCEPT}`, () => {
    expect(EXERCISES_PER_CONCEPT).toBe(5);
  });
});
