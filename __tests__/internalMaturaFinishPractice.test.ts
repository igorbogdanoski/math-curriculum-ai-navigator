/**
 * Unit tests for C1 (S22):
 *   collectPracticeConceptIds — deduplication helper used by finishPractice()
 *   in InternalMaturaTab (MaturaLibraryView.tsx).
 *
 * Verifies that after a practice session, updateConceptMastery is triggered
 * for exactly the right set of unique concept IDs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../firebaseConfig', () => ({ db: {}, auth: {}, app: {} }));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  startAfter: vi.fn(),
  documentId: vi.fn(),
  getFirestore: vi.fn(),
  initializeFirestore: vi.fn(),
}));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(), onAuthStateChanged: vi.fn() }));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(), ref: vi.fn(), uploadBytes: vi.fn(), getDownloadURL: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(), getApps: vi.fn(() => []) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

import { collectPracticeConceptIds } from '../views/MaturaLibraryView';

describe('collectPracticeConceptIds', () => {
  it('returns empty array when practiceQs is empty', () => {
    expect(collectPracticeConceptIds([])).toEqual([]);
  });

  it('returns all conceptIds when there are no duplicates', () => {
    const qs = [
      { conceptIds: ['c1', 'c2'] },
      { conceptIds: ['c3'] },
    ];
    const result = collectPracticeConceptIds(qs);
    expect(result).toHaveLength(3);
    expect(result).toContain('c1');
    expect(result).toContain('c2');
    expect(result).toContain('c3');
  });

  it('deduplicates conceptIds that appear in multiple questions', () => {
    const qs = [
      { conceptIds: ['algebra-1', 'functions-2'] },
      { conceptIds: ['algebra-1', 'trig-3'] },
      { conceptIds: ['functions-2'] },
    ];
    const result = collectPracticeConceptIds(qs);
    expect(result).toHaveLength(3);
    expect(result).toContain('algebra-1');
    expect(result).toContain('functions-2');
    expect(result).toContain('trig-3');
  });

  it('handles questions with empty conceptIds arrays', () => {
    const qs = [
      { conceptIds: [] },
      { conceptIds: ['c1'] },
      { conceptIds: [] },
    ];
    expect(collectPracticeConceptIds(qs)).toEqual(['c1']);
  });

  it('updateConceptMastery called once per unique conceptId', async () => {
    const updateConceptMastery = vi.fn().mockResolvedValue({});
    const mockService = { updateConceptMastery };

    const qs = [
      { conceptIds: ['algebra-1', 'functions-2'] },
      { conceptIds: ['algebra-1'] },
      { conceptIds: ['trig-3'] },
    ];
    const uniqueIds = collectPracticeConceptIds(qs);
    const pct = 75;
    const studentName = 'test-user';

    uniqueIds.forEach(cid => {
      mockService.updateConceptMastery(studentName, cid, pct, { gradeLevel: 13 })
        .catch(() => {/* fire-and-forget */});
    });

    await Promise.resolve();

    expect(updateConceptMastery).toHaveBeenCalledTimes(3);
    expect(updateConceptMastery).toHaveBeenCalledWith(studentName, 'algebra-1', pct, { gradeLevel: 13 });
    expect(updateConceptMastery).toHaveBeenCalledWith(studentName, 'functions-2', pct, { gradeLevel: 13 });
    expect(updateConceptMastery).toHaveBeenCalledWith(studentName, 'trig-3', pct, { gradeLevel: 13 });
  });

  it('updateConceptMastery NOT called when practiceQs have no conceptIds', async () => {
    const updateConceptMastery = vi.fn().mockResolvedValue({});
    const mockService = { updateConceptMastery };

    const qs = [{ conceptIds: [] }, { conceptIds: [] }];
    const uniqueIds = collectPracticeConceptIds(qs);

    uniqueIds.forEach(cid => {
      mockService.updateConceptMastery('student', cid, 80, { gradeLevel: 13 })
        .catch(() => {});
    });

    await Promise.resolve();
    expect(updateConceptMastery).not.toHaveBeenCalled();
  });
});
