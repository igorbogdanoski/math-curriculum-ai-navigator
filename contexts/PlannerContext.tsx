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
    deleteField,
    updateDoc
} from "firebase/firestore";
import { exampleLessonPlans } from '../data/examples';
import type { PlannerItem, LessonPlan, LessonReflection, SharedAnnualPlan } from '../types';
import { PlannerItemType } from '../types';

interface PlannerContextType {
  items: PlannerItem[];
  lessonPlans: LessonPlan[];
  communityLessonPlans: LessonPlan[];
  isLoading: boolean;
  error: string | null;
  addItem: (item: Omit<PlannerItem, 'id'>) => Promise<void>;
  updateItem: (item: PlannerItem) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  addOrUpdateReflection: (itemId: string, reflection: LessonReflection) => Promise<void>;
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
  // Calculated values for performance
  todaysItems: PlannerItem[];
  todaysLesson?: PlannerItem;
  tomorrowsLesson?: PlannerItem;
  progress: number;
}

const PlannerContext = createContext<PlannerContextType | undefined>(undefined);

export const usePlanner = () => {
  const context = useContext(PlannerContext);
  if (!context) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return context;
};

export const PlannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [userLessonPlans, setUserLessonPlans] = useState<LessonPlan[]>([]);
  const [communityLessonPlans, setCommunityLessonPlans] = useState<LessonPlan[]>(exampleLessonPlans);
  const [isCommunityLoading, setIsCommunityLoading] = useState(true);
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Effect for community (public) data - runs once a user is authenticated
  useEffect(() => {
    // Don't fetch if there's no user. The effect will re-run when the user logs in.
    // The initial state with example plans will be used until then.
    if (!firebaseUser) {
        setCommunityLessonPlans(exampleLessonPlans); // Ensure examples are loaded if user logs out
        setIsCommunityLoading(false);
        return;
    }

    setIsCommunityLoading(true);
    const q = query(collection(db, "communityLessonPlans"));
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const fetchedPlans: LessonPlan[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonPlan));
        const combined = [...exampleLessonPlans, ...fetchedPlans];
        const uniquePlans = Array.from(new Map(combined.map(p => [p.id, p])).values());
        setCommunityLessonPlans(uniquePlans);
        setIsCommunityLoading(false);
      },
      (err) => {
        console.error("Error fetching community plans:", err);
        setError("Не може да се вчитаат подготовките од заедницата.");
        // Fallback to just the example plans if the fetch fails
        setCommunityLessonPlans(exampleLessonPlans);
        setIsCommunityLoading(false);
      }
    );
    return () => unsubscribe();
  }, [firebaseUser]);

  // Effect for user-specific data - runs when user logs in or out
  useEffect(() => {
    if (!firebaseUser) {
      setItems([]);
      setUserLessonPlans([]);
      setIsUserLoading(false); // If no user, user data is considered "loaded" (as empty)
      return;
    }

    setIsUserLoading(true);
    const uid = firebaseUser.uid;
    
    const itemsQuery = query(collection(db, "users", uid, "plannerItems"));
    const plansQuery = query(collection(db, "users", uid, "lessonPlans"));

    let itemsLoaded = false;
    let plansLoaded = false;
    const checkLoaded = () => { if (itemsLoaded && plansLoaded) setIsUserLoading(false); };

    const unsubscribeItems = onSnapshot(itemsQuery, 
      (snapshot) => {
        const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlannerItem));
        setItems(fetchedItems);
        if (!itemsLoaded) { itemsLoaded = true; checkLoaded(); }
      }, 
      (err) => {
        console.error("Error fetching planner items:", err);
        setError("Не може да се вчитаат податоците од планерот.");
      }
    );

    const unsubscribePlans = onSnapshot(plansQuery, 
      (snapshot) => {
        const fetchedPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LessonPlan));
        setUserLessonPlans(fetchedPlans);
        if (!plansLoaded) { plansLoaded = true; checkLoaded(); }
      }, 
      (err) => {
        console.error("Error fetching lesson plans:", err);
        setError("Не може да се вчитаат подготовките за час.");
      }
    );
    
    return () => {
      unsubscribeItems();
      unsubscribePlans();
    };
  }, [firebaseUser]);

  const isLoading = isCommunityLoading || isUserLoading;
  
  const { todaysItems, todaysLesson, tomorrowsLesson, progress } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todaysItems = items.filter(item => item.date === today);
    const tomorrowsItems = items.filter(item => item.date === tomorrowStr);
    
    const todaysLesson = todaysItems.find(i => i.type === PlannerItemType.LESSON);
    const tomorrowsLesson = tomorrowsItems.find(i => i.type === PlannerItemType.LESSON);

    const totalTasks = todaysItems.filter(i => i.type === PlannerItemType.LESSON).length;
    const completedTasks = todaysItems.filter(i => i.type === PlannerItemType.LESSON && !!i.reflection).length;
    const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    return { todaysItems, todaysLesson, tomorrowsLesson, progress };
  }, [items]);

  const checkUser = () => {
    if (!firebaseUser) throw new Error("Корисникот не е најавен.");
    return firebaseUser.uid;
  };

  const addItem = useCallback(async (item: Omit<PlannerItem, 'id'>) => {
    const uid = checkUser();
    await addDoc(collection(db, "users", uid, "plannerItems"), item);
  }, [firebaseUser]);

  const updateItem = useCallback(async (updatedItem: PlannerItem) => {
    const uid = checkUser();
    const { id, ...data } = updatedItem;
    await setDoc(doc(db, "users", uid, "plannerItems", id), data, { merge: true });
  }, [firebaseUser]);

  const deleteItem = useCallback(async (itemId: string) => {
    const uid = checkUser();
    await deleteDoc(doc(db, "users", uid, "plannerItems", itemId));
  }, [firebaseUser]);

  const addOrUpdateReflection = useCallback(async (itemId: string, reflection: LessonReflection) => {
    const uid = checkUser();
    await updateDoc(doc(db, "users", uid, "plannerItems", itemId), { reflection });
  }, [firebaseUser]);

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
    if (!confirmed) return; // Confirmation must be handled by the UI layer
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
    const plan = userLessonPlans.find(p => p.id === planId);
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
    
    // Firestore supports max 500 operations per batch.
    // We need to chunk the operations to avoid errors for large plans.
    const BATCH_SIZE = 450; // Safety margin
    let currentBatch = writeBatch(db);
    let operationCount = 0;

    const commitAndResetBatch = async () => {
        if (operationCount > 0) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
        }
    };

    // Process Lesson Plans
    for (const plan of planData.lessonPlans) {
        const { id, ...data } = plan;
        const newPlanRef = doc(collection(db, "users", uid, "lessonPlans"));
        idMap.set(id, newPlanRef.id);
        
        const newPlanData = { ...data, isPublished: false, authorName: undefined, ratings: [], comments: [], originalId: id };
        currentBatch.set(newPlanRef, newPlanData);
        operationCount++;

        if (operationCount >= BATCH_SIZE) await commitAndResetBatch();
    }

    // Process Planner Items
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
    
    // Commit any remaining operations
    await commitAndResetBatch();

  }, [firebaseUser]);

  const addRatingToCommunityPlan = useCallback(async (planId: string, rating: number) => {
    const plan = communityLessonPlans.find(p => p.id === planId);
    if (plan) {
      const newRatings = [...(plan.ratings || []), rating];
      await setDoc(doc(db, "communityLessonPlans", planId), { ratings: newRatings }, { merge: true });
    }
  }, [communityLessonPlans]);

  const addCommentToCommunityPlan = useCallback(async (planId: string, comment: { authorName: string; text: string; date: string; }) => {
    const plan = communityLessonPlans.find(p => p.id === planId);
    if (plan) {
      const newComments = [...(plan.comments || []), comment];
      await setDoc(doc(db, "communityLessonPlans", planId), { comments: newComments }, { merge: true });
    }
  }, [communityLessonPlans]);

  const isUserPlan = useCallback((planId: string) => userLessonPlans.some(plan => plan.id === planId), [userLessonPlans]);

  const value: PlannerContextType = useMemo(() => ({
    items,
    lessonPlans: userLessonPlans,
    communityLessonPlans,
    isLoading,
    error,
    addItem,
    updateItem,
    deleteItem,
    addOrUpdateReflection,
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
    todaysItems,
    todaysLesson,
    tomorrowsLesson,
    progress
  }), [items, userLessonPlans, communityLessonPlans, isLoading, error, addItem, updateItem, deleteItem, addOrUpdateReflection, getLessonPlan, addLessonPlan, updateLessonPlan, deleteLessonPlan, publishLessonPlan, importCommunityPlan, addRatingToCommunityPlan, addCommentToCommunityPlan, isUserPlan, importAnnualPlan, todaysItems, todaysLesson, tomorrowsLesson, progress]);

  return (
    <PlannerContext.Provider value={value}>
      {children}
    </PlannerContext.Provider>
  );
};