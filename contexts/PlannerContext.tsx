import React, { createContext, useContext, useMemo } from 'react';
import { PlannerItemsProvider, usePlannerItems } from './PlannerItemsContext';
import { LessonPlansProvider, useLessonPlans } from './LessonPlansContext';
import type { PlannerItem, LessonPlan, LessonReflection, SharedAnnualPlan } from '../types';

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

const PlannerConsumer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const plannerItems = usePlannerItems();
  const lessonPlans = useLessonPlans();

  const value: PlannerContextType = useMemo(() => ({
    ...plannerItems,
    ...lessonPlans,
    isLoading: plannerItems.isLoading || lessonPlans.isLoading,
    error: plannerItems.error || lessonPlans.error,
    lessonPlans: lessonPlans.lessonPlans,
  }), [plannerItems, lessonPlans]);

  return (
    <PlannerContext.Provider value={value}>
      {children}
    </PlannerContext.Provider>
  );
};

export const PlannerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <PlannerItemsProvider>
      <LessonPlansProvider>
        <PlannerConsumer>
          {children}
        </PlannerConsumer>
      </LessonPlansProvider>
    </PlannerItemsProvider>
  );
};