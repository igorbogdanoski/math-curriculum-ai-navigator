import React, { createContext, useContext, useEffect, useState } from 'react';

// Defines the structure of a user's progress in the Academy
export interface AcademyProgress {
  readLessons: string[]; // Array of lesson IDs the user has opened/read
  appliedLessons: string[]; // Array of lesson IDs the user has actually generated material with
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

  // Load from localStorage on mount
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

  // Save to localStorage whenever progress changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('math-navigator-academy-progress', JSON.stringify(progress));
    }
  }, [progress, isLoaded]);

  const markLessonAsRead = (lessonId: string) => {
    setProgress(prev => {
      if (prev.readLessons.includes(lessonId)) return prev;
      return {
        ...prev,
        readLessons: [...prev.readLessons, lessonId]
      };
    });
  };

  const markLessonAsApplied = (lessonId: string) => {
    setProgress(prev => {
      if (prev.appliedLessons.includes(lessonId)) return prev;
      return {
        ...prev,
        appliedLessons: [...prev.appliedLessons, lessonId]
      };
    });
  };

  const getCompletionPercentage = (totalLessons: number) => {
    if (totalLessons === 0) return 0;
    // For now, completion means having read it and applied it.
    // Let's count reading as progress.
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
