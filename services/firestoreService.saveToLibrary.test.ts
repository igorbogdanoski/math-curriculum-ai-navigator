import { describe, it, expect, vi, beforeEach } from 'vitest';

const { addDocMock, collectionMock, getDocs_mock, query_mock, where_mock, limit_mock, serverTimestampMock } = vi.hoisted(() => ({
    addDocMock: vi.fn(),
    collectionMock: vi.fn(() => 'col-ref'),
    getDocs_mock: vi.fn(),
    query_mock: vi.fn((...args: unknown[]) => args),
    where_mock: vi.fn((...args: unknown[]) => ({ where: args })),
    limit_mock: vi.fn((n: number) => ({ limit: n })),
    serverTimestampMock: vi.fn(() => 'mock-ts'),
}));

vi.mock('firebase/firestore', async () => {
    const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
    return {
        ...actual,
        addDoc: addDocMock,
        collection: collectionMock,
        getDocs: getDocs_mock,
        query: query_mock,
        where: where_mock,
        limit: limit_mock,
        serverTimestamp: serverTimestampMock,
        orderBy: vi.fn(),
        startAfter: vi.fn(),
    };
});

vi.mock('../firebaseConfig', () => ({ db: { __test: true } }));

vi.mock('./gemini/core', () => ({
    callEmbeddingProxy: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const { saveToLibrary } = await import('./firestoreService.materials');

const BASE_META = {
    title: 'Квадратни равенки',
    type: 'quiz' as const,
    teacherUid: 'teacher-abc',
    conceptId: 'alg-quad',
    topicId: 'algebra',
    gradeLevel: 9,
};

describe('saveToLibrary — content deduplication', () => {
    beforeEach(() => {
        addDocMock.mockReset();
        getDocs_mock.mockReset();
        collectionMock.mockReturnValue('col-ref');
        addDocMock.mockResolvedValue({ id: 'new-material-id' });
    });

    it('returns existing material id when hash already exists (dedup hit)', async () => {
        getDocs_mock.mockResolvedValue({
            empty: false,
            docs: [{ id: 'existing-material-id' }],
        });

        const id = await saveToLibrary({ questions: [] }, BASE_META);

        expect(id).toBe('existing-material-id');
        expect(addDocMock).not.toHaveBeenCalled();
    });

    it('saves new document when no duplicate exists', async () => {
        getDocs_mock.mockResolvedValue({ empty: true, docs: [] });

        const id = await saveToLibrary({ questions: [] }, BASE_META);

        expect(id).toBe('new-material-id');
        expect(addDocMock).toHaveBeenCalledOnce();

        const savedData = addDocMock.mock.calls[0][1];
        expect(savedData).toHaveProperty('contentHash');
        expect(typeof savedData.contentHash).toBe('string');
        expect(savedData.contentHash).toHaveLength(64);
    });

    it('saves contentHash field to the document', async () => {
        getDocs_mock.mockResolvedValue({ empty: true, docs: [] });

        await saveToLibrary('some content text', BASE_META);

        const savedData = addDocMock.mock.calls[0][1];
        expect(savedData.contentHash).toBeDefined();
        expect(savedData.type).toBe('quiz');
        expect(savedData.teacherUid).toBe('teacher-abc');
    });

    it('produces the same hash for same inputs (idempotent)', async () => {
        getDocs_mock.mockResolvedValue({ empty: true, docs: [] });

        await saveToLibrary('content', BASE_META);
        const hash1 = addDocMock.mock.calls[0][1].contentHash as string;

        addDocMock.mockReset();
        addDocMock.mockResolvedValue({ id: 'new-material-id-2' });
        getDocs_mock.mockResolvedValue({ empty: true, docs: [] });

        await saveToLibrary('content', BASE_META);
        const hash2 = addDocMock.mock.calls[0][1].contentHash as string;

        expect(hash1).toBe(hash2);
    });

    it('produces different hash when title differs', async () => {
        getDocs_mock.mockResolvedValue({ empty: true, docs: [] });

        await saveToLibrary('content', { ...BASE_META, title: 'Линеарни равенки' });
        const hash1 = addDocMock.mock.calls[0][1].contentHash as string;

        addDocMock.mockReset();
        addDocMock.mockResolvedValue({ id: 'new-material-id-2' });
        getDocs_mock.mockResolvedValue({ empty: true, docs: [] });

        await saveToLibrary('content', { ...BASE_META, title: 'Квадратни равенки' });
        const hash2 = addDocMock.mock.calls[0][1].contentHash as string;

        expect(hash1).not.toBe(hash2);
    });
});
