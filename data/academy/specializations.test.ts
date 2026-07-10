import { describe, it, expect } from 'vitest';
import { SPECIALIZATIONS } from './specializations';
import { ACADEMY_CONTENT } from './content';
import { CHAPTERS } from '../profDev/index';

describe('SPECIALIZATIONS data integrity', () => {
  it('every non-quizOnly specialization only references real ACADEMY_CONTENT lesson ids', () => {
    for (const spec of SPECIALIZATIONS.filter(s => !s.quizOnly)) {
      for (const id of spec.lessonIds) {
        expect(ACADEMY_CONTENT[id], `${spec.id} references unknown lesson id "${id}"`).toBeTruthy();
      }
    }
  });

  it('ai-literate-teacher is quizOnly with exactly 10 lessonIds, all real profDev chapter ids', () => {
    const spec = SPECIALIZATIONS.find(s => s.id === 'ai-literate-teacher');
    expect(spec).toBeTruthy();
    expect(spec!.quizOnly).toBe(true);
    expect(spec!.lessonIds).toHaveLength(10);

    const chapterIds = new Set(CHAPTERS.map(c => c.id));
    for (const id of spec!.lessonIds) {
      expect(chapterIds.has(id), `ai-literate-teacher references unknown chapter id "${id}"`).toBe(true);
    }
  });

  it('ai-responsible-manager is quizOnly with exactly 6 lessonIds, all real profDev chapter ids', () => {
    const spec = SPECIALIZATIONS.find(s => s.id === 'ai-responsible-manager');
    expect(spec).toBeTruthy();
    expect(spec!.quizOnly).toBe(true);
    expect(spec!.lessonIds).toHaveLength(6);

    const chapterIds = new Set(CHAPTERS.map(c => c.id));
    for (const id of spec!.lessonIds) {
      expect(chapterIds.has(id), `ai-responsible-manager references unknown chapter id "${id}"`).toBe(true);
    }
  });

  it('every specialization id is unique', () => {
    const ids = SPECIALIZATIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
