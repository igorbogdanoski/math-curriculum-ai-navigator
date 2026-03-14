import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const ACADEMY_XP = {
  READ_LESSON: 5,
  APPLY_LESSON: 20,
  SAVE_REFLECTION: 30,
  MENTOR_CHAT: 10,
  QUIZ_COMPLETE: 50,
} as const;

export interface AcademyProgress {
  readLessons: string[];
  appliedLessons: string[];
  completedQuizzes: string[]; // lessonId
  reflections: Record<string, string>; // lessonId → reflection note
  xp: number;
}

export interface AcademyProgressContextType {
  progress: AcademyProgress;
  markLessonAsRead: (lessonId: string) => void;
  markLessonAsApplied: (lessonId: string) => void;
  markQuizAsCompleted: (lessonId: string) => void;
  saveReflection: (lessonId: string, note: string) => void;
  addXp: (amount: number, reason?: string) => void;
  getCompletionPercentage: (totalLessons: number) => number;
}

const defaultProgress: AcademyProgress = {
  readLessons: [],
  appliedLessons: [],
  completedQuizzes: [],
  reflections: {},
  xp: 0,
};

const STORAGE_KEY = 'math-navigator-academy-progress';

const AcademyProgressContext = createContext<AcademyProgressContextType | undefined>(undefined);

export const AcademyProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<AcademyProgress>(defaultProgress);
  const [isLoaded, setIsLoaded] = useState(false);
  const { firebaseUser } = useAuth();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProgress({ ...defaultProgress, ...parsed });
      }
    } catch (e) {
      console.error('Failed to load academy progress', e);
    }
    setIsLoaded(true);
  }, []);

  // Sync with Firestore when user is logged in
  useEffect(() => {
    if (!firebaseUser) return;

    const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');

    const unsubscribe = onSnapshot(progressRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<AcademyProgress>;

        setProgress(prev => {
          const mergedRead = Array.from(new Set([...prev.readLessons, ...(data.readLessons || [])]));
          const mergedApplied = Array.from(new Set([...prev.appliedLessons, ...(data.appliedLessons || [])]));
          const mergedQuizzes = Array.from(new Set([...prev.completedQuizzes, ...(data.completedQuizzes || [])]));
          const mergedReflections = { ...(data.reflections || {}), ...prev.reflections };
          const mergedXp = Math.max(prev.xp, data.xp || 0);

          const merged: AcademyProgress = {
            readLessons: mergedRead,
            appliedLessons: mergedApplied,
            completedQuizzes: mergedQuizzes,
            reflections: mergedReflections,
            xp: mergedXp,
          };

          const remoteReadLen = data.readLessons?.length || 0;
          const remoteAppliedLen = data.appliedLessons?.length || 0;
          const remoteQuizLen = data.completedQuizzes?.length || 0;
          const remoteReflCount = Object.keys(data.reflections || {}).length;
          const localReflCount = Object.keys(prev.reflections).length;

          if (
            mergedRead.length > remoteReadLen ||
            mergedApplied.length > remoteAppliedLen ||
            mergedQuizzes.length > remoteQuizLen ||
            localReflCount > remoteReflCount ||
            mergedXp > (data.xp || 0)
          ) {
            setDoc(progressRef, merged, { merge: true }).catch(console.error);
          }

          return merged;
        });
      } else {
        setProgress(prev => {
          setDoc(progressRef, prev, { merge: true }).catch(console.error);
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  // Persist to localStorage whenever progress changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    }
  }, [progress, isLoaded]);

  const markLessonAsRead = useCallback((lessonId: string) => {
    setProgress(prev => {
      if (prev.readLessons.includes(lessonId)) return prev;
      const newReadLessons = [...prev.readLessons, lessonId];
      const newXp = prev.xp + ACADEMY_XP.READ_LESSON;
      const next = { ...prev, readLessons: newReadLessons, xp: newXp };
      if (firebaseUser) {
        const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
        setDoc(progressRef, { readLessons: newReadLessons, xp: newXp }, { merge: true }).catch(console.error);
      }
      return next;
    });
  }, [firebaseUser]);

  const markLessonAsApplied = useCallback((lessonId: string) => {
    setProgress(prev => {
      if (prev.appliedLessons.includes(lessonId)) return prev;
      const newAppliedLessons = [...prev.appliedLessons, lessonId];
      const newXp = prev.xp + ACADEMY_XP.APPLY_LESSON;
      const next = { ...prev, appliedLessons: newAppliedLessons, xp: newXp };
      if (firebaseUser) {
        const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
        setDoc(progressRef, { appliedLessons: newAppliedLessons, xp: newXp }, { merge: true }).catch(console.error);
      }
      return next;
    });
  }, [firebaseUser]);

  const markQuizAsCompleted = useCallback((lessonId: string) => {
    setProgress(prev => {
      if (prev.completedQuizzes.includes(lessonId)) return prev;
      const newQuizzes = [...prev.completedQuizzes, lessonId];
      const newXp = prev.xp + ACADEMY_XP.QUIZ_COMPLETE;
      const next = { ...prev, completedQuizzes: newQuizzes, xp: newXp };
      if (firebaseUser) {
        const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
        setDoc(progressRef, { completedQuizzes: newQuizzes, xp: newXp }, { merge: true }).catch(console.error);
      }
      return next;
    });
  }, [firebaseUser]);

  const saveReflection = useCallback((lessonId: string, note: string) => {
    setProgress(prev => {
      const isFirstReflection = !prev.reflections[lessonId];
      const newReflections = { ...prev.reflections, [lessonId]: note };
      const newXp = isFirstReflection ? prev.xp + ACADEMY_XP.SAVE_REFLECTION : prev.xp;
      const next = { ...prev, reflections: newReflections, xp: newXp };
      if (firebaseUser) {
        const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
        setDoc(progressRef, { reflections: newReflections, xp: newXp }, { merge: true }).catch(console.error);
      }
      return next;
    });
  }, [firebaseUser]);

  const addXp = useCallback((amount: number) => {
    setProgress(prev => {
      const newXp = prev.xp + amount;
      const next = { ...prev, xp: newXp };
      if (firebaseUser) {
        const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
        setDoc(progressRef, { xp: newXp }, { merge: true }).catch(console.error);
      }
      return next;
    });
  }, [firebaseUser]);

  const getCompletionPercentage = useCallback((totalLessons: number) => {
    if (totalLessons === 0) return 0;
    return Math.round((progress.readLessons.length / totalLessons) * 100);
  }, [progress.readLessons.length]);

  return (
    <AcademyProgressContext.Provider value={{
      progress,
      markLessonAsRead,
      markLessonAsApplied,
      saveReflection,
      addXp,
      getCompletionPercentage,
    }}>
      {children}
    </AcademyProgressContext.Provider>
  );
};

export const useAcademyProgress = () => {
  const context = useContext(AcademyProgressContext);
  if (!context) {
    throw new Error('useAcademyProgress must be used within an AcademyProgressProvider');
  }
  return context;
};
