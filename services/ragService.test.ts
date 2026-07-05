import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../firebaseConfig', () => ({ db: {} }));

const getDocsMock = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => ({ __collection: args }),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  query: (...args: unknown[]) => ({ __query: args }),
  where: (...args: unknown[]) => ({ __where: args }),
  limit: (n: number) => ({ __limit: n }),
}));

vi.mock('./gemini/core', () => ({
  callEmbeddingProxy: vi.fn().mockResolvedValue([1, 0, 0]),
}));

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), debug: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const mkDoc = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });

describe('ragService.searchSimilarContext — concept_embeddings crowding-out fix', () => {
  beforeEach(() => {
    getDocsMock.mockReset();
    localStorage.setItem('VITE_ENABLE_VECTOR_RAG', 'true');
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.removeItem('VITE_ENABLE_VECTOR_RAG');
  });

  it('includes a scenario-sourced doc even when the flat (general) query does not return it', async () => {
    // The flat 500-cap query returns only curriculum-concept docs (no `source` field) —
    // simulating a case where scenario docs got crowded out of that query's raw order.
    getDocsMock.mockResolvedValueOnce({
      docs: [mkDoc('curriculum-1', { vector: [1, 0, 0], text: 'Дропки', source: undefined, grade: 5 })],
    });
    // The dedicated scenario_bank query supplies the scenario doc regardless.
    getDocsMock.mockResolvedValueOnce({
      docs: [mkDoc('scenario_abc', { vector: [1, 0, 0], text: 'Сценарио за дропки', source: 'scenario_bank', grade: 5 })],
    });

    const { ragService } = await import('./ragService');
    const results = await ragService.searchSimilarContext('дропки', 5);

    expect(getDocsMock).toHaveBeenCalledTimes(2);
    const ids = results.map(r => r.conceptId);
    expect(ids).toContain('scenario_abc');
    expect(ids).toContain('curriculum-1');
  });

  it('deduplicates when the same id appears in both queries', async () => {
    getDocsMock.mockResolvedValueOnce({
      docs: [mkDoc('scenario_dup', { vector: [1, 0, 0], text: 'A', source: 'scenario_bank', grade: 5 })],
    });
    getDocsMock.mockResolvedValueOnce({
      docs: [mkDoc('scenario_dup', { vector: [1, 0, 0], text: 'A', source: 'scenario_bank', grade: 5 })],
    });

    const { ragService } = await import('./ragService');
    const results = await ragService.searchSimilarContext('test', 5);

    expect(results.filter(r => r.conceptId === 'scenario_dup')).toHaveLength(1);
  });
});
