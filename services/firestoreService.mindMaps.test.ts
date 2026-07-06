import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveMindMap, fetchMyMindMaps, fetchMindMap } from './firestoreService.mindMaps';
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
  addDoc: vi.fn().mockResolvedValue({ id: 'map-new' }),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

describe('saveMindMap', () => {
  it('creates a new doc when no existingId is passed', async () => {
    const id = await saveMindMap('teacher1', 'Дропки', 6, []);
    expect(id).toBe('map-new');
    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({ teacherUid: 'teacher1', topic: 'Дропки', gradeLevel: 6 }));
  });

  it('updates the existing doc in place when existingId is passed', async () => {
    const id = await saveMindMap('teacher1', 'Дропки', 6, [], 'map-existing');
    expect(id).toBe('map-existing');
    expect(updateDoc).toHaveBeenCalledWith({ __ref: 'doc' }, expect.objectContaining({ topic: 'Дропки', gradeLevel: 6 }));
    expect(addDoc).not.toHaveBeenCalled();
  });
});

describe('fetchMyMindMaps', () => {
  it('queries scoped to the teacher and bounded by limit', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
    await fetchMyMindMaps('teacher1');
    expect(where).toHaveBeenCalledWith('teacherUid', '==', 'teacher1');
  });

  it('returns [] and swallows errors', async () => {
    vi.mocked(getDocs).mockRejectedValue(new Error('offline'));
    const result = await fetchMyMindMaps('teacher1');
    expect(result).toEqual([]);
  });
});

describe('fetchMindMap', () => {
  it('returns null when the doc does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as never);
    const result = await fetchMindMap('missing');
    expect(result).toBeNull();
  });

  it('returns the mapped doc when it exists', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      id: 'map-1',
      data: () => ({ teacherUid: 'teacher1', topic: 'Дропки', gradeLevel: 6, nodes: [] }),
    } as never);
    const result = await fetchMindMap('map-1');
    expect(result).toEqual({ id: 'map-1', teacherUid: 'teacher1', topic: 'Дропки', gradeLevel: 6, nodes: [] });
  });
});
