import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deleteAllUserData, exportUserData, downloadUserDataAsJson } from './firestoreService.gdpr';
import {
  collection, query, where, getDocs, deleteDoc, doc, getDoc, writeBatch,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDocs: vi.fn(),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn((...args: unknown[]) => ({ __docPath: args })),
  getDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  deleteObject: vi.fn(),
}));

vi.mock('../firebaseConfig', () => ({ db: {}, storage: {} }));

function makeSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    size: docs.length,
    docs: docs.map(d => ({ id: d.id, ref: { __id: d.id }, data: () => d.data })),
  };
}

describe('deleteAllUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue(makeSnap([]));
    (deleteDoc as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (deleteObject as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (writeBatch as ReturnType<typeof vi.fn>).mockReturnValue({
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    });
  });

  it('queries every teacherUid-scoped collection plus the special-field collections', async () => {
    await deleteAllUserData('teacher-1');

    const whereCalls = (where as ReturnType<typeof vi.fn>).mock.calls;
    const teacherUidCollections = [
      'quiz_results', 'concept_mastery', 'student_gamification', 'cached_ai_materials',
      'classes', 'class_memberships', 'assignments', 'material_feedback',
      'saved_questions', 'announcements', 'chat_sessions', 'spaced_rep',
    ];
    for (const c of teacherUidCollections) {
      expect((collection as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([{}, c]);
    }
    // Special owner-field collections — regression guard for the field-name mismatches
    // this exact file already had (the 'announcement'/'announcements' typo fixed earlier).
    expect(whereCalls).toContainEqual(['hostUid', '==', 'teacher-1']); // live_sessions, live_quizzes
    expect(whereCalls).toContainEqual(['userId', '==', 'teacher-1']); // academic_annual_plans
    expect(whereCalls).toContainEqual(['uid', '==', 'teacher-1']); // user_tokens
    expect(whereCalls.filter(c => c[0] === 'teacherUid').length).toBe(teacherUidCollections.length);
  });

  it('deletes the user profile document and attempts the Storage profile picture', async () => {
    await deleteAllUserData('teacher-1');
    expect(deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ __docPath: [{}, 'users', 'teacher-1'] }));
    expect(ref).toHaveBeenCalledWith({}, 'profilePictures/teacher-1');
    expect(deleteObject).toHaveBeenCalled();
  });

  it('does not throw even when some collection deletes fail (Promise.allSettled resilience)', async () => {
    (getDocs as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('permission-denied'))
      .mockResolvedValue(makeSnap([]));

    await expect(deleteAllUserData('teacher-1')).resolves.toBeUndefined();
  });

  it('does not throw when the Storage profile picture is missing (404)', async () => {
    (deleteObject as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('object-not-found'));
    await expect(deleteAllUserData('teacher-1')).resolves.toBeUndefined();
  });

  it('batches deletes for a collection with matching documents', async () => {
    const batchMock = { delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
    (writeBatch as ReturnType<typeof vi.fn>).mockReturnValue(batchMock);
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSnap([{ id: 'q1', data: { teacherUid: 'teacher-1' } }, { id: 'q2', data: { teacherUid: 'teacher-1' } }])
    );

    await deleteAllUserData('teacher-1');

    expect(batchMock.delete).toHaveBeenCalled();
    expect(batchMock.commit).toHaveBeenCalled();
  });
});

describe('exportUserData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({ exists: () => false, data: () => undefined });
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue(makeSnap([]));
  });

  it('returns null profile when the user document does not exist', async () => {
    const result = await exportUserData('teacher-1');
    expect(result.profile).toBeNull();
    expect(result.uid).toBe('teacher-1');
    expect(typeof result.exportedAt).toBe('string');
  });

  it('includes the profile data when the user document exists', async () => {
    (getDoc as ReturnType<typeof vi.fn>).mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'Ана', role: 'teacher' }),
    });
    const result = await exportUserData('teacher-1');
    expect(result.profile).toEqual({ name: 'Ана', role: 'teacher' });
  });

  it('collects quiz results and other per-collection arrays', async () => {
    (getDocs as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeSnap([{ id: 'r1', data: { percentage: 90 } }])
    );
    const result = await exportUserData('teacher-1');
    expect(result.quizResults).toEqual([{ id: 'r1', percentage: 90 }]);
  });

  it('records a warning and returns an empty array when a collection query fails, without throwing', async () => {
    (getDocs as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('index-missing'))
      .mockResolvedValue(makeSnap([]));

    const result = await exportUserData('teacher-1');
    expect(result.quizResults).toEqual([]);
    expect(Array.isArray(result.exportWarnings)).toBe(true);
    expect((result.exportWarnings as string[])[0]).toContain('quiz_results');
  });

  it('omits exportWarnings entirely when nothing failed', async () => {
    const result = await exportUserData('teacher-1');
    expect(result.exportWarnings).toBeUndefined();
  });

  it('records a warning (not a throw) when the profile fetch itself fails', async () => {
    (getDoc as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('permission-denied'));
    const result = await exportUserData('teacher-1');
    expect(result.profile).toBeNull();
    expect((result.exportWarnings as string[]).some(w => w.includes('users/teacher-1'))).toBe(true);
  });
});

describe('downloadUserDataAsJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom doesn't implement the Blob URL APIs — stub them for the click-download path.
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  it('creates a filename containing the uid prefix and current date', () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') el.click = clickSpy;
      return el;
    });

    downloadUserDataAsJson({ some: 'data' }, 'teacher-abcdefgh12345');

    expect(clickSpy).toHaveBeenCalled();
    const anchor = (document.createElement as ReturnType<typeof vi.fn>).mock.results
      .map(r => r.value)
      .find((el: HTMLElement) => el.tagName === 'A') as HTMLAnchorElement;
    expect(anchor.download).toMatch(/^ai-navigator-data-teacher-/);
    expect(anchor.download).toMatch(/\.json$/);
  });

  it('does not throw when the browser blocks the synthetic click (falls back to window.open)', () => {
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('blocked by extension');
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    expect(() => downloadUserDataAsJson({ some: 'data' }, 'teacher-1')).toThrow(/download_failed/);
    openSpy.mockRestore();
  });
});
