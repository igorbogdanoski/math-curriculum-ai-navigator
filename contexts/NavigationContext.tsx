import React, { useContext, createContext } from 'react';

interface NavigationContextType {
  navigate: (path: string) => void;
}

export const NavigationContext = createContext<NavigationContextType>({ 
    navigate: () => { 
        if (process.env.NODE_ENV !== 'production') {
            console.warn('Navigate function called outside of a NavigationProvider context. This is a no-op.');
        }
    } 
});

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
