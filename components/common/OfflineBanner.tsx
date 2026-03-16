import React, { useEffect, useState } from 'react';
import { useNetworkStatus } from '../../contexts/NetworkStatusContext';
import { ICONS } from '../../constants';
import { getPendingQuizzesCount } from '../../services/indexedDBService';

export const OfflineBanner: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const count = await getPendingQuizzesCount();
        if (!cancelled) setPendingCount(count);
      } catch {
        // non-fatal
      }
    };
    check();
    // Re-check every 10 s so the count drops as sync clears entries
    const interval = setInterval(check, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isOnline]);

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white px-4 py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg animate-fade-in-up fixed bottom-0 left-0 right-0 z-[100] safe-area-pb">
        <ICONS.arrowPath className="w-5 h-5 animate-spin" />
        <span>Офлајн сте. Вашата работа се зачувува локално и ќе се синхронизира автоматски!</span>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-blue-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-lg fixed bottom-0 left-0 right-0 z-[100] safe-area-pb">
        <ICONS.arrowPath className="w-4 h-4 animate-spin" />
        <span>{pendingCount} {pendingCount === 1 ? 'резултат чека' : 'резултати чекаат'} синхронизација…</span>
      </div>
    );
  }

  return null;
};
