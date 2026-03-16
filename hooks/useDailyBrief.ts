import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';

export interface DailyBriefAction {
  label: string;
  conceptId?: string;
  conceptTitle?: string;
}

export interface DailyBrief {
  summary: string;
  priority: 'high' | 'medium' | 'low';
  primaryAction?: DailyBriefAction;
}

interface CacheEntry {
  brief: DailyBrief;
  generatedAt: number;
}

const CACHE_KEY = 'daily_brief_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

/** Concepts that are SM-2 due for review based on last quiz date + avg score */
export interface DueForReviewConcept {
  conceptId?: string;
  title: string;
  avg: number;
  lastQuizDate: Date;
  daysOverdue: number;
}

/** Simple SM-2-like interval (days) based on avg score */
function reviewInterval(avg: number): number {
  if (avg >= 90) return 14;
  if (avg >= 75) return 7;
  if (avg >= 60) return 3;
  return 1;
}

function aggregateResults(results: Awaited<ReturnType<typeof firestoreService.fetchQuizResults>>) {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const recent = results.filter(r => {
    const ms = r.playedAt?.toMillis() ?? 0;
    return ms > cutoff;
  });

  if (recent.length === 0) return null;

  // Group by concept
  const byConcept: Record<string, { sum: number; count: number; title: string; conceptId?: string }> = {};
  recent.forEach(r => {
    const key = r.conceptId ?? r.quizTitle;
    if (!byConcept[key]) byConcept[key] = { sum: 0, count: 0, title: r.quizTitle, conceptId: r.conceptId };
    byConcept[key].sum += r.percentage;
    byConcept[key].count++;
  });

  const weakConcepts = Object.entries(byConcept)
    .map(([, d]) => ({ conceptId: d.conceptId, title: d.title, avg: Math.round(d.sum / d.count), count: d.count }))
    .filter(c => c.avg < 70)
    .sort((a, b) => a.avg - b.avg);

  // Students with avg < 50%
  const byStudent: Record<string, { sum: number; count: number }> = {};
  recent.forEach(r => {
    if (!r.studentName) return;
    if (!byStudent[r.studentName]) byStudent[r.studentName] = { sum: 0, count: 0 };
    byStudent[r.studentName].sum += r.percentage;
    byStudent[r.studentName].count++;
  });
  const strugglingCount = Object.values(byStudent).filter(d => d.sum / d.count < 50).length;

  return { totalQuizzes: recent.length, weakConcepts, strugglingCount };
}

function computeSpacedRepDue(
  results: Awaited<ReturnType<typeof firestoreService.fetchQuizResults>>,
): DueForReviewConcept[] {
  const now = Date.now();
  // Group ALL results by concept, track latest quiz date + running avg
  const map: Record<string, { sum: number; count: number; title: string; conceptId?: string; lastMs: number }> = {};
  results.forEach(r => {
    const key = r.conceptId ?? r.quizTitle;
    const ms = r.playedAt?.toMillis() ?? 0;
    if (!map[key]) map[key] = { sum: 0, count: 0, title: r.quizTitle, conceptId: r.conceptId, lastMs: 0 };
    map[key].sum += r.percentage;
    map[key].count++;
    if (ms > map[key].lastMs) map[key].lastMs = ms;
  });

  const due: DueForReviewConcept[] = [];
  for (const d of Object.values(map)) {
    if (!d.lastMs) continue;
    const avg = Math.round(d.sum / d.count);
    const intervalMs = reviewInterval(avg) * 24 * 60 * 60 * 1000;
    const dueAt = d.lastMs + intervalMs;
    const daysOverdue = Math.round((now - dueAt) / (1000 * 60 * 60 * 24));
    if (daysOverdue >= 0) {
      due.push({ conceptId: d.conceptId, title: d.title, avg, lastQuizDate: new Date(d.lastMs), daysOverdue });
    }
  }

  // Most overdue first
  return due.sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 5);
}

export interface WeakConcept {
  conceptId?: string;
  title: string;
  avg: number;
  count: number;
}

export function useDailyBrief() {
  const { firebaseUser } = useAuth();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [weakConcepts, setWeakConcepts] = useState<WeakConcept[]>([]);
  const [spacedRepDue, setSpacedRepDue] = useState<DueForReviewConcept[]>([]);
  const isLoadingRef = useRef(false); // Prevent concurrent executions

  const load = useCallback(async (forceRefresh = false) => {
    if (!firebaseUser) return;
    if (isLoadingRef.current) return; // Already in-flight — skip duplicate call

    // Check cache
    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const entry: CacheEntry = JSON.parse(raw);
          if (Date.now() - entry.generatedAt < CACHE_TTL_MS) {
            setBrief(entry.brief);
            return;
          }
        }
      } catch { /* ignore */ }
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const results = await firestoreService.fetchQuizResults(150, firebaseUser.uid);
      const stats = aggregateResults(results);
      if (!stats) return; // No recent data — skip brief

      // Expose weak concepts for formative loop (no AI credits needed)
      setWeakConcepts(stats.weakConcepts);

      // Compute SM-2 due-for-review from full dataset
      setSpacedRepDue(computeSpacedRepDue(results));

      if (isDailyQuotaKnownExhausted()) return;

      const generated = await geminiService.generateDailyBrief(stats);
      setBrief(generated);

      const entry: CacheEntry = { brief: generated, generatedAt: Date.now() };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(entry)); } catch { /* storage full */ }
    } catch {
      // Non-fatal — brief is a nice-to-have feature
    } finally {
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
    setBrief(null);
    setWeakConcepts([]);
    setSpacedRepDue([]);
    load(true);
  }, [load]);

  return { brief, isLoading, refresh, weakConcepts, spacedRepDue };
}
