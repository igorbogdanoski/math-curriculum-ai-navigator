/**
 * S65 P3-B — useReferral
 *
 * Captures `?ref=TEACHERCODE` (or `&ref=` inside hash query) from the URL on
 * mount and persists it in localStorage. The captured code is later read by
 * AuthContext to credit the referring teacher when a brand-new account is
 * created (in `claimPendingReferral`).
 *
 * The referral code IS the referring teacher's UID. Teachers share their link
 * via `getReferralLink(uid)` and earn +10 AI credits per successful sign-up.
 */

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pending_referral_code';

const parseRefFromUrl = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const direct = new URLSearchParams(window.location.search).get('ref');
    if (direct) return direct.trim();
    const hash = window.location.hash || '';
    const qIndex = hash.indexOf('?');
    if (qIndex >= 0) {
      const fromHash = new URLSearchParams(hash.slice(qIndex + 1)).get('ref');
      if (fromHash) return fromHash.trim();
    }
  } catch { /* malformed URL */ }
  return '';
};

export function getPendingReferralCode(): string {
  try { return localStorage.getItem(STORAGE_KEY) || ''; } catch { return ''; }
}

export function clearPendingReferralCode(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* incognito */ }
}

export function getReferralLink(teacherUid: string): string {
  if (!teacherUid) return '';
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/?ref=${encodeURIComponent(teacherUid)}`;
  } catch {
    return `?ref=${encodeURIComponent(teacherUid)}`;
  }
}

export function useReferral(): { code: string; clear: () => void } {
  const [code, setCode] = useState<string>(() => getPendingReferralCode());

  useEffect(() => {
    const fresh = parseRefFromUrl();
    if (fresh && fresh !== code) {
      try { localStorage.setItem(STORAGE_KEY, fresh); } catch { /* incognito */ }
      setCode(fresh);
    }
  }, [code]);

  return {
    code,
    clear: () => {
      clearPendingReferralCode();
      setCode('');
    },
  };
}
