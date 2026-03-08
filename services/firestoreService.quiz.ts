import { doc, getDoc, collection, getDocs, query, where, orderBy, limit, updateDoc, setDoc, addDoc, deleteDoc, serverTimestamp, startAfter, documentId, type DocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';
import type { ConceptMastery, QuizResult, StudentGamification } from './firestoreService.types';

export const quizService = {

  // -- Curriculum ----------------------------------------------------------------

  fetchFullCurriculum: async (): Promise<CurriculumModule> => {
    console.log('Attempting to fetch data from Firestore...');
    const docRef = doc(db, 'curriculum', 'v1');
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log('...Data received successfully from Firestore.');
        return docSnap.data() as CurriculumModule;
      } else {
        console.error("...Firestore fetch failed: Document 'v1' does not exist in 'curriculum' collection.");
        throw new Error('Документот не постои во колекцијата за курикулум.');
      }
    } catch (error: any) {
      if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
        console.info('...Could not fetch from Firestore: client is offline and data is not cached. Using local data.');
        throw new Error('Офлајн — не може да се вчита курикулумот.');
      }
      console.error('...Error fetching document from Firestore:', error);
      throw new Error(`Грешка при вчитување на документот: ${error.message || 'Unknown error'}`);
    }
  },

  saveFullCurriculum: async (data: CurriculumModule): Promise<void> => {
    console.log('Attempting to save curriculum data to Firestore...');
    const docRef = doc(db, 'curriculum', 'v1');
    try {
      await setDoc(docRef, data);
      console.log('Curriculum data successfully saved to Firestore.');
    } catch (error) {
      console.error('Error saving curriculum data to Firestore:', error);
      throw error;
    }
  },

  saveUserCurriculumEdit: async (
    userId: string,
    conceptId: string,
    updates: { assessmentStandards?: string[]; activities?: string[] }
  ): Promise<void> => {
    const ref = doc(db, 'users', userId, 'curriculumEdits', conceptId);
    await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  },

  loadUserCurriculumEdits: async (userId: string): Promise<Record<string, { assessmentStandards?: string[]; activities?: string[] }>> => {
    try {
      const snap = await getDocs(collection(db, 'users', userId, 'curriculumEdits'));
      const edits: Record<string, { assessmentStandards?: string[]; activities?: string[] }> = {};
      snap.forEach(d => { edits[d.id] = d.data() as { assessmentStandards?: string[]; activities?: string[] }; });
      return edits;
    } catch {
      return {};
    }
  },

  // -- Quiz Results --------------------------------------------------------------

  saveQuizResult: async (result: QuizResult): Promise<string> => {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        const { saveQuizOffline } = await import('./indexedDBService');
        return await saveQuizOffline(result);
      }
      const docRef = doc(collection(db, 'quiz_results'));
      setDoc(docRef, { ...result, playedAt: serverTimestamp() }).catch(err => console.warn('Offline deferred', err));
      return docRef.id;
    } catch (error) {
      console.error('Error saving quiz result:', error);
      return '';
    }
  },

  syncOfflineQuizzes: async (): Promise<number> => {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) return 0;
      const { getPendingQuizzes, clearPendingQuiz } = await import('./indexedDBService');
      const pending = await getPendingQuizzes();
      if (pending.length === 0) return 0;
      let synced = 0;
      for (const item of pending) {
        try {
          const docRef = doc(collection(db, 'quiz_results'));
          await setDoc(docRef, { ...item.quizResult, playedAt: new Date(item.timestamp) });
          await clearPendingQuiz(item.id);
          synced++;
        } catch (err) {
          console.error('Failed to sync offline quiz:', err);
        }
      }
      return synced;
    } catch (err) {
      console.error('Sync error', err);
      return 0;
    }
  },

  updateQuizConfidence: async (docId: string, confidence: number): Promise<void> => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, 'quiz_results', docId), { confidence });
    } catch (error) {
      console.error('Error updating quiz confidence:', error);
    }
  },

  updateQuizMetacognitiveNote: async (docId: string, note: string): Promise<void> => {
    if (!docId || !note.trim()) return;
    try {
      await updateDoc(doc(db, 'quiz_results', docId), { metacognitiveNote: note.trim() });
    } catch (error) {
      console.error('Error updating metacognitive note:', error);
    }
  },

  fetchQuizResults: async (maxCount: number = 200, teacherUid?: string): Promise<QuizResult[]> => {
    try {
      const q = teacherUid
        ? query(collection(db, 'quiz_results'), where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc'), limit(maxCount))
        : query(collection(db, 'quiz_results'), orderBy('playedAt', 'desc'), limit(maxCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.error('Error fetching quiz results:', error);
      return [];
    }
  },

  fetchQuizResultsPage: async (
    teacherUid: string | undefined,
    pageSize: number = 200,
    startAfterDoc?: DocumentSnapshot
  ): Promise<{ results: QuizResult[]; lastDoc: DocumentSnapshot | null }> => {
    try {
      const baseConstraints = teacherUid
        ? [where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc')]
        : [orderBy('playedAt', 'desc')];
      const q = startAfterDoc
        ? query(collection(db, 'quiz_results'), ...baseConstraints, startAfter(startAfterDoc), limit(pageSize))
        : query(collection(db, 'quiz_results'), ...baseConstraints, limit(pageSize));
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data() as QuizResult);
      const lastDoc = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
      return { results, lastDoc };
    } catch (error) {
      console.error('Error fetching quiz results page:', error);
      return { results: [], lastDoc: null };
    }
  },

  fetchQuizResultsByStudentName: async (studentName: string, deviceId?: string): Promise<QuizResult[]> => {
    try {
      const q = deviceId
        ? query(collection(db, 'quiz_results'), where('deviceId', '==', deviceId), orderBy('playedAt', 'desc'), limit(100))
        : query(collection(db, 'quiz_results'), where('studentName', '==', studentName), orderBy('playedAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.error('Error fetching quiz results by student name:', error);
      return [];
    }
  },

  fetchQuizResultsByQuizId: async (quizId: string): Promise<QuizResult[]> => {
    try {
      const q = query(collection(db, 'quiz_results'), where('quizId', '==', quizId), orderBy('playedAt', 'desc'), limit(200));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.error('Error fetching quiz results by quiz ID:', error);
      return [];
    }
  },

  fetchQuizResultsByConcept: async (conceptId: string, teacherUid?: string, maxCount = 50): Promise<QuizResult[]> => {
    try {
      if (teacherUid) {
        try {
          const q = query(collection(db, 'quiz_results'), where('conceptId', '==', conceptId), where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc'), limit(maxCount));
          const snap = await getDocs(q);
          return snap.docs.map(d => d.data() as QuizResult);
        } catch {
          // Composite index not yet built — fall back to conceptId-only query
        }
      }
      const q = query(collection(db, 'quiz_results'), where('conceptId', '==', conceptId), orderBy('playedAt', 'desc'), limit(maxCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.warn('fetchQuizResultsByConcept failed (non-critical):', error);
      return [];
    }
  },

  // -- Concept Mastery -----------------------------------------------------------

  updateConceptMastery: async (
    studentName: string,
    conceptId: string,
    score: number,
    meta?: { conceptTitle?: string; topicId?: string; gradeLevel?: number },
    teacherUid?: string,
    deviceId?: string,
  ): Promise<ConceptMastery> => {
    const safeName = studentName.replace(/\s+/g, '_');
    const docId = deviceId
      ? (teacherUid ? `${teacherUid}_${deviceId}_${conceptId}` : `${deviceId}_${conceptId}`)
      : (teacherUid ? `${teacherUid}_${safeName}_${conceptId}` : `${safeName}_${conceptId}`);
    const ref = doc(db, 'concept_mastery', docId);
    try {
      const snap = await getDoc(ref);
      const existing = snap.exists() ? (snap.data() as ConceptMastery) : null;
      const prevConsecutive = existing?.consecutiveHighScores ?? 0;
      const newConsecutive = score >= 85 ? prevConsecutive + 1 : 0;
      const mastered = newConsecutive >= 3;
      const wasAlreadyMastered = existing?.mastered ?? false;
      const updated: Partial<ConceptMastery> = {
        studentName, conceptId,
        conceptTitle: meta?.conceptTitle ?? existing?.conceptTitle,
        topicId: meta?.topicId ?? existing?.topicId,
        gradeLevel: meta?.gradeLevel ?? existing?.gradeLevel,
        ...(teacherUid ? { teacherUid } : {}),
        ...(deviceId ? { deviceId } : {}),
        attempts: (existing?.attempts ?? 0) + 1,
        consecutiveHighScores: newConsecutive,
        bestScore: Math.max(score, existing?.bestScore ?? 0),
        lastScore: score,
        mastered,
        updatedAt: serverTimestamp() as unknown as Timestamp,
        ...(mastered && !wasAlreadyMastered ? { masteredAt: serverTimestamp() as unknown as Timestamp } : {}),
      };
      setDoc(ref, updated, { merge: true }).catch(err => console.warn('Offline deferred', err));
      return { ...updated, attempts: updated.attempts! } as ConceptMastery;
    } catch (error) {
      console.error('Error updating concept mastery:', error);
      return {
        studentName, conceptId, attempts: 1,
        consecutiveHighScores: score >= 85 ? 1 : 0,
        bestScore: score, lastScore: score, mastered: false,
      } as ConceptMastery;
    }
  },

  fetchMasteryByStudent: async (studentName: string, deviceId?: string): Promise<ConceptMastery[]> => {
    try {
      const q = deviceId
        ? query(collection(db, 'concept_mastery'), where('deviceId', '==', deviceId))
        : query(collection(db, 'concept_mastery'), where('studentName', '==', studentName));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as ConceptMastery);
    } catch (error) {
      console.error('Error fetching mastery by student:', error);
      return [];
    }
  },

  fetchMasteryByConcept: async (conceptId: string): Promise<ConceptMastery[]> => {
    try {
      const q = query(collection(db, 'concept_mastery'), where('conceptId', '==', conceptId));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as ConceptMastery);
    } catch (error) {
      console.error('Error fetching mastery by concept:', error);
      return [];
    }
  },

  fetchAllMastery: async (teacherUid?: string): Promise<ConceptMastery[]> => {
    try {
      const q = teacherUid
        ? query(collection(db, 'concept_mastery'), where('teacherUid', '==', teacherUid))
        : collection(db, 'concept_mastery');
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as ConceptMastery);
    } catch (error) {
      console.error('Error fetching all mastery:', error);
      return [];
    }
  },

  // -- Gamification --------------------------------------------------------------

  fetchStudentGamification: async (studentName: string, teacherUid?: string, deviceId?: string): Promise<StudentGamification | null> => {
    try {
      if (deviceId && teacherUid) {
        const s = await getDoc(doc(db, 'student_gamification', `${teacherUid}_${deviceId}`));
        if (s.exists()) return s.data() as StudentGamification;
      }
      if (deviceId && !teacherUid) {
        const s = await getDoc(doc(db, 'student_gamification', deviceId));
        if (s.exists()) return s.data() as StudentGamification;
      }
      if (teacherUid) {
        const s = await getDoc(doc(db, 'student_gamification', `${teacherUid}_${studentName}`));
        if (s.exists()) return s.data() as StudentGamification;
      }
      const s = await getDoc(doc(db, 'student_gamification', studentName));
      return s.exists() ? (s.data() as StudentGamification) : null;
    } catch (error) {
      console.error('Error fetching gamification:', error);
      return null;
    }
  },

  fetchClassLeaderboard: async (teacherUid: string): Promise<StudentGamification[]> => {
    try {
      const q = query(
        collection(db, 'student_gamification'),
        where(documentId(), '>=', `${teacherUid}_`),
        where(documentId(), '<=', `${teacherUid}_\uf8ff`),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as StudentGamification).sort((a, b) => b.totalXP - a.totalXP);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  },

  updateStudentGamification: async (
    studentName: string,
    percentage: number,
    justMastered: boolean,
    totalMastered: number,
    teacherUid?: string,
    deviceId?: string,
  ): Promise<{ xpGained: number; newAchievements: string[]; gamification: StudentGamification }> => {
    const docId = deviceId
      ? (teacherUid ? `${teacherUid}_${deviceId}` : deviceId)
      : (teacherUid ? `${teacherUid}_${studentName}` : studentName);
    const ref = doc(db, 'student_gamification', docId);
    const snap = await getDoc(ref);
    const today = new Date().toLocaleDateString('sv-SE');
    const existing: StudentGamification = snap.exists()
      ? (snap.data() as StudentGamification)
      : { studentName, totalXP: 0, currentStreak: 0, longestStreak: 0, lastActivityDate: '', achievements: [], totalQuizzes: 0, ...(deviceId ? { deviceId } : {}), ...(teacherUid ? { teacherUid } : {}) };

    const xpGained = calcXP(percentage, justMastered);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE');
    const newStreak = calcStreak(existing.currentStreak, existing.lastActivityDate, today, yesterdayStr);
    const newLongest = Math.max(existing.longestStreak, newStreak);
    const updated: StudentGamification = {
      ...existing,
      totalXP: existing.totalXP + xpGained,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActivityDate: today,
      totalQuizzes: existing.totalQuizzes + 1,
      ...(teacherUid && !existing.teacherUid ? { teacherUid } : {}),
    };
    const newAchievements = computeNewAchievements(updated.totalQuizzes, updated.longestStreak, percentage, totalMastered, updated.achievements);
    updated.achievements = [...updated.achievements, ...newAchievements];
    setDoc(ref, updated, { merge: false }).catch(err => console.warn('Offline deferred', err));
    return { xpGained, newAchievements, gamification: updated };
  },
};
