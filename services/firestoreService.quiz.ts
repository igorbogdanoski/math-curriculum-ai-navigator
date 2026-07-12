import { doc, getDoc, collection, getDocs, query, where, orderBy, limit, updateDoc, setDoc, writeBatch, serverTimestamp, startAfter, documentId, runTransaction, type QueryConstraint, type DocumentSnapshot, type QueryDocumentSnapshot, type Timestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { firestorePage } from './firestorePagination';
import { logger } from '../utils/logger';
import { type CurriculumModule } from '../data/curriculum';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';
import type { ConceptMastery, QuizResult, StudentGamification } from './firestoreService.types';
import { parseFirestoreDoc, QuizResultSchema, ConceptMasterySchema, StudentGamificationSchema } from '../schemas/firestoreSchemas';
import { NotFoundError, OfflineError, FirestoreError } from '../utils/errors';
import { membershipKey } from '../utils/studentIdentity';

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
        logger.error("...Firestore fetch failed: Document 'v1' does not exist in 'curriculum' collection.");
        throw new NotFoundError('curriculum/v1');
      }
    } catch (error: any) {
      if (error?.code && error?.userMessage) throw error;
      if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
        logger.info('...Could not fetch from Firestore: client is offline and data is not cached. Using local data.');
        throw new OfflineError('Офлајн — не може да се вчита курикулумот.');
      }
      logger.error('...Error fetching document from Firestore:', error);
      throw new FirestoreError('read', error.message);
    }
  },

  saveFullCurriculum: async (data: CurriculumModule): Promise<void> => {
    const docRef = doc(db, 'curriculum', 'v1');
    try {
      await setDoc(docRef, data);
    } catch (error) {
      logger.error('Error saving curriculum data to Firestore:', error);
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
      const q = query(collection(db, 'users', userId, 'curriculumEdits'), orderBy('updatedAt', 'desc'), limit(300));
      const snap = await getDocs(q);
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
        logger.error('Error saving quiz result offline:', err);
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
            logger.warn('[AdaptiveDifficulty] fire-and-forget update failed:', err);
          });
      }
      return docRef.id;
    } catch (error) {
      logger.warn('Firestore write failed, falling back to offline queue:', error);
      try {
        const { saveQuizOffline } = await import('./indexedDBService');
        return await saveQuizOffline(result);
      } catch (offlineErr) {
        logger.error('Both Firestore and offline save failed:', offlineErr);
        return '';
      }
    }
  },

  /**
   * Batch-save multiple quiz results in a single Firestore write.
   * Use when saving class-wide results (e.g., live quiz end) to avoid N writes.
   */
  saveQuizResultBatch: async (results: QuizResult[]): Promise<string[]> => {
    if (results.length === 0) return [];
    const batch = writeBatch(db);
    const refs = results.map(() => doc(collection(db, 'quiz_results')));
    results.forEach((r, i) => batch.set(refs[i], { ...r, playedAt: serverTimestamp() }));
    await batch.commit();
    const ids = refs.map(r => r.id);

    // Batched adaptive difficulty updates — one import, one pass
    const needsDifficulty = results.filter(r => r.teacherUid && r.studentName && r.conceptId);
    if (needsDifficulty.length > 0) {
      import('./firestoreService.adaptiveDifficulty')
        .then(({ adaptiveDifficultyService }) =>
          Promise.allSettled(
            needsDifficulty.map(r =>
              adaptiveDifficultyService.updateAfterQuiz(r.teacherUid!, r.studentName!, r.conceptId!, r.percentage)
            )
          )
        )
        .catch(err => logger.warn('[AdaptiveDifficulty] batch update failed:', err));
    }
    return ids;
  },

  syncOfflineQuizzes: async (): Promise<number> => {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) return 0;
      const { getPendingQuizzes, clearPendingQuiz } = await import('./indexedDBService');
      const pending = await getPendingQuizzes();
      if (pending.length === 0) return 0;

      // Batch-write all pending in one Firestore round-trip (max 500 per batch)
      const CHUNK = 500;
      let synced = 0;
      for (let i = 0; i < pending.length; i += CHUNK) {
        const chunk = pending.slice(i, i + CHUNK);
        try {
          const batch = writeBatch(db);
          chunk.forEach(item => {
            const ref = doc(collection(db, 'quiz_results'));
            batch.set(ref, { ...item.quizResult, playedAt: new Date(item.timestamp) });
          });
          await batch.commit();
          await Promise.allSettled(chunk.map(item => clearPendingQuiz(item.id)));
          synced += chunk.length;
        } catch (err) {
          logger.error(`Failed to sync offline quiz chunk [${i}–${i + chunk.length}]:`, err);
        }
      }
      return synced;
    } catch (err) {
      logger.error('Sync error', err);
      return 0;
    }
  },

  /**
   * Replays queued offline mastery updates one at a time (not batch-committed like
   * syncOfflineQuizzes) — each update is a stateful read-modify-write (consecutiveHighScores,
   * mastered streak), so every replay must read the then-current Firestore state rather than
   * risk overwriting with a stale precomputed snapshot.
   */
  syncOfflineMastery: async (): Promise<number> => {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) return 0;
      const { getPendingMastery, clearPendingMastery } = await import('./indexedDBService');
      const pending = await getPendingMastery();
      if (pending.length === 0) return 0;

      let synced = 0;
      for (const item of pending) {
        try {
          await quizService.updateConceptMastery(item.studentName, item.conceptId, item.score, item.meta, item.teacherUid, item.deviceId);
          await clearPendingMastery(item.id);
          synced++;
        } catch (err) {
          logger.error(`Failed to sync offline mastery update ${item.id}:`, err);
        }
      }
      return synced;
    } catch (err) {
      logger.error('Mastery sync error', err);
      return 0;
    }
  },

  updateQuizConfidence: async (docId: string, confidence: number): Promise<void> => {
    if (!docId) return;
    try {
      await updateDoc(doc(db, 'quiz_results', docId), { confidence });
    } catch (error) {
      logger.error('Error updating quiz confidence:', error);
    }
  },

  updateQuizMetacognitiveNote: async (docId: string, note: string): Promise<void> => {
    if (!docId || !note.trim()) return;
    try {
      await updateDoc(doc(db, 'quiz_results', docId), { metacognitiveNote: note.trim() });
    } catch (error) {
      logger.error('Error updating metacognitive note:', error);
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
      logger.error('Error fetching quiz results:', error);
      return [];
    }
  },

  fetchQuizResultsPage: async (
    teacherUid: string | undefined,
    pageSize: number = 200,
    startAfterDoc?: DocumentSnapshot
  ): Promise<{ results: QuizResult[]; lastDoc: DocumentSnapshot | null }> => {
    // E2E Mocking
    logger.info('E2E CHECK: window.__E2E_TEACHER_MODE__ =', { value: String(window.__E2E_TEACHER_MODE__) });
    if (typeof window !== 'undefined' && window.__E2E_TEACHER_MODE__) {
      logger.info('E2E: fetchQuizResultsPage mocking activated');
      const mockResults = window.__E2E_MOCK_QUIZ_RESULTS__ || [];
      logger.info('E2E: mockResults count', { count: mockResults.length });
      const startIdx = startAfterDoc ? 10 : 0; 
      const batch = mockResults.slice(startIdx, startIdx + pageSize);
      return {
        results: batch,
        lastDoc: mockResults.length > startIdx + pageSize ? ({ id: 'mock-last-doc' } as unknown as DocumentSnapshot) : null
      };
    }

    const baseConstraints = teacherUid
      ? [where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc')]
      : [orderBy('playedAt', 'desc')];
    const { items, hasMore, lastDoc } = await firestorePage<QuizResult>({
      collectionName: 'quiz_results',
      constraints: baseConstraints,
      pageSize,
      cursor: startAfterDoc as QueryDocumentSnapshot | undefined,
      mapper: (d) => d.data() as QuizResult,
      filter: isValidQuizResult,
      errorTag: 'quiz_results (page)',
    });
    // Preserve this function's existing contract: `lastDoc: null` signals "no more
    // pages" to callers (e.g. TeacherAnalyticsView checks `page.lastDoc !== null`),
    // whereas firestorePage's own `lastDoc` is the current page's last doc regardless
    // of `hasMore`.
    return { results: items, lastDoc: hasMore ? lastDoc : null };
  },

  fetchQuizResultsByStudentName: async (studentName: string, deviceId?: string, teacherUid?: string): Promise<QuizResult[]> => {
    try {
      const q = deviceId
        ? query(collection(db, 'quiz_results'), where('deviceId', '==', deviceId), orderBy('playedAt', 'desc'), limit(100))
        : teacherUid
          ? query(collection(db, 'quiz_results'), where('studentName', '==', studentName), where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc'), limit(100))
          : query(collection(db, 'quiz_results'), where('studentName', '==', studentName), orderBy('playedAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data()).filter(isValidQuizResult);
    } catch (error) {
      logger.error('Error fetching quiz results by student name:', error);
      return [];
    }
  },

  fetchQuizResultsByQuizId: async (quizId: string): Promise<QuizResult[]> => {
    try {
      const q = query(collection(db, 'quiz_results'), where('quizId', '==', quizId), orderBy('playedAt', 'desc'), limit(200));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data()).filter(isValidQuizResult);
    } catch (error) {
      logger.error('Error fetching quiz results by quiz ID:', error);
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
      logger.warn('fetchQuizResultsByConcept failed (non-critical):', error);
      return [];
    }
  },

  /** Most recent lab-exercise session for a lab (optionally scoped to a student). Reuses the conceptId+playedAt index. */
  fetchLastLabSession: async (labId: string, studentName?: string): Promise<QuizResult | null> => {
    try {
      const q = query(collection(db, 'quiz_results'), where('conceptId', '==', labId), orderBy('playedAt', 'desc'), limit(30));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => d.data() as QuizResult).filter(d => d.quizType === 'lab');
      const match = studentName ? docs.find(d => d.studentName === studentName) : docs[0];
      return match ?? null;
    } catch (error) {
      logger.warn('fetchLastLabSession failed (non-critical):', error);
      return null;
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
    // Keyed per-student-on-this-device (membershipKey), not bare deviceId — two different
    // students sharing one device/browser would otherwise collide on the same doc and the
    // second student's update would silently overwrite the first's mastery record.
    const docId = deviceId
      ? (teacherUid ? `${teacherUid}_${membershipKey(deviceId, studentName)}_${conceptId}` : `${membershipKey(deviceId, studentName)}_${conceptId}`)
      : (teacherUid ? `${teacherUid}_${safeName}_${conceptId}` : `${safeName}_${conceptId}`);
    const ref = doc(db, 'concept_mastery', docId);
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const queueOffline = async () => {
      try {
        const { saveMasteryOffline } = await import('./indexedDBService');
        await saveMasteryOffline({ studentName, conceptId, score, meta, teacherUid, deviceId });
      } catch (err) {
        logger.error('Error queueing offline mastery update:', err);
      }
    };
    try {
      let snap = await getDoc(ref);
      // Fall back to the legacy bare-deviceId doc (pre-fix data) for continuity on this
      // student's first update after the fix — subsequent updates only touch the new doc.
      if (!snap.exists() && deviceId) {
        const legacyDocId = teacherUid ? `${teacherUid}_${deviceId}_${conceptId}` : `${deviceId}_${conceptId}`;
        const legacySnap = await getDoc(doc(db, 'concept_mastery', legacyDocId));
        if (legacySnap.exists()) snap = legacySnap;
      }
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
      if (!isOnline) {
        await queueOffline();
      } else {
        setDoc(ref, updated, { merge: true }).catch(err => { logger.warn('Mastery write failed, queueing offline:', err); void queueOffline(); });
      }
      return { ...updated, attempts: updated.attempts! } as ConceptMastery;
    } catch (error) {
      logger.error('Error updating concept mastery:', error);
      await queueOffline();
      return {
        studentName, conceptId, attempts: 1,
        consecutiveHighScores: score >= 85 ? 1 : 0,
        bestScore: score, lastScore: score, mastered: false,
      } as ConceptMastery;
    }
  },

  fetchMasteryByStudent: async (studentName: string, deviceId?: string, teacherUid?: string): Promise<ConceptMastery[]> => {
    try {
      const q = deviceId
        ? query(collection(db, 'concept_mastery'), where('deviceId', '==', deviceId))
        : teacherUid
          ? query(collection(db, 'concept_mastery'), where('studentName', '==', studentName), where('teacherUid', '==', teacherUid))
          : query(collection(db, 'concept_mastery'), where('studentName', '==', studentName));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data()).filter(isValidConceptMastery);
    } catch (error) {
      logger.error('Error fetching mastery by student:', error);
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
      logger.error('Error fetching mastery by concept:', error);
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
      logger.error('Error fetching mastery by concept bulk:', error);
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
      logger.error('Error fetching all mastery:', error);
      return allResults; // return whatever we managed to fetch
    }
  },

  // -- Gamification --------------------------------------------------------------

  fetchStudentGamification: async (studentName: string, teacherUid?: string, deviceId?: string): Promise<StudentGamification | null> => {
    try {
      // Keyed per-student-on-this-device — two students sharing a device must not read/write
      // the same gamification doc. Falls back to the legacy bare-deviceId doc for continuity
      // with data written before this fix.
      if (deviceId && teacherUid) {
        const key = `${teacherUid}_${membershipKey(deviceId, studentName)}`;
        const s = await getDoc(doc(db, 'student_gamification', key));
        if (s.exists()) return parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${key}`) as StudentGamification;
        const legacyKey = `${teacherUid}_${deviceId}`;
        const legacy = await getDoc(doc(db, 'student_gamification', legacyKey));
        if (legacy.exists()) return parseFirestoreDoc(StudentGamificationSchema, legacy.data(), `student_gamification/${legacyKey}`) as StudentGamification;
      }
      if (deviceId && !teacherUid) {
        const key = membershipKey(deviceId, studentName);
        const s = await getDoc(doc(db, 'student_gamification', key));
        if (s.exists()) return parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${key}`) as StudentGamification;
        const legacy = await getDoc(doc(db, 'student_gamification', deviceId));
        if (legacy.exists()) return parseFirestoreDoc(StudentGamificationSchema, legacy.data(), `student_gamification/${deviceId}`) as StudentGamification;
      }
      if (teacherUid) {
        const s = await getDoc(doc(db, 'student_gamification', `${teacherUid}_${studentName}`));
        if (s.exists()) return parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${teacherUid}_${studentName}`) as StudentGamification;
      }
      const s = await getDoc(doc(db, 'student_gamification', studentName));
      return s.exists() ? parseFirestoreDoc(StudentGamificationSchema, s.data(), `student_gamification/${studentName}`) as StudentGamification : null;
    } catch (error) {
      logger.error('Error fetching gamification:', error);
      return null;
    }
  },

  fetchClassLeaderboard: async (teacherUid: string): Promise<StudentGamification[]> => {
    try {
      const q = query(
        collection(db, 'student_gamification'),
        where(documentId(), '>=', `${teacherUid}_`),
        where(documentId(), '<=', `${teacherUid}_\uf8ff`),
        limit(1000),
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as StudentGamification)
        .filter(d => typeof d?.studentName === 'string' && typeof d?.totalXP === 'number')
        .sort((a, b) => b.totalXP - a.totalXP);
    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
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
    // Keyed per-student-on-this-device — see fetchStudentGamification's matching comment.
    const docId = deviceId
      ? (teacherUid ? `${teacherUid}_${membershipKey(deviceId, studentName)}` : membershipKey(deviceId, studentName))
      : (teacherUid ? `${teacherUid}_${studentName}` : studentName);
    const legacyDocId = deviceId
      ? (teacherUid ? `${teacherUid}_${deviceId}` : deviceId)
      : null;
    const ref = doc(db, 'student_gamification', docId);

    const computeUpdate = (existing: StudentGamification | null) => {
      const today = new Date().toLocaleDateString('sv-SE');
      const base: StudentGamification = existing
        ?? { studentName, totalXP: 0, currentStreak: 0, longestStreak: 0, lastActivityDate: '', achievements: [], totalQuizzes: 0, ...(deviceId ? { deviceId } : {}), ...(teacherUid ? { teacherUid } : {}) };
      const xpGained = calcXP(percentage, justMastered);
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString('sv-SE');
      const newStreak = calcStreak(base.currentStreak, base.lastActivityDate, today, yesterdayStr);
      const newLongest = Math.max(base.longestStreak, newStreak);
      const updated: StudentGamification = {
        ...base,
        totalXP: base.totalXP + xpGained,
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActivityDate: today,
        totalQuizzes: base.totalQuizzes + 1,
        ...(teacherUid && !base.teacherUid ? { teacherUid } : {}),
      };
      const newAchievements = computeNewAchievements(updated.totalQuizzes, updated.longestStreak, percentage, totalMastered, updated.achievements);
      updated.achievements = [...updated.achievements, ...newAchievements];
      return { updated, xpGained, newAchievements };
    };

    try {
      // Atomic read-modify-write — without this, two concurrent calls for the same
      // docId (e.g. a duplicate quiz submission slipping past the UI guard) both read
      // the same stale doc and the second silently clobbers the first's XP/streak/
      // achievement update instead of stacking on top of it.
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        let existing = snap.exists() ? (snap.data() as StudentGamification) : null;
        if (!existing && legacyDocId) {
          const legacySnap = await tx.get(doc(db, 'student_gamification', legacyDocId));
          if (legacySnap.exists()) existing = legacySnap.data() as StudentGamification;
        }
        const computed = computeUpdate(existing);
        tx.set(ref, computed.updated, { merge: false });
        return computed;
      });
      return { xpGained: result.xpGained, newAchievements: result.newAchievements, gamification: result.updated };
    } catch (err) {
      // Transactions require a live round-trip and don't queue while offline the way a
      // plain setDoc does — fall back to the previous best-effort behavior (same race
      // window as before this fix, but only while offline) so offline play still works.
      logger.warn('Gamification transaction failed, falling back to best-effort write', err);
      let snap = await getDoc(ref).catch(() => null);
      if ((!snap || !snap.exists()) && legacyDocId) {
        snap = await getDoc(doc(db, 'student_gamification', legacyDocId)).catch(() => null);
      }
      const existing = snap?.exists() ? (snap.data() as StudentGamification) : null;
      const { updated, xpGained, newAchievements } = computeUpdate(existing);
      setDoc(ref, updated, { merge: false }).catch(e => logger.warn('Offline deferred', e));
      return { xpGained, newAchievements, gamification: updated };
    }
  },
};
