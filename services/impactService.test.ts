import { describe, it, expect, vi } from 'vitest';
import { fetchTeacherImpactSummary } from './impactService';
import { fetchMyScenarios } from './firestoreService.scenarioBank';
import { fetchMyAnnualPlans } from './firestoreService.materials';
import { subscribeMyDuggaTests } from './firestoreService.dugga';
import type { ScenarioBankEntry } from './firestoreService.scenarioBank';
import type { AnnualPlanDoc } from './firestoreService.materials';
import type { DuggaTest } from './firestoreService.dugga';

vi.mock('./firestoreService.scenarioBank', () => ({ fetchMyScenarios: vi.fn() }));
vi.mock('./firestoreService.materials', () => ({ fetchMyAnnualPlans: vi.fn() }));
vi.mock('./firestoreService.dugga', () => ({ subscribeMyDuggaTests: vi.fn() }));

function makeScenario(overrides: Partial<ScenarioBankEntry> = {}): ScenarioBankEntry {
  return {
    id: 's1', title: 'X', grade: 8, subject: 'Математика', topicTitle: 'X',
    objectives: [], scenarioIntro: '', scenarioMain: [], scenarioConcluding: '',
    materials: [], assessmentStandards: [], bloomLevels: [], dokLevel: null,
    teachingModel: null, duration: 0, authorUid: 'u1', authorName: 'Мене', schoolName: '',
    originalId: null, forkDepth: 0, publishedAt: null, forkCount: 0, usageCount: 0,
    ratingsByUid: {}, savedByUids: [], verifiedByBRO: false, isFeatured: false,
    deleted: false, isPublic: true, authorNotes: '',
    ...overrides,
  };
}

function makeAnnualPlan(overrides: Partial<AnnualPlanDoc> = {}): AnnualPlanDoc {
  return { id: 'p1', userId: 'u1', createdAt: null, grade: '8', subject: 'Математика', planData: {} as any, ...overrides };
}

function makeDuggaTest(overrides: Partial<DuggaTest> = {}): DuggaTest {
  return {
    id: 'd1', title: 'X', teacherUid: 'u1', teacherName: 'Мене', grade: 8, track: 'primary',
    topics: [], testType: 'topic', questions: [], shareCode: 'ABCDEF', isPublic: true,
    totalPoints: 10, estimatedMinutes: 20, createdAt: {} as any,
    ...overrides,
  };
}

describe('fetchTeacherImpactSummary', () => {
  it('sums forkCount, usage, and ratings across all scenario bank entries', async () => {
    vi.mocked(fetchMyScenarios).mockResolvedValue([
      makeScenario({ forkCount: 3, ratingsByUid: { a: 5, b: 4 } }),
      makeScenario({ forkCount: 2, ratingsByUid: { c: 3 } }),
    ]);
    vi.mocked(fetchMyAnnualPlans).mockResolvedValue([]);
    vi.mocked(subscribeMyDuggaTests).mockImplementation((_uid, onData) => { onData([]); return () => {}; });

    const summary = await fetchTeacherImpactSummary('u1');

    expect(summary.scenarioBank.totalShared).toBe(2);
    expect(summary.scenarioBank.totalForksOrAdapts).toBe(5);
    expect(summary.scenarioBank.totalRatings).toBe(3);
    expect(summary.scenarioBank.avgRating).toBe(4); // (5+4+3)/3 = 4
  });

  it('excludes private (non-public) entries from totalShared', async () => {
    vi.mocked(fetchMyScenarios).mockResolvedValue([
      makeScenario({ isPublic: true }),
      makeScenario({ isPublic: false }),
    ]);
    vi.mocked(fetchMyAnnualPlans).mockResolvedValue([]);
    vi.mocked(subscribeMyDuggaTests).mockImplementation((_uid, onData) => { onData([]); return () => {}; });

    const summary = await fetchTeacherImpactSummary('u1');
    expect(summary.scenarioBank.totalShared).toBe(1);
  });

  it('sums forks and ratings across annual plans', async () => {
    vi.mocked(fetchMyScenarios).mockResolvedValue([]);
    vi.mocked(fetchMyAnnualPlans).mockResolvedValue([
      makeAnnualPlan({ isPublic: true, forks: 4, ratingsByUid: { a: 5 } }),
      makeAnnualPlan({ isPublic: true, forks: 1, ratingsByUid: { b: 3 } }),
    ]);
    vi.mocked(subscribeMyDuggaTests).mockImplementation((_uid, onData) => { onData([]); return () => {}; });

    const summary = await fetchTeacherImpactSummary('u1');
    expect(summary.annualPlans.totalShared).toBe(2);
    expect(summary.annualPlans.totalForksOrAdapts).toBe(5);
    expect(summary.annualPlans.totalRatings).toBe(2);
    expect(summary.annualPlans.avgRating).toBe(4); // (5+3)/2
  });

  it('sums adaptCount across Dugga tests (no ratings surface for Dugga)', async () => {
    vi.mocked(fetchMyScenarios).mockResolvedValue([]);
    vi.mocked(fetchMyAnnualPlans).mockResolvedValue([]);
    vi.mocked(subscribeMyDuggaTests).mockImplementation((_uid, onData) => {
      onData([makeDuggaTest({ adaptCount: 2 }), makeDuggaTest({ adaptCount: 3, isPublic: false })]);
      return () => {};
    });

    const summary = await fetchTeacherImpactSummary('u1');
    expect(summary.duggaTests.totalShared).toBe(1); // only the public one
    expect(summary.duggaTests.totalForksOrAdapts).toBe(5);
    expect(summary.duggaTests.totalRatings).toBe(0);
    expect(summary.duggaTests.avgRating).toBeNull();
  });

  it('combines all three surfaces into a correctly weighted totals object', async () => {
    vi.mocked(fetchMyScenarios).mockResolvedValue([
      makeScenario({ isPublic: true, forkCount: 2, ratingsByUid: { a: 5, b: 5 } }), // 2 ratings, avg 5
    ]);
    vi.mocked(fetchMyAnnualPlans).mockResolvedValue([
      makeAnnualPlan({ isPublic: true, forks: 1, ratingsByUid: { c: 1 } }), // 1 rating, avg 1
    ]);
    vi.mocked(subscribeMyDuggaTests).mockImplementation((_uid, onData) => {
      onData([makeDuggaTest({ adaptCount: 1 })]);
      return () => {};
    });

    const summary = await fetchTeacherImpactSummary('u1');

    expect(summary.totals.totalShared).toBe(3); // 1 + 1 + 1
    expect(summary.totals.totalForksOrAdapts).toBe(4); // 2 + 1 + 1
    expect(summary.totals.totalRatings).toBe(3); // 2 + 1 + 0
    // Weighted avg: (5*2 + 1*1) / 3 = 11/3 = 3.666... -> rounds to 3.7
    expect(summary.totals.avgRating).toBe(3.7);
  });

  it('returns null avgRating when there are no ratings anywhere', async () => {
    vi.mocked(fetchMyScenarios).mockResolvedValue([makeScenario()]);
    vi.mocked(fetchMyAnnualPlans).mockResolvedValue([]);
    vi.mocked(subscribeMyDuggaTests).mockImplementation((_uid, onData) => { onData([]); return () => {}; });

    const summary = await fetchTeacherImpactSummary('u1');
    expect(summary.totals.totalRatings).toBe(0);
    expect(summary.totals.avgRating).toBeNull();
  });
});
