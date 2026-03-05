import React, { useEffect } from 'react';
import { create } from 'zustand';
import { firestoreService } from '../services/firestoreService';

interface NetworkStatusState {
  isOnline: boolean;
  setOnline: (status: boolean) => void;
}

export const useNetworkStatus = create<NetworkStatusState>((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  setOnline: (status) => set({ isOnline: status }),
}));

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setOnline = useNetworkStatus((state) => state.setOnline);

  useEffect(() => {
    const handleOnline = async () => {
      setOnline(true);
      // Automatically sync offline quizzes when connection is restored
      try {
        const syncedCount = await firestoreService.syncOfflineQuizzes();
        if (syncedCount > 0) {
          console.log(`[Offline Sync] Successfully synced ${syncedCount} pending quizzes to Firebase.`);
          // Optionally, dispatch a UI notification event here
        }
      } catch (err) {
        console.error('[Offline Sync] Failed during reconnection:', err);
      }
    };
    
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check in case it un-suspended online with pending items
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return <>{children}</>;
};
