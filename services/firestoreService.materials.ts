import { logger } from '../utils/logger';
import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, startAfter, arrayUnion, documentId, getCountFromServer, getAggregateFromServer, average, type DocumentSnapshot, type Timestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { type DifferentiationLevel, type SavedQuestion, type ScanArtifactRecord } from '../types';
import { type CachedMaterial, type Assignment, type AIMaterialFeedbackEvent, type AIMaterialFeedbackSummary, type AIMaterialFeedbackSummaryRow, type AIMaterialType, type AIMaterialFeedbackAction, type RecoveryWorksheetApproval } from './firestoreService.types';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';
import { callEmbeddingProxy } from './gemini/core';
import { NotFoundError, OfflineError, FirestoreError } from '../utils/errors';
import { recordE2EAssignmentWrite } from './e2eTesting';

export const fetchFullCurriculum = async (): Promise<CurriculumModule> => {
    // Проверка на конекцијата пред да се вчита новиот курикулум.
    // Податоците од 'v1' се дел од официјалниот национален курикулум.
    const docRef = doc(db, "curriculum", "v1");

    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        // Се враќаат сите податоци мапирани по објект CurriculumModule.
        return docSnap.data() as CurriculumModule;
      } else {
        logger.error("...Firestore fetch failed: Document 'v1' does not exist in 'curriculum' collection.");
        throw new NotFoundError('curriculum/v1');
      }
    } catch (error: any) {
      // Re-throw AppErrors directly (NotFoundError, etc.)
      if (error?.code && error?.userMessage) throw error;
      // Gracefully handle offline errors — the app has a local data fallback.
      if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
          logger.info("...Could not fetch from Firestore: client is offline and data is not cached. Using local data.");
          throw new OfflineError('Клиентот е офлајн — Firestore не е достапен.');
      }
      logger.error("...Error fetching document from Firestore:", error);
      throw new FirestoreError('read', error.message);
    }
  };

export const saveFullCurriculum = async (data: CurriculumModule): Promise<void> => {
    const docRef = doc(db, "curriculum", "v1");
    try {
      await setDoc(docRef, data);
    } catch (error) {
      logger.error("Error saving curriculum data to Firestore:", error);
      throw error;
    }
  };

export const fetchCachedMaterials = async (maxCount: number = 50): Promise<CachedMaterial[]> => {
    try {
      const q = query(
        collection(db, "cached_ai_materials"),
        orderBy("createdAt", "desc"),
        limit(maxCount)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CachedMaterial[];
    } catch (error) {
      logger.error("Error fetching cached materials:", error);
      return [];
    }
  };

export const fetchLatestQuizByConcept = async (conceptId: string): Promise<CachedMaterial | null> => {
    try {
      const q = query(
        collection(db, "cached_ai_materials"),
        where("conceptId", "==", conceptId),
        where("type", "==", "quiz"),
        orderBy("createdAt", "desc"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const d = querySnapshot.docs[0];
        return {
          id: d.id,
          ...d.data()
        } as CachedMaterial;
      }
      return null;
    } catch (error) {
      logger.error("Error fetching latest quiz:", error);
      return null;
    }
  };

export const syncOfflineQuizzes = async (): Promise<number> => {
    try {
       const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
       if (!isOnline) return 0;
       
       const { getPendingQuizzes, clearPendingQuiz } = await import('./indexedDBService');
       const pending = await getPendingQuizzes();
       if (pending.length === 0) return 0;
       
       let synced = 0;
       for (const item of pending) {
         try {
           const docRef = doc(collection(db, "quiz_results"));
           await setDoc(docRef, {
             ...item.quizResult,
             playedAt: new Date(item.timestamp),
           });
           await clearPendingQuiz(item.id);
           synced++;
         } catch (err) {
           logger.error('Failed to sync offline quiz:', err);
         }
       }
       return synced;
    } catch (err) {
       logger.error('Sync error', err);
       return 0;
    }
  };

export const saveUserCurriculumEdit = async (
    userId: string,
    conceptId: string,
    updates: { assessmentStandards?: string[]; activities?: string[] }
  ): Promise<void> => {
    const ref = doc(db, "users", userId, "curriculumEdits", conceptId);
    await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  };

export const loadUserCurriculumEdits = async (userId: string): Promise<Record<string, { assessmentStandards?: string[]; activities?: string[] }>> => {
    try {
      const snap = await getDocs(collection(db, "users", userId, "curriculumEdits"));
      const edits: Record<string, { assessmentStandards?: string[]; activities?: string[] }> = {};
      snap.forEach(d => { edits[d.id] = d.data() as { assessmentStandards?: string[]; activities?: string[] }; });
      return edits;
    } catch {
      return {};
    }
  };

export const saveRemediaQuiz = async (content: any, meta: {
    conceptId?: string;
    topicId?: string;
    gradeLevel?: number;
    sourceQuizId?: string;
    title?: string;
  }, teacherUid?: string): Promise<string | null> => {
    try {
      // Generate embedding for RAG searchability
      let embedding: number[] | undefined;
      try {
        const snippetText = `${meta.title || 'Remedial Quiz'} ${meta.conceptId || ''}\n${JSON.stringify(content).substring(0, 800)}`;
        embedding = await callEmbeddingProxy(snippetText);
      } catch { /* non-fatal */ }

      const docRef = doc(collection(db, 'cached_ai_materials'));
      setDoc(docRef, {
        content,
        type: 'quiz',
        title: meta.title || 'Remedijalen kviz',
        isRemedial: true,
        sourceQuizId: meta.sourceQuizId,
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel ?? 0,
        ...(teacherUid ? { teacherUid } : {}),
        ...(embedding ? { embedding } : {}),
        createdAt: serverTimestamp(),
      }).catch(err => logger.warn('Offline deferred', err));
      return docRef.id;
    } catch (error) {
      logger.error('Error saving remedial quiz:', error);
      return null;
    }
  };

export const saveExitTicketQuiz = async (content: any, meta: {
    lessonTitle: string;
    gradeLevel?: number;
    topicId?: string;
    conceptId?: string;
  }, teacherUid?: string): Promise<string | null> => {
    try {
      let embedding: number[] | undefined;
      try {
        const snippetText = `${meta.lessonTitle} ${meta.conceptId || ''}\n${JSON.stringify(content).substring(0, 800)}`;
        embedding = await callEmbeddingProxy(snippetText);
      } catch { /* non-fatal */ }

      const docRef = await addDoc(collection(db, 'cached_ai_materials'), {
        content,
        type: 'quiz',
        title: `Exit Ticket: ${meta.lessonTitle}`,
        isExitTicket: true,
        lessonTitle: meta.lessonTitle,
        gradeLevel: meta.gradeLevel ?? 0,
        topicId: meta.topicId,
        conceptId: meta.conceptId,
        ...(teacherUid ? { teacherUid } : {}),
        ...(embedding ? { embedding } : {}),
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      logger.error('Error saving exit ticket quiz:', error);
      return null;
    }
  };

export const rateCachedMaterial = async (materialId: string, isHelpful: boolean): Promise<boolean> => {
    try {
      const docRef = doc(db, "cached_ai_materials", materialId);
      await updateDoc(docRef, {
        [isHelpful ? "helpfulCount" : "notHelpfulCount"]: increment(1)
      });
      return true;
    } catch (error) {
      logger.error("Error rating material:", error);
      return false;
    }
  };

export const saveQuestion = async (q: Omit<SavedQuestion, 'id'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'saved_questions'), {
      ...q,
      options: q.options ?? [],      // Firestore rejects undefined
      solution: q.solution ?? '',
      reviewStatus: q.reviewStatus ?? 'pending',
      savedAt: serverTimestamp(),
    });
    return ref.id;
  };

export const fetchUnapprovedQuestions = async (): Promise<SavedQuestion[]> => {
    try {
      const q = query(
        collection(db, 'saved_questions'),
        where('isApproved', '==', false),
        limit(200)
      );
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as SavedQuestion))
        .filter(q => !q.reviewStatus || q.reviewStatus === 'pending');
    } catch (error) {
      logger.error('Error fetching unapproved questions:', error);
      return [];
    }
  };

export const updateSavedQuestion = async (questionId: string, updates: Partial<SavedQuestion>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'saved_questions', questionId), updates);
    } catch (error) {
      logger.error('Error updating saved question:', error);
      throw error;
    }
  };

export const fetchSavedQuestions = async (teacherUid: string): Promise<SavedQuestion[]> => {
    try {
      const q = query(
        collection(db, 'saved_questions'),
        where('teacherUid', '==', teacherUid),
        orderBy('savedAt', 'desc'),
        limit(200)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedQuestion));
    } catch (error) {
      logger.error('Error fetching saved questions:', error);
      return [];
    }
  };

export const deleteQuestion = async (questionId: string): Promise<void> => {
    await deleteDoc(doc(db, 'saved_questions', questionId));
  };

export const verifyQuestion = async (questionId: string, verified: boolean): Promise<void> => {
    await updateDoc(doc(db, 'saved_questions', questionId), {
      isVerified: verified,
      verifiedAt: verified ? serverTimestamp() : null,
    });
  };

export const fetchVerifiedQuestions = async (teacherUid: string, conceptId?: string): Promise<SavedQuestion[]> => {
    try {
      const constraints = [
        where('teacherUid', '==', teacherUid),
        where('isVerified', '==', true),
        ...(conceptId ? [where('conceptId', '==', conceptId)] : []),
        limit(100),
      ];
      const q = query(collection(db, 'saved_questions'), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedQuestion));
    } catch (error) {
      logger.error('Error fetching verified questions:', error);
      return [];
    }
  };

export const saveMaterialFeedback = async (
    rating: 'up' | 'down',
    materialTitle: string,
    materialType: string,
    teacherUid: string,
    reportText?: string,
    conceptId?: string,
    gradeLevel?: number,
  ): Promise<void> => {
    await addDoc(collection(db, 'material_feedback'), {
      rating,
      materialTitle,
      materialType,
      teacherUid,
      ...(reportText ? { reportText } : {}),
      ...(conceptId  ? { conceptId }  : {}),
      ...(gradeLevel ? { gradeLevel } : {}),
      ratedAt: serverTimestamp(),
    });
  };

const AI_MATERIAL_FEEDBACK_COLLECTION = 'ai_material_feedback_events';

export const logAIMaterialFeedbackEvent = async (payload: {
  teacherUid: string;
  materialType: AIMaterialType;
  action: AIMaterialFeedbackAction;
  materialId?: string;
  context?: string;
}): Promise<void> => {
  await addDoc(collection(db, AI_MATERIAL_FEEDBACK_COLLECTION), {
    teacherUid: payload.teacherUid,
    materialType: payload.materialType,
    action: payload.action,
    ...(payload.materialId ? { materialId: payload.materialId } : {}),
    ...(payload.context ? { context: payload.context } : {}),
    occurredAt: serverTimestamp(),
  });
};

export const buildAIMaterialFeedbackSummaryFromEvents = (
  events: Array<Pick<AIMaterialFeedbackEvent, 'materialType' | 'action'>>,
  windowDays = 30,
): AIMaterialFeedbackSummary => {
  const rows: Record<string, AIMaterialFeedbackSummaryRow> = {};

  for (const e of events) {
    const t = e.materialType || 'other';
    if (!rows[t]) {
      rows[t] = { materialType: t, total: 0, editEvents: 0, rejectEvents: 0, acceptEvents: 0 };
    }

    rows[t].total += 1;
    if (e.action?.startsWith('edit_')) rows[t].editEvents += 1;
    if (e.action?.startsWith('reject_')) rows[t].rejectEvents += 1;
    if (e.action?.startsWith('accept_')) rows[t].acceptEvents += 1;
  }

  const byMaterialType = Object.values(rows).sort((a, b) => b.total - a.total);
  return {
    windowDays,
    totalEvents: byMaterialType.reduce((s, r) => s + r.total, 0),
    byMaterialType,
  };
};

export const fetchAIMaterialFeedbackSummary = async (
  teacherUid: string,
  windowDays = 30,
): Promise<AIMaterialFeedbackSummary> => {
  const fallback: AIMaterialFeedbackSummary = {
    windowDays,
    totalEvents: 0,
    byMaterialType: [],
  };

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);

    const q = query(
      collection(db, AI_MATERIAL_FEEDBACK_COLLECTION),
      where('teacherUid', '==', teacherUid),
      where('occurredAt', '>=', cutoff),
      orderBy('occurredAt', 'desc'),
      limit(2000),
    );

    const snap = await getDocs(q);
    if (snap.empty) return fallback;
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AIMaterialFeedbackEvent));
    return buildAIMaterialFeedbackSummaryFromEvents(events, windowDays);
  } catch (error) {
    logger.error('Error fetching AI material feedback summary:', error);
    return fallback;
  }
};

export const saveToLibrary = async (content: any, meta: {
    title: string;
    type: CachedMaterial['type'];
    teacherUid: string;
    conceptId?: string;
    topicId?: string;
    gradeLevel?: number;
    isPublic?: boolean;
}): Promise<string> => {
    // Generate embedding for semantic search
    let embedding: number[] | undefined;
    try {
        // Embed the title and a snippet of the content for semantic relevance
        const contentSnippet = typeof content === 'string' 
            ? content.substring(0, 1000) 
            : JSON.stringify(content).substring(0, 1000);
        const textToEmbed = `${meta.title}\n${contentSnippet}`;
        embedding = await callEmbeddingProxy(textToEmbed);
    } catch (err) {
        logger.warn('Failed to generate embedding for library item:', err);
    }

    const ref = await addDoc(collection(db, 'cached_ai_materials'), {
        content,
        type: meta.type,
        title: meta.title,
        teacherUid: meta.teacherUid,
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel ?? 0,
        status: 'draft',
        isPublic: meta.isPublic !== false, // default true; PRO can set false
        embedding,
        createdAt: serverTimestamp(),
    });
    return ref.id;
};

export const fetchLibraryMaterials = async (teacherUid: string): Promise<CachedMaterial[]> => {
    try {
      const q = query(collection(db, 'cached_ai_materials'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CachedMaterial));
    } catch (error) {
      logger.error('Error fetching library materials:', error);
      return [];
    }
  };

export const fetchGlobalLibraryMaterials = async (): Promise<CachedMaterial[]> => {
    try {
      const q = query(
        collection(db, 'cached_ai_materials'),
        where('status', '==', 'published'),
        limit(200)
      );
      const snap = await getDocs(q);
      // Filter client-side: exclude materials explicitly marked private (isPublic === false)
      return snap.docs
        .map(d => ({ id: d.id, ...d.data() } as CachedMaterial))
        .filter(m => m.isPublic !== false);
    } catch (error) {
      logger.error('Error fetching global library materials:', error);
      return [];
    }
  };

export const publishMaterial = async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { status: 'published' });
  };

export const unpublishMaterial = async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { status: 'draft' });
  };

export const approveMaterial = async (id: string, approved: boolean): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { isApproved: approved });
  };

export const deleteCachedMaterial = async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'cached_ai_materials', id));
  };

/** Soft-delete: sets archivedAt timestamp. The material stays in Firestore but is hidden from the main library. */
export const archiveMaterial = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'cached_ai_materials', id), { archivedAt: serverTimestamp() });
};

/** Restore: clears archivedAt so the material reappears in the main library. */
export const restoreMaterial = async (id: string): Promise<void> => {
  await updateDoc(doc(db, 'cached_ai_materials', id), { archivedAt: null });
};

/** Fetch all archived materials for the given teacher. */
export const fetchArchivedMaterials = async (teacherUid: string): Promise<import('./firestoreService.types').CachedMaterial[]> => {
  try {
    const q = query(
      collection(db, 'cached_ai_materials'),
      where('teacherUid', '==', teacherUid),
      where('archivedAt', '!=', null),
      orderBy('archivedAt', 'desc'),
      limit(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as import('./firestoreService.types').CachedMaterial));
  } catch (error) {
    logger.error('fetchArchivedMaterials error:', error);
    return [];
  }
};

export const updateMaterialTitle = async (id: string, title: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { title });
  };

// ── И3: Teacher Collaboration ───────────────────────────────────────────────

/** Publish material and store author attribution (И3) */
export const publishMaterialWithAttribution = async (
  id: string,
  publishedByUid: string,
  publishedByName: string,
  publisherIsMentor = false
): Promise<void> => {
  await updateDoc(doc(db, 'cached_ai_materials', id), {
    status: 'published',
    publishedByUid,
    publishedByName,
    publisherIsMentor,
  });
};

/** Rate a published material (1–5 stars). One rating per teacher UID — overwritable. */
export const rateMaterial = async (
  materialId: string,
  teacherUid: string,
  rating: number
): Promise<void> => {
  await updateDoc(doc(db, 'cached_ai_materials', materialId), {
    [`ratingsByUid.${teacherUid}`]: rating,
  });
};

/** Fork a published material into the target teacher's library (status: draft) */
export const forkCachedMaterial = async (
  sourceId: string,
  targetTeacherUid: string
): Promise<string> => {
  const snap = await getDoc(doc(db, 'cached_ai_materials', sourceId));
  if (!snap.exists()) throw new NotFoundError('cached_ai_material');
  const src = snap.data();
  if (src.status !== 'published') throw new FirestoreError('read', 'Can only fork published materials');
  const ref = await addDoc(collection(db, 'cached_ai_materials'), {
    content: src.content,
    type: src.type,
    title: `[Форк] ${src.title || 'Материјал'}`,
    conceptId: src.conceptId ?? null,
    topicId: src.topicId ?? null,
    gradeLevel: src.gradeLevel ?? 0,
    teacherUid: targetTeacherUid,
    status: 'draft',
    isForked: true,
    sourceId,
    sourceAuthor: src.publishedByName || 'Непознат наставник',
    createdAt: serverTimestamp(),
  });
  return ref.id;
};

export const saveAssignment = async (a: Omit<Assignment, 'id' | 'createdAt'>): Promise<string> => {
    const e2eId = recordE2EAssignmentWrite(a);
    if (e2eId) return e2eId;

    const ref = await addDoc(collection(db, 'assignments'), { ...a, createdAt: serverTimestamp() });
    return ref.id;
  };

export const fetchAssignmentsByTeacher = async (teacherUid: string): Promise<Assignment[]> => {
    try {
      const q = query(collection(db, 'assignments'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
    } catch (error) {
      logger.error('Error fetching assignments by teacher:', error);
      return [];
    }
  };

export const fetchAssignmentsByStudent = async (studentName: string): Promise<Assignment[]> => {
    try {
      const q = query(collection(db, 'assignments'), where('classStudentNames', 'array-contains', studentName), orderBy('dueDate', 'asc'), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
    } catch (error) {
      logger.error('Error fetching assignments by student:', error);
      return [];
    }
  };

export const markAssignmentCompleted = async (assignmentId: string, studentName: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'assignments', assignmentId), { completedBy: arrayUnion(studentName) });
    } catch (error) {
      logger.error('Error marking assignment completed:', error);
    }
  };

export const deleteAssignment = async (assignmentId: string): Promise<void> => {
    await deleteDoc(doc(db, 'assignments', assignmentId));
  };

export const saveAssignmentMaterial = async (content: any, meta: { title: string; type: 'QUIZ' | 'ASSESSMENT'; conceptId?: string; topicId?: string; gradeLevel?: number; teacherUid: string; isPublic?: boolean; isRecoveryWorksheet?: boolean; reviewStatus?: 'draft' | 'approved' | 'rejected'; teacherNotes?: string; approvalRef?: string; removedQuestionIds?: number[] }): Promise<string> => {
    const ref = await addDoc(collection(db, 'cached_ai_materials'), {
      content,
      type: meta.type.toLowerCase(),
      title: meta.title,
      conceptId: meta.conceptId,
      topicId: meta.topicId,
      gradeLevel: meta.gradeLevel,
      teacherUid: meta.teacherUid,
      isPublic: meta.isPublic !== false, // default true
      ...(meta.isRecoveryWorksheet ? { isRecoveryWorksheet: true } : {}),
      ...(meta.reviewStatus ? { reviewStatus: meta.reviewStatus } : {}),
      ...(meta.teacherNotes ? { teacherNotes: meta.teacherNotes } : {}),
      ...(meta.approvalRef ? { approvalRef: meta.approvalRef } : {}),
      ...(meta.removedQuestionIds?.length ? { removedQuestionIds: meta.removedQuestionIds } : {}),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

export const saveScanArtifactRecord = async (
  record: Omit<ScanArtifactRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  const ref = await addDoc(collection(db, 'scan_artifacts'), {
    ...record,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
};

export const saveRecoveryWorksheetApproval = async (approval: Omit<RecoveryWorksheetApproval, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'worksheet_approvals'), {
      ...approval,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

export const publishToNationalLibrary = async (
    q: SavedQuestion,
    teacherName: string,
    schoolName?: string,
    publisherIsMentor = false,
  ): Promise<string> => {
    const ref = await addDoc(collection(db, 'national_library'), {
      question: q.question,
      type: q.type,
      options: q.options ?? [],
      answer: q.answer,
      solution: q.solution ?? '',
      gradeLevel: q.gradeLevel ?? null,
      conceptId: q.conceptId ?? null,
      conceptTitle: q.conceptTitle ?? null,
      topicId: q.topicId ?? null,
      publishedByUid: q.teacherUid,
      publishedByName: teacherName,
      schoolName: schoolName ?? null,
      publisherIsMentor,
      importCount: 0,
      publishedAt: serverTimestamp(),
      ...(q.dokLevel ? { dokLevel: q.dokLevel } : {}),
    });
    // Mark the original question as public
    await updateDoc(doc(db, 'saved_questions', q.id), { isPublic: true });
    return ref.id;
  };

export interface NationalLibraryEntry {
  id: string;
  question: string;
  type: string;
  options: string[];
  answer: string;
  solution: string;
  gradeLevel: number | null;
  conceptId: string | null;
  conceptTitle: string | null;
  topicId: string | null;
  publishedByUid: string;
  publishedByName: string;
  schoolName: string | null;
  publisherIsMentor: boolean;
  importCount: number;
  publishedAt: Timestamp | null;
  /** map of teacherUid → star rating (1–5) */
  ratingsByUid?: Record<string, number>;
  /** Admin-marked featured entry (shown at top) */
  isFeatured?: boolean;
  /** Webb's Depth of Knowledge level */
  dokLevel?: 1 | 2 | 3 | 4 | null;
  /** Soft-deleted by admin */
  deleted?: boolean;
}

/** Returns average star rating (1–5) or null if no ratings */
export function getAvgRating(entry: NationalLibraryEntry): number | null {
  const ratings = entry.ratingsByUid ? Object.values(entry.ratingsByUid) : [];
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
}

/** Returns this teacher's existing rating or null */
export function getUserRating(entry: NationalLibraryEntry, teacherUid: string): number | null {
  return entry.ratingsByUid?.[teacherUid] ?? null;
}

/** Submit or update a star rating (1–5) for a national library entry */
export const rateNationalLibraryEntry = async (
  entryId: string,
  teacherUid: string,
  stars: number,
): Promise<void> => {
  await updateDoc(doc(db, 'national_library', entryId), {
    [`ratingsByUid.${teacherUid}`]: stars,
  });
};

/** Admin: hard-delete a national library entry */
export const deleteNationalLibraryEntry = async (entryId: string): Promise<void> => {
  await deleteDoc(doc(db, 'national_library', entryId));
};

/** Admin: toggle featured flag on a national library entry */
export const featureNationalLibraryEntry = async (entryId: string, featured: boolean): Promise<void> => {
  await updateDoc(doc(db, 'national_library', entryId), { isFeatured: featured });
};

export const PAGE_SIZE_NATIONAL_LIBRARY = 20;

export const fetchNationalLibrary = async (filters?: {
    gradeLevel?: number;
    conceptId?: string;
    type?: string;
    cursor?: DocumentSnapshot;
  }): Promise<{ entries: NationalLibraryEntry[]; lastDoc: DocumentSnapshot | null }> => {
    try {
      const constraints: any[] = [];
      if (filters?.gradeLevel) constraints.push(where('gradeLevel', '==', filters.gradeLevel));
      if (filters?.type) constraints.push(where('type', '==', filters.type));
      if (filters?.conceptId) constraints.push(where('conceptId', '==', filters.conceptId));
      constraints.push(orderBy('publishedAt', 'desc'));
      if (filters?.cursor) constraints.push(startAfter(filters.cursor));
      constraints.push(limit(PAGE_SIZE_NATIONAL_LIBRARY));
      const q = query(collection(db, 'national_library'), ...constraints);
      const snap = await getDocs(q);
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() })) as NationalLibraryEntry[];
      const lastDoc = snap.docs.length === PAGE_SIZE_NATIONAL_LIBRARY ? snap.docs[snap.docs.length - 1] : null;
      return { entries, lastDoc };
    } catch (error) {
      logger.error('Error fetching national library:', error);
      return { entries: [], lastDoc: null };
    }
  };

export const importFromNationalLibrary = async (
    entry: any,
    teacherUid: string,
  ): Promise<string> => {
    const ref = await addDoc(collection(db, 'saved_questions'), {
      teacherUid,
      question: entry.question,
      type: entry.type,
      options: entry.options ?? [],
      answer: entry.answer,
      solution: entry.solution ?? '',
      gradeLevel: entry.gradeLevel,
      conceptId: entry.conceptId,
      conceptTitle: entry.conceptTitle,
      topicId: entry.topicId,
      savedAt: serverTimestamp(),
      isVerified: false,
      importedFrom: entry.id,
      importedFromAuthor: entry.publishedByName,
      ...(entry.dokLevel ? { dokLevel: entry.dokLevel } : {}),
    });
    // Increment importCount atomically — avoids race condition when multiple users import simultaneously
    try {
      await updateDoc(doc(db, 'national_library', entry.id), {
        importCount: increment(1),
      });
    } catch { /* non-fatal */ }
    return ref.id;
  };

export const saveTeacherNote = async (teacherUid: string, conceptId: string, note: string): Promise<void> => {
    const docId = `${teacherUid}_${conceptId}`;
    await setDoc(doc(db, 'teacher_notes', docId), {
      teacherUid,
      conceptId,
      note,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

export const fetchTeacherNote = async (teacherUid: string, conceptId: string): Promise<string> => {
    const snap = await getDoc(doc(db, 'teacher_notes', `${teacherUid}_${conceptId}`));
    return snap.exists() ? (snap.data().note ?? '') : '';
  };

// ─── Annual Plan CRUD ─────────────────────────────────────────────────────────

export interface AnnualPlanDoc {
  id: string;
  userId: string;
  authorName?: string;
  createdAt: Timestamp | null;
  grade: string;
  subject: string;
  planData: import('../types').AIGeneratedAnnualPlan;
  likes?: number;
  forks?: number;
  isForked?: boolean;
  originalPlanId?: string;
}

export const fetchAnnualPlanById = async (planId: string): Promise<AnnualPlanDoc | null> => {
  const snap = await getDoc(doc(db, 'academic_annual_plans', planId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AnnualPlanDoc;
};

export const updateAnnualPlan = async (
  planId: string,
  planData: import('../types').AIGeneratedAnnualPlan
): Promise<void> => {
  await updateDoc(doc(db, 'academic_annual_plans', planId), {
    planData,
    grade: planData.grade,
    subject: planData.subject,
    updatedAt: serverTimestamp(),
  });
};

export const createAnnualPlan = async (
  userId: string,
  planData: import('../types').AIGeneratedAnnualPlan,
  extra?: Partial<Omit<AnnualPlanDoc, 'id' | 'userId' | 'planData'>>
): Promise<string> => {
  const ref = await addDoc(collection(db, 'academic_annual_plans'), {
    userId,
    createdAt: serverTimestamp(),
    planData,
    grade: planData.grade,
    subject: planData.subject,
    ...extra,
  });
  return ref.id;
};

