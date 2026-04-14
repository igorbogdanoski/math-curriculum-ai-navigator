import { logger } from '../utils/logger';
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const ACADEMY_XP = {
  READ_LESSON: 5,
  APPLY_LESSON: 20,
  SAVE_REFLECTION: 30,
  MENTOR_CHAT: 10,
  QUIZ_COMPLETE: 50,
  MATERIAL_SAVED: 15,
} as const;

// ── Material Stats & Achievements ─────────────────────────────────────────────

export interface MaterialStats {
  totalSaved: number;
  quizzesSaved: number;
  assessmentsSaved: number;
  ideasSaved: number;
  rubricsSaved: number;
}

export interface MaterialAchievement {
  id: string;
  label: string;
  emoji: string;
  xp: number;
  condition: (stats: MaterialStats) => boolean;
}

export const MATERIAL_ACHIEVEMENTS: MaterialAchievement[] = [
  { id: 'mat_first',   label: 'Прв материјал',              emoji: '🎯', xp: 50,   condition: s => s.totalSaved >= 1 },
  { id: 'mat_variety', label: 'Разновидност',                emoji: '🎨', xp: 80,   condition: s => s.quizzesSaved >= 1 && s.assessmentsSaved >= 1 && s.ideasSaved >= 1 },
  { id: 'mat_quiz5',   label: '5 Квизови',                   emoji: '📝', xp: 100,  condition: s => s.quizzesSaved >= 5 },
  { id: 'mat_asmt5',   label: '5 Проценети листови',         emoji: '📊', xp: 100,  condition: s => s.assessmentsSaved >= 5 },
  { id: 'mat_10',      label: '10 Зачувани материјали',      emoji: '⭐', xp: 150,  condition: s => s.totalSaved >= 10 },
  { id: 'mat_quiz25',  label: '25 Квизови',                  emoji: '🏆', xp: 250,  condition: s => s.quizzesSaved >= 25 },
  { id: 'mat_50',      label: '50 Зачувани материјали',      emoji: '🌟', xp: 500,  condition: s => s.totalSaved >= 50 },
  { id: 'mat_100',     label: '100 Материјали — Мајстор!',   emoji: '💎', xp: 1000, condition: s => s.totalSaved >= 100 },
];

const DEFAULT_STATS: MaterialStats = {
  totalSaved: 0, quizzesSaved: 0, assessmentsSaved: 0, ideasSaved: 0, rubricsSaved: 0,
};

// ─────────────────────────────────────────────────────────────────────────────

export interface AcademyProgress {
  readLessons: string[];
  appliedLessons: string[];
  completedQuizzes: string[]; // lessonId
  reflections: Record<string, string>; // lessonId → reflection note
  xp: number;
  materialStats?: MaterialStats;
  unlockedMaterialAchievements?: string[]; // achievement ids
}

export interface AcademyProgressContextType {
  progress: AcademyProgress;
  markLessonAsRead: (lessonId: string) => void;
  markLessonAsApplied: (lessonId: string) => void;
  markQuizAsCompleted: (lessonId: string) => void;
  saveReflection: (lessonId: string, note: string) => void;
  addXp: (amount: number, reason?: string) => void;
  getCompletionPercentage: (totalLessons: number) => number;
  /** Call after saving a material to the library. Returns newly unlocked achievement labels. */
  trackMaterialSaved: (type: string) => string[];
}

const defaultProgress: AcademyProgress = {
  readLessons: [],
  appliedLessons: [],
  completedQuizzes: [],
  reflections: {},
  xp: 0,
  materialStats: undefined,
  unlockedMaterialAchievements: [],
};

const STORAGE_KEY = 'math-navigator-academy-progress';

const AcademyProgressContext = createContext<AcademyProgressContextType | undefined>(undefined);

export const AcademyProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<AcademyProgress>(defaultProgress);
  const [isLoaded, setIsLoaded] = useState(false);
  const { firebaseUser } = useAuth();
  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProgress({ ...defaultProgress, ...parsed });
      }
    } catch (e) {
      logger.error('Failed to load academy progress', e);
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

          // Merge material stats — take max of each counter
          const localStats = prev.materialStats || DEFAULT_STATS;
          const remoteStats = (data.materialStats as MaterialStats | undefined) || DEFAULT_STATS;
          const mergedStats: MaterialStats = {
            totalSaved: Math.max(localStats.totalSaved, remoteStats.totalSaved),
            quizzesSaved: Math.max(localStats.quizzesSaved, remoteStats.quizzesSaved),
            assessmentsSaved: Math.max(localStats.assessmentsSaved, remoteStats.assessmentsSaved),
            ideasSaved: Math.max(localStats.ideasSaved, remoteStats.ideasSaved),
            rubricsSaved: Math.max(localStats.rubricsSaved, remoteStats.rubricsSaved),
          };
          const mergedUnlocked = Array.from(new Set([
            ...(prev.unlockedMaterialAchievements || []),
            ...((data.unlockedMaterialAchievements as string[] | undefined) || []),
          ]));

          const merged: AcademyProgress = {
            readLessons: mergedRead,
            appliedLessons: mergedApplied,
            completedQuizzes: mergedQuizzes,
            reflections: mergedReflections,
            xp: mergedXp,
            materialStats: mergedStats,
            unlockedMaterialAchievements: mergedUnlocked,
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

  const trackMaterialSaved = useCallback((type: string): string[] => {
    const prev = progressRef.current;
    const stats = prev.materialStats || { ...DEFAULT_STATS };

    const newStats: MaterialStats = {
      totalSaved: stats.totalSaved + 1,
      quizzesSaved: stats.quizzesSaved + (type === 'quiz' ? 1 : 0),
      assessmentsSaved: stats.assessmentsSaved + (type === 'assessment' ? 1 : 0),
      ideasSaved: stats.ideasSaved + (type === 'idea' ? 1 : 0),
      rubricsSaved: stats.rubricsSaved + (type === 'rubric' ? 1 : 0),
    };

    const alreadyUnlocked = prev.unlockedMaterialAchievements || [];
    const newlyUnlocked = MATERIAL_ACHIEVEMENTS.filter(
      a => !alreadyUnlocked.includes(a.id) && a.condition(newStats),
    );
    const newUnlocked = [...alreadyUnlocked, ...newlyUnlocked.map(a => a.id)];
    const bonusXp = newlyUnlocked.reduce((sum, a) => sum + a.xp, 0);
    const newXp = prev.xp + ACADEMY_XP.MATERIAL_SAVED + bonusXp;

    const next: AcademyProgress = {
      ...prev,
      xp: newXp,
      materialStats: newStats,
      unlockedMaterialAchievements: newUnlocked,
    };

    setProgress(next);

    if (firebaseUser) {
      const ref = doc(db, 'users', firebaseUser.uid, 'academy', 'progress');
      setDoc(ref, { xp: newXp, materialStats: newStats, unlockedMaterialAchievements: newUnlocked }, { merge: true }).catch(console.error);
    }

    return newlyUnlocked.map(a => `${a.emoji} ${a.label} (+${a.xp} XP)`);
  }, [firebaseUser]);

  return (
    <AcademyProgressContext.Provider value={{
      progress,
      markLessonAsRead,
      markLessonAsApplied,
      markQuizAsCompleted,
      saveReflection,
      addXp,
      getCompletionPercentage,
      trackMaterialSaved,
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
