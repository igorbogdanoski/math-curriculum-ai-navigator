import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDuggaTest, updateDuggaTest, deleteDuggaTest,
  getDuggaTest, getDuggaTestByCode, submitDuggaTest, incrementDuggaAdaptCount,
  fetchPublicDuggaTestsPage, gradeSubmissionQuestion,
} from './firestoreService.dugga';
import type { DuggaTest } from './firestoreService.dugga';
import {
  doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where,
} from 'firebase/firestore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
  increment: vi.fn((n: number) => ['increment', n]),
  limit: (n: number) => ({ __limit: n }),
  startAfter: (c: unknown) => ({ __startAfter: c }),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTestData(): Omit<DuggaTest, 'id' | 'shareCode' | 'createdAt'> {
  return {
    title: 'Тест за алгебра',
    teacherUid: 'teacher-123',
    teacherName: 'Ана Наставник',
    grade: 8,
    track: 'gymnasium',
    topics: ['Линеарни равенки'],
    testType: 'topic',
    questions: [],
    isPublic: false,
    totalPoints: 20,
    estimatedMinutes: 30,
  };
}

// ─── createDuggaTest ─────────────────────────────────────────────────────────

describe('createDuggaTest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls addDoc on dugga_tests collection and returns new id', async () => {
    (collection as ReturnType<typeof vi.fn>).mockReturnValue('col-ref');
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new-test-id' });

    const id = await createDuggaTest(makeTestData());

    expect(collection).toHaveBeenCalledWith({}, 'dugga_tests');
    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
      title: 'Тест за алгебра',
      teacherUid: 'teacher-123',
      createdAt: 'SERVER_TS',
    }));
    expect(id).toBe('new-test-id');
  });

  it('attaches a 6-character share code', async () => {
    (collection as ReturnType<typeof vi.fn>).mockReturnValue('col-ref');
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'x' });

    await createDuggaTest(makeTestData());

    const [, payload] = (addDoc as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload.shareCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('share code uses only unambiguous characters (no O, 0, I, 1)', async () => {
    (collection as ReturnType<typeof vi.fn>).mockReturnValue('col-ref');
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'x' });

    // Generate many codes and verify the character set
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      await createDuggaTest(makeTestData());
      const [, payload] = (addDoc as ReturnType<typeof vi.fn>).mock.calls[i];
      codes.add(payload.shareCode);
    }
    const allChars = [...codes].join('');
    expect(allChars).not.toMatch(/[O0I1]/);
  });
});

// ─── updateDuggaTest ─────────────────────────────────────────────────────────

describe('updateDuggaTest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls updateDoc with updatedAt timestamp', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    await updateDuggaTest('test-123', { title: 'Нов наслов' });

    expect(doc).toHaveBeenCalledWith({}, 'dugga_tests', 'test-123');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', {
      title: 'Нов наслов',
      updatedAt: 'SERVER_TS',
    });
  });
});

// ─── deleteDuggaTest ─────────────────────────────────────────────────────────

describe('deleteDuggaTest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls deleteDoc on the correct document ref', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    await deleteDuggaTest('test-456');

    expect(doc).toHaveBeenCalledWith({}, 'dugga_tests', 'test-456');
    expect(deleteDoc).toHaveBeenCalledWith('doc-ref');
  });
});

// ─── incrementDuggaAdaptCount ──────────────────────────────────────────────────

describe('incrementDuggaAdaptCount', () => {
  beforeEach(() => vi.clearAllMocks());

  it('increments adaptCount on the original test document', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    await incrementDuggaAdaptCount('original-test-id');

    expect(doc).toHaveBeenCalledWith({}, 'dugga_tests', 'original-test-id');
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', { adaptCount: ['increment', 1] });
  });
});

// ─── getDuggaTest ─────────────────────────────────────────────────────────────

describe('getDuggaTest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when document does not exist', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: () => false });

    const result = await getDuggaTest('nonexistent');
    expect(result).toBeNull();
  });

  it('returns test with id merged from snapshot', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      id: 'test-789',
      data: () => ({ title: 'Геометрија', grade: 9 }),
    });

    const result = await getDuggaTest('test-789');
    expect(result?.id).toBe('test-789');
    expect(result?.title).toBe('Геометрија');
    expect(result?.grade).toBe(9);
  });
});

// ─── getDuggaTestByCode ───────────────────────────────────────────────────────

describe('getDuggaTestByCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for empty snapshot', async () => {
    (collection as ReturnType<typeof vi.fn>).mockReturnValue('col-ref');
    (query as ReturnType<typeof vi.fn>).mockReturnValue('q-ref');
    (where as ReturnType<typeof vi.fn>).mockReturnValue('where-ref');
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });

    const result = await getDuggaTestByCode('XXXXXX');
    expect(result).toBeNull();
  });

  it('uppercases the share code before querying', async () => {
    (collection as ReturnType<typeof vi.fn>).mockReturnValue('col-ref');
    (query as ReturnType<typeof vi.fn>).mockReturnValue('q-ref');
    (where as ReturnType<typeof vi.fn>).mockReturnValue('where-ref');
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({ empty: true, docs: [] });

    await getDuggaTestByCode('ab3k7z');
    expect(where).toHaveBeenCalledWith('shareCode', '==', 'AB3K7Z');
  });

  it('returns the first matching test from snapshot', async () => {
    (collection as ReturnType<typeof vi.fn>).mockReturnValue('col-ref');
    (query as ReturnType<typeof vi.fn>).mockReturnValue('q-ref');
    (where as ReturnType<typeof vi.fn>).mockReturnValue('where-ref');
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue({
      empty: false,
      docs: [{ id: 'test-abc', data: () => ({ title: 'Алгебра', shareCode: 'AB3K7Z' }) }],
    });

    const result = await getDuggaTestByCode('AB3K7Z');
    expect(result?.id).toBe('test-abc');
    expect(result?.title).toBe('Алгебра');
  });
});

// ─── submitDuggaTest ─────────────────────────────────────────────────────────

describe('submitDuggaTest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves to dugga_submissions with submittedAt timestamp', async () => {
    (collection as ReturnType<typeof vi.fn>).mockReturnValue('col-ref');
    (addDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'sub-1' });

    const subId = await submitDuggaTest({
      testId: 'test-1', testTitle: 'Тест',
      teacherUid: 'teacher-1', studentUid: 'uid-1', studentName: 'Петар',
      answers: { q1: 'a' }, score: 8, totalPoints: 10, percentage: 80,
    });

    expect(collection).toHaveBeenCalledWith({}, 'dugga_submissions');
    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
      studentName: 'Петар', score: 8, submittedAt: 'SERVER_TS',
    }));
    expect(subId).toBe('sub-1');
  });
});

// ─── gradeSubmissionQuestion ──────────────────────────────────────────────────
// 2026-07-19 (audit_2026_07_18_full_app_review, Wave 5.2): lets a teacher manually
// award points for a question that couldn't be auto/AI-graded (correct: null),
// recomputing score/percentage/pendingReviewPoints from the full result set so
// they never drift out of sync with the per-question detail.

describe('gradeSubmissionQuestion', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockSubmission(overrides: Record<string, unknown> = {}) {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      data: () => ({
        totalPoints: 10,
        score: 4,
        questionResults: {
          q1: { earned: 4, maxPoints: 4, correct: true, feedback: '' },
          q2: { earned: 0, maxPoints: 6, correct: null, feedback: 'Потребно дополнително оценување' },
        },
        ...overrides,
      }),
    });
  }

  it('throws when the submission does not exist', async () => {
    (doc as ReturnType<typeof vi.fn>).mockReturnValue('doc-ref');
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: () => false });
    await expect(gradeSubmissionQuestion('missing-sub', 'q2', 5)).rejects.toThrow('Submission not found');
  });

  it('throws for a questionId not present in questionResults', async () => {
    mockSubmission();
    await expect(gradeSubmissionQuestion('sub-1', 'q-unknown', 5)).rejects.toThrow('Unknown question for this submission');
  });

  it('awards full points and marks correct=true when earnedPoints meets maxPoints', async () => {
    mockSubmission();
    await gradeSubmissionQuestion('sub-1', 'q2', 6);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
      score: 10, // 4 (q1) + 6 (q2)
      pendingReviewPoints: 0,
      percentage: 100, // 10/10, no more pending
      questionResults: expect.objectContaining({
        q2: expect.objectContaining({ earned: 6, correct: true }),
      }),
    }));
  });

  it('awards partial credit and keeps correct=false (not null) once graded', async () => {
    mockSubmission();
    await gradeSubmissionQuestion('sub-1', 'q2', 3);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
      score: 7, // 4 + 3
      pendingReviewPoints: 0,
      percentage: 70, // 7/10
      questionResults: expect.objectContaining({
        q2: expect.objectContaining({ earned: 3, correct: false }),
      }),
    }));
  });

  it('clamps earnedPoints to [0, maxPoints]', async () => {
    mockSubmission();
    await gradeSubmissionQuestion('sub-1', 'q2', 999);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
      questionResults: expect.objectContaining({ q2: expect.objectContaining({ earned: 6 }) }),
    }));

    await gradeSubmissionQuestion('sub-1', 'q2', -5);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
      questionResults: expect.objectContaining({ q2: expect.objectContaining({ earned: 0 }) }),
    }));
  });

  it('leaves other still-pending questions out of the percentage denominator', async () => {
    mockSubmission({
      totalPoints: 15,
      questionResults: {
        q1: { earned: 4, maxPoints: 4, correct: true, feedback: '' },
        q2: { earned: 0, maxPoints: 6, correct: null, feedback: '' },
        q3: { earned: 0, maxPoints: 5, correct: null, feedback: '' },
      },
    });
    await gradeSubmissionQuestion('sub-1', 'q2', 6);
    expect(updateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
      score: 10, // 4 + 6, q3 still ungraded
      pendingReviewPoints: 5, // q3 still pending
      percentage: 100, // 10/(15-5)
    }));
  });
});

describe('fetchPublicDuggaTestsPage — replaces the old unbounded live listener', () => {
  beforeEach(() => vi.clearAllMocks());

  const mkDoc = (id: string) => ({ id, data: () => ({ title: `Тест ${id}`, isPublic: true }) });

  it('returns hasMore=false when fewer docs than the page size come back', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ docs: [mkDoc('a'), mkDoc('b')] });
    const page = await fetchPublicDuggaTestsPage(5);
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it('reports hasMore=true and a lastDoc when the peek-ahead extra doc comes back', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ docs: [mkDoc('a'), mkDoc('b'), mkDoc('c')] });
    const page = await fetchPublicDuggaTestsPage(2);
    expect(page.items.map(t => t.id)).toEqual(['a', 'b']);
    expect(page.hasMore).toBe(true);
    expect(page.lastDoc).toEqual(expect.objectContaining({ id: 'b' }));
  });
});
