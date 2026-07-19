import { describe, it, expect } from 'vitest';
import { LAB_STANDARDS, getLabCurriculumEntry, getRelatedLabsForConcept } from './labCurriculumMap';
import { MATH_STANDARDS } from './allNationalStandardsComplete';

describe('LAB_STANDARDS', () => {
  it('every primary standard code referenced actually exists in MATH_STANDARDS', () => {
    const validCodes = new Set(MATH_STANDARDS.map(s => s.code));
    for (const [labId, entry] of Object.entries(LAB_STANDARDS)) {
      for (const code of entry.primaryStandards ?? []) {
        expect(validCodes.has(code), `${labId} references unknown standard code ${code}`).toBe(true);
      }
    }
  });

  it('every lab has at least a primary standard or a secondary topic tag', () => {
    for (const [labId, entry] of Object.entries(LAB_STANDARDS)) {
      const hasSomething = (entry.primaryStandards?.length ?? 0) > 0 || (entry.secondaryTopics?.length ?? 0) > 0;
      expect(hasSomething, `${labId} has no curriculum tag at all`).toBe(true);
    }
  });
});

describe('getLabCurriculumEntry', () => {
  it('returns undefined for an unknown lab id', () => {
    expect(getLabCurriculumEntry('not-a-real-lab')).toBeUndefined();
  });

  it('returns the entry for a known lab', () => {
    expect(getLabCurriculumEntry('fractions')?.primaryStandards).toContain('III-А.1');
  });
});

describe('getRelatedLabsForConcept', () => {
  it('finds the fractions lab for a fractions concept title', () => {
    const tools = getRelatedLabsForConcept('Собирање и одземање дропки', { grade: 6 });
    expect(tools.map(t => t.route)).toContain('/data-viz?tab=fractions');
  });

  it('excludes secondary-only tools when the concept is at a primary grade', () => {
    const tools = getRelatedLabsForConcept('Тригонометриски функции', { grade: 6 });
    expect(tools.map(t => t.route)).not.toContain('/data-viz?tab=trig');
  });
});
