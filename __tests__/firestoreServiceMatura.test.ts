/**
 * Tests for services/firestoreService.matura.ts (T1.1).
 *
 * Strategy:
 *   - Mock firebase/firestore primitives (collection/doc/getDoc/getDocs/setDoc/query/where/orderBy/serverTimestamp).
 *   - Mock the local-fallback path so import.meta.glob does not hit real JSON.
 *   - Mock indexedDBService cache helpers.
 *   - Reset module-level caches between tests via maturaService.clearCache() + ensure
 *     mocks return predictable shapes.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Firestore primitive mocks ────────────────────────────────────────────────
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockServerTimestamp = vi.fn(() => 'SERVER_TIMESTAMP');

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((_db, ...path) => ({ __type: 'collection', path: path.join('/') })),
  doc: vi.fn((_db, ...path) => ({ __type: 'doc', path: path.join('/') })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  query: vi.fn((coll, ..._constraints) => ({ __type: 'query', coll })),
  where: vi.fn((field, op, val) => ({ __type: 'where', field, op, val })),
  orderBy: vi.fn((field) => ({ __type: 'orderBy', field })),
  serverTimestamp: () => mockServerTimestamp(),
}));

// firebaseConfig provides `db` — we don't care about its identity.
vi.mock('../firebaseConfig', () => ({ db: { __mock: true } }));

// IndexedDB cache helpers — make them no-ops returning null for offline path.
const mockGetCachedMatura = vi.fn(async () => null);
const mockCacheMatura = vi.fn(async () => undefined);
vi.mock('../services/indexedDBService', () => ({
  cacheMaturaExamQuestions: (...args: unknown[]) => mockCacheMatura(...args),
  getCachedMaturaExamQuestions: (...args: unknown[]) => mockGetCachedMatura(...args),
}));

// Logger noise — silence warnings during tests.
vi.mock('../utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  maturaService,
  buildGradeCacheKey,
  getCachedAIGrade,
  saveAIGrade,
  saveUserMaturaResult,
  getUserMaturaResults,
  saveMaturaMissionPlan,
  getActiveMaturaMission,
  buildMissionPlan,
  importMaturaFromDraft,
  getStudentMaturaProfile,
  createStudentMaturaProfile,
  updateStudentMaturaProfile,
  type MaturaQuestion,
  type MaturaExamMeta,
  type MaturaImportDraft,
  type MaturaMissionPlan,
} from '../services/firestoreService.matura';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function snap<T>(docs: T[]) {
  return {
    empty: docs.length === 0,
    docs: docs.map((data, i) => ({
      id: (data as { id?: string }).id ?? `doc-${i}`,
      data: () => data,
      exists: () => true,
    })),
  };
}

function singleSnap<T>(data: T | undefined) {
  return {
    exists: () => data !== undefined,
    data: () => data,
  };
}

function makeQ(over: Partial<MaturaQuestion> & { questionNumber: number }): MaturaQuestion {
  return {
    examId: 'exam-1',
    year: 2024,
    session: 'june',
    language: 'mk',
    questionNumber: over.questionNumber,
    part: 1,
    points: 1,
    questionType: 'mc',
    questionText: 'Test',
    choices: { А: 'a', Б: 'b' },
    correctAnswer: 'А',
    topicArea: 'algebra',
    dokLevel: 1,
    ...over,
  };
}

function makeExam(over: Partial<MaturaExamMeta> & { id: string }): MaturaExamMeta {
  return {
    id: over.id,
    year: 2024,
    session: 'june',
    language: 'mk',
    title: `Exam ${over.id}`,
    questionCount: 0,
    totalPoints: 0,
    importedAt: new Date().toISOString(),
    ...over,
  };
}

beforeEach(() => {
  maturaService.clearCache();
  mockGetDocs.mockReset();
  mockGetDoc.mockReset();
  mockSetDoc.mockReset();
  mockGetCachedMatura.mockReset();
  mockCacheMatura.mockReset();
  mockGetCachedMatura.mockResolvedValue(null);
  mockCacheMatura.mockResolvedValue(undefined);
});

// ─── buildGradeCacheKey ───────────────────────────────────────────────────────

describe('buildGradeCacheKey', () => {
  it('produces deterministic key for the same inputs', () => {
    const a = buildGradeCacheKey('exam-1', 5, 'My answer');
    const b = buildGradeCacheKey('exam-1', 5, 'My answer');
    expect(a).toBe(b);
  });

  it('is case- and whitespace-insensitive on the answer', () => {
    const a = buildGradeCacheKey('exam-1', 5, '  My Answer  ');
    const b = buildGradeCacheKey('exam-1', 5, 'my answer');
    expect(a).toBe(b);
  });

  it('produces different keys for different question numbers', () => {
    expect(buildGradeCacheKey('exam-1', 5, 'x')).not.toBe(buildGradeCacheKey('exam-1', 6, 'x'));
  });

  it('produces different keys for different exams', () => {
    expect(buildGradeCacheKey('exam-1', 5, 'x')).not.toBe(buildGradeCacheKey('exam-2', 5, 'x'));
  });

  it('embeds the examId and questionNumber in the key', () => {
    expect(buildGradeCacheKey('xyz', 7, 'answer')).toMatch(/^xyz_q7_/);
  });
});

// ─── maturaService.listExams ──────────────────────────────────────────────────

describe('maturaService.listExams', () => {
  it('returns Firestore exams sorted newest year first', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaExamMeta>([
        makeExam({ id: 'a', year: 2022 }),
        makeExam({ id: 'b', year: 2024 }),
        makeExam({ id: 'c', year: 2023 }),
      ]),
    );

    const list = await maturaService.listExams();
    expect(list.map(e => e.year)).toEqual([2024, 2023, 2022]);
  });

  it('caches the exam list (second call does not refetch)', async () => {
    mockGetDocs.mockResolvedValueOnce(snap<MaturaExamMeta>([makeExam({ id: 'a', year: 2024 })]));

    await maturaService.listExams();
    await maturaService.listExams();

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('clearCache forces a re-fetch on next call', async () => {
    mockGetDocs.mockResolvedValueOnce(snap<MaturaExamMeta>([makeExam({ id: 'a', year: 2024 })]));
    await maturaService.listExams();

    maturaService.clearCache();

    mockGetDocs.mockResolvedValueOnce(snap<MaturaExamMeta>([makeExam({ id: 'b', year: 2025 })]));
    const list = await maturaService.listExams();
    expect(list[0].id).toBe('b');
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('sorts by session then language when years are equal', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaExamMeta>([
        makeExam({ id: 'a', year: 2024, session: 'june',   language: 'mk' }),
        makeExam({ id: 'b', year: 2024, session: 'august', language: 'mk' }),
        makeExam({ id: 'c', year: 2024, session: 'august', language: 'al' }),
      ]),
    );
    const list = await maturaService.listExams();
    // 'august' < 'june' alphabetically, and 'al' < 'mk'
    expect(list.map(e => e.id)).toEqual(['c', 'b', 'a']);
  });
});

// ─── maturaService.getExamQuestions ───────────────────────────────────────────

describe('maturaService.getExamQuestions', () => {
  it('returns Firestore questions ordered by questionNumber', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaQuestion>([
        makeQ({ questionNumber: 3 }),
        makeQ({ questionNumber: 1 }),
        makeQ({ questionNumber: 2 }),
      ]),
    );

    const qs = await maturaService.getExamQuestions('exam-1');
    expect(qs.map(q => q.questionNumber)).toEqual([1, 2, 3]);
  });

  it('caches per examId — subsequent calls do not refetch', async () => {
    mockGetDocs.mockResolvedValueOnce(snap<MaturaQuestion>([makeQ({ questionNumber: 1 })]));
    await maturaService.getExamQuestions('exam-1');
    await maturaService.getExamQuestions('exam-1');
    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('writes through to IndexedDB on Firestore success', async () => {
    mockGetDocs.mockResolvedValueOnce(snap<MaturaQuestion>([makeQ({ questionNumber: 1 })]));
    await maturaService.getExamQuestions('exam-1');
    // Allow void-promise microtask to flush
    await Promise.resolve();
    expect(mockCacheMatura).toHaveBeenCalledWith('exam-1', expect.any(Array));
  });

  it('falls back to IndexedDB when Firestore throws', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('offline'));
    const cached = [makeQ({ questionNumber: 1 }), makeQ({ questionNumber: 2 })];
    mockGetCachedMatura.mockResolvedValueOnce(cached);

    const qs = await maturaService.getExamQuestions('exam-1');
    expect(qs).toHaveLength(2);
    expect(mockGetCachedMatura).toHaveBeenCalledWith('exam-1');
  });
});

// ─── maturaService.getMultiExamQuestions + filters ────────────────────────────

describe('maturaService.getMultiExamQuestions', () => {
  it('returns [] for empty examIds', async () => {
    expect(await maturaService.getMultiExamQuestions([])).toEqual([]);
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it('aggregates questions across multiple exams', async () => {
    mockGetDocs
      .mockResolvedValueOnce(snap<MaturaQuestion>([makeQ({ questionNumber: 1, examId: 'a' })]))
      .mockResolvedValueOnce(snap<MaturaQuestion>([makeQ({ questionNumber: 1, examId: 'b' })]));

    const all = await maturaService.getMultiExamQuestions(['a', 'b']);
    expect(all).toHaveLength(2);
    expect(all.map(q => q.examId).sort()).toEqual(['a', 'b']);
  });

  it('filters by topicAreas', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaQuestion>([
        makeQ({ questionNumber: 1, topicArea: 'algebra' }),
        makeQ({ questionNumber: 2, topicArea: 'geometrija' }),
        makeQ({ questionNumber: 3, topicArea: 'algebra' }),
      ]),
    );

    const filtered = await maturaService.getMultiExamQuestions(['exam-1'], { topicAreas: ['algebra'] });
    expect(filtered).toHaveLength(2);
    expect(filtered.every(q => q.topicArea === 'algebra')).toBe(true);
  });

  it('filters by parts', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaQuestion>([
        makeQ({ questionNumber: 1, part: 1 }),
        makeQ({ questionNumber: 2, part: 2 }),
        makeQ({ questionNumber: 3, part: 3 }),
      ]),
    );

    const filtered = await maturaService.getMultiExamQuestions(['exam-1'], { parts: [2, 3] });
    expect(filtered.map(q => q.part).sort()).toEqual([2, 3]);
  });

  it('filters by dokLevels', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaQuestion>([
        makeQ({ questionNumber: 1, dokLevel: 1 }),
        makeQ({ questionNumber: 2, dokLevel: 2 }),
        makeQ({ questionNumber: 3, dokLevel: 3 }),
      ]),
    );

    const filtered = await maturaService.getMultiExamQuestions(['exam-1'], { dokLevels: [2] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].dokLevel).toBe(2);
  });

  it('filters by questionType=mc (excludes open + short)', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaQuestion>([
        makeQ({ questionNumber: 1, questionType: 'mc',    choices: { А: 'a', Б: 'b' } }),
        makeQ({ questionNumber: 2, questionType: 'open',  choices: null }),
        makeQ({ questionNumber: 3, questionType: 'short', choices: null }),
      ]),
    );

    const filtered = await maturaService.getMultiExamQuestions(['exam-1'], { questionType: 'mc' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].questionType).toBe('mc');
  });

  it('filters by questionType=open (includes open + short, excludes mc)', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaQuestion>([
        makeQ({ questionNumber: 1, questionType: 'mc',    choices: { А: 'a' } }),
        makeQ({ questionNumber: 2, questionType: 'open',  choices: null }),
        makeQ({ questionNumber: 3, questionType: 'short', choices: null }),
      ]),
    );

    const filtered = await maturaService.getMultiExamQuestions(['exam-1'], { questionType: 'open' });
    expect(filtered).toHaveLength(2);
    expect(filtered.every(q => q.questionType !== 'mc')).toBe(true);
  });
});

// ─── maturaService.getTopicAreas ──────────────────────────────────────────────

describe('maturaService.getTopicAreas', () => {
  it('returns unique topicAreas (dedup, preserving filter)', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap<MaturaQuestion>([
        makeQ({ questionNumber: 1, topicArea: 'algebra' }),
        makeQ({ questionNumber: 2, topicArea: 'algebra' }),
        makeQ({ questionNumber: 3, topicArea: 'geometrija' }),
        makeQ({ questionNumber: 4, topicArea: undefined }),
      ]),
    );

    const areas = await maturaService.getTopicAreas(['exam-1']);
    expect(areas.sort()).toEqual(['algebra', 'geometrija']);
  });
});

// ─── maturaService.getQuestionsByDocIds ───────────────────────────────────────

describe('maturaService.getQuestionsByDocIds', () => {
  it('returns [] for empty input without firestore call', async () => {
    expect(await maturaService.getQuestionsByDocIds([])).toEqual([]);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('fetches each docId in parallel and ignores missing docs', async () => {
    mockGetDoc
      .mockResolvedValueOnce(singleSnap<MaturaQuestion>(makeQ({ questionNumber: 1 })))
      .mockResolvedValueOnce({ exists: () => false, data: () => undefined })
      .mockResolvedValueOnce(singleSnap<MaturaQuestion>(makeQ({ questionNumber: 2 })));

    const out = await maturaService.getQuestionsByDocIds(['a_q01', 'a_q02', 'a_q03']);
    expect(out).toHaveLength(2);
    expect(out.map(q => q.questionNumber).sort()).toEqual([1, 2]);
  });
});

// ─── AI Grade cache (getCachedAIGrade / saveAIGrade) ──────────────────────────

describe('AI grade cache', () => {
  it('getCachedAIGrade returns null on cache miss', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    expect(await getCachedAIGrade('any-key')).toBeNull();
  });

  it('getCachedAIGrade returns cached grade on hit', async () => {
    const grade = { examId: 'e', questionNumber: 1, inputHash: 'h', score: 3, maxPoints: 4, feedback: 'good' };
    mockGetDoc.mockResolvedValueOnce(singleSnap(grade));
    const out = await getCachedAIGrade('k');
    expect(out).toEqual(grade);
  });

  it('getCachedAIGrade returns null on Firestore error', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('boom'));
    expect(await getCachedAIGrade('k')).toBeNull();
  });

  it('saveAIGrade persists with serverTimestamp (fire-and-forget)', () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    saveAIGrade('k', { examId: 'e', questionNumber: 1, inputHash: 'h', score: 2, maxPoints: 4, feedback: 'ok' });
    expect(mockSetDoc).toHaveBeenCalled();
    const payload = mockSetDoc.mock.calls[0][1] as { cachedAt: unknown };
    expect(payload.cachedAt).toBe('SERVER_TIMESTAMP');
  });

  it('saveAIGrade swallows errors silently', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('write failed'));
    expect(() =>
      saveAIGrade('k', { examId: 'e', questionNumber: 1, inputHash: 'h', score: 0, maxPoints: 4, feedback: '' }),
    ).not.toThrow();
    // Allow rejected promise to settle
    await Promise.resolve();
  });
});

// ─── User matura results ──────────────────────────────────────────────────────

describe('user matura results', () => {
  it('saveUserMaturaResult writes with normalized completedAtTs', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const completedAt = '2026-04-15T10:00:00.000Z';
    await saveUserMaturaResult('uid-1', {
      examId: 'exam-1',
      examTitle: 'Exam 1',
      grades: { 1: { score: 1, maxPoints: 1 } },
      totalScore: 1,
      maxScore: 1,
      durationSeconds: 60,
      completedAt,
    });

    expect(mockSetDoc).toHaveBeenCalled();
    const payload = mockSetDoc.mock.calls[0][1] as { completedAtTs: number };
    expect(payload.completedAtTs).toBe(new Date(completedAt).getTime());
  });

  it('saveUserMaturaResult uses Date.now() when completedAt is invalid', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const before = Date.now();
    await saveUserMaturaResult('uid-1', {
      examId: 'e',
      examTitle: 'E',
      grades: {},
      totalScore: 0,
      maxScore: 0,
      durationSeconds: 0,
      completedAt: 'not-a-date',
    });
    const after = Date.now();
    const payload = mockSetDoc.mock.calls[0][1] as { completedAtTs: number };
    expect(payload.completedAtTs).toBeGreaterThanOrEqual(before);
    expect(payload.completedAtTs).toBeLessThanOrEqual(after);
  });

  it('saveUserMaturaResult swallows errors (non-blocking)', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('boom'));
    await expect(
      saveUserMaturaResult('uid-1', {
        examId: 'e', examTitle: 'E', grades: {},
        totalScore: 0, maxScore: 0, durationSeconds: 0, completedAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
  });

  it('getUserMaturaResults returns array tagged with source=firestore', async () => {
    mockGetDocs.mockResolvedValueOnce(
      snap([
        { examId: 'e', examTitle: 'E', grades: {}, totalScore: 0, maxScore: 0, durationSeconds: 0, completedAt: '2026-01-01', completedAtTs: 1 },
      ]),
    );
    const results = await getUserMaturaResults('uid-1');
    expect(results).toHaveLength(1);
    expect(results[0].source).toBe('firestore');
  });

  it('getUserMaturaResults returns [] on Firestore error', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('boom'));
    expect(await getUserMaturaResults('uid-1')).toEqual([]);
  });
});

// ─── Recovery missions ────────────────────────────────────────────────────────

describe('buildMissionPlan', () => {
  it('builds 7 days with cycling DoK 1-2-2-3-2-3-3', () => {
    const plan = buildMissionPlan('uid-1', 'concept-1', 'Концепт', 'algebra');
    expect(plan.days).toHaveLength(7);
    expect(plan.days.map(d => d.dokLevel)).toEqual([1, 2, 2, 3, 2, 3, 3]);
  });

  it('Day 1 always uses the source primary topic area', () => {
    const plan = buildMissionPlan('uid-1', 'c-1', 'C', 'geometrija');
    expect(plan.days[0].topicArea).toBe('geometrija');
    expect(plan.days[0].label).toContain('Геометрија');
  });

  it('all days start as pending with no streak/badge', () => {
    const plan = buildMissionPlan('uid-1', 'c', 'C', 'algebra');
    expect(plan.days.every(d => d.status === 'pending')).toBe(true);
    expect(plan.streakCount).toBe(0);
    expect(plan.badgeEarned).toBe(false);
  });

  it('endsAt is exactly 7 days after createdAt', () => {
    const plan = buildMissionPlan('uid-1', 'c', 'C', 'algebra');
    const diff = new Date(plan.endsAt).getTime() - new Date(plan.createdAt).getTime();
    expect(diff).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('id format is uid_timestamp', () => {
    const plan = buildMissionPlan('user-42', 'c', 'C', 'algebra');
    expect(plan.id).toMatch(/^user-42_\d+$/);
  });
});

describe('saveMaturaMissionPlan / getActiveMaturaMission', () => {
  it('saveMaturaMissionPlan writes with merge=true and serverTimestamp', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const plan = buildMissionPlan('uid-1', 'c', 'C', 'algebra');
    await saveMaturaMissionPlan('uid-1', plan);
    expect(mockSetDoc).toHaveBeenCalled();
    const opts = mockSetDoc.mock.calls[0][2] as { merge: boolean };
    expect(opts.merge).toBe(true);
  });

  it('saveMaturaMissionPlan swallows errors', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('boom'));
    const plan = buildMissionPlan('uid-1', 'c', 'C', 'algebra');
    await expect(saveMaturaMissionPlan('uid-1', plan)).resolves.toBeUndefined();
  });

  it('getActiveMaturaMission returns null when collection empty', async () => {
    mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });
    expect(await getActiveMaturaMission('uid-1')).toBeNull();
  });

  it('getActiveMaturaMission prefers a non-expired plan', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const past   = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const expired: MaturaMissionPlan = {
      id: 'p1', uid: 'u', sourceConceptId: 'c', sourceConceptTitle: 't',
      createdAt: '2024-01-01', endsAt: past, days: [], streakCount: 0, badgeEarned: false,
    };
    const active: MaturaMissionPlan = {
      id: 'p2', uid: 'u', sourceConceptId: 'c', sourceConceptTitle: 't',
      createdAt: '2026-04-01', endsAt: future, days: [], streakCount: 0, badgeEarned: false,
    };
    mockGetDocs.mockResolvedValueOnce(snap([active, expired]));
    const out = await getActiveMaturaMission('uid-1');
    expect(out?.id).toBe('p2');
  });

  it('getActiveMaturaMission returns null on error', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('boom'));
    expect(await getActiveMaturaMission('uid-1')).toBeNull();
  });
});

// ─── importMaturaFromDraft ────────────────────────────────────────────────────

describe('importMaturaFromDraft', () => {
  const draft: MaturaImportDraft = {
    examId: 'imp-1',
    title: 'Imported',
    year: 2025,
    session: 'june',
    language: 'mk',
    track: 'gymnasium',
    gradeLevel: 13,
    durationMinutes: 90,
    questions: [
      { questionNumber: 1, part: 1, points: 1, questionType: 'mc',   questionText: 'Q1', choices: { А: 'a' }, correctAnswer: 'А' },
      { questionNumber: 2, part: 2, points: 2, questionType: 'open', questionText: 'Q2' },
    ],
  };

  it('writes the exam metadata + one doc per question (3 setDoc calls)', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await importMaturaFromDraft(draft);
    // 1 exam + 2 questions = 3 setDoc calls
    expect(mockSetDoc).toHaveBeenCalledTimes(3);
  });

  it('exam metadata totalPoints is the sum of question points', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await importMaturaFromDraft(draft);
    const examPayload = mockSetDoc.mock.calls[0][1] as { totalPoints: number; questionCount: number };
    expect(examPayload.totalPoints).toBe(3);
    expect(examPayload.questionCount).toBe(2);
  });

  it('question doc IDs are zero-padded by question number', async () => {
    mockSetDoc.mockResolvedValue(undefined);
    await importMaturaFromDraft(draft);
    const q1 = mockSetDoc.mock.calls[1][0] as { path: string };
    const q2 = mockSetDoc.mock.calls[2][0] as { path: string };
    expect(q1.path).toContain('imp-1_q01');
    expect(q2.path).toContain('imp-1_q02');
  });

  it('invalidates the exam cache after import', async () => {
    mockGetDocs.mockResolvedValueOnce(snap<MaturaExamMeta>([makeExam({ id: 'a' })]));
    await maturaService.listExams();
    expect(mockGetDocs).toHaveBeenCalledTimes(1);

    mockSetDoc.mockResolvedValue(undefined);
    await importMaturaFromDraft(draft);

    mockGetDocs.mockResolvedValueOnce(snap<MaturaExamMeta>([makeExam({ id: 'imp-1' })]));
    await maturaService.listExams();
    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

// ─── Student matura profile ───────────────────────────────────────────────────

describe('student matura profile', () => {
  it('getStudentMaturaProfile returns null when doc missing', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false, data: () => undefined });
    expect(await getStudentMaturaProfile('uid-1')).toBeNull();
  });

  it('getStudentMaturaProfile returns profile when present', async () => {
    mockGetDoc.mockResolvedValueOnce(
      singleSnap({ uid: 'uid-1', name: 'Аце', track: 'gymnasium' }),
    );
    const p = await getStudentMaturaProfile('uid-1');
    expect(p?.uid).toBe('uid-1');
    expect(p?.track).toBe('gymnasium');
  });

  it('getStudentMaturaProfile returns null on error', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('boom'));
    expect(await getStudentMaturaProfile('uid-1')).toBeNull();
  });

  it('createStudentMaturaProfile writes a complete default profile', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    const profile = await createStudentMaturaProfile('uid-1', 'Ана', 'a@x', 'http://x', 'vocational4');
    expect(profile.track).toBe('vocational4');
    expect(profile.examDate).toBe('2026-06-06');
    expect(profile.weakTopics).toEqual([]);
    expect(profile.practiceStats.byTopic).toEqual({});
    expect(profile.simulationCount).toBe(0);
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('updateStudentMaturaProfile writes partial updates with merge=true', async () => {
    mockSetDoc.mockResolvedValueOnce(undefined);
    await updateStudentMaturaProfile('uid-1', { simulationCount: 5 });
    const opts = mockSetDoc.mock.calls[0][2] as { merge: boolean };
    expect(opts.merge).toBe(true);
    const payload = mockSetDoc.mock.calls[0][1] as { simulationCount: number };
    expect(payload.simulationCount).toBe(5);
  });
});
