import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveGradeBook, fetchMyGradeBooks, fetchGradeBook } from './firestoreService.gradeBooks';
import { addDoc, updateDoc, getDocs, getDoc, where } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ __ref: 'doc' })),
  collection: vi.fn(() => 'col-ref'),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args) => ['query-ref', ...args]),
  where: vi.fn((...args) => ['where', ...args]),
  orderBy: vi.fn((...args) => ['orderBy', ...args]),
  limit: vi.fn((...args) => ['limit', ...args]),
  addDoc: vi.fn().mockResolvedValue({ id: 'gb-new' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

describe('saveGradeBook', () => {
  it('creates a new doc when no existingId is passed', async () => {
    const id = await saveGradeBook('teacher1', 'VI-3', 6, 'traditional', []);
    expect(id).toBe('gb-new');
    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
      teacherUid: 'teacher1', className: 'VI-3', gradeLevel: 6, model: 'traditional', entries: [],
    }));
  });

  it('updates the existing doc in place when existingId is passed', async () => {
    const id = await saveGradeBook('teacher1', 'VI-3', 6, 'traditional', [], 'gb-existing');
    expect(id).toBe('gb-existing');
    expect(updateDoc).toHaveBeenCalledWith({ __ref: 'doc' }, expect.objectContaining({ className: 'VI-3', gradeLevel: 6 }));
    expect(addDoc).not.toHaveBeenCalled();
  });
});

describe('fetchMyGradeBooks', () => {
  it('queries scoped to the teacher', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
    await fetchMyGradeBooks('teacher1');
    expect(where).toHaveBeenCalledWith('teacherUid', '==', 'teacher1');
  });

  it('returns [] and swallows errors', async () => {
    vi.mocked(getDocs).mockRejectedValue(new Error('offline'));
    const result = await fetchMyGradeBooks('teacher1');
    expect(result).toEqual([]);
  });
});

describe('fetchGradeBook', () => {
  it('returns null when the doc does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    const result = await fetchGradeBook('missing');
    expect(result).toBeNull();
  });

  it('returns the mapped doc when it exists', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'gb-1',
      data: () => ({ teacherUid: 'teacher1', className: 'VI-3', gradeLevel: 6, model: 'traditional', entries: [] }),
    } as never);
    const result = await fetchGradeBook('gb-1');
    expect(result).toEqual({ id: 'gb-1', teacherUid: 'teacher1', className: 'VI-3', gradeLevel: 6, model: 'traditional', entries: [] });
  });
});
