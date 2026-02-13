import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineBanner = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="bg-red-500 text-white text-center p-2 text-xs font-bold flex items-center justify-center gap-2 fixed bottom-0 left-0 w-full z-[100] animate-pulse">
      <WifiOff className="w-4 h-4" />
      Нема интернет конекција. Некои AI функции нема да работат.
    </div>
  );
};
