import { doc, getDoc, collection, getDocs, query, where, orderBy, limit, updateDoc, setDoc, serverTimestamp, startAfter, documentId, type QueryConstraint, type DocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';
import type { ConceptMastery, QuizResult, StudentGamification } from './firestoreService.types';
import { parseFirestoreDoc, QuizResultSchema, ConceptMasterySchema, StudentGamificationSchema } from '../schemas/firestoreSchemas';
import { NotFoundError, OfflineError, FirestoreError } from '../utils/errors';

function isValidQuizResult(data: unknown): data is QuizResult {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.quizId === 'string' && typeof d.percentage === 'number';
}

function isValidConceptMastery(data: unknown): data is ConceptMastery {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.conceptId === 'string' && typeof d.studentName === 'string';
}

export const quizService = {

  // -- Curriculum ----------------------------------------------------------------

  fetchFullCurriculum: async (): Promise<CurriculumModule> => {
    const docRef = doc(db, 'curriculum', 'v1');
    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data() as CurriculumModule;
      } else {
        console.error("...Firestore fetch failed: Document 'v1' does not exist in 'curriculum' collection.");
        throw new NotFoundError('curriculum/v1');
      }
    } catch (error: any) {
      if (error?.code && error?.userMessage) throw error;
      if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
        console.info('...Could not fetch from Firestore: client is offline and data is not cached. Using local data.');
        throw new OfflineError('Офлајн — не може да се вчита курикулумот.');
      }
      console.error('...Error fetching document from Firestore:', error);
      throw new FirestoreError('read', error.message);
    }
  },

  saveFullCurriculum: async (data: CurriculumModule): Promise<void> => {
    const docRef = doc(db, 'curriculum', 'v1');
    try {
      await setDoc(docRef, data);
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
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      try {
        const { saveQuizOffline } = await import('./indexedDBService');
        return await saveQuizOffline(result);
      } catch (err) {
        console.error('Error saving quiz result offline:', err);
        return '';
      }
    }
    try {
      const docRef = doc(collection(db, 'quiz_results'));
      await setDoc(docRef, { ...result, playedAt: serverTimestamp() });
      // Fire-and-forget: update ZPD difficulty target for this student/concept
      if (result.teacherUid && result.studentName && result.conceptId) {
        import('./firestoreService.adaptiveDifficulty')
          .then(({ adaptiveDifficultyService }) => {
            adaptiveDifficultyService.updateAfterQuiz(
              result.teacherUid!,
              result.studentName!,
              result.conceptId!,
              result.percentage,
            );
          })
          .catch((err) => {
            console.warn('[AdaptiveDifficulty] fire-and-forget update failed:', err);
          });
      }
      return docRef.id;
    } catch (error) {
      console.warn('Firestore write failed, falling back to offline queue:', error);
      try {
        const { saveQuizOffline } = await import('./indexedDBService');
        return await saveQuizOffline(result);
      } catch (offlineErr) {
        console.error('Both Firestore and offline save failed:', offlineErr);
        return '';
      }
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
      return snap.docs.map(d => d.data()).filter(isValidQuizResult);
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
    // E2E Mocking
    console.log('E2E CHECK: window.__E2E_TEACHER_MODE__ =', window.__E2E_TEACHER_MODE__);
    if (typeof window !== 'undefined' && window.__E2E_TEACHER_MODE__) {
      console.log('E2E: fetchQuizResultsPage mocking activated');
      const mockResults = window.__E2E_MOCK_QUIZ_RESULTS__ || [];
      console.log('E2E: mockResults count =', mockResults.length);
      const startIdx = startAfterDoc ? 10 : 0; 
      const batch = mockResults.slice(startIdx, startIdx + pageSize);
      return {
        results: batch,
        lastDoc: mockResults.length > startIdx + pageSize ? ({ id: 'mock-last-doc' } as unknown as DocumentSnapshot) : null
      };
    }

    try {
      const baseConstraints = teacherUid
        ? [where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc')]
        : [orderBy('playedAt', 'desc')];
      const q = startAfterDoc
        ? query(collection(db, 'quiz_results'), ...baseConstraints, startAfter(startAfterDoc), limit(pageSize))
        : query(collection(db, 'quiz_results'), ...baseConstraints, limit(pageSize));
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data()).filter(isValidQuizResult);
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
      return snap.docs.map(d => d.data()).filter(isValidQuizResult);
    } catch (error) {
      console.error('Error fetching quiz results by student name:', error);
      return [];
    }
  },

  fetchQuizResultsByQuizId: async (quizId: string): Promise<QuizResult[]> => {
    try {
      const q = query(collection(db, 'quiz_results'), where('quizId', '==', quizId), orderBy('playedAt', 'desc'), limit(200));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data()).filter(isValidQuizResult);
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
          return snap.docs.map(d => d.data()).filter(isValidQuizResult);
        } catch {
          // Composite index not yet built — fall back to conceptId-only query
        }
      }
      const q = query(collection(db, 'quiz_results'), where('conceptId', '==', conceptId), orderBy('playedAt', 'desc'), limit(maxCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => parseFirestoreDoc(QuizResultSchema, d.data(), `quiz_results/${d.id}`) as QuizResult);
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
      const existing = snap.exists() ? parseFirestoreDoc(ConceptMasterySchema, snap.data(), `concept_mastery/${docId}`) as ConceptMastery : null;
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
      return snap.docs.map(d => d.data()).filter(isValidConceptMastery);
    } catch (error) {
      console.error('Error fetching mastery by student:', error);
      return [];
    }
  },

  fetchMasteryByConcept: async (conceptId: string, teacherUid?: string): Promise<ConceptMastery[]> => {
    try {
      const qConstraints = [where('conceptId', '==', conceptId)];
      if (teacherUid) qConstraints.push(where('teacherUid', '==', teacherUid));
      const q = query(collection(db, 'concept_mastery'), ...qConstraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data()).filter(isValidConceptMastery);
    } catch (error) {
      console.error('Error fetching mastery by concept:', error);
      return [];
    }
  },

  fetchMasteryByConceptBulk: async (conceptIds: string[], teacherUid?: string): Promise<ConceptMastery[]> => {
    if (conceptIds.length === 0) return [];
    try {
      const qConstraints = [where('conceptId', 'in', conceptIds.slice(0, 30))];
      if (teacherUid) qConstraints.push(where('teacherUid', '==', teacherUid));
      const q = query(collection(db, 'concept_mastery'), ...qConstraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data()).filter(isValidConceptMastery);
    } catch (error) {
      console.error('Error fetching mastery by concept bulk:', error);
      return [];
    }
  },

  fetchAllMastery: async (teacherUid?: string): Promise<ConceptMastery[]> => {
    // E2E Mocking
    if (typeof window !== 'undefined' && window.__E2E_TEACHER_MODE__) {
      return window.__E2E_MOCK_MASTERY__ || [];
    }

    const PAGE_SIZE = 500;
    const allResults: ConceptMastery[] = [];
    let lastDoc: DocumentSnapshot | null = null;

    try {
      // Paginate in batches of 500 to avoid loading 18MB in one shot on mobile
      while (true) {
        const constraints: QueryConstraint[] = [
          ...(teacherUid ? [where('teacherUid', '==', teacherUid)] : []),
          limit(PAGE_SIZE),
          ...(lastDoc ? [startAfter(lastDoc)] : []),
        ];
        const q = query(collection(db, 'concept_mastery'), ...constraints);
        const snap = await getDocs(q);
        const page = snap.docs.map((d: DocumentSnapshot) => d.data()).filter(isValidConceptMastery);
        allResults.push(...page);
        if (snap.docs.length < PAGE_SIZE) break; // last page
        lastDoc = snap.docs[snap.docs.length - 1];
      }
      return allResults;
    } catch (error) {
      console.error('Error fetching all mastery:', error);
      return allResults; // return whatever we managed to fetch
    }
  },

  // -- Gamification --------------------------------------------------------------

  fetchStudentGamification: async (studentName: string, teacherUid?: string, deviceId?: string): Promise<StudentGamification | null> => {
    try {
      if (deviceId && teacherUid) {
        const s = await getDoc(doc(db, 'student_gamification', `${teacherUid}_${deviceId}`));
        if (s.exists()) return parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${teacherUid}_${deviceId}`) as StudentGamification;
      }
      if (deviceId && !teacherUid) {
        const s = await getDoc(doc(db, 'student_gamification', deviceId));
        if (s.exists()) return parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${deviceId}`) as StudentGamification;
      }
      if (teacherUid) {
        const s = await getDoc(doc(db, 'student_gamification', `${teacherUid}_${studentName}`));
        if (s.exists()) return parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${teacherUid}_${studentName}`) as StudentGamification;
      }
      const s = await getDoc(doc(db, 'student_gamification', studentName));
      return s.exists() ? parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${studentName}`) as StudentGamification : null;
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
      return snap.docs.map(d => d.data() as StudentGamification)
        .filter(d => typeof d?.studentName === 'string' && typeof d?.totalXP === 'number')
        .sort((a, b) => b.totalXP - a.totalXP);
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
