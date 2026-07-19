/**
 * MaturaPracticeView — M3 (Адаптивна практика по тема)
 *
 * Фази:
 *   setup    → избери теми, јазик, дел, DoK, број прашања, shuffle
 *   practice → едно прашање на екран, автоматска/AI/self-assess оценка
 *   results  → детален резултат по тема + DoK, препораки, "Повтори грешки"
 *
 * Оценување (идентично со M2):
 *   Part 1 MC   → автоматска оценка при клик
 *   Part 2 open → Gemini AI (А+Б)
 *   Part 3 open → self-assess чекбокси + опционален AI опис
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useMaturaExams, useMaturaQuestions } from '../hooks/useMatura';
import { useMaturaMissions } from '../hooks/useMaturaMissions';
import { maturaService } from '../services/firestoreService.matura';
import type { MaturaQuestion, MaturaExamMeta } from '../services/firestoreService.matura';
import {
  type PracticeItem,
  type QuestionState,
  type Phase,
  type SetupConfig,
  type RecoveryPrefill,
  examDisplayLabel,
  isOpen,
  shuffle,
} from './maturaPractice/maturaPracticeHelpers';
import { addBreadcrumb } from '../services/sentryService';
import { ProgressBar } from './maturaPractice/MaturaPracticeUI';
import { SetupScreen } from './maturaPractice/MaturaPracticeSetupScreen';
import { QuestionCard } from './maturaPractice/MaturaPracticeQuestionCard';
import { ResultsScreen } from './maturaPractice/MaturaPracticeResultsScreen';




// ─── Main View ────────────────────────────────────────────────────────────────
export function MaturaPracticeView() {
  const [phase, setPhase]     = useState<Phase>('setup');
  const [queue, setQueue]     = useState<PracticeItem[]>([]);
  const [current, setCurrent] = useState(0);
  const [states, setStates]   = useState<QuestionState[]>([]);
  const [recoveryPrefill, setRecoveryPrefill] = useState<RecoveryPrefill | null>(() => {
    try {
      const raw = sessionStorage.getItem('matura_recovery_prefill');
      return raw ? (JSON.parse(raw) as RecoveryPrefill) : null;
    } catch {
      return null;
    }
  });

  const [assignmentTitle, setAssignmentTitle] = useState<string | null>(null);

  // Assignment launch: skip setup, load specific questions by doc IDs
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('matura_assignment_launch');
      if (!raw) return;
      sessionStorage.removeItem('matura_assignment_launch');
      const { title, questionDocIds } = JSON.parse(raw) as { title: string; questionDocIds: string[] };
      if (!questionDocIds?.length) return;
      setAssignmentTitle(title);
      maturaService.getQuestionsByDocIds(questionDocIds).then(questions => {
        const items: PracticeItem[] = questions.map(q => ({ ...q, examLabel: title }));
        setQueue(items);
        setCurrent(0);
        setStates(items.map(() => ({ submitted: false })));
        setPhase('practice');
      }).catch(() => { /* fallback to setup if fetch fails */ });
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { completeDay } = useMaturaMissions();

  // ── Offline detection — shows banner when data is served from IndexedDB ──
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' && !navigator.onLine,
  );
  useEffect(() => {
    const onOnline  = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Firestore: exam list (needed by setup screen) ──
  const { exams, loading: examsLoading, error: examsError } = useMaturaExams();

  // ── Firestore: questions for selected exams (loaded when practice starts) ──
  const [activeExamIds, setActiveExamIds] = useState<string[]>([]);
  const { questions: firestoreQuestions, loading: qLoading } = useMaturaQuestions(activeExamIds, undefined, activeExamIds.length > 0);

  // Unique topics across ALL loaded exams (for setup screen chips)
  const allTopics = useMemo<string[]>(() => {
    const set = new Set<string>();
    firestoreQuestions.forEach(q => { if (q.topicArea) set.add(q.topicArea); });
    // Also use topics from the exam list while questions aren't loaded yet
    if (!firestoreQuestions.length) {
      // Best-effort from known topic areas
      ['algebra','analiza','geometrija','trigonometrija','matrici-vektori','broevi'].forEach(t => set.add(t));
    }
    return [...set].sort();
  }, [firestoreQuestions]);

  // ── SetupConfig holds which exams the user picked ──
  // buildQueue is called after questions are already fetched
  const buildQueueFromFirestore = useCallback((
    questions: MaturaQuestion[],
    cfg: SetupConfig,
    examMap: Map<string, MaturaExamMeta>,
  ): PracticeItem[] => {
    let items: PracticeItem[] = questions
      .filter(q => {
        const exam = examMap.get(q.examId);
        if (!exam) return false;
        if (!cfg.langs.includes(exam.language as 'mk'|'al')) return false;
        if (!cfg.sessions.includes(exam.session as 'june'|'august')) return false;
        if (cfg.topics.length && !cfg.topics.includes(q.topicArea ?? '')) return false;
        if (cfg.parts.length && !cfg.parts.includes(q.part)) return false;
        if (cfg.dokLevels.length && !cfg.dokLevels.includes(q.dokLevel ?? 1)) return false;
        return true;
      })
      .map(q => ({ ...q, examLabel: examDisplayLabel(examMap.get(q.examId)!) }));

    if (cfg.doShuffle) items = shuffle(items);
    return items.slice(0, cfg.maxQ);
  }, []);

  // Called when user clicks "Започни" in SetupScreen
  const handleStart = useCallback((cfg: SetupConfig) => {
    // Determine which exam IDs match the config
    const ids = exams
      .filter(e => cfg.langs.includes(e.language as 'mk'|'al') && cfg.sessions.includes(e.session as 'june'|'august'))
      .map(e => e.id);
    setActiveExamIds(ids);
    // Store cfg for when questions arrive — handled in effect below
    setPendingCfg(cfg);
    setRecoveryPrefill(null);
    try { sessionStorage.removeItem('matura_recovery_prefill'); } catch { /* ignore */ }
  }, [exams]);

  // Pending cfg: applied once questions finish loading
  const [pendingCfg, setPendingCfg] = useState<SetupConfig | null>(null);

  // When firestoreQuestions updates and we have a pending config → build queue → start
  const prevQKey = React.useRef('');
  React.useEffect(() => {
    if (!pendingCfg || qLoading || !firestoreQuestions.length) return;
    const key = activeExamIds.slice().sort().join(',');
    if (key === prevQKey.current) return;
    prevQKey.current = key;

    const examMap = new Map(exams.map(e => [e.id, e]));
    const q = buildQueueFromFirestore(firestoreQuestions, pendingCfg, examMap);
    setQueue(q);
    setCurrent(0);
    setStates(q.map(() => ({ submitted: false })));
    setPendingCfg(null);
    setPhase('practice');
    addBreadcrumb('matura.practice', 'session_started', {
      questionCount: q.length,
      topics: pendingCfg?.topics ?? [],
      dokLevels: pendingCfg?.dokLevels ?? [],
    });
  }, [firestoreQuestions, qLoading, pendingCfg, activeExamIds, exams, buildQueueFromFirestore]);

  const handleRetryWrong = useCallback((wrongItems: PracticeItem[]) => {
    const shuffled = shuffle(wrongItems);
    setQueue(shuffled);
    setCurrent(0);
    setStates(shuffled.map(() => ({ submitted: false })));
    setPhase('practice');
  }, []);

  const updateState = useCallback((idx: number, patch: Partial<QuestionState>) => {
    setStates(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const { runningScore, runningMax } = useMemo(() => {
    let scored = 0, max = 0;
    states.slice(0, current).forEach((s, i) => {
      const item = queue[i];
      // Officially voided questions carry no correct answer and are excluded from both
      // the numerator and denominator — they're not part of the scored exam at all.
      if (!item || item.voided) return;
      max += item.points;
      if (!isOpen(item) && s.submitted && s.mcPick === item.correctAnswer?.trim()) scored += 1;
      else if (item.part === 2 && s.aiGrade) scored += s.aiGrade.score;
      else if (item.part === 3) scored += s.aiGradeP3 ? s.aiGradeP3.score : (s.selfChecks ?? []).filter(Boolean).length;
    });
    return { runningScore: scored, runningMax: max };
  }, [states, current, queue]);

  const currentState = states[current];
  const currentItem  = queue[current];
  const canNext      = currentState?.submitted || currentState?.skipped;
  const isLast       = current === queue.length - 1;

  // Save concept-level practice delta to localStorage for M5 delta tracking
  const saveConceptProgress = useCallback(() => {
    if (!recoveryPrefill?.sourceConceptId) return;
    const topicArea = recoveryPrefill.topicArea ?? null;

    let scored = 0;
    let max = 0;
    let matched = 0;

    queue.forEach((item, i) => {
      const s = states[i];
      if (item.voided) return;
      if (topicArea && item.topicArea !== topicArea) return;
      matched++;
      if (!isOpen(item)) {
        max += 1;
        if (s.submitted && s.mcPick === item.correctAnswer?.trim()) scored += 1;
      } else if (item.part === 2 && s.aiGrade) {
        max += s.aiGrade.maxScore;
        scored += s.aiGrade.score;
      } else if (item.part === 3) {
        max += item.points;
        scored += s.aiGradeP3 ? s.aiGradeP3.score : (s.selfChecks ?? []).filter(Boolean).length;
      } else {
        max += item.points;
      }
    });

    // Fallback to overall session score if no topic-specific questions matched
    if (matched === 0) {
      queue.forEach((item, i) => {
        const s = states[i];
        if (item.voided) return;
        if (!isOpen(item)) {
          max += 1;
          if (s.submitted && s.mcPick === item.correctAnswer?.trim()) scored += 1;
        } else if (item.part === 2 && s.aiGrade) {
          max += s.aiGrade.maxScore;
          scored += s.aiGrade.score;
        } else if (item.part === 3) {
          max += item.points;
          scored += s.aiGradeP3 ? s.aiGradeP3.score : (s.selfChecks ?? []).filter(Boolean).length;
        } else {
          max += item.points;
        }
      });
    }

    const pctAfter = max > 0 ? Math.round((scored / max) * 1000) / 10 : 0;

    try {
      const snapshotRaw = localStorage.getItem(`matura_concept_snap_${recoveryPrefill.sourceConceptId}`);
      const pctBefore: number | null = snapshotRaw
        ? ((JSON.parse(snapshotRaw) as { pctBefore: number }).pctBefore ?? null)
        : null;

      const entry = {
        conceptId: recoveryPrefill.sourceConceptId,
        topicArea,
        pctBefore,
        pctAfter,
        practiceAt: new Date().toISOString(),
      };

      const existing: typeof entry[] = (() => {
        try {
          const raw = localStorage.getItem('matura_concept_progress');
          return raw ? (JSON.parse(raw) as typeof entry[]) : [];
        } catch { return []; }
      })();

      const updated = [
        ...existing.filter((e) => e.conceptId !== entry.conceptId),
        entry,
      ].slice(-50);
      localStorage.setItem('matura_concept_progress', JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }

    // Mark mission day as completed if this practice was started from a mission plan
    if (recoveryPrefill.missionDay !== undefined) {
      void completeDay(recoveryPrefill.missionDay, pctAfter);
    }
  }, [recoveryPrefill, queue, states, completeDay]);

  const handleNext = useCallback(() => {
    if (isLast) {
      saveConceptProgress();
      setPhase('results');
      addBreadcrumb('matura.practice', 'session_finished', {
        questionCount: queue.length, score: runningScore, maxScore: runningMax,
      });
      return;
    }
    setCurrent(c => c + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isLast, saveConceptProgress, queue.length, runningScore, runningMax]);

  const handleSkip = useCallback(() => {
    updateState(current, { skipped: true, submitted: false });
    if (isLast) {
      saveConceptProgress();
      setPhase('results');
      addBreadcrumb('matura.practice', 'session_finished', {
        questionCount: queue.length, score: runningScore, maxScore: runningMax,
      });
      return;
    }
    setCurrent(c => c + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current, isLast, updateState, saveConceptProgress, queue.length, runningScore, runningMax]);

  // S37-D3: Keyboard-first nav — →/Enter = next, ← = back to previous
  useEffect(() => {
    if (phase !== 'practice') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'BUTTON') return;
      if ((e.key === 'ArrowRight' || e.key === 'Enter') && canNext) {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' && current > 0) {
        e.preventDefault();
        setCurrent(c => c - 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, canNext, current, handleNext]);

  // Loading overlay while fetching questions after "Започни"
  if (pendingCfg && (qLoading || !firestoreQuestions.length)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-brand-primary border-t-transparent animate-spin" />
        <p className="text-gray-500 font-medium">Се вчитуваат прашањата…</p>
      </div>
    );
  }

  const offlineBanner = isOffline ? (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-4 py-2 mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium"
    >
      <span className="text-base">📶</span>
      <span>Офлајн режим — прашањата се вчитуваат од локален кеш</span>
    </div>
  ) : null;

  // ── Render ──
  if (phase === 'setup') {
    return (
      <>
        {offlineBanner}
        <SetupScreen
          allTopics={allTopics}
          exams={exams}
          examsLoading={examsLoading}
          examsError={examsError}
          onStart={handleStart}
          prefill={recoveryPrefill}
          onDismissPrefill={() => {
            setRecoveryPrefill(null);
            try { sessionStorage.removeItem('matura_recovery_prefill'); } catch { /* ignore */ }
          }}
        />
      </>
    );
  }

  if (phase === 'results') {
    return (
      <>
        {offlineBanner}
        <ResultsScreen
          items={queue}
          states={states}
          onRetryWrong={handleRetryWrong}
          onNewSession={() => setPhase('setup')}
        />
      </>
    );
  }

  // practice
  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {offlineBanner}
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-black text-brand-primary flex-1">
          {assignmentTitle ? (
            <><span className="text-indigo-600">📋</span> {assignmentTitle}</>
          ) : 'Адаптивна практика'}
        </h2>
        <button
          type="button"
          onClick={() => setPhase('results')}
          className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
        >
          Заврши
        </button>
      </div>

      <ProgressBar current={current} total={queue.length} score={runningScore} maxScore={runningMax} />

      {currentItem && currentState && (
        <QuestionCard
          item={currentItem}
          idx={current}
          total={queue.length}
          state={currentState}
          onUpdate={patch => updateState(current, patch)}
        />
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3 mt-4">
        <button
          type="button"
          onClick={handleSkip}
          className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Прескокни
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={handleNext}
          className={`flex-1 py-2.5 rounded-xl text-sm font-black transition-all ${
            canNext
              ? 'bg-brand-primary text-white shadow hover:-translate-y-0.5'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLast ? 'Заврши и види резултати →' : 'Следно прашање →'}
        </button>
      </div>

      {/* Hint: submit first */}
      {!canNext && (
        <p className="text-center text-xs text-gray-400 mt-2">
          {isOpen(currentItem) ? 'Провери го одговорот за да продолжиш' : 'Избери одговор за да продолжиш'}
        </p>
      )}
      {/* Keyboard nav hint */}
      <p className="text-center text-[11px] text-gray-300 mt-3 hidden sm:block">
        ▲▼ избор &nbsp;·&nbsp; А Б В Г / 1-4 директно &nbsp;·&nbsp; Enter потврди &nbsp;·&nbsp; ← назад / → следно
      </p>
    </div>
  );
}
