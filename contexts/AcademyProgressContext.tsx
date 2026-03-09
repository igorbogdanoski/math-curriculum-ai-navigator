import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export interface AcademyProgress {
  readLessons: string[]; 
  appliedLessons: string[];
}

export interface AcademyProgressContextType {
  progress: AcademyProgress;
  markLessonAsRead: (lessonId: string) => void;
  markLessonAsApplied: (lessonId: string) => void;
  getCompletionPercentage: (totalLessons: number) => number;
}

const defaultProgress: AcademyProgress = {
  readLessons: [],
  appliedLessons: [],
};

const AcademyProgressContext = createContext<AcademyProgressContextType | undefined>(undefined);

export const AcademyProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<AcademyProgress>(defaultProgress);
  const [isLoaded, setIsLoaded] = useState(false);
  const { firebaseUser } = useAuth();

  useEffect(() => {
    try {
      const stored = localStorage.getItem('math-navigator-academy-progress');
      if (stored) {
        setProgress(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load academy progress', e);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    
    const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
    
    const unsubscribe = onSnapshot(progressRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AcademyProgress;
        
        setProgress(prev => {
          const mergedRead = Array.from(new Set([...prev.readLessons, ...(data.readLessons || [])]));
          const mergedApplied = Array.from(new Set([...prev.appliedLessons, ...(data.appliedLessons || [])]));
          
          const merged = {
            readLessons: mergedRead,
            appliedLessons: mergedApplied
          };
          
          if (mergedRead.length > (data.readLessons?.length || 0) || mergedApplied.length > (data.appliedLessons?.length || 0)) {
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

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('math-navigator-academy-progress', JSON.stringify(progress));
    }
  }, [progress, isLoaded]);

  const markLessonAsRead = async (lessonId: string) => {
    setProgress(prev => {
      if (prev.readLessons.includes(lessonId)) return prev;
      
      const newReadLessons = [...prev.readLessons, lessonId];
      if (firebaseUser) {
        const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
        setDoc(progressRef, { readLessons: newReadLessons }, { merge: true }).catch(console.error);
      }
      return { ...prev, readLessons: newReadLessons };
    });
  };

  const markLessonAsApplied = async (lessonId: string) => {
    setProgress(prev => {
      if (prev.appliedLessons.includes(lessonId)) return prev;
      
      const newAppliedLessons = [...prev.appliedLessons, lessonId];
      if (firebaseUser) {
        const progressRef = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
        setDoc(progressRef, { appliedLessons: newAppliedLessons }, { merge: true }).catch(console.error);
      }
      return { ...prev, appliedLessons: newAppliedLessons };
    });
  };

  const getCompletionPercentage = (totalLessons: number) => {
    if (totalLessons === 0) return 0;
    return Math.round((progress.readLessons.length / totalLessons) * 100);
  };

  return (
    <AcademyProgressContext.Provider value={{ progress, markLessonAsRead, markLessonAsApplied, getCompletionPercentage }}>
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
