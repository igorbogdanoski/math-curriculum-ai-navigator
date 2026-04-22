import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../firebaseConfig', () => ({ db: {} }));

const getDocsMock = vi.fn();
const queryMock = vi.fn((..._args: any[]) => 'QUERY');
const collectionMock = vi.fn((..._args: any[]) => 'COLLECTION');
const limitMock = vi.fn((n: number) => ({ __limit: n }));
const startAfterMock = vi.fn((c: any) => ({ __startAfter: c }));

vi.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => collectionMock(...args),
  getDocs: (...args: any[]) => getDocsMock(...args),
  limit: (n: number) => limitMock(n),
  query: (...args: any[]) => queryMock(...args),
  startAfter: (c: any) => startAfterMock(c),
  where: (..._args: any[]) => ({ __where: true }),
  orderBy: (..._args: any[]) => ({ __orderBy: true }),
}));

const loggerErrorMock = vi.fn();
vi.mock('../utils/logger', () => ({
  logger: { error: (...args: any[]) => loggerErrorMock(...args), info: vi.fn(), warn: vi.fn() },
}));

import { firestorePage } from './firestorePagination';

const mkDoc = (id: string, data: any) => ({
  id,
  data: () => data,
});

describe('firestorePage<T> — generic Firestore cursor pagination', () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    queryMock.mockClear();
    limitMock.mockClear();
    startAfterMock.mockClear();
    loggerErrorMock.mockReset();
  });

  it('returns hasMore=true when N+1 docs are returned and trims to pageSize', async () => {
    const docs = Array.from({ length: 6 }, (_, i) => mkDoc(`d${i}`, { v: i }));
    getDocsMock.mockResolvedValueOnce({ docs });
    const result = await firestorePage<{ id: string; v: number }>({
      collectionName: 'col',
      constraints: [],
      pageSize: 5,
    });
    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(5);
    expect(result.items[0].id).toBe('d0');
    expect(result.lastDoc).toBe(docs[4]);
    expect(limitMock).toHaveBeenCalledWith(6);
  });

  it('returns hasMore=false when fewer than pageSize+1 docs returned', async () => {
    const docs = Array.from({ length: 3 }, (_, i) => mkDoc(`d${i}`, { v: i }));
    getDocsMock.mockResolvedValueOnce({ docs });
    const result = await firestorePage({
      collectionName: 'col',
      constraints: [],
      pageSize: 5,
    });
    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(3);
    expect(result.lastDoc).toBe(docs[2]);
  });

  it('applies cursor via startAfter when provided', async () => {
    const cursor = { id: 'cursor-doc' } as any;
    getDocsMock.mockResolvedValueOnce({ docs: [] });
    await firestorePage({
      collectionName: 'col',
      constraints: [],
      pageSize: 10,
      cursor,
    });
    expect(startAfterMock).toHaveBeenCalledWith(cursor);
  });

  it('applies custom mapper and filter', async () => {
    const docs = [
      mkDoc('a', { keep: true, n: 1 }),
      mkDoc('b', { keep: false, n: 2 }),
      mkDoc('c', { keep: true, n: 3 }),
    ];
    getDocsMock.mockResolvedValueOnce({ docs });
    const result = await firestorePage<{ id: string; n: number; keep: boolean }>({
      collectionName: 'col',
      constraints: [],
      mapper: (d: any) => ({ id: d.id, ...d.data() }),
      filter: (m) => m.keep,
    });
    expect(result.items.map(i => i.id)).toEqual(['a', 'c']);
  });

  it('returns empty result and logs on Firestore error', async () => {
    getDocsMock.mockRejectedValueOnce(new Error('boom'));
    const result = await firestorePage({
      collectionName: 'col',
      constraints: [],
      errorTag: 'unit-test',
    });
    expect(result).toEqual({ items: [], hasMore: false, lastDoc: null });
    expect(loggerErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('unit-test'),
      expect.any(Error),
    );
  });

  it('returns lastDoc=null when result is empty', async () => {
    getDocsMock.mockResolvedValueOnce({ docs: [] });
    const result = await firestorePage({ collectionName: 'col', constraints: [] });
    expect(result.lastDoc).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
  });
});
