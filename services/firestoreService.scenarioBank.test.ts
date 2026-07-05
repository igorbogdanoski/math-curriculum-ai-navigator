import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  publishThematicPlanToBank,
  forkScenario,
  fetchScenarios,
  fetchScenariosForSearch,
  type ScenarioBankEntry,
} from './firestoreService.scenarioBank';
import { addDoc, updateDoc, getDocs, startAfter } from 'firebase/firestore';
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

  it('threads originalId/forkDepth/originalAuthor through a thematic_plan fork instead of dropping lineage', async () => {
    const plan = makeThematicPlan();
    const entry = makeEntry({
      id: 'entry-1',
      entryType: 'thematic_plan',
      generatedContent: plan as unknown as Record<string, unknown>,
      authorUid: 'author-uid',
      authorName: 'Оригинален Автор',
    });

    await forkScenario(entry, 'forker-uid', 'Друг наставник');

    const payload = lastAddDocPayload();
    expect(payload.originalId).toBe('entry-1');
    expect(payload.forkDepth).toBe(1);
    expect(payload.originalAuthorName).toBe('Оригинален Автор');
    expect(payload.originalAuthorUid).toBe('author-uid');
  });

  it('collapses the chain on a re-fork: keeps the root author, not the immediate parent', async () => {
    const plan = makeThematicPlan();
    const entry = makeEntry({
      id: 'entry-2',
      entryType: 'thematic_plan',
      generatedContent: plan as unknown as Record<string, unknown>,
      authorUid: 'forker-uid', // this entry's own author is the first forker
      authorName: 'Друг наставник',
      originalId: 'entry-1',
      forkDepth: 1,
      originalAuthorName: 'Оригинален Автор',
      originalAuthorUid: 'author-uid',
    });

    await forkScenario(entry, 'second-forker-uid', 'Трет наставник');

    const payload = lastAddDocPayload();
    expect(payload.originalId).toBe('entry-1');
    expect(payload.forkDepth).toBe(2);
    expect(payload.originalAuthorName).toBe('Оригинален Автор');
    expect(payload.originalAuthorUid).toBe('author-uid');
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
    expect(payload.originalAuthorName).toBe('Автор');
    expect(payload.originalAuthorUid).toBe('author-uid');
  });
});

/** A fake Firestore QueryDocumentSnapshot — just enough shape for the code under test. */
function makeDoc(id: string, overrides: Partial<ScenarioBankEntry> = {}) {
  const { id: _ignored, ...entry } = makeEntry({ id, ...overrides });
  return { id, data: () => entry };
}

function mockSnapshot(docs: ReturnType<typeof makeDoc>[]) {
  vi.mocked(getDocs).mockResolvedValueOnce({ docs } as never);
}

describe('fetchScenarios — pagination', () => {
  it('reports hasMore=false and lastDoc=null when fewer docs than the page size come back', async () => {
    mockSnapshot([makeDoc('a'), makeDoc('b')]);
    const page = await fetchScenarios({}, 5);
    expect(page.entries).toHaveLength(2);
    expect(page.hasMore).toBe(false);
    expect(page.lastDoc).toBeNull();
  });

  it('reports hasMore=true and a lastDoc when the peek-ahead extra doc comes back', async () => {
    // pageLimit=2 → fetch size 3 (peek-ahead); simulate 3 docs coming back
    mockSnapshot([makeDoc('a'), makeDoc('b'), makeDoc('c')]);
    const page = await fetchScenarios({}, 2);
    expect(page.entries).toHaveLength(2);
    expect(page.entries.map(e => e.id)).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(true);
    expect(page.lastDoc).toEqual(expect.objectContaining({ id: 'b' }));
  });

  it('passes the cursor through to startAfter when fetching a subsequent page', async () => {
    mockSnapshot([makeDoc('c')]);
    const cursor = { id: 'b' } as never;
    await fetchScenarios({}, 5, cursor);
    expect(startAfter).toHaveBeenCalledWith(cursor);
  });

  it('applies client-side dokLevel filtering within a raw page without corrupting pagination boundaries', async () => {
    // 3 raw docs, only 2 match dokLevel=2 — hasMore/lastDoc must still reflect the raw page, not the filtered count
    mockSnapshot([
      makeDoc('a', { dokLevel: 2 }),
      makeDoc('b', { dokLevel: 3 }),
      makeDoc('c', { dokLevel: 2 }),
    ]);
    const page = await fetchScenarios({ dokLevel: 2 }, 10);
    expect(page.entries.map(e => e.id)).toEqual(['a', 'c']);
  });
});

describe('fetchScenariosForSearch', () => {
  it('reports truncated=false when fewer results than the cap come back', async () => {
    mockSnapshot([makeDoc('a'), makeDoc('b')]);
    const page = await fetchScenariosForSearch({}, 10);
    expect(page.entries).toHaveLength(2);
    expect(page.truncated).toBe(false);
  });

  it('reports truncated=true when the cap is hit, so the UI can show an honest notice', async () => {
    mockSnapshot([makeDoc('a'), makeDoc('b'), makeDoc('c')]);
    const page = await fetchScenariosForSearch({}, 3);
    expect(page.entries).toHaveLength(3);
    expect(page.truncated).toBe(true);
  });

  it('applies client-side teachingModel filtering after the fetch', async () => {
    mockSnapshot([
      makeDoc('a', { teachingModel: '5E' }),
      makeDoc('b', { teachingModel: 'PBL' }),
    ]);
    const page = await fetchScenariosForSearch({ teachingModel: 'PBL' }, 10);
    expect(page.entries.map(e => e.id)).toEqual(['b']);
  });
});
