import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getDocsMock,
  collectionMock,
  queryMock,
  whereMock,
  orderByMock,
  limitMock,
  startAfterMock,
} = vi.hoisted(() => ({
  getDocsMock: vi.fn(),
  collectionMock: vi.fn(() => 'cached_ai_materials_ref'),
  queryMock: vi.fn((...args: unknown[]) => ({ __query: args })),
  whereMock: vi.fn((...args: unknown[]) => ({ __where: args })),
  orderByMock: vi.fn((...args: unknown[]) => ({ __orderBy: args })),
  limitMock: vi.fn((n: number) => ({ __limit: n })),
  startAfterMock: vi.fn((c: unknown) => ({ __startAfter: c })),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    getDocs: getDocsMock,
    collection: collectionMock,
    query: queryMock,
    where: whereMock,
    orderBy: orderByMock,
    limit: limitMock,
    startAfter: startAfterMock,
  };
});

vi.mock('../firebaseConfig', () => ({
  db: { __test: true },
}));

import { fetchLibraryPage } from './firestoreService.materials';

function fakeDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe('fetchLibraryPage — cursor pagination', () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    queryMock.mockClear();
    whereMock.mockClear();
    orderByMock.mockClear();
    limitMock.mockClear();
    startAfterMock.mockClear();
  });

  it('returns items + hasMore=true when more than pageSize docs are returned', async () => {
    const docs = Array.from({ length: 4 }, (_, i) => fakeDoc(`m${i}`, { title: `t${i}`, teacherUid: 'u1' }));
    getDocsMock.mockResolvedValue({ docs });

    const { items, hasMore, lastDoc } = await fetchLibraryPage('u1', 3);

    expect(items).toHaveLength(3);
    expect(hasMore).toBe(true);
    expect(lastDoc).toBe(docs[2]);
    // limit should be pageSize + 1
    expect(limitMock).toHaveBeenCalledWith(4);
    expect(whereMock).toHaveBeenCalledWith('teacherUid', '==', 'u1');
    expect(orderByMock).toHaveBeenCalledWith('createdAt', 'desc');
    // No cursor on first page
    expect(startAfterMock).not.toHaveBeenCalled();
  });

  it('returns hasMore=false when fewer than pageSize+1 docs are returned', async () => {
    const docs = Array.from({ length: 2 }, (_, i) => fakeDoc(`m${i}`, { title: `t${i}`, teacherUid: 'u1' }));
    getDocsMock.mockResolvedValue({ docs });

    const { items, hasMore, lastDoc } = await fetchLibraryPage('u1', 3);

    expect(items).toHaveLength(2);
    expect(hasMore).toBe(false);
    expect(lastDoc).toBe(docs[1]);
  });

  it('uses startAfter cursor when cursor is provided', async () => {
    const cursor = fakeDoc('cursor-doc', { title: 'prev' }) as any;
    const docs = [fakeDoc('m10', { title: 't10', teacherUid: 'u1' })];
    getDocsMock.mockResolvedValue({ docs });

    await fetchLibraryPage('u1', 3, cursor);

    expect(startAfterMock).toHaveBeenCalledWith(cursor);
  });

  it('filters out archived materials from returned items', async () => {
    const docs = [
      fakeDoc('m1', { title: 'keep', teacherUid: 'u1' }),
      fakeDoc('m2', { title: 'archived', teacherUid: 'u1', archivedAt: 'yesterday' }),
      fakeDoc('m3', { title: 'keep2', teacherUid: 'u1' }),
    ];
    getDocsMock.mockResolvedValue({ docs });

    const { items } = await fetchLibraryPage('u1', 10);

    expect(items.map(i => i.id)).toEqual(['m1', 'm3']);
  });

  it('returns empty result and hasMore=false on Firestore error', async () => {
    getDocsMock.mockRejectedValue(new Error('network down'));

    const { items, hasMore, lastDoc } = await fetchLibraryPage('u1', 10);

    expect(items).toEqual([]);
    expect(hasMore).toBe(false);
    expect(lastDoc).toBeNull();
  });

  it('returns lastDoc=null when no docs returned', async () => {
    getDocsMock.mockResolvedValue({ docs: [] });

    const { items, hasMore, lastDoc } = await fetchLibraryPage('u1', 10);

    expect(items).toEqual([]);
    expect(hasMore).toBe(false);
    expect(lastDoc).toBeNull();
  });
});
