import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { AlertCircle, X, MapPin } from 'lucide-react';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { detectCurriculumGaps } from '../../utils/curriculumGapDetector';
import { isDailyQuotaKnownExhausted } from '../../services/geminiService';
import type { AIGeneratedAnnualPlan } from '../../types';

const DISMISS_KEY = 'curriculum_gap_banner_dismissed_until';
const RECHECK_DAYS = 90; // roughly one MK school term ("оваа четвртина")
const COVERAGE_THRESHOLD_PCT = 70;

function isDismissed(): boolean {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    return !!until && Date.now() < Number(until);
  } catch {
    return false;
  }
}

function dismissForNow(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + RECHECK_DAYS * 86400_000));
  } catch { /* incognito */ }
}

/**
 * Turns detectCurriculumGaps() from a passive dashboard panel (PlanAnalyticsDashboard)
 * into a proactive nudge — checks the teacher's most recent annual plan against БРО
 * standards coverage on load, instead of relying on the teacher to remember to open
 * that panel. Dismissing snoozes the check for ~a school term, not just the session.
 */
export const CurriculumGapBanner: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [gapExample, setGapExample] = useState<{ code: string; description: string; count: number } | null>(null);

  useEffect(() => {
    if (!firebaseUser?.uid || isDismissed()) return;
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'academic_annual_plans'),
          where('userId', '==', firebaseUser.uid),
          orderBy('createdAt', 'desc'),
          limit(1),
        ));
        if (cancelled || snap.empty) return;

        const data = snap.docs[0].data() as { grade?: string; planData?: AIGeneratedAnnualPlan };
        const plan = data.planData;
        if (!plan?.topics?.length) return;

        const gradeMatch = (data.grade ?? '').match(/\d+/);
        const gradeLevel = gradeMatch ? parseInt(gradeMatch[0], 10) : NaN;
        if (!gradeLevel || gradeLevel > 9) return; // standards only defined for primary grades

        const { uncovered, coveragePct } = detectCurriculumGaps(plan.topics.map(t => t.title), gradeLevel);
        if (cancelled || coveragePct >= COVERAGE_THRESHOLD_PCT || uncovered.length === 0) return;

        setGapExample({ code: uncovered[0].code, description: uncovered[0].description, count: uncovered.length });
      } catch {
        // non-fatal — banner just doesn't show
      }
    })();

    return () => { cancelled = true; };
  }, [firebaseUser?.uid]);

  // OfflineBanner/QuotaBanner claim the same fixed bottom-bar position with no
  // stacking logic between them — defer to the quota banner when both would be
  // true, since an active usage block is more actionable right now than a
  // longer-term curriculum-coverage nudge.
  if (!gapExample || isDailyQuotaKnownExhausted()) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-md animate-fade-in-up fixed bottom-0 left-0 right-0 z-50 md:left-64">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>
        Забележавме дека годишниот план не покрива {gapExample.count} стандарди — на пр. <strong>{gapExample.code}</strong> ({gapExample.description.slice(0, 60)}{gapExample.description.length > 60 ? '…' : ''}).
      </span>
      <a
        href="#/standards-coverage"
        className="ml-2 flex-shrink-0 text-xs font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
      >
        <MapPin className="w-3 h-3" /> Прегледај покриеност
      </a>
      <button
        type="button"
        onClick={() => { dismissForNow(); setGapExample(null); }}
        className="ml-auto flex-shrink-0 hover:opacity-75 transition"
        aria-label="Затвори"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
