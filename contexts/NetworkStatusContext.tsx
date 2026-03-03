import React, { useEffect } from 'react';
import { create } from 'zustand';

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
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return <>{children}</>;
};
