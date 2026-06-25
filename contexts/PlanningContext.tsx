import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Grade, Topic } from '../types';

export interface PlanningState {
  annualPlanId: string | null;
  grade: Grade | null;
  topic: Topic | null;
  /** Theme title from annual plan (e.g. "Броеви") — may not map 1:1 to a Topic */
  themeName: string | null;
  /** [startWeek, endWeek] within the 36-week school year */
  weekRange: [number, number] | null;
  hoursAllocated: number | null;
  /** Bloom levels expected for this planning context (e.g. [1,2,3]) */
  bloomTargets: number[];
  objectives: string[];
}

interface PlanningContextValue extends PlanningState {
  setPlanningState: (patch: Partial<PlanningState>) => void;
  clearPlanningState: () => void;
}

const defaultState: PlanningState = {
  annualPlanId: null,
  grade: null,
  topic: null,
  themeName: null,
  weekRange: null,
  hoursAllocated: null,
  bloomTargets: [],
  objectives: [],
};

const PlanningContext = createContext<PlanningContextValue>({
  ...defaultState,
  setPlanningState: () => undefined,
  clearPlanningState: () => undefined,
});

export const PlanningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PlanningState>(defaultState);

  const setPlanningState = useCallback((patch: Partial<PlanningState>) => {
    setState(prev => ({ ...prev, ...patch }));
  }, []);

  const clearPlanningState = useCallback(() => setState(defaultState), []);

  const value = useMemo(
    () => ({ ...state, setPlanningState, clearPlanningState }),
    [state, setPlanningState, clearPlanningState],
  );

  return <PlanningContext.Provider value={value}>{children}</PlanningContext.Provider>;
};

export const usePlanning = () => useContext(PlanningContext);
