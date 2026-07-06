import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveQuestion, fetchUnapprovedQuestions } from './firestoreService.materials';
import { addDoc, getDocs, where } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ __ref: 'doc' })),
  getDoc: vi.fn(),
  collection: vi.fn(() => 'col-ref'),
  getDocs: vi.fn(),
  query: vi.fn((...args) => ['query-ref', ...args]),
  limit: vi.fn((...args) => ['limit', ...args]),
  orderBy: vi.fn((...args) => ['orderBy', ...args]),
  updateDoc: vi.fn(),
  increment: vi.fn(),
  where: vi.fn((...args) => ['where', ...args]),
  setDoc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'q-new' }),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ seconds: 0, nanoseconds: 0 })),
  startAfter: vi.fn(),
  arrayUnion: vi.fn(),
  arrayRemove: vi.fn(),
  documentId: vi.fn(),
  getCountFromServer: vi.fn(),
  getAggregateFromServer: vi.fn(),
  average: vi.fn(),
}));

vi.mock('../firebaseConfig', () => ({ db: {} }));

beforeEach(() => vi.clearAllMocks());

describe('saveQuestion — always writes isApproved explicitly', () => {
  it('defaults isApproved to false so the review queue query can match it', async () => {
    await saveQuestion({
      teacherUid: 't1',
      question: '2+2?',
      type: 'multiple_choice',
      answer: '4',
    } as never);

    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({ isApproved: false }));
  });

  it('preserves an explicitly-passed isApproved value instead of forcing false', async () => {
    await saveQuestion({
      teacherUid: 't1',
      question: '2+2?',
      type: 'multiple_choice',
      answer: '4',
      isApproved: true,
    } as never);

    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({ isApproved: true }));
  });

  it('carries the schoolId through so the review queue can be scoped per school', async () => {
    await saveQuestion({
      teacherUid: 't1',
      schoolId: 'school-A',
      question: '2+2?',
      type: 'multiple_choice',
      answer: '4',
    } as never);

    expect(addDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({ schoolId: 'school-A' }));
  });
});

describe('fetchUnapprovedQuestions — school scoping', () => {
  beforeEach(() => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);
  });

  it('queries only isApproved==false when no schoolId is passed (global admin)', async () => {
    await fetchUnapprovedQuestions();

    expect(where).toHaveBeenCalledWith('isApproved', '==', false);
    expect(where).not.toHaveBeenCalledWith('schoolId', '==', expect.anything());
  });

  it('adds a schoolId constraint when passed (school_admin)', async () => {
    await fetchUnapprovedQuestions('school-A');

    expect(where).toHaveBeenCalledWith('isApproved', '==', false);
    expect(where).toHaveBeenCalledWith('schoolId', '==', 'school-A');
  });
});
