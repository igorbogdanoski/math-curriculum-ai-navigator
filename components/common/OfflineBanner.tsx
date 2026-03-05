import React from 'react';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { ICONS } from '../../constants';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-600 text-white px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg animate-fade-in-up fixed bottom-0 left-0 right-0 z-[100] safe-area-pb">
      <ICONS.arrowPath className="w-5 h-5 animate-spin" />
      <span>Офлајн сте. Вашата работа се зачувува локално и ќе се синхронизира автоматски!</span>
    </div>
  );
};