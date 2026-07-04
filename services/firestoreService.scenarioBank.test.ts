import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  publishThematicPlanToBank,
  forkScenario,
  type ScenarioBankEntry,
} from './firestoreService.scenarioBank';
import { addDoc, updateDoc } from 'firebase/firestore';
import type { AIGeneratedThematicPlan } from '../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => 'doc-ref'),
  addDoc: vi.fn().mockResolvedValue({ id: 'new-entry-id' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn(() => 'col-ref'),
  query: vi.fn((...args) => ['query-ref', ...args]),
  where: vi.fn((...args) => ['where', ...args]),
  orderBy: vi.fn((...args) => ['orderBy', ...args]),
  limit: vi.fn((...args) => ['limit', ...args]),
  startAfter: vi.fn((...args) => ['startAfter', ...args]),
  increment: vi.fn((n) => ['increment', n]),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

/** The mocked addDoc's second argument, typed as a plain record for assertions. */
function lastAddDocPayload(): Record<string, unknown> {
  const calls = vi.mocked(addDoc).mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

function makeThematicPlan(overrides: Partial<AIGeneratedThematicPlan> = {}): AIGeneratedThematicPlan {
  return {
    thematicUnit: 'Линеарни равенки',
    lessons: [
      { lessonNumber: 1, lessonUnit: 'Час 1', learningOutcomes: 'III-А.1', keyActivities: 'Активност', assessment: 'Квиз' } as never,
    ],
    ...overrides,
  };
}

function makeEntry(overrides: Partial<ScenarioBankEntry> = {}): ScenarioBankEntry {
  return {
    id: 'entry-1',
    title: 'Тест',
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
    dokLevel: null,
    teachingModel: null,
    duration: 0,
    authorUid: 'author-uid',
    authorName: 'Автор',
    schoolName: '',
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
    isPublic: true,
    authorNotes: '',
    ...overrides,
  };
}

describe('publishThematicPlanToBank', () => {
  it('writes entryType=thematic_plan with the plan stored in generatedContent', async () => {
    const plan = makeThematicPlan();
    await publishThematicPlanToBank({
      title: 'Линеарни равенки',
      grade: 8,
      topicTitle: 'Линеарни равенки',
      plan,
      authorUid: 'u1',
      authorName: 'Наставник',
    });

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = lastAddDocPayload();
    expect(payload.entryType).toBe('thematic_plan');
    expect(payload.generatedContent).toEqual(plan);
    expect(payload.generatedMaterialType).toBe('thematicplan');
    // Denormalised scenario fields stay empty, matching the generated_material pattern
    expect(payload.scenarioIntro).toBe('');
    expect(payload.scenarioMain).toEqual([]);
  });

  it('defaults isPublic to true and respects an explicit false', async () => {
    const plan = makeThematicPlan();
    await publishThematicPlanToBank({
      title: 'X', grade: 8, topicTitle: 'X', plan, authorUid: 'u1', authorName: 'N', isPublic: false,
    });
    const payload = lastAddDocPayload();
    expect(payload.isPublic).toBe(false);
  });
});

describe('forkScenario — entryType branching', () => {
  it('forks a thematic_plan entry via publishThematicPlanToBank, not the generic LessonPlan path', async () => {
    const plan = makeThematicPlan();
    const entry = makeEntry({ entryType: 'thematic_plan', generatedContent: plan as unknown as Record<string, unknown> });

    await forkScenario(entry, 'forker-uid', 'Друг наставник', 'Друго училиште');

    expect(addDoc).toHaveBeenCalledTimes(1);
    const payload = lastAddDocPayload();
    expect(payload.entryType).toBe('thematic_plan');
    expect(payload.generatedContent).toEqual(plan);
    expect(payload.authorUid).toBe('forker-uid');
    // forkCount increment targets the root entry
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { forkCount: ['increment', 1] });
  });

  it('falls back to the generic LessonPlan fork path for lesson_plan entries', async () => {
    const entry = makeEntry({
      entryType: 'lesson_plan',
      scenarioIntro: 'Вовед',
      scenarioMain: ['Активност 1'],
      scenarioConcluding: 'Заклучок',
    });

    await forkScenario(entry, 'forker-uid', 'Друг наставник');

    const payload = lastAddDocPayload();
    expect(payload.entryType).toBeUndefined();
    expect(payload.scenarioIntro).toBe('Вовед');
    expect(payload.originalId).toBe('entry-1');
    expect(payload.forkDepth).toBe(1);
  });
});
