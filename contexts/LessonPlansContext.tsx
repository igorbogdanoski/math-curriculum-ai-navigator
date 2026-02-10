import React, { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebaseConfig';
import {
    collection,
    onSnapshot,
    addDoc,
    doc,
    setDoc,
    deleteDoc,
    query,
    writeBatch,
    getDocs,
    where,
    deleteField
} from "firebase/firestore";
import { exampleLessonPlans } from '../data/examples';
import type { LessonPlan, SharedAnnualPlan } from '../types';

interface LessonPlansContextType {
  lessonPlans: LessonPlan[];
  communityLessonPlans: LessonPlan[];
  isLoading: boolean;
  error: string | null;
  getLessonPlan: (id: string) => LessonPlan | undefined;
  addLessonPlan: (plan: Omit<LessonPlan, 'id'>) => Promise<string>;
  updateLessonPlan: (plan: LessonPlan) => Promise<void>;
  deleteLessonPlan: (planId: string, confirmed?: boolean) => Promise<void>;
  publishLessonPlan: (planId: string, authorName: string) => Promise<void>;
  importCommunityPlan: (plan: LessonPlan) => Promise<string>;
  addRatingToCommunityPlan: (planId: string, rating: number) => Promise<void>;
  addCommentToCommunityPlan: (planId: string, comment: { authorName: string; text: string; date: string; }) => Promise<void>;
  isUserPlan: (planId: string) => boolean;
  importAnnualPlan: (planData: SharedAnnualPlan) => Promise<void>;
}

const LessonPlansContext = createContext<LessonPlansContextType | undefined>(undefined);

export const useLessonPlans = () => {
  const context = useContext(LessonPlansContext);
  if (!context) {
    throw new Error('useLessonPlans must be used within a LessonPlansProvider');
  }
  return context;
};

export const LessonPlansProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser } = useAuth();
  const [userLessonPlans, setUserLessonPlans] = useState<LessonPlan[]>([]);
  const [communityLessonPlans, setCommunityLessonPlans] = useState<LessonPlan[]>(exampleLessonPlans);
  const [isCommunityLoading, setIsCommunityLoading] = useState(true);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
        setCommunityLessonPlans(exampleLessonPlans);
        setIsCommunityLoading(false);
        return;
    }

    setIsCommunityLoading(true);
    const q = query(collection(db, "communityLessonPlans"));
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const fetchedPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonPlan));
        const combined = [...exampleLessonPlans, ...fetchedPlans];
        const uniquePlans = Array.from(new Map(combined.map(p => [p.id, p])).values());
        setCommunityLessonPlans(uniquePlans);
        setIsCommunityLoading(false);
      },
      (err) => {
        console.error("Error fetching community plans:", err);
        setError("Не може да се вчитаат подготовките од заедницата.");
        setCommunityLessonPlans(exampleLessonPlans);
        setIsCommunityLoading(false);
      }
    );
    return () => unsubscribe();
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      setUserLessonPlans([]);
      setIsUserLoading(false);
      return;
    }

    setIsUserLoading(true);
    const uid = firebaseUser.uid;
    const plansQuery = query(collection(db, "users", uid, "lessonPlans"));

    const unsubscribe = onSnapshot(plansQuery, 
      (snapshot) => {
        const fetchedPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonPlan));
        setUserLessonPlans(fetchedPlans);
        setIsUserLoading(false);
      }, 
      (err) => {
        console.error("Error fetching lesson plans:", err);
        setError("Не може да се вчитаат подготовките за час.");
        setIsUserLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [firebaseUser]);

  const isLoading = isCommunityLoading || isUserLoading;

  const checkUser = () => {
    if (!firebaseUser) throw new Error("Корисникот не е најавен.");
    return firebaseUser.uid;
  };

  const getLessonPlan = useCallback((id: string) => {
    return [...userLessonPlans, ...communityLessonPlans].find(plan => plan.id === id);
  }, [userLessonPlans, communityLessonPlans]);

  const addLessonPlan = useCallback(async (plan: Omit<LessonPlan, 'id'>): Promise<string> => {
    const uid = checkUser();
    const newDocRef = await addDoc(collection(db, "users", uid, "lessonPlans"), plan);
    return newDocRef.id;
  }, [firebaseUser]);

  const updateLessonPlan = useCallback(async (updatedPlan: LessonPlan) => {
    const uid = checkUser();
    const { id, ...data } = updatedPlan;
    await setDoc(doc(db, "users", uid, "lessonPlans", id), data, { merge: true });
    if (data.isPublished) {
      await setDoc(doc(db, "communityLessonPlans", id), data, { merge: true });
    }
  }, [firebaseUser]);

  const deleteLessonPlan = useCallback(async (planId: string, confirmed?: boolean) => {
    const uid = checkUser();
    if (!confirmed) return;
    await deleteDoc(doc(db, "users", uid, "lessonPlans", planId));
    await deleteDoc(doc(db, "communityLessonPlans", planId)).catch(() => {});
    
    const q = query(collection(db, "users", uid, "plannerItems"), where("lessonPlanId", "==", planId));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, { lessonPlanId: deleteField() });
    });
    await batch.commit();
  }, [firebaseUser]);

  const publishLessonPlan = useCallback(async (planId: string, authorName: string) => {
    const uid = checkUser();
    const plan = userLessonPlans.find((p: LessonPlan) => p.id === planId);
    if (plan) {
      const publishedData = { ...plan, isPublished: true, authorName, ratings: plan.ratings || [], comments: plan.comments || [] };
      const { id, ...data } = publishedData;
      const batch = writeBatch(db);
      batch.set(doc(db, "users", uid, "lessonPlans", id), data, { merge: true });
      batch.set(doc(db, "communityLessonPlans", id), data, { merge: true });
      await batch.commit();
    }
  }, [firebaseUser, userLessonPlans]);

  const importCommunityPlan = useCallback(async (planToImport: LessonPlan): Promise<string> => {
    const uid = checkUser();
    const { id, ...dataToImport } = planToImport;
    const newPlanData: Omit<LessonPlan, 'id'> = {
      ...dataToImport,
      isPublished: false,
      authorName: undefined,
      ratings: [],
      comments: [],
      originalId: id,
    };
    const docRef = await addDoc(collection(db, "users", uid, "lessonPlans"), newPlanData);
    return docRef.id;
  }, [firebaseUser]);

  const importAnnualPlan = useCallback(async (planData: SharedAnnualPlan) => {
    const uid = checkUser();
    const idMap = new Map<string, string>();
    const BATCH_SIZE = 450;
    let currentBatch = writeBatch(db);
    let operationCount = 0;

    const commitAndResetBatch = async () => {
        if (operationCount > 0) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
        }
    };

    for (const plan of planData.lessonPlans) {
        const { id, ...data } = plan;
        const newPlanRef = doc(collection(db, "users", uid, "lessonPlans"));
        idMap.set(id, newPlanRef.id);
        const newPlanData = { ...data, isPublished: false, authorName: undefined, ratings: [], comments: [], originalId: id };
        currentBatch.set(newPlanRef, newPlanData);
        operationCount++;
        if (operationCount >= BATCH_SIZE) await commitAndResetBatch();
    }

    for (const item of planData.items) {
        const { id, ...data } = item;
        const newItemRef = doc(collection(db, "users", uid, "plannerItems"));
        const newItemData = {
            ...data,
            lessonPlanId: data.lessonPlanId && idMap.has(data.lessonPlanId) ? idMap.get(data.lessonPlanId) : undefined,
        };
        currentBatch.set(newItemRef, newItemData);
        operationCount++;
        if (operationCount >= BATCH_SIZE) await commitAndResetBatch();
    }
    await commitAndResetBatch();
  }, [firebaseUser]);

  const addRatingToCommunityPlan = useCallback(async (planId: string, rating: number) => {
    const plan = communityLessonPlans.find((p: LessonPlan) => p.id === planId);
    if (plan) {
      const newRatings = [...(plan.ratings || []), rating];
      await setDoc(doc(db, "communityLessonPlans", planId), { ratings: newRatings }, { merge: true });
    }
  }, [communityLessonPlans]);

  const addCommentToCommunityPlan = useCallback(async (planId: string, comment: { authorName: string; text: string; date: string; }) => {
    const plan = communityLessonPlans.find((p: LessonPlan) => p.id === planId);
    if (plan) {
      const newComments = [...(plan.comments || []), comment];
      await setDoc(doc(db, "communityLessonPlans", planId), { comments: newComments }, { merge: true });
    }
  }, [communityLessonPlans]);

  const isUserPlan = useCallback((planId: string) => userLessonPlans.some((plan: LessonPlan) => plan.id === planId), [userLessonPlans]);

  const value = useMemo(() => ({
    lessonPlans: userLessonPlans,
    communityLessonPlans,
    isLoading,
    error,
    getLessonPlan,
    addLessonPlan,
    updateLessonPlan,
    deleteLessonPlan,
    publishLessonPlan,
    importCommunityPlan,
    addRatingToCommunityPlan,
    addCommentToCommunityPlan,
    isUserPlan,
    importAnnualPlan,
  }), [userLessonPlans, communityLessonPlans, isLoading, error, getLessonPlan, addLessonPlan, updateLessonPlan, deleteLessonPlan, publishLessonPlan, importCommunityPlan, addRatingToCommunityPlan, addCommentToCommunityPlan, isUserPlan, importAnnualPlan]);

  return (
    <LessonPlansContext.Provider value={value}>
      {children}
    </LessonPlansContext.Provider>
  );
};
