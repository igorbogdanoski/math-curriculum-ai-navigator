import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firestoreService } from './firestoreService';
import { doc, getDoc, collection, getDocs, setDoc, updateDoc } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  increment: vi.fn(),
  startAfter: vi.fn(),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  arrayUnion: vi.fn(),
  documentId: vi.fn(),
  onSnapshot: vi.fn(),
  getCountFromServer: vi.fn(),
  getAggregateFromServer: vi.fn(),
  average: vi.fn()
}));

vi.mock('../firebaseConfig', () => ({
  db: {}
}));

describe('firestoreService tests with mocked firestore layer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('saveStudentIdentity', () => {
        it('calls setDoc with correct path and payload', async () => {
            (doc as any).mockReturnValue('mock-doc-ref');
            
            await firestoreService.saveStudentIdentity('dev123', 'John Doe', 'anon-uid');
            
            expect(doc).toHaveBeenCalledWith({}, 'student_identity', 'dev123');
            expect(setDoc).toHaveBeenCalledWith('mock-doc-ref', {
                name: 'John Doe',
                anonymousUid: 'anon-uid',
                deviceId: 'dev123',
                updatedAt: 'SERVER_TIMESTAMP'
            }, { merge: true });
        });
    });

    describe('updateLiveSessionStatus', () => {
        it('calls updateDoc with the chosen status', async () => {
             (doc as any).mockReturnValue('session-doc-ref');
             
             await firestoreService.updateLiveSessionStatus('sess_999', 'ended');
             
             expect(doc).toHaveBeenCalledWith({}, 'live_sessions', 'sess_999');
             expect(updateDoc).toHaveBeenCalledWith('session-doc-ref', {
                 status: 'ended'
             });
        });
    });

    describe('deleteStudentGroup', () => {
        it('calls deleteDoc for the specific group ID', async () => {
             (doc as any).mockReturnValue('group-delete-ref');
             // Needs the deleteDoc import to be mocked
             const { deleteDoc } = await import('firebase/firestore');
             
             await firestoreService.deleteStudentGroup('group_abc123');
             
             expect(doc).toHaveBeenCalledWith({}, 'student_groups', 'group_abc123');
             expect(deleteDoc).toHaveBeenCalledWith('group-delete-ref');
        });
    });

    describe('saveQuizResult', () => {
        it('calls setDoc on a new doc within quiz_results collection', async () => {
             const { doc, setDoc, collection } = await import('firebase/firestore');
             (collection as any).mockReturnValue('quiz-results-collection');
             (doc as any).mockReturnValue({ id: 'new_result_id' });
             
             const result = await firestoreService.saveQuizResult({
                 quizId: 'q1', quizTitle: 'T', score: 10, correctCount: 1, totalQuestions: 1, percentage: 100
             });
             
             expect(collection).toHaveBeenCalledWith({}, 'quiz_results');
             expect(setDoc).toHaveBeenCalledWith({ id: 'new_result_id' }, expect.objectContaining({
                 quizId: 'q1',
                 percentage: 100
             }));
             expect(result).toBe('new_result_id');
        });
    });
});