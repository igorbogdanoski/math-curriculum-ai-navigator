import React, { useEffect, useRef } from 'react';
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

/** Exponential backoff: 2s, 4s, 8s, 16s, 32s, cap 60s */
async function syncWithRetry(maxAttempts = 6): Promise<void> {
  let delay = 2_000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const synced = await firestoreService.syncOfflineQuizzes();
      if (synced > 0) {
        console.log(`[Offline Sync] Synced ${synced} pending quiz(es) on attempt ${attempt}.`);
      }
      return; // success
    } catch (err) {
      console.warn(`[Offline Sync] Attempt ${attempt}/${maxAttempts} failed:`, err);
      if (attempt === maxAttempts) {
        console.error('[Offline Sync] All retry attempts exhausted. Data remains in IndexedDB.');
        return;
      }
      // Wait before next attempt; abort early if we went offline again
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, delay);
        const abort = () => { clearTimeout(t); resolve(); };
        window.addEventListener('offline', abort, { once: true });
      });
      if (!navigator.onLine) return; // went offline — stop retrying
      delay = Math.min(delay * 2, 60_000);
    }
  }
}

export const NetworkStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setOnline = useNetworkStatus((state) => state.setOnline);
  // Periodic re-sync every 5 min in case a previous sync was missed
  const periodicRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void syncWithRetry();
    };

    const handleOffline = () => {
      setOnline(false);
      if (periodicRef.current) clearInterval(periodicRef.current);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync on mount if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void syncWithRetry();
      // Periodic background sync every 5 minutes
      periodicRef.current = setInterval(() => {
        if (navigator.onLine) void syncWithRetry(2);
      }, 5 * 60_000);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (periodicRef.current) clearInterval(periodicRef.current);
    };
  }, [setOnline]);

  return <>{children}</>;
};
