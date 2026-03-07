import { useState, useEffect } from 'react';
import { clearDailyQuotaFlag } from '../services/geminiService';

export function useQuotaManager(addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void) {
  const [quotaError, setQuotaError] = useState<{ resetTime: string; resetMs: number; exhaustedAt?: string } | null>(null);
  const [quotaCountdown, setQuotaCountdown] = useState('');
  const [isThrottled, setIsThrottled] = useState(false);

  useEffect(() => {
    if (!quotaError?.resetMs) { setQuotaCountdown(''); return; }
    const update = () => {
      const diff = quotaError.resetMs - Date.now();
      if (diff <= 0) { setQuotaCountdown(''); return; }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      setQuotaCountdown(h > 0 ? `${h}ч ${m}мин` : `${m}мин`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [quotaError]);

  const setQuotaBannerFromStorage = () => {
    try {
      const cookieMatch = document.cookie.split('; ').find(r => r.startsWith('ai_quota='));
      const stored = cookieMatch
        ? decodeURIComponent(cookieMatch.slice('ai_quota='.length))
        : localStorage.getItem('ai_daily_quota_exhausted');
      const { nextResetMs, exhaustedAt }: { nextResetMs?: number, exhaustedAt?: number | string } = stored ? JSON.parse(stored) : {};
      const resetTime = nextResetMs
        ? new Date(nextResetMs).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })
        : '09:00';
      const exhaustedAtStr = exhaustedAt
        ? new Date(exhaustedAt).toLocaleString('mk-MK', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        : undefined;
      setQuotaError({ resetTime, resetMs: nextResetMs ?? 0, exhaustedAt: exhaustedAtStr });
    } catch {
      setQuotaError({ resetTime: '09:00', resetMs: 0 });
    }
  };

  const handleClearQuota = () => {
    clearDailyQuotaFlag();
    setQuotaError(null);
    addNotification('Квота флагот е ресетиран. Обидете се со генерирање.', 'success');
  };

  return {
    quotaError,
    setQuotaError,
    quotaCountdown,
    isThrottled,
    setIsThrottled,
    setQuotaBannerFromStorage,
    handleClearQuota,
  };
}