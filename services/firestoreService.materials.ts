import { doc, getDoc, collection, getDocs, query, limit, orderBy, updateDoc, increment, where, setDoc, addDoc, deleteDoc, onSnapshot, serverTimestamp, startAfter, arrayUnion, documentId, getCountFromServer, getAggregateFromServer, average, type DocumentSnapshot, type Timestamp } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';
import { type DifferentiationLevel, type SavedQuestion } from '../types';
import { calcXP, calcStreak, computeNewAchievements } from '../utils/gamification';

export const fetchFullCurriculum = async (): Promise<CurriculumModule> => {
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
  };

export const saveFullCurriculum = async (data: CurriculumModule): Promise<void> => {
    console.log("Attempting to save curriculum data to Firestore...");
    const docRef = doc(db, "curriculum", "v1");
    try {
      await setDoc(docRef, data);
      console.log("Curriculum data successfully saved to Firestore.");
    } catch (error) {
      console.error("Error saving curriculum data to Firestore:", error);
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
      console.error("Error fetching cached materials:", error);
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
      console.error("Error fetching latest quiz:", error);
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
           console.error('Failed to sync offline quiz:', err);
         }
       }
       return synced;
    } catch (err) {
       console.error('Sync error', err);
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
  };

export const saveExitTicketQuiz = async (content: any, meta: {
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
  };

export const rateCachedMaterial = async (materialId: string, isHelpful: boolean): Promise<boolean> => {
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
  };

export const saveQuestion = async (q: Omit<SavedQuestion, 'id'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'saved_questions'), {
      ...q,
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
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedQuestion));
    } catch (error) {
      console.error('Error fetching unapproved questions:', error);
      return [];
    }
  };

export const updateSavedQuestion = async (questionId: string, updates: Partial<SavedQuestion>): Promise<void> => {
    try {
      await updateDoc(doc(db, 'saved_questions', questionId), updates);
    } catch (error) {
      console.error('Error updating saved question:', error);
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
      console.error('Error fetching saved questions:', error);
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

export const saveToLibrary = async (content: any, meta: {
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
  };

export const fetchLibraryMaterials = async (teacherUid: string): Promise<CachedMaterial[]> => {
    try {
      const q = query(collection(db, 'cached_ai_materials'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as CachedMaterial));
    } catch (error) {
      console.error('Error fetching library materials:', error);
      return [];
    }
  };

export const fetchGlobalLibraryMaterials = async (): Promise<CachedMaterial[]> => {
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

export const updateMaterialTitle = async (id: string, title: string): Promise<void> => {
    await updateDoc(doc(db, 'cached_ai_materials', id), { title });
  };

export const saveAssignment = async (a: Omit<Assignment, 'id' | 'createdAt'>): Promise<string> => {
    const ref = await addDoc(collection(db, 'assignments'), { ...a, createdAt: serverTimestamp() });
    return ref.id;
  };

export const fetchAssignmentsByTeacher = async (teacherUid: string): Promise<Assignment[]> => {
    try {
      const q = query(collection(db, 'assignments'), where('teacherUid', '==', teacherUid), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
    } catch (error) {
      console.error('Error fetching assignments by teacher:', error);
      return [];
    }
  };

export const fetchAssignmentsByStudent = async (studentName: string): Promise<Assignment[]> => {
    try {
      const q = query(collection(db, 'assignments'), where('classStudentNames', 'array-contains', studentName), orderBy('dueDate', 'asc'), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
    } catch (error) {
      console.error('Error fetching assignments by student:', error);
      return [];
    }
  };

export const markAssignmentCompleted = async (assignmentId: string, studentName: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'assignments', assignmentId), { completedBy: arrayUnion(studentName) });
    } catch (error) {
      console.error('Error marking assignment completed:', error);
    }
  };

export const deleteAssignment = async (assignmentId: string): Promise<void> => {
    await deleteDoc(doc(db, 'assignments', assignmentId));
  };

export const saveAssignmentMaterial = async (content: any, meta: { title: string; type: 'QUIZ' | 'ASSESSMENT'; conceptId?: string; gradeLevel?: number; teacherUid: string }): Promise<string> => {
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
  };

export const publishToNationalLibrary = async (
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
  };

export const fetchNationalLibrary = async (filters?: {
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

