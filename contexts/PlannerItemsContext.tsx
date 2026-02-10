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
    updateDoc
} from "firebase/firestore";
import type { PlannerItem, LessonReflection } from '../types';
import { PlannerItemType } from '../types';

interface PlannerItemsContextType {
  items: PlannerItem[];
  isLoading: boolean;
  error: string | null;
  addItem: (item: Omit<PlannerItem, 'id'>) => Promise<void>;
  updateItem: (item: PlannerItem) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  addOrUpdateReflection: (itemId: string, reflection: LessonReflection) => Promise<void>;
  todaysItems: PlannerItem[];
  todaysLesson?: PlannerItem;
  tomorrowsLesson?: PlannerItem;
  progress: number;
}

const PlannerItemsContext = createContext<PlannerItemsContextType | undefined>(undefined);

export const usePlannerItems = () => {
  const context = useContext(PlannerItemsContext);
  if (!context) {
    throw new Error('usePlannerItems must be used within a PlannerItemsProvider');
  }
  return context;
};

export const PlannerItemsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { firebaseUser } = useAuth();
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const uid = firebaseUser.uid;
    const itemsQuery = query(collection(db, "users", uid, "plannerItems"));

    const unsubscribe = onSnapshot(itemsQuery, 
      (snapshot) => {
        const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlannerItem));
        setItems(fetchedItems);
        setIsLoading(false);
      }, 
      (err) => {
        console.error("Error fetching planner items:", err);
        setError("Не може да се вчитаат податоците од планерот.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser]);

  const { todaysItems, todaysLesson, tomorrowsLesson, progress } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const todaysItems = items.filter((item: PlannerItem) => item.date === today);
    const tomorrowsItems = items.filter((item: PlannerItem) => item.date === tomorrowStr);
    
    const todaysLesson = todaysItems.find((i: PlannerItem) => i.type === PlannerItemType.LESSON);
    const tomorrowsLesson = tomorrowsItems.find((i: PlannerItem) => i.type === PlannerItemType.LESSON);

    const totalTasks = todaysItems.filter((i: PlannerItem) => i.type === PlannerItemType.LESSON).length;
    const completedTasks = todaysItems.filter((i: PlannerItem) => i.type === PlannerItemType.LESSON && !!i.reflection).length;
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

  const value = useMemo(() => ({
    items,
    isLoading,
    error,
    addItem,
    updateItem,
    deleteItem,
    addOrUpdateReflection,
    todaysItems,
    todaysLesson,
    tomorrowsLesson,
    progress
  }), [items, isLoading, error, addItem, updateItem, deleteItem, addOrUpdateReflection, todaysItems, todaysLesson, tomorrowsLesson, progress]);

  return (
    <PlannerItemsContext.Provider value={value}>
      {children}
    </PlannerItemsContext.Provider>
  );
};
