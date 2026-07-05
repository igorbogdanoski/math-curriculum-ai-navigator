import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchClassMembership, joinClassByCode } from './firestoreService.classroom';
import { getDoc, setDoc, getDocs, doc } from 'firebase/firestore';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db, _col, id) => ({ __id: id })),
  getDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  collection: vi.fn(() => 'col-ref'),
  query: vi.fn((...args) => ['query-ref', ...args]),
  where: vi.fn((...args) => ['where', ...args]),
  limit: vi.fn((...args) => ['limit', ...args]),
  serverTimestamp: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

const membership = (overrides: Record<string, unknown> = {}) => ({
  deviceId: 'device-1',
  classId: 'class-1',
  className: 'VIII-1',
  gradeLevel: 8,
  teacherUid: 'teacher-1',
  ...overrides,
});

describe('fetchClassMembership — per-student-on-shared-device disambiguation', () => {
  it('returns the composite-keyed doc when it exists for this student', async () => {
    vi.mocked(getDoc).mockImplementation(async (ref: any) => ({
      exists: () => ref.__id === 'device-1__марко',
      data: () => membership({ studentName: 'Марко' }),
    }) as any);

    const result = await fetchClassMembership('device-1', 'Марко');
    expect(result?.studentName).toBe('Марко');
    expect(doc).toHaveBeenCalledWith({}, 'class_memberships', 'device-1__марко');
  });

  it('falls back to the legacy bare-deviceId doc when no composite doc exists and the legacy doc has no conflicting name', async () => {
    vi.mocked(getDoc).mockImplementation(async (ref: any) => {
      if (ref.__id === 'device-1__ана') return { exists: () => false, data: () => undefined } as any;
      return { exists: () => true, data: () => membership() } as any; // legacy doc, no studentName recorded
    });

    const result = await fetchClassMembership('device-1', 'Ана');
    expect(result?.classId).toBe('class-1');
  });

  it('refuses the legacy doc when it already belongs to a different named student (the actual shared-device bug)', async () => {
    vi.mocked(getDoc).mockImplementation(async (ref: any) => {
      if (ref.__id === 'device-1__втор-ученик') return { exists: () => false, data: () => undefined } as any;
      // legacy doc belongs to "Прв Ученик" who joined before this fix existed
      return { exists: () => true, data: () => membership({ studentName: 'Прв Ученик' }) } as any;
    });

    const result = await fetchClassMembership('device-1', 'Втор Ученик');
    expect(result).toBeNull();
  });

  it('without a studentName (caller has none available), only checks the legacy doc — unchanged pre-fix behavior', async () => {
    vi.mocked(getDoc).mockResolvedValue({ exists: () => true, data: () => membership() } as any);
    const result = await fetchClassMembership('device-1');
    expect(result?.classId).toBe('class-1');
    expect(doc).toHaveBeenCalledWith({}, 'class_memberships', 'device-1');
  });
});

describe('joinClassByCode — writes the per-student composite key', () => {
  it('writes to {deviceId}__{studentSlug}, not the bare deviceId', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      empty: false,
      docs: [{ id: 'class-1', data: () => ({ teacherUid: 't1', name: 'VIII-1', gradeLevel: 8, studentNames: [] }) }],
    } as any);

    await joinClassByCode('ABC123', 'device-1', 'Марко');

    expect(setDoc).toHaveBeenCalledWith(
      { __id: 'device-1__марко' },
      expect.objectContaining({ studentName: 'Марко', classId: 'class-1' }),
      { merge: true },
    );
  });
});
