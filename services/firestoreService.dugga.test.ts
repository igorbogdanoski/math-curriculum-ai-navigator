import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDuggaTest, updateDuggaTest, deleteDuggaTest,
  getDuggaTest, getDuggaTestByCode, submitDuggaTest, incrementDuggaAdaptCount,
  fetchPublicDuggaTestsPage,
} from './firestoreService.dugga';
import type { DuggaTest } from './firestoreService.dugga';
import {
  doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc,
  collection, query, where, orderBy, onSnapshot, serverTimestamp,
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
