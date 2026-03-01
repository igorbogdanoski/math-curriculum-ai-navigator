import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { type DifferentiationLevel, type SavedQuestion } from '../types';

/**
 * Tracks a student's mastery of a specific concept over time.
 * Stored in Firestore under: concept_mastery/{studentName}_{conceptId}
 *
 * Mastery is achieved when the student scores ≥85% on 3+ consecutive attempts.
 */
export interface ConceptMastery {
  studentName: string;
  conceptId: string;
  conceptTitle?: string;
  topicId?: string;
  gradeLevel?: number;
  teacherUid?: string;       // set for new records; undefined for legacy shared records
  attempts: number;          // total attempts
  consecutiveHighScores: number; // consecutive attempts ≥85%
  bestScore: number;
  lastScore: number;
  mastered: boolean;         // true when consecutiveHighScores ≥ 3
  masteredAt?: any;          // Firestore Timestamp
  updatedAt?: any;
}

// ── Live Session ──────────────────────────────────────────────────────────────
export interface LiveSession {
  id: string;
  hostUid: string;
  quizId: string;
  quizTitle: string;
  conceptId?: string;
  status: 'active' | 'ended';
  joinCode: string;         // 4-char alphanumeric, e.g. 'AB3K'
  studentResponses: Record<string, {
    status: 'joined' | 'in_progress' | 'completed';
    percentage?: number;
    completedAt?: any;
  }>;
  createdAt?: any;
}

// ── Student Groups ────────────────────────────────────────────────────────────
export interface StudentGroup {
  id: string;
  name: string;
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple';
  studentNames: string[];
  teacherUid?: string;
  createdAt?: any;
}

// ── School Classes ────────────────────────────────────────────────────────────
export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number;
  teacherUid: string;
  studentNames: string[];
  createdAt?: any;
}

// ── Gamification ─────────────────────────────────────────────────────────────
export interface StudentGamification {
  studentName: string;
  totalXP: number;
  currentStreak: number;    // consecutive days with ≥1 quiz
  longestStreak: number;
  lastActivityDate: string; // 'YYYY-MM-DD' local date
  achievements: string[];   // unlocked achievement IDs
  totalQuizzes: number;     // running total across all time
}

export const ACHIEVEMENTS: Record<string, { label: string; icon: string; condition: (g: StudentGamification) => boolean }> = {
  first_quiz:  { label: 'Прво знаење',      icon: '🎯', condition: g => g.totalQuizzes >= 1 },
  quiz_10:     { label: 'Упорен ученик',     icon: '📚', condition: g => g.totalQuizzes >= 10 },
  quiz_50:     { label: 'Математичар',       icon: '🧮', condition: g => g.totalQuizzes >= 50 },
  streak_3:    { label: 'Редовен ученик',    icon: '🔥', condition: g => g.longestStreak >= 3 },
  streak_7:    { label: 'Недела упорност',   icon: '⚡', condition: g => g.longestStreak >= 7 },
  score_90:    { label: 'Одличен',           icon: '⭐', condition: () => false }, // set ad-hoc on score
  mastered_1:  { label: 'Мајстор',           icon: '🏆', condition: () => false }, // set ad-hoc on mastery
  mastered_5:  { label: 'Напреден',          icon: '🥇', condition: () => false },
  mastered_10: { label: 'Виртуоз',           icon: '💎', condition: () => false },
};

export interface QuizResult {
  quizId: string;
  quizTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  playedAt?: any;
  conceptId?: string;
  topicId?: string;
  gradeLevel?: number;
  studentName?: string;
  teacherUid?: string;       // set when student arrives via teacher-tagged link
  differentiationLevel?: DifferentiationLevel; // level of the quiz that was played
}

export interface CachedMaterial {
  id: string;
  content: any;
  type: 'analogy' | 'outline' | 'quiz' | 'discussion' | 'problems' | 'assessment' | 'rubric' | 'thematicplan' | 'ideas' | 'solver';
  conceptId?: string;
  topicId?: string;
  gradeLevel: number;
  createdAt: any; // Firestore Timestamp or date string
  helpfulCount?: number;
  notHelpfulCount?: number;
}

// Овој сервис сега користи вистински Firebase SDK за да ги вчита податоците.
// Тој пристапува до колекцијата 'curriculum' и документот 'v1' што го креиравме.

export const firestoreService = {
  /**
   * Fetches the entire curriculum data module from Firestore.
   */
  fetchFullCurriculum: async (): Promise<CurriculumModule> => {
    console.log("Attempting to fetch data from Firestore...");
    
    // Референца до документот што ги содржи сите податоци.
    // Променете го 'v1' ако сте го именувале документот поинаку.
    const docRef = doc(db, "curriculum", "v1");

    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log("...Data received successfully from Firestore.");
        // Го враќаме целиот документ, кастиран во нашиот CurriculumModule тип.
        return docSnap.data() as CurriculumModule;
      } else {
        console.error("...Firestore fetch failed: Document 'v1' does not exist in 'curriculum' collection.");
        throw new Error("Документот со наставната програма не е пронајден во базата на податоци.");
      }
    } catch (error: any) {
      // Gracefully handle offline errors, as the app has a local data fallback.
      if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
          console.info("...Could not fetch from Firestore: client is offline and data is not cached. Using local data.");
          // We throw an error so the calling hook knows the fetch failed, but it's not a critical error.
          throw new Error("Офлајн сте и податоците не можеа да се синхронизираат.");
      }

      // For any other type of error, log it as a critical error.
      console.error("...Error fetching document from Firestore:", error);
      const errorMessage = error.message || "An unknown network error occurred.";
      throw new Error(`Грешка при комуникација со базата на податоци: ${errorMessage}`);
    }
  },

  /**
   * Saves the entire curriculum data module to Firestore.
   * Useful for initial setup or migrations.
   */
  saveFullCurriculum: async (data: CurriculumModule): Promise<void> => {
    console.log("Attempting to save curriculum data to Firestore...");
    const docRef = doc(db, "curriculum", "v1");
    try {
      await setDoc(docRef, data);
      console.log("Curriculum data successfully saved to Firestore.");
    } catch (error) {
      console.error("Error saving curriculum data to Firestore:", error);
      throw error;
    }
  },

  /**
   * Fetches AI cached materials for community reuse
   */
  fetchCachedMaterials: async (maxCount: number = 50): Promise<CachedMaterial[]> => {
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
      console.error("Error fetching cached materials:", error);
      return [];
    }
  },

  /**
   * Fetches the latest quiz for a specific concept
   */
  fetchLatestQuizByConcept: async (conceptId: string): Promise<CachedMaterial | null> => {
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
      console.error("Error fetching latest quiz:", error);
      return null;
    }
  },

  /**
   * Saves a quiz result to the quiz_results collection.
   * Works for anonymous students (no auth required).
   */
  saveQuizResult: async (result: QuizResult): Promise<void> => {
    try {
      await addDoc(collection(db, "quiz_results"), {
        ...result,
        playedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error saving quiz result:", error);
    }
  },

  /**
   * Saves a teacher's custom edits to a concept (assessmentStandards and/or activities)
   * stored under users/{userId}/curriculumEdits/{conceptId}
   */
  saveUserCurriculumEdit: async (
    userId: string,
    conceptId: string,
    updates: { assessmentStandards?: string[]; activities?: string[] }
  ): Promise<void> => {
    const ref = doc(db, "users", userId, "curriculumEdits", conceptId);
    await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
  },

  /**
   * Loads all curriculum edits saved by a teacher
   * Returns a map of conceptId → { assessmentStandards?, activities? }
   */
  loadUserCurriculumEdits: async (userId: string): Promise<Record<string, { assessmentStandards?: string[]; activities?: string[] }>> => {
    try {
      const snap = await getDocs(collection(db, "users", userId, "curriculumEdits"));
      const edits: Record<string, { assessmentStandards?: string[]; activities?: string[] }> = {};
      snap.forEach(d => { edits[d.id] = d.data() as { assessmentStandards?: string[]; activities?: string[] }; });
      return edits;
    } catch {
      return {};
    }
  },

  /**
   * Fetches quiz results for the teacher analytics dashboard.
   * Returns the most recent results, newest first.
   */
  fetchQuizResults: async (maxCount: number = 200, teacherUid?: string): Promise<QuizResult[]> => {
    try {
      const q = teacherUid
        ? query(collection(db, "quiz_results"), where("teacherUid", "==", teacherUid), orderBy("playedAt", "desc"), limit(maxCount))
        : query(collection(db, "quiz_results"), orderBy("playedAt", "desc"), limit(maxCount));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.error("Error fetching quiz results:", error);
      return [];
    }
  },

  /**
   * Saves an AI-generated remedial quiz to cached_ai_materials and returns the new document ID.
   * Used by the Adaptive Remediation Engine in StudentPlayView.
   */
  saveRemediaQuiz: async (content: any, meta: {
    conceptId?: string;
    topicId?: string;
    gradeLevel?: number;
    sourceQuizId?: string;
  }, teacherUid?: string): Promise<string | null> => {
    try {
      const docRef = await addDoc(collection(db, 'cached_ai_materials'), {
        content,
        type: 'quiz',
        isRemedial: true,
        sourceQuizId: meta.sourceQuizId,
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
        ...(teacherUid ? { teacherUid } : {}),
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving remedial quiz:', error);
      return null;
    }
  },

  /**
   * Fetches quiz results for a specific student by name (case-insensitive client-side filter).
   */
  fetchQuizResultsByStudentName: async (studentName: string): Promise<QuizResult[]> => {
    try {
      const q = query(
        collection(db, "quiz_results"),
        where("studentName", "==", studentName),
        orderBy("playedAt", "desc"),
        limit(100)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.error("Error fetching quiz results by student name:", error);
      return [];
    }
  },

  /**
   * Fetches quiz results for a specific quiz (exit ticket analytics).
   */
  fetchQuizResultsByQuizId: async (quizId: string): Promise<QuizResult[]> => {
    try {
      const q = query(
        collection(db, "quiz_results"),
        where("quizId", "==", quizId),
        orderBy("playedAt", "desc"),
        limit(200)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.error("Error fetching quiz results by quiz ID:", error);
      return [];
    }
  },

  /**
   * Saves an exit ticket quiz (linked to a planner lesson) to cached_ai_materials.
   * Returns the new document ID.
   */
  saveExitTicketQuiz: async (content: any, meta: {
    lessonTitle: string;
    gradeLevel?: number;
    topicId?: string;
    conceptId?: string;
  }, teacherUid?: string): Promise<string | null> => {
    try {
      const docRef = await addDoc(collection(db, 'cached_ai_materials'), {
        content,
        type: 'quiz',
        isExitTicket: true,
        lessonTitle: meta.lessonTitle,
        gradeLevel: meta.gradeLevel,
        topicId: meta.topicId,
        conceptId: meta.conceptId,
        ...(teacherUid ? { teacherUid } : {}),
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error saving exit ticket quiz:', error);
      return null;
    }
  },

  /**
   * Rates a cached material
   */
  rateCachedMaterial: async (materialId: string, isHelpful: boolean): Promise<boolean> => {
    try {
      const docRef = doc(db, "cached_ai_materials", materialId);
      await updateDoc(docRef, {
        [isHelpful ? "helpfulCount" : "notHelpfulCount"]: increment(1)
      });
      return true;
    } catch (error) {
      console.error("Error rating material:", error);
      return false;
    }
  },

  // ── Mastery Tracking ────────────────────────────────────────────────────────

  /**
   * Updates concept mastery for a student after a quiz attempt.
   * Called automatically by StudentPlayView after each quiz completion.
   *
   * Mastery logic:
   * - 3+ consecutive scores ≥85% → mastered = true
   * - Any score <85% resets the consecutive counter
   */
  updateConceptMastery: async (
    studentName: string,
    conceptId: string,
    score: number,
    meta?: { conceptTitle?: string; topicId?: string; gradeLevel?: number },
    teacherUid?: string
  ): Promise<ConceptMastery> => {
    const safeName = studentName.replace(/\s+/g, '_');
    const docId = teacherUid
      ? `${teacherUid}_${safeName}_${conceptId}`
      : `${safeName}_${conceptId}`;
    const ref = doc(db, 'concept_mastery', docId);

    try {
      const snap = await getDoc(ref);
      const existing = snap.exists() ? (snap.data() as ConceptMastery) : null;

      const prevConsecutive = existing?.consecutiveHighScores ?? 0;
      const newConsecutive = score >= 85 ? prevConsecutive + 1 : 0;
      const mastered = newConsecutive >= 3;
      const wasAlreadyMastered = existing?.mastered ?? false;

      const updated: Partial<ConceptMastery> = {
        studentName,
        conceptId,
        conceptTitle: meta?.conceptTitle ?? existing?.conceptTitle,
        topicId: meta?.topicId ?? existing?.topicId,
        gradeLevel: meta?.gradeLevel ?? existing?.gradeLevel,
        ...(teacherUid ? { teacherUid } : {}),
        attempts: (existing?.attempts ?? 0) + 1,
        consecutiveHighScores: newConsecutive,
        bestScore: Math.max(score, existing?.bestScore ?? 0),
        lastScore: score,
        mastered,
        updatedAt: serverTimestamp(),
        ...(mastered && !wasAlreadyMastered ? { masteredAt: serverTimestamp() } : {}),
      };

      await setDoc(ref, updated, { merge: true });
      return { ...updated, attempts: updated.attempts! } as ConceptMastery;
    } catch (error) {
      console.error('Error updating concept mastery:', error);
      return {
        studentName, conceptId, attempts: 1,
        consecutiveHighScores: score >= 85 ? 1 : 0,
        bestScore: score, lastScore: score,
        mastered: false,
      } as ConceptMastery;
    }
  },

  /**
   * Fetches all mastery records for a given student.
   */
  fetchMasteryByStudent: async (studentName: string): Promise<ConceptMastery[]> => {
    try {
      const q = query(
        collection(db, 'concept_mastery'),
        where('studentName', '==', studentName)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as ConceptMastery);
    } catch (error) {
      console.error('Error fetching mastery by student:', error);
      return [];
    }
  },

  /**
   * Fetches all mastery records for a given concept (class-wide view).
   * Used in TeacherAnalyticsView to show how many students mastered a concept.
   */
  fetchMasteryByConcept: async (conceptId: string): Promise<ConceptMastery[]> => {
    try {
      const q = query(
        collection(db, 'concept_mastery'),
        where('conceptId', '==', conceptId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as ConceptMastery);
    } catch (error) {
      console.error('Error fetching mastery by concept:', error);
      return [];
    }
  },

  /**
   * Fetches mastery records for all students across all concepts.
   * Used in TeacherAnalyticsView for class-wide mastery overview.
   */
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

  // ── Gamification: fetch ───────────────────────────────────────────────────
  fetchStudentGamification: async (studentName: string): Promise<StudentGamification | null> => {
    try {
      const ref = doc(db, 'student_gamification', studentName);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as StudentGamification) : null;
    } catch (error) {
      console.error('Error fetching gamification:', error);
      return null;
    }
  },

  // ── Gamification: update after quiz ──────────────────────────────────────
  updateStudentGamification: async (
    studentName: string,
    percentage: number,
    justMastered: boolean,
    totalMastered: number,
  ): Promise<{ xpGained: number; newAchievements: string[]; gamification: StudentGamification }> => {
    const ref = doc(db, 'student_gamification', studentName);
    const snap = await getDoc(ref);
    const today = new Date().toLocaleDateString('sv-SE'); // 'YYYY-MM-DD'

    const existing: StudentGamification = snap.exists()
      ? (snap.data() as StudentGamification)
      : { studentName, totalXP: 0, currentStreak: 0, longestStreak: 0, lastActivityDate: '', achievements: [], totalQuizzes: 0 };

    // XP calculation
    let xpGained = 10;
    if (percentage >= 70) xpGained += 10;
    if (percentage >= 90) xpGained += 20;
    if (justMastered) xpGained += 50;

    // Streak calculation
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE');
    let newStreak = 1;
    if (existing.lastActivityDate === today) {
      newStreak = existing.currentStreak; // same day — no increment
    } else if (existing.lastActivityDate === yesterdayStr) {
      newStreak = existing.currentStreak + 1; // consecutive day
    }
    const newLongest = Math.max(existing.longestStreak, newStreak);
    const newTotalQuizzes = existing.totalQuizzes + 1;

    // Achievement detection
    const updated: StudentGamification = {
      ...existing,
      totalXP: existing.totalXP + xpGained,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActivityDate: today,
      totalQuizzes: newTotalQuizzes,
    };

    const newAchievements: string[] = [];
    const check = (id: string, cond: boolean) => {
      if (cond && !updated.achievements.includes(id)) {
        updated.achievements = [...updated.achievements, id];
        newAchievements.push(id);
      }
    };

    check('first_quiz',  updated.totalQuizzes >= 1);
    check('quiz_10',     updated.totalQuizzes >= 10);
    check('quiz_50',     updated.totalQuizzes >= 50);
    check('streak_3',    updated.longestStreak >= 3);
    check('streak_7',    updated.longestStreak >= 7);
    check('score_90',    percentage >= 90);
    check('mastered_1',  totalMastered >= 1);
    check('mastered_5',  totalMastered >= 5);
    check('mastered_10', totalMastered >= 10);

    await setDoc(ref, updated, { merge: false });
    return { xpGained, newAchievements, gamification: updated };
  },

  // ── Student Groups ────────────────────────────────────────────────────────
  fetchStudentGroups: async (teacherUid?: string): Promise<StudentGroup[]> => {
    try {
      const q = teacherUid
        ? query(collection(db, 'student_groups'), where('teacherUid', '==', teacherUid))
        : collection(db, 'student_groups');
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentGroup));
    } catch (error) {
      console.error('Error fetching student groups:', error);
      return [];
    }
  },

  createStudentGroup: async (name: string, color: string, teacherUid?: string): Promise<string> => {
    const ref = await addDoc(collection(db, 'student_groups'), {
      name,
      color,
      studentNames: [],
      ...(teacherUid ? { teacherUid } : {}),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  updateGroupStudents: async (groupId: string, studentNames: string[]): Promise<void> => {
    await updateDoc(doc(db, 'student_groups', groupId), { studentNames });
  },

  deleteStudentGroup: async (groupId: string): Promise<void> => {
    await deleteDoc(doc(db, 'student_groups', groupId));
  },

  // ── Live Sessions ─────────────────────────────────────────────────────────
  fetchCachedQuizList: async (): Promise<{ id: string; title: string; conceptId?: string }[]> => {
    try {
      const q = query(collection(db, 'cached_ai_materials'), orderBy('createdAt', 'desc'), limit(40));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => ({
          id: d.id,
          title: d.data().content?.title ?? d.data().conceptId ?? d.id,
          conceptId: d.data().conceptId as string | undefined,
          type: d.data().type as string,
        }))
        .filter(q => q.type === 'QUIZ' || q.type === 'ASSESSMENT')
        .slice(0, 20);
    } catch (error) {
      console.error('Error fetching cached quiz list:', error);
      return [];
    }
  },

  createLiveSession: async (hostUid: string, quizId: string, quizTitle: string, conceptId?: string): Promise<string> => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let joinCode = '';
    for (let i = 0; i < 4; i++) joinCode += chars[Math.floor(Math.random() * chars.length)];
    const ref = await addDoc(collection(db, 'live_sessions'), {
      hostUid, quizId, quizTitle, conceptId: conceptId ?? null,
      status: 'active', joinCode, studentResponses: {}, createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  getLiveSessionByCode: async (joinCode: string): Promise<LiveSession | null> => {
    try {
      const q = query(collection(db, 'live_sessions'), where('joinCode', '==', joinCode.toUpperCase()), where('status', '==', 'active'), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as LiveSession;
    } catch (error) {
      console.error('Error fetching live session by code:', error);
      return null;
    }
  },

  updateLiveSessionStatus: async (sessionId: string, status: 'active' | 'ended'): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), { status });
  },

  joinLiveSession: async (sessionId: string, studentName: string): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${studentName}`]: { status: 'joined' },
    });
  },

  submitLiveResponse: async (sessionId: string, studentName: string, percentage: number): Promise<void> => {
    await updateDoc(doc(db, 'live_sessions', sessionId), {
      [`studentResponses.${studentName}`]: { status: 'completed', percentage, completedAt: serverTimestamp() },
    }).catch(err => console.warn('[Live] submitLiveResponse failed:', err));
  },

  subscribeLiveSession: (sessionId: string, callback: (session: LiveSession | null) => void): (() => void) => {
    const ref = doc(db, 'live_sessions', sessionId);
    return onSnapshot(ref, snap => {
      callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as LiveSession) : null);
    });
  },

  // ── School Classes ─────────────────────────────────────────────────────────
  fetchClasses: async (teacherUid: string): Promise<SchoolClass[]> => {
    try {
      const q = query(collection(db, 'classes'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SchoolClass));
    } catch (error) {
      console.error('Error fetching classes:', error);
      return [];
    }
  },

  createClass: async (cls: Omit<SchoolClass, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'classes'), {
      ...cls,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  updateClass: async (classId: string, updates: Partial<Pick<SchoolClass, 'name' | 'gradeLevel' | 'studentNames'>>): Promise<void> => {
    await updateDoc(doc(db, 'classes', classId), updates);
  },

  deleteClass: async (classId: string): Promise<void> => {
    await deleteDoc(doc(db, 'classes', classId));
  },

  // ── Adaptive Difficulty ───────────────────────────────────────────────────
  /**
   * Fetches recent quiz results for a specific concept.
   * Used by MaterialsGeneratorView to recommend difficulty level.
   */
  fetchQuizResultsByConcept: async (conceptId: string, teacherUid?: string, maxCount = 50): Promise<QuizResult[]> => {
    try {
      const q = teacherUid
        ? query(collection(db, 'quiz_results'), where('conceptId', '==', conceptId), where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc'), limit(maxCount))
        : query(collection(db, 'quiz_results'), where('conceptId', '==', conceptId), orderBy('playedAt', 'desc'), limit(maxCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data() as QuizResult);
    } catch (error) {
      console.error('Error fetching quiz results by concept:', error);
      return [];
    }
  },

  // ── Question Bank ─────────────────────────────────────────────────────────
  saveQuestion: async (q: Omit<SavedQuestion, 'id'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'saved_questions'), {
      ...q,
      savedAt: serverTimestamp(),
    });
    return ref.id;
  },

  fetchSavedQuestions: async (teacherUid: string): Promise<SavedQuestion[]> => {
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
      console.error('Error fetching saved questions:', error);
      return [];
    }
  },

  deleteQuestion: async (questionId: string): Promise<void> => {
    await deleteDoc(doc(db, 'saved_questions', questionId));
  },
};