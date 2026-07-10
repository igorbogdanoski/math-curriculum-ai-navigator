import { describe, it, expect } from 'vitest';
import { CHAPTERS, COMPETENCE_META, COMPETENCE_DOMAINS } from './index';

describe('ProfDev CHAPTERS data integrity', () => {
  it('has 23 chapters with unique ids, in ascending order', () => {
    expect(CHAPTERS).toHaveLength(23);
    const ids = CHAPTERS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < CHAPTERS.length; i++) {
      expect(CHAPTERS[i].order).toBeGreaterThan(CHAPTERS[i - 1].order);
    }
  });

  it('every chapter has non-empty title, description and at least one keyPoint', () => {
    for (const ch of CHAPTERS) {
      expect(ch.title.length).toBeGreaterThan(0);
      expect(ch.description.length).toBeGreaterThan(0);
      expect(ch.keyPoints.length).toBeGreaterThan(0);
    }
  });

  it('every tagged competence code is a real EU-OECD AI Literacy Framework competence', () => {
    for (const ch of CHAPTERS) {
      for (const code of ch.competences ?? []) {
        expect(COMPETENCE_META[code], `${ch.id} references unknown competence "${code}"`).toBeTruthy();
        expect(COMPETENCE_DOMAINS[code[0] as keyof typeof COMPETENCE_DOMAINS]).toBeTruthy();
      }
    }
  });

  it('the 6 new gap-closing chapters (ch-18..ch-23) all carry a competences tag', () => {
    const newIds = ['ch-18-when-to-use-ai', 'ch-19-choosing-tools', 'ch-20-ai-impact', 'ch-21-bias-fairness', 'ch-22-evaluating-outputs', 'ch-23-multimodal-creation'];
    for (const id of newIds) {
      const ch = CHAPTERS.find(c => c.id === id);
      expect(ch, `missing new chapter ${id}`).toBeTruthy();
      expect(ch!.competences?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('COMPETENCE_META has exactly the 19 official competences across 4 domains', () => {
    const codes = Object.keys(COMPETENCE_META);
    expect(codes).toHaveLength(19);
    const byDomain = { E: 0, C: 0, M: 0, S: 0 };
    for (const code of codes) {
      byDomain[code[0] as keyof typeof byDomain]++;
    }
    expect(byDomain).toEqual({ E: 7, C: 4, M: 4, S: 4 });
  });
});
