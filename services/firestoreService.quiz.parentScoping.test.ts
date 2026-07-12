/**
 * Regression tests for the P3 parent-link data-scoping fix (2026-07-12).
 *
 * fetchQuizResultsByStudentName / fetchMasteryByStudent previously looked up a
 * student by bare studentName only — anyone who knew a student's name (not just
 * that student's parent) could read their quiz history and mastery, and two
 * students sharing a name across different teachers/schools would have their
 * data merged. These tests lock in that a teacherUid, when supplied, is always
 * threaded into the Firestore query.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { quizService } from './firestoreService.quiz';
import { getDocs, getDoc, where, doc } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ __id: id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  collection: vi.fn((_db, name) => ({ __col: name })),
  query: vi.fn((...args) => ({ __query: args })),
  where: vi.fn((field, op, value) => ({ __where: [field, op, value] })),
  orderBy: vi.fn((...args) => ({ __orderBy: args })),
  limit: vi.fn((n) => ({ __limit: n })),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

describe('fetchQuizResultsByStudentName — teacherUid scoping', () => {
  it('adds a teacherUid where-clause when teacherUid is supplied', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await quizService.fetchQuizResultsByStudentName('Марко Петровски', undefined, 'teacher-1');

    expect(where).toHaveBeenCalledWith('studentName', '==', 'Марко Петровски');
    expect(where).toHaveBeenCalledWith('teacherUid', '==', 'teacher-1');
  });

  it('does NOT add a teacherUid where-clause when teacherUid is absent (own-device self-read, unaffected)', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await quizService.fetchQuizResultsByStudentName('Марко Петровски');

    expect(where).toHaveBeenCalledWith('studentName', '==', 'Марко Петровски');
    expect(where).not.toHaveBeenCalledWith('teacherUid', '==', expect.anything());
  });

  it('prefers deviceId scoping over teacherUid when both are supplied (own-device read takes priority)', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await quizService.fetchQuizResultsByStudentName('Марко Петровски', 'device-1', 'teacher-1');

    expect(where).toHaveBeenCalledWith('deviceId', '==', 'device-1');
    expect(where).not.toHaveBeenCalledWith('studentName', '==', expect.anything());
  });
});

describe('fetchMasteryByStudent — teacherUid scoping', () => {
  it('adds a teacherUid where-clause when teacherUid is supplied', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await quizService.fetchMasteryByStudent('Марко Петровски', undefined, 'teacher-1');

    expect(where).toHaveBeenCalledWith('studentName', '==', 'Марко Петровски');
    expect(where).toHaveBeenCalledWith('teacherUid', '==', 'teacher-1');
  });

  it('does NOT add a teacherUid where-clause when teacherUid is absent', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as any);

    await quizService.fetchMasteryByStudent('Марко Петровски');

    expect(where).not.toHaveBeenCalledWith('teacherUid', '==', expect.anything());
  });
});

describe('fetchStudentGamification — composite-key scoping (pre-existing, locked in by this fix)', () => {
  it('reads the {teacherUid}_{studentName} composite doc when teacherUid is supplied', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

    await quizService.fetchStudentGamification('Марко Петровски', 'teacher-1');

    expect(doc).toHaveBeenCalledWith({}, 'student_gamification', 'teacher-1_Марко Петровски');
  });

  it('falls back to the bare-name doc only when no teacherUid is supplied at all', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => false } as any);

    await quizService.fetchStudentGamification('Марко Петровски');

    expect(doc).toHaveBeenCalledWith({}, 'student_gamification', 'Марко Петровски');
  });
});
