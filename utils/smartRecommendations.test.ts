import { describe, it, expect } from 'vitest';
import { rankScenarios } from './smartRecommendations';
import type { ScenarioBankEntry } from '../services/firestoreService.scenarioBank';

function scenario(overrides: Partial<ScenarioBankEntry> = {}): ScenarioBankEntry {
  return {
    id: crypto.randomUUID(),
    title: 'Тест сценарио',
    grade: 8,
    subject: 'Математика',
    topicTitle: 'Линеарни равенки',
    objectives: [],
    scenarioIntro: '',
    scenarioMain: [],
    scenarioConcluding: '',
    materials: [],
    assessmentStandards: [],
    bloomLevels: [],
    dokLevel: 2,
    teachingModel: null,
    duration: 40,
    authorUid: 'u1',
    authorName: 'Тест',
    schoolName: 'ОУ Тест',
    originalId: null,
    forkDepth: 0,
    publishedAt: null,
    forkCount: 0,
    usageCount: 0,
    ratingsByUid: {},
    savedByUids: [],
    verifiedByBRO: false,
    isFeatured: false,
    deleted: false,
    ...overrides,
  } as ScenarioBankEntry;
}

describe('rankScenarios', () => {
  it('returns empty array for empty input', () => {
    expect(rankScenarios([], 8, ['равенки'])).toHaveLength(0);
  });

  it('returns at most topN results', () => {
    const items = Array.from({ length: 10 }, (_, i) => scenario({ id: `s${i}` }));
    expect(rankScenarios(items, 8, [], 3)).toHaveLength(3);
  });

  it('ranks verified-by-BRO scenario higher than unverified with same base', () => {
    const verified = scenario({ id: 'v', verifiedByBRO: true, forkCount: 5, usageCount: 5 });
    const plain = scenario({ id: 'p', verifiedByBRO: false, forkCount: 5, usageCount: 5 });
    const result = rankScenarios([plain, verified], 8, []);
    expect(result[0].entry.id).toBe('v');
  });

  it('ranks higher-rated scenario first', () => {
    const good = scenario({ id: 'g', ratingsByUid: { u1: 5, u2: 5 } });
    const poor = scenario({ id: 'p', ratingsByUid: { u1: 2, u2: 1 } });
    const result = rankScenarios([poor, good], 8, []);
    expect(result[0].entry.id).toBe('g');
  });

  it('ranks grade-matching scenario higher when community scores are equal', () => {
    // Same forkCount/usageCount/rating so only proximity (grade) differs
    const exact = scenario({ id: 'e', grade: 8, forkCount: 5, usageCount: 5 });
    const wrong = scenario({ id: 'w', grade: 12, forkCount: 5, usageCount: 5 });
    const result = rankScenarios([wrong, exact], 8, ['линеарни']);
    expect(result[0].entry.id).toBe('e');
  });

  it('computes avgRating correctly in result', () => {
    const s = scenario({ ratingsByUid: { u1: 4, u2: 2 } });
    const result = rankScenarios([s], 8, []);
    expect(result[0].avgRating).toBe(3);
  });

  it('avgRating is 0 when no ratings', () => {
    const s = scenario({ ratingsByUid: {} });
    const result = rankScenarios([s], 8, []);
    expect(result[0].avgRating).toBe(0);
  });

  it('scores are between 0 and ~1.15 (with bonuses)', () => {
    const s = scenario({ forkCount: 10, usageCount: 10, ratingsByUid: { u: 5 }, verifiedByBRO: true, isFeatured: true });
    const result = rankScenarios([s], 8, []);
    expect(result[0].score).toBeGreaterThan(0);
    expect(result[0].score).toBeLessThanOrEqual(1.2);
  });

  it('topic keyword match boosts proximity score', () => {
    const matching = scenario({ id: 'm', topicTitle: 'Линеарни равенки' });
    const notMatching = scenario({ id: 'n', topicTitle: 'Геометрија' });
    const result = rankScenarios([notMatching, matching], 8, ['линеарни']);
    expect(result[0].entry.id).toBe('m');
  });
});
