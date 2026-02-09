import React from 'react';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { ICONS } from '../../constants';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-md animate-fade-in-up fixed bottom-0 left-0 right-0 z-50">
      <ICONS.arrowPath className="w-5 h-5 animate-spin" />
      <span>Нема интернет конекција. Некои функции (AI, синхронизација) се привремено недостапни.</span>
    </div>
  );
};