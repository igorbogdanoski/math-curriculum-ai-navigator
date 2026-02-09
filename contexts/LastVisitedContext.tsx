import React, { createContext, useContext, useCallback } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';

interface LastVisitedItem {
  path: string;
  label: string;
  type: 'concept' | 'lesson';
}

interface LastVisitedContextType {
  lastVisited: LastVisitedItem | null;
  setLastVisited: (item: LastVisitedItem) => void;
}

const LastVisitedContext = createContext<LastVisitedContextType | undefined>(undefined);

export const useLastVisited = () => {
  const context = useContext(LastVisitedContext);
  if (!context) {
    throw new Error('useLastVisited must be used within a LastVisitedProvider');
  }
  return context;
};

export const LastVisitedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lastVisited, setLastVisitedState] = usePersistentState<LastVisitedItem | null>('lastVisitedItem', null);

  const setLastVisited = useCallback((item: LastVisitedItem) => {
    setLastVisitedState(item);
  }, [setLastVisitedState]);

  const value = { lastVisited, setLastVisited };

  return (
    <LastVisitedContext.Provider value={value}>
      {children}
    </LastVisitedContext.Provider>
  );
};