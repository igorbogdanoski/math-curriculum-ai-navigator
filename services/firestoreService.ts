import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, startAfter, arrayUnion, documentId, getCountFromServer, getAggregateFromServer, average, type DocumentSnapshot, type Timestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { type DifferentiationLevel, type SavedQuestion } from '../types';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';

/**
 * Tracks a student's mastery of a specific concept over time.
 * Stored in Firestore under: concept_mastery/{studentName}_{conceptId}
 *
 * Mastery is achieved when the student scores =85% on 3+ consecutive attempts.
 */
export interface ConceptMastery {
  studentName: string;
  conceptId: string;
  conceptTitle?: string;
  topicId?: string;
  gradeLevel?: number;
  teacherUid?: string;       // set for new records; undefined for legacy shared records
  deviceId?: string;         // ?1: device-bound UUID; undefined for legacy records
  attempts: number;          // total attempts
  consecutiveHighScores: number; // consecutive attempts =85%
  bestScore: number;
  lastScore: number;
  mastered: boolean;         // true when consecutiveHighScores = 3
  masteredAt?: Timestamp;
  updatedAt?: Timestamp;
}

// -- Live Session --------------------------------------------------------------
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
    completedAt?: Timestamp;
  }>;
  createdAt?: Timestamp;
}

// -- Student Groups ------------------------------------------------------------
export interface StudentGroup {
  id: string;
  name: string;
  color: 'green' | 'blue' | 'orange' | 'red' | 'purple';
  studentNames: string[];
  teacherUid?: string;
  createdAt?: Timestamp;
}

// -- School Classes ------------------------------------------------------------
export interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number;
  teacherUid: string;
  studentNames: string[];
  createdAt?: Timestamp;
}

// -- Assignments ---------------------------------------------------------------
export interface Assignment {
  id: string;
  title: string;
  materialType: 'QUIZ' | 'ASSESSMENT';
  cacheId: string;           // ID in cached_ai_materials
  teacherUid: string;
  classId: string;
  classStudentNames: string[]; // snapshot at assignment time
  dueDate: string;             // YYYY-MM-DD
  createdAt?: Timestamp;
  completedBy: string[];       // student names who finished
}

// -- Gamification -------------------------------------------------------------
export interface StudentGamification {
  studentName: string;
  totalXP: number;
  currentStreak: number;    // consecutive days with =1 quiz
  longestStreak: number;
  lastActivityDate: string; // 'YYYY-MM-DD' local date
  achievements: string[];   // unlocked achievement IDs
  totalQuizzes: number;     // running total across all time
  deviceId?: string;        // ?1: device-bound UUID; undefined for legacy records
}

export const ACHIEVEMENTS: Record<string, { label: string; icon: string; condition: (g: StudentGamification) => boolean }> = {
  first_quiz:          { label: '???? ??????',         icon: '??', condition: g => g.totalQuizzes >= 1 },
  quiz_10:             { label: '?????? ??????',        icon: '??', condition: g => g.totalQuizzes >= 10 },
  quiz_50:             { label: '???????????',          icon: '??', condition: g => g.totalQuizzes >= 50 },
  streak_3:            { label: '??????? ??????',       icon: '??', condition: g => g.longestStreak >= 3 },
  streak_7:            { label: '?????? ????????',      icon: '?', condition: g => g.longestStreak >= 7 },
  score_90:            { label: '???????',              icon: '?', condition: () => false }, // set ad-hoc on score
  mastered_1:          { label: '???????',              icon: '??', condition: () => false }, // set ad-hoc on mastery
  mastered_5:          { label: '????????',             icon: '??', condition: () => false },
  mastered_10:         { label: '???????',              icon: '??', condition: () => false },
  // Math-themed mathematician badges
  pythagorean_master:  { label: '????????? ???????',   icon: '??', condition: g => g.achievements.includes('mastered_1') },
  euler_path:          { label: '??????? ???',          icon: '??', condition: g => g.longestStreak >= 5 },
  golden_ratio:        { label: '?????? ??????',        icon: '?', condition: () => false }, // set ad-hoc: perfect score
};

export interface QuizResult {
  quizId: string;
  quizTitle: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  playedAt?: Timestamp;
  conceptId?: string;
  topicId?: string;
  gradeLevel?: number;
  studentName?: string;
  teacherUid?: string;       // set when student arrives via teacher-tagged link
  deviceId?: string;         // ?1: device-bound UUID; undefined for legacy records
  differentiationLevel?: DifferentiationLevel; // level of the quiz that was played
  confidence?: number;       // 1-5 self-assessment rating (?26)
  misconceptions?: { question: string; studentAnswer: string; misconception: string }[];
}

export interface Announcement {
  id: string;
  teacherUid: string;
  message: string;
  gradeLevel?: number;
  createdAt?: Timestamp;
}

export interface CachedMaterial {
  id: string;
  content: unknown;
  type: 'analogy' | 'outline' | 'quiz' | 'discussion' | 'problems' | 'assessment' | 'rubric' | 'thematicplan' | 'ideas' | 'solver';
  title?: string;
  conceptId?: string;
  topicId?: string;
  gradeLevel: number;
  teacherUid?: string;
  /** ?1: draft = pending review, published = approved for students. Undefined = legacy (treated as published). */
  status?: 'draft' | 'published';
  createdAt: Timestamp;
  helpfulCount?: number;
  notHelpfulCount?: number;
  isApproved?: boolean; // Z2 feature
}

// ???? ?????? ???? ??????? ????????? Firebase SDK ?? ?? ?? ????? ??????????.
// ??? ?????????? ?? ??????????? 'curriculum' ? ?????????? 'v1' ??? ?? ?????????.

export const firestoreService = {

  createSchool: async (name: string, city: string, adminUid: string = ''): Promise<{id: string, name: string, city: string}> => {
    try {
      const docRef = await addDoc(collection(db, 'schools'), {
        name,
        city,
        adminUid,
        teacherUids: [],
        createdAt: serverTimestamp()
      });
      return { id: docRef.id, name, city };
    } catch (error) {
      console.error('Error creating school:', error);
      throw error;
    }
  },

  fetchSchools: async (): Promise<any[]> => {
    try {
      const q = query(collection(db, 'schools'), orderBy('name'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return [];
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching schools:', error);
      return [];
    }
  },

  /**
   * В — Листа на сите регистрирани корисници (само за admin).
   * Враќа UID + name + email + role + schoolId.
   */
  fetchAllUsers: async (): Promise<{ uid: string; name: string; email?: string; role?: string; schoolId?: string }[]> => {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.docs.map(d => ({ uid: d.id, ...(d.data() as any) }));
    } catch (error) {
      console.error('Error fetching all users:', error);
      return [];
    }
  },

  /**
   * В — Ажурирање на улога и/или училиште на корисник (само за admin).
   */
  updateUserRole: async (uid: string, role: 'teacher' | 'school_admin' | 'admin', schoolId?: string): Promise<void> => {
    try {
      const patch: Record<string, string> = { role };
      if (schoolId !== undefined) patch.schoolId = schoolId;
      await updateDoc(doc(db, 'users', uid), patch);
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  /**
   * Dashboard stats for School Admins (Phase D4 target)
   */
  fetchSchoolStats: async (schoolId: string): Promise<any> => {
    try {
      // 1. Fetch all teachers for this school
      const usersRef = collection(db, 'users');
      const qTeachers = query(usersRef, where('schoolId', '==', schoolId));
      const teachersSnap = await getDocs(qTeachers);
      
      const teachersData = [];
      let totalSchoolQuizzes = 0;
      let globalScoreSum = 0;
      let teachersWithQuizzes = 0;

      for (const tDoc of teachersSnap.docs) {
        const tData = tDoc.data();
        if (tData.role !== 'teacher') continue;
        
        // 2. For each teacher, aggregate their quizzes
        const quizRef = collection(db, 'quiz_results');
        const qQuizzes = query(quizRef, where('teacherUid', '==', tDoc.id));
        
        // Aggregate: count, average score
        const aggSnapshot = await getAggregateFromServer(qQuizzes, {
          total: average('percentage')
        }); // wait, getCountFromServer is safer, let's just do getDocs and manual average if average() is risky.
        
        // Because getAggregateFromServer might be tricky to type in TS without checking, let's just get the count:
        const countSnap = await getCountFromServer(qQuizzes);
        const quizzesGiven = countSnap.data().count;
        
        let avgScore = 0;
        if (quizzesGiven > 0) {
          // fetch to calculate avg (limit 500 to avoid large reads)
          const quizzes = await getDocs(query(quizRef, where('teacherUid', '==', tDoc.id), limit(500)));
          let sum = 0;
          quizzes.forEach(q => sum += (q.data().percentage || 0));
          avgScore = sum / quizzes.size;
          
          globalScoreSum += avgScore;
          teachersWithQuizzes++;
        }
        
        totalSchoolQuizzes += quizzesGiven;
        
        teachersData.push({
          id: tDoc.id,
          name: tData.name || 'Непознат наставник',
          quizzesGiven,
          avgScore,
          lastActive: tData.lastActive ? new Date(tData.lastActive).toISOString() : 'Непознато'
        });
      }

      // Г4: Count generated materials per teacher
      const teacherUids = teachersData.map(t => t.id);
      if (teacherUids.length > 0) {
        // Firestore `in` supports up to 30 values; batch if needed
        const BATCH = 30;
        const materialCounts: Record<string, number> = {};
        for (let i = 0; i < teacherUids.length; i += BATCH) {
          const batch = teacherUids.slice(i, i + BATCH);
          const matSnap = await getDocs(query(collection(db, 'cached_ai_materials'), where('teacherUid', 'in', batch)));
          matSnap.forEach(d => {
            const uid = d.data().teacherUid as string;
            materialCounts[uid] = (materialCounts[uid] ?? 0) + 1;
          });
        }
        teachersData.forEach(t => { (t as any).materialsGenerated = materialCounts[t.id] ?? 0; });
      }

      // Г4: School-wide grade comparison + weekly trend from quiz_results
      const gradeMap: Record<string, { sum: number; count: number }> = {};
      const weekMap: Record<string, { sum: number; count: number; label: string }> = {};
      if (teacherUids.length > 0) {
        const BATCH = 30;
        for (let i = 0; i < teacherUids.length; i += BATCH) {
          const batch = teacherUids.slice(i, i + BATCH);
          const qrSnap = await getDocs(query(collection(db, 'quiz_results'), where('teacherUid', 'in', batch), limit(500)));
          qrSnap.forEach(d => {
            const r = d.data();
            const grade = r.gradeLevel != null ? String(r.gradeLevel) : null;
            if (grade) {
              if (!gradeMap[grade]) gradeMap[grade] = { sum: 0, count: 0 };
              gradeMap[grade].sum += r.percentage ?? 0;
              gradeMap[grade].count++;
            }
            // Weekly trend: group by ISO week
            const ts = r.playedAt?.toDate ? r.playedAt.toDate() : (r.playedAt ? new Date(r.playedAt) : null);
            if (ts) {
              const mon = new Date(ts); mon.setDate(ts.getDate() - ts.getDay() + 1);
              const wk = mon.toISOString().slice(0, 10);
              const lbl = mon.toLocaleDateString('mk-MK', { day: '2-digit', month: 'short' });
              if (!weekMap[wk]) weekMap[wk] = { sum: 0, count: 0, label: lbl };
              weekMap[wk].sum += r.percentage ?? 0;
              weekMap[wk].count++;
            }
          });
        }
      }
      const gradeStats = Object.entries(gradeMap)
        .map(([grade, v]) => ({ grade: `${grade}. одд.`, avgPct: Math.round(v.sum / v.count), attempts: v.count }))
        .sort((a, b) => parseInt(a.grade) - parseInt(b.grade));
      const weeklyTrend = Object.entries(weekMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-8)
        .map(([, v]) => ({ label: v.label, avg: Math.round(v.sum / v.count), count: v.count }));

      return {
        totalTeachers: teachersData.length,
        totalQuizzes: totalSchoolQuizzes,
        averageScore: teachersWithQuizzes > 0 ? (globalScoreSum / teachersWithQuizzes) : 0,
        teachers: teachersData,
        gradeStats,
        weeklyTrend,
      };
    } catch (error) {
      console.error("Error fetching school stats:", error);
      return null;
    }
  },

  /**
   * Fetches the entire curriculum data module from Firestore.
   */
  fetchFullCurriculum: async (): Promise<CurriculumModule> => {
    console.log("Attempting to fetch data from Firestore...");
    
    // ????????? ?? ?????????? ??? ?? ?????? ???? ????????.
    // ????????? ?? 'v1' ??? ??? ?? ????????? ?????????? ???????.
    const docRef = doc(db, "curriculum", "v1");

    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log("...Data received successfully from Firestore.");
        // ?? ??????? ?????? ????????, ???????? ?? ?????? CurriculumModule ???.
        return docSnap.data() as CurriculumModule;
      } else {
        console.error("...Firestore fetch failed: Document 'v1' does not exist in 'curriculum' collection.");
        throw new Error("?????????? ?? ?????????? ???????? ?? ? ????????? ?? ?????? ?? ????????.");
      }
    } catch (error: any) {
      // Gracefully handle offline errors, as the app has a local data fallback.
      if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
          console.info("...Could not fetch from Firestore: client is offline and data is not cached. Using local data.");
          // We throw an error so the calling hook knows the fetch failed, but it's not a critical error.
          throw new Error("?????? ??? ? ?????????? ?? ????? ?? ?? ??????????????.");
      }

      // For any other type of error, log it as a critical error.
      console.error("...Error fetching document from Firestore:", error);
      const errorMessage = error.message || "An unknown network error occurred.";
      throw new Error(`?????? ??? ???????????? ?? ?????? ?? ????????: ${errorMessage}`);
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
  saveQuizResult: async (result: QuizResult): Promise<string> => {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        const { saveQuizOffline } = await import('./indexedDBService');
        const id = await saveQuizOffline(result);
        return id;
      }
      
      const docRef = doc(collection(db, "quiz_results"));
      setDoc(docRef, {
        ...result,
        playedAt: serverTimestamp(),
      }).catch(err => console.warn("Offline deferred", err));
      return docRef.id;
    } catch (error) {
      console.error("Error saving quiz result:", error);
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
           const docRef = doc(collection(db, "quiz_results"));
           await setDoc(docRef, {
             ...item.quizResult,
             playedAt: new Date(item.timestamp),
           });
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
   * Returns a map of conceptId ? { assessmentStandards?, activities? }
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
   * Fetches a single page of quiz results with cursor-based pagination.
   * Returns the results and the last document snapshot (cursor for next page).
   * lastDoc === null means there are no more pages.
   */
  fetchQuizResultsPage: async (
    teacherUid: string | undefined,
    pageSize: number = 200,
    startAfterDoc?: DocumentSnapshot
  ): Promise<{ results: QuizResult[]; lastDoc: DocumentSnapshot | null }> => {
    try {
      const baseConstraints = teacherUid
        ? [where("teacherUid", "==", teacherUid), orderBy("playedAt", "desc")]
        : [orderBy("playedAt", "desc")];
      const q = startAfterDoc
        ? query(collection(db, "quiz_results"), ...baseConstraints, startAfter(startAfterDoc), limit(pageSize))
        : query(collection(db, "quiz_results"), ...baseConstraints, limit(pageSize));
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data() as QuizResult);
      const lastDoc = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
      return { results, lastDoc };
    } catch (error) {
      console.error("Error fetching quiz results page:", error);
      return { results: [], lastDoc: null };
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
      const docRef = doc(collection(db, 'cached_ai_materials'));
      setDoc(docRef, {
        content,
        type: 'quiz',
        isRemedial: true,
        sourceQuizId: meta.sourceQuizId,
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
        ...(teacherUid ? { teacherUid } : {}),
        createdAt: serverTimestamp(),
      }).catch(err => console.warn('Offline deferred', err));
      return docRef.id;
    } catch (error) {
      console.error('Error saving remedial quiz:', error);
      return null;
    }
  },

  /**
   * Fetches quiz results for a specific student by name (case-insensitive client-side filter).
   */
  fetchQuizResultsByStudentName: async (studentName: string, deviceId?: string): Promise<QuizResult[]> => {
    try {
      // ?1: prefer deviceId query; old records without deviceId fall back to studentName
      const q = deviceId
        ? query(collection(db, 'quiz_results'), where('deviceId', '==', deviceId), orderBy('playedAt', 'desc'), limit(100))
        : query(collection(db, 'quiz_results'), where('studentName', '==', studentName), orderBy('playedAt', 'desc'), limit(100));
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

  // -- Mastery Tracking --------------------------------------------------------

  /**
   * Updates concept mastery for a student after a quiz attempt.
   * Called automatically by StudentPlayView after each quiz completion.
   *
   * Mastery logic:
   * - 3+ consecutive scores =85% ? mastered = true
   * - Any score <85% resets the consecutive counter
   */
  updateConceptMastery: async (
    studentName: string,
    conceptId: string,
    score: number,
    meta?: { conceptTitle?: string; topicId?: string; gradeLevel?: number },
    teacherUid?: string,
    deviceId?: string,
  ): Promise<ConceptMastery> => {
    const safeName = studentName.replace(/\s+/g, '_');
    // ?1: prefer deviceId in docId to prevent name-collision between same-named students
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
        studentName,
        conceptId,
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

      // deferred for offline support
      setDoc(ref, updated, { merge: true }).catch(err => console.warn('Offline deferred', err));
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
  fetchMasteryByStudent: async (studentName: string, deviceId?: string): Promise<ConceptMastery[]> => {
    try {
      // ?1: prefer deviceId query to avoid same-name collisions
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

  // -- Gamification: fetch ---------------------------------------------------
  // ?1: docId priority chain:
  //   1. "{teacherUid}_{deviceId}" (new records with deviceId)
  //   2. "{teacherUid}_{studentName}" (scoped by teacher, legacy)
  //   3. "{studentName}" (oldest legacy records)
  fetchStudentGamification: async (studentName: string, teacherUid?: string, deviceId?: string): Promise<StudentGamification | null> => {
    try {
      if (deviceId && teacherUid) {
        const deviceRef = doc(db, 'student_gamification', `${teacherUid}_${deviceId}`);
        const deviceSnap = await getDoc(deviceRef);
        if (deviceSnap.exists()) return deviceSnap.data() as StudentGamification;
      }
      if (deviceId && !teacherUid) {
        const deviceRef = doc(db, 'student_gamification', deviceId);
        const deviceSnap = await getDoc(deviceRef);
        if (deviceSnap.exists()) return deviceSnap.data() as StudentGamification;
      }
      if (teacherUid) {
        const scopedRef = doc(db, 'student_gamification', `${teacherUid}_${studentName}`);
        const scopedSnap = await getDoc(scopedRef);
        if (scopedSnap.exists()) return scopedSnap.data() as StudentGamification;
      }
      // Fallback: unscoped docId (legacy records)
      const ref = doc(db, 'student_gamification', studentName);
      const snap = await getDoc(ref);
      return snap.exists() ? (snap.data() as StudentGamification) : null;
    } catch (error) {
      console.error('Error fetching gamification:', error);
      return null;
    }
  },

  // -- Gamification: class leaderboard --------------------------------------
  fetchClassLeaderboard: async (teacherUid: string): Promise<StudentGamification[]> => {
    try {
      // Range query on doc IDs: all docs prefixed with "{teacherUid}_"
      const q = query(
        collection(db, 'student_gamification'),
        where(documentId(), '>=', `${teacherUid}_`),
        where(documentId(), '<=', `${teacherUid}_\uf8ff`),
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => d.data() as StudentGamification);
      return rows.sort((a, b) => b.totalXP - a.totalXP);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  },

  // -- Gamification: update after quiz --------------------------------------
  updateStudentGamification: async (
    studentName: string,
    percentage: number,
    justMastered: boolean,
    totalMastered: number,
    teacherUid?: string,
    deviceId?: string,
  ): Promise<{ xpGained: number; newAchievements: string[]; gamification: StudentGamification }> => {
    // ?1: prefer deviceId in docId to prevent same-name collisions
    const docId = deviceId
      ? (teacherUid ? `${teacherUid}_${deviceId}` : deviceId)
      : (teacherUid ? `${teacherUid}_${studentName}` : studentName);
    const ref = doc(db, 'student_gamification', docId);
    const snap = await getDoc(ref);
    const today = new Date().toLocaleDateString('sv-SE'); // 'YYYY-MM-DD'

    const existing: StudentGamification = snap.exists()
      ? (snap.data() as StudentGamification)
      : { studentName, totalXP: 0, currentStreak: 0, longestStreak: 0, lastActivityDate: '', achievements: [], totalQuizzes: 0, ...(deviceId ? { deviceId } : {}) };

    // XP + streak via pure utils (utils/gamification.ts)
    const xpGained = calcXP(percentage, justMastered);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('sv-SE');
    const newStreak = calcStreak(existing.currentStreak, existing.lastActivityDate, today, yesterdayStr);

    const newLongest = Math.max(existing.longestStreak, newStreak);
    const newTotalQuizzes = existing.totalQuizzes + 1;

    // Achievement detection via pure util
    const updated: StudentGamification = {
      ...existing,
      totalXP: existing.totalXP + xpGained,
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastActivityDate: today,
      totalQuizzes: newTotalQuizzes,
    };

    const freshAchievements = computeNewAchievements(
      updated.totalQuizzes, updated.longestStreak, percentage, totalMastered, updated.achievements,
    );
    const newAchievements = freshAchievements;
    updated.achievements = [...updated.achievements, ...freshAchievements];

    // deferred for offline support
    setDoc(ref, updated, { merge: false }).catch(err => console.warn('Offline deferred', err));
    return { xpGained, newAchievements, gamification: updated };
  },

  // -- Student Groups --------------------------------------------------------
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

  // -- Live Sessions ---------------------------------------------------------
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
        .filter(q => q.type === 'quiz' || q.type === 'assessment')
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

  // -- School Classes ---------------------------------------------------------
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

  // -- Adaptive Difficulty ---------------------------------------------------
  /**
   * Fetches recent quiz results for a specific concept.
   * Used by MaterialsGeneratorView to recommend difficulty level.
   */
  fetchQuizResultsByConcept: async (conceptId: string, teacherUid?: string, maxCount = 50): Promise<QuizResult[]> => {
    try {
      if (teacherUid) {
        try {
          const q = query(collection(db, 'quiz_results'), where('conceptId', '==', conceptId), where('teacherUid', '==', teacherUid), orderBy('playedAt', 'desc'), limit(maxCount));
          const snap = await getDocs(q);
          return snap.docs.map(d => d.data() as QuizResult);
        } catch {
          // Composite index not yet built � fall back to conceptId-only query
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

  // -- Question Bank ---------------------------------------------------------
  saveQuestion: async (q: Omit<SavedQuestion, 'id'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'saved_questions'), {
      ...q,
      savedAt: serverTimestamp(),
    });
    return ref.id;
  },

  fetchUnapprovedQuestions: async (): Promise<SavedQuestion[]> => {
    try {
      const q = query(
        collection(db, 'saved_questions'),
        where('isApproved', '==', false),
        limit(200)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedQuestion));
    } catch (error) {
      console.error('Error fetching unapproved questions:', error);
      return [];
    }
  },

  updateSavedQuestion: async (questionId: string, updates: Partial<SavedQuestion>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'saved_questions', questionId), updates);
    } catch (error) {
      console.error('Error updating saved question:', error);
      throw error;
    }
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

  /** Toggle verified status on a saved question (?3.2) */
  verifyQuestion: async (questionId: string, verified: boolean): Promise<void> => {
    await updateDoc(doc(db, 'saved_questions', questionId), {
      isVerified: verified,
      verifiedAt: verified ? serverTimestamp() : null,
    });
  },

  /** Fetch verified questions for a teacher, optionally filtered by conceptId (?3.2) */
  fetchVerifiedQuestions: async (teacherUid: string, conceptId?: string): Promise<SavedQuestion[]> => {
    try {
      const q = query(
        collection(db, 'saved_questions'),
        where('teacherUid', '==', teacherUid),
        where('isVerified', '==', true),
        limit(100)
      );
      const snap = await getDocs(q);
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedQuestion));
      return conceptId ? all.filter(q => q.conceptId === conceptId) : all;
    } catch (error) {
      console.error('Error fetching verified questions:', error);
      return [];
    }
  },

  // -- AI Material Feedback (?3.1) -------------------------------------------
  saveMaterialFeedback: async (
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
  },

  // -- Announcements (?27) ---------------------------------------------------
  addAnnouncement: async (teacherUid: string, message: string, gradeLevel?: number): Promise<void> => {
    await addDoc(collection(db, 'announcements'), {
      teacherUid,
      message: message.trim(),
      gradeLevel: gradeLevel ?? null,
      createdAt: serverTimestamp(),
    });
  },

  fetchAnnouncements: async (teacherUid: string, maxCount = 5): Promise<Announcement[]> => {
    try {
      const q = query(
        collection(db, 'announcements'),
        where('teacherUid', '==', teacherUid),
        orderBy('createdAt', 'desc'),
        limit(maxCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
    } catch {
      return [];
    }
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'announcements', id));
  },

  // --- LIVE QUIZ SESSIONS ---

  createLiveQuizSession: async (teacherId: string, title: string, questions: any[]): Promise<string> => {
    // Generate a random 6-digit pin
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionRef = doc(db, 'live_quizzes', pin);
    
    await setDoc(sessionRef, {
        pin,
        teacherId,
        status: 'waiting',
        title,
        questions,
        currentQuestionIndex: -1,
        createdAt: serverTimestamp()
    });
    
    return pin;
  },

  updateLiveQuizState: async (pin: string, data: Partial<{ status: 'waiting' | 'active' | 'finished', currentQuestionIndex: number }>): Promise<void> => {
    const sessionRef = doc(db, 'live_quizzes', pin);
    await updateDoc(sessionRef, data);
  },

  joinLiveQuiz: async (pin: string, studentName: string): Promise<string> => {
    const participantRef = doc(collection(db, 'live_quizzes', pin, 'participants'));
    await setDoc(participantRef, {
        id: participantRef.id,
        name: studentName,
        score: 0,
        answers: {},
        joinedAt: serverTimestamp()
    });
    return participantRef.id;
  },

  submitLiveQuizAnswer: async (pin: string, participantId: string, questionIndex: number, answer: string, isCorrect: boolean): Promise<void> => {
    const participantRef = doc(db, 'live_quizzes', pin, 'participants', participantId);
    
    // Instead of simple update, if it's correct we increment score. 
    // We update answers map.
    await updateDoc(participantRef, {
        [`answers.${questionIndex}`]: answer,
        ...(isCorrect ? { score: increment(1) } : {})
    });
  },

  subscribeToLiveQuiz: (pin: string, callback: (data: any) => void) => {
    return onSnapshot(doc(db, 'live_quizzes', pin), (doc) => {
        if (doc.exists()) {
            callback(doc.data());
        } else {
            callback(null);
        }
    });
  },

  subscribeToLiveQuizParticipants: (pin: string, callback: (participants: any[]) => void) => {
    return onSnapshot(collection(db, 'live_quizzes', pin, 'participants'), (snap) => {
        callback(snap.docs.map(d => d.data()));
    });
  },

  // -- Content Library (?1) -----------------------------------------------------
  /** Saves a generated material to the teacher's library with status='draft'. Returns the new doc ID. */
  saveToLibrary: async (content: any, meta: {
    title: string;
    type: CachedMaterial['type'];
    teacherUid: string;
    conceptId?: string;
    topicId?: string;
    gradeLevel?: number;
  }): Promise<string> => {
    const ref = await addDoc(collection(db, 'cached_ai_materials'), {
      content,
      type: meta.type,
      title: meta.title,
      teacherUid: meta.teacherUid,
      conceptId: meta.conceptId,
      topicId: meta.topicId,
      gradeLevel: meta.gradeLevel ?? 0,
      status: 'draft',
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  fetchLibraryMaterials: async (teacherUid: string): Promise<CachedMaterial[]> => {
    try {
      const q = query(collection(db, 'cached_ai_materials'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CachedMaterial));
    } catch (error) {
      console.error('Error fetching library materials:', error);
      return [];
    }
  },

    fetchGlobalLibraryMaterials: async (): Promise<CachedMaterial[]> => {
    try {
      const q = query(
        collection(db, 'cached_ai_materials'), 
        where('isApproved', '==', true), 
        where('status', '==', 'published'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CachedMaterial));
    } catch (error) {
      console.error('Error fetching global library materials:', error);
      return [];
    }
  },

  publishMaterial: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { status: 'published' });
  },

  unpublishMaterial: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { status: 'draft' });
  },

  approveMaterial: async (id: string, approved: boolean): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { isApproved: approved });
  },

  deleteCachedMaterial: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, 'cached_ai_materials', id));
  },

  updateMaterialTitle: async (id: string, title: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { title });
  },

  // -- Assignments -------------------------------------------------------------
  saveAssignment: async (a: Omit<Assignment, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'assignments'), { ...a, createdAt: serverTimestamp() });
    return ref.id;
  },

  fetchAssignmentsByTeacher: async (teacherUid: string): Promise<Assignment[]> => {
    try {
      const q = query(collection(db, 'assignments'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
    } catch (error) {
      console.error('Error fetching assignments by teacher:', error);
      return [];
    }
  },

  fetchAssignmentsByStudent: async (studentName: string): Promise<Assignment[]> => {
    try {
      const q = query(collection(db, 'assignments'), where('classStudentNames', 'array-contains', studentName), orderBy('dueDate', 'asc'), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
    } catch (error) {
      console.error('Error fetching assignments by student:', error);
      return [];
    }
  },

  markAssignmentCompleted: async (assignmentId: string, studentName: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'assignments', assignmentId), { completedBy: arrayUnion(studentName) });
    } catch (error) {
      console.error('Error marking assignment completed:', error);
    }
  },

  deleteAssignment: async (assignmentId: string): Promise<void> => {
    await deleteDoc(doc(db, 'assignments', assignmentId));
  },

  /** Save a quiz/assessment as a cached material for assignment purposes. Returns the cacheId. */
  saveAssignmentMaterial: async (content: any, meta: { title: string; type: 'QUIZ' | 'ASSESSMENT'; conceptId?: string; gradeLevel?: number; teacherUid: string }): Promise<string> => {
    const ref = await addDoc(collection(db, 'cached_ai_materials'), {
      content,
      type: meta.type.toLowerCase(),
      title: meta.title,
      conceptId: meta.conceptId,
      gradeLevel: meta.gradeLevel,
      teacherUid: meta.teacherUid,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  },

  // ── И4: Национална Библиотека ────────────────────────────────────────────

  /** Publish a verified question to the national shared library */
  publishToNationalLibrary: async (
    q: SavedQuestion,
    teacherName: string,
    schoolName?: string,
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
      importCount: 0,
      publishedAt: serverTimestamp(),
    });
    // Mark the original question as public
    await updateDoc(doc(db, 'saved_questions', q.id), { isPublic: true });
    return ref.id;
  },

  /** Fetch questions from the national library with optional filters */
  fetchNationalLibrary: async (filters?: {
    gradeLevel?: number;
    conceptId?: string;
    type?: string;
  }) => {
    try {
      const constraints: any[] = [];
      if (filters?.gradeLevel) constraints.push(where('gradeLevel', '==', filters.gradeLevel));
      if (filters?.type) constraints.push(where('type', '==', filters.type));
      if (filters?.conceptId) constraints.push(where('conceptId', '==', filters.conceptId));
      constraints.push(orderBy('publishedAt', 'desc'));
      constraints.push(limit(200));
      const q = query(collection(db, 'national_library'), ...constraints);
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    } catch (error) {
      console.error('Error fetching national library:', error);
      return [];
    }
  },

  /** Import a question from the national library into teacher's own saved_questions */
  importFromNationalLibrary: async (
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
    });
    // Increment importCount atomically — avoids race condition when multiple users import simultaneously
    try {
      await updateDoc(doc(db, 'national_library', entry.id), {
        importCount: increment(1),
      });
    } catch { /* non-fatal */ }
    return ref.id;
  },

  // ── Г3-alt: Teacher notes per concept ──
  saveTeacherNote: async (teacherUid: string, conceptId: string, note: string): Promise<void> => {
    const docId = `${teacherUid}_${conceptId}`;
    await setDoc(doc(db, 'teacher_notes', docId), {
      teacherUid,
      conceptId,
      note,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  fetchTeacherNote: async (teacherUid: string, conceptId: string): Promise<string> => {
    const snap = await getDoc(doc(db, 'teacher_notes', `${teacherUid}_${conceptId}`));
    return snap.exists() ? (snap.data().note ?? '') : '';
  },

  // ── А1: Student identity persistence ──
  saveStudentIdentity: async (deviceId: string, name: string, anonymousUid: string): Promise<void> => {
    await setDoc(doc(db, 'student_identity', deviceId), {
      deviceId,
      name,
      anonymousUid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  },

  fetchStudentIdentityByDevice: async (deviceId: string): Promise<{ name: string; anonymousUid: string } | null> => {
    const snap = await getDoc(doc(db, 'student_identity', deviceId));
    if (!snap.exists()) return null;
    const data = snap.data();
    return { name: data.name, anonymousUid: data.anonymousUid };
  },
};

