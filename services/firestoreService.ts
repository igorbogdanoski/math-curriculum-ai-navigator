import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';

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
  attempts: number;          // total attempts
  consecutiveHighScores: number; // consecutive attempts ≥85%
  bestScore: number;
  lastScore: number;
  mastered: boolean;         // true when consecutiveHighScores ≥ 3
  masteredAt?: any;          // Firestore Timestamp
  updatedAt?: any;
}

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
  fetchQuizResults: async (maxCount: number = 200): Promise<QuizResult[]> => {
    try {
      const q = query(
        collection(db, "quiz_results"),
        orderBy("playedAt", "desc"),
        limit(maxCount)
      );
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
  }): Promise<string | null> => {
    try {
      const docRef = await addDoc(collection(db, 'cached_ai_materials'), {
        content,
        type: 'quiz',
        isRemedial: true,
        sourceQuizId: meta.sourceQuizId,
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
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
    meta?: { conceptTitle?: string; topicId?: string; gradeLevel?: number }
  ): Promise<ConceptMastery> => {
    const docId = `${studentName.replace(/\s+/g, '_')}_${conceptId}`;
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
  fetchAllMastery: async (): Promise<ConceptMastery[]> => {
    try {
      const snap = await getDocs(collection(db, 'concept_mastery'));
      return snap.docs.map(d => d.data() as ConceptMastery);
    } catch (error) {
      console.error('Error fetching all mastery:', error);
      return [];
    }
  }
};