import { RateLimitError } from '../apiErrors';

export const DAILY_QUOTA_KEY = 'ai_daily_quota_exhausted';

// Dual write: cookie (primary, immune to Tracking Prevention) + localStorage (fallback).
export function quotaRead(): string | null {
  try {
    const match = document.cookie.split('; ').find(r => r.startsWith('ai_quota='));
    if (match) return decodeURIComponent(match.slice('ai_quota='.length));
  } catch { /* ignore */ }
  try { return localStorage.getItem(DAILY_QUOTA_KEY); } catch { return null; }
}

export function quotaWrite(value: string, expiresMs: number): void {
  try {
    document.cookie = `ai_quota=${encodeURIComponent(value)}; expires=${new Date(expiresMs).toUTCString()}; SameSite=Strict; path=/`;
  } catch { /* ignore */ }
  try { localStorage.setItem(DAILY_QUOTA_KEY, value); } catch { /* ignore */ }
}

export function quotaClear(): void {
  try { document.cookie = 'ai_quota=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict; path=/'; } catch { /* ignore */ }
  try { localStorage.removeItem(DAILY_QUOTA_KEY); } catch { /* ignore */ }
}

/** Returns Unix timestamp (ms) of the next Pacific midnight (= Gemini's reset time = 09:00 MK). */
export function getNextPacificMidnightMs(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const march1Day = new Date(Date.UTC(year, 2, 1)).getUTCDay();
  const dstStart  = new Date(Date.UTC(year, 2, (7 - march1Day) % 7 + 8, 10));
  const nov1Day   = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const dstEnd    = new Date(Date.UTC(year, 10, (7 - nov1Day) % 7 + 1, 9));
  const isPDT = now >= dstStart && now < dstEnd;
  const utcHour = isPDT ? 7 : 8;
  const nextMidnight = new Date();
  nextMidnight.setUTCHours(utcHour, 0, 0, 0);
  if (nextMidnight.getTime() <= now.getTime()) {
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  }
  return nextMidnight.getTime();
}

export function checkDailyQuotaGuard(): void {
  // PAID TIER: skip client-side quota guard.
  return;
  /* eslint-disable-next-line no-unreachable */
  /* ORIGINAL: try { const stored = quotaRead(); if (!stored) return; const parsed = JSON.parse(stored); if (Date.now() < parsed.nextResetMs) throw new RateLimitError(...); quotaClear(); } catch (e) { if (e instanceof RateLimitError) throw e; } */
}

export function markDailyQuotaExhausted(): void {
  try {
    const nextResetMs = getNextPacificMidnightMs();
    quotaWrite(JSON.stringify({ exhaustedAt: new Date().toISOString(), nextResetMs }), nextResetMs);
    scheduleQuotaNotification(nextResetMs);
  } catch { /* ignore write errors */ }
}

export function scheduleQuotaNotification(nextResetMs: number): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const delay = nextResetMs - Date.now();
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
  setTimeout(() => {
    new Notification('AI Квотата е обновена!', {
      body: 'Gemini AI е повторно достапен. Можете да генерирате материјали.',
      icon: '/icons/icon-192.png',
      tag: 'quota-reset',
    });
  }, delay);
}

export function isDailyQuotaKnownExhausted(): boolean {
  try {
    const stored = quotaRead();
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    return Date.now() < (parsed.nextResetMs ?? 0);
  } catch { return false; }
}

export function clearDailyQuotaFlag(): void {
  quotaClear();
}

export function getQuotaDiagnostics(): {
  source: 'cookie' | 'localStorage' | 'none';
  exhaustedAt?: string;
  nextResetMs?: number;
  nextResetISO?: string;
  isCurrentlyExhausted: boolean;
} {
  let raw: string | null = null;
  let source: 'cookie' | 'localStorage' | 'none' = 'none';
  try {
    const match = document.cookie.split('; ').find(r => r.startsWith('ai_quota='));
    if (match) { raw = decodeURIComponent(match.slice('ai_quota='.length)); source = 'cookie'; }
  } catch { /* ignore */ }
  if (!raw) {
    try { const ls = localStorage.getItem(DAILY_QUOTA_KEY); if (ls) { raw = ls; source = 'localStorage'; } } catch { /* ignore */ }
  }
  if (!raw) return { source: 'none', isCurrentlyExhausted: false };
  try {
    const parsed = JSON.parse(raw);
    const nextResetMs: number = parsed.nextResetMs ?? 0;
    return { source, exhaustedAt: parsed.exhaustedAt, nextResetMs, nextResetISO: nextResetMs ? new Date(nextResetMs).toISOString() : undefined, isCurrentlyExhausted: Date.now() < nextResetMs };
  } catch {
    return { source, isCurrentlyExhausted: false };
  }
}
