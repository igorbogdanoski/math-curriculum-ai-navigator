/**
 * MaturaSimulationView — M4 (Симулација на целосен ДИМ испит)
 *
 * Фази:
 *   select   → избери испит (Firestore, lazy loaded)
 *   exam     → полагај (тајмер 180мин, навигација, MC + Part2 + Part3)
 *   grading  → автоматско + AI оценување (со Firestore кеш)
 *   results  → резултати по дел + теми + AI анализа
 *
 * Оценување:
 *   Part 1 MC   → автоматска (споредба со correctAnswer)
 *   Part 2 open → Gemini AI (А+Б), со Firestore кеш
 *   Part 3 open → Gemini AI (опис), со Firestore кеш
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  GraduationCap, Clock, ChevronLeft, ChevronRight, CheckCircle2,
  XCircle, BarChart2, BookOpen, Sparkles, AlertTriangle, Trophy,
  RotateCcw, Loader2, Play, List, Grid3x3, PenLine, FileText,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { MathRenderer } from '../components/common/MathRenderer';
import { DokBadge } from '../components/common/DokBadge';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';
import { callGeminiProxy } from '../services/gemini/core';
import { useMaturaExams, useMaturaQuestions } from '../hooks/useMatura';
import {
  buildGradeCacheKey,
  getCachedAIGrade,
  saveUserMaturaResult,
  saveAIGrade,
} from '../services/firestoreService.matura';
import type { MaturaQuestion, MaturaExamMeta } from '../services/firestoreService.matura';

// ─── Constants ────────────────────────────────────────────────────────────────

const CHOICES = ['А', 'Б', 'В', 'Г'] as const;
const CHOICE_COLORS: Record<string, string> = {
  А: 'from-blue-500 to-blue-600',
  Б: 'from-violet-500 to-violet-600',
  В: 'from-amber-500 to-amber-600',
  Г: 'from-rose-500 to-rose-600',
};
const CHOICE_LIGHT: Record<string, string> = {
  А: 'border-blue-300 bg-blue-50 text-blue-800',
  Б: 'border-violet-300 bg-violet-50 text-violet-800',
  В: 'border-amber-300 bg-amber-50 text-amber-800',
  Г: 'border-rose-300 bg-rose-50 text-rose-800',
};
const GRADE_THRESHOLDS = [
  { min: 90, label: '5 — Одличен',          color: 'text-emerald-600' },
  { min: 75, label: '4 — Многу добар',       color: 'text-blue-600'   },
  { min: 55, label: '3 — Добар',             color: 'text-amber-600'  },
  { min: 40, label: '2 — Доволен',           color: 'text-orange-600' },
  { min: 0,  label: '1 — Незадоволителен',   color: 'text-red-600'    },
];
const SESSION_LABELS: Record<string, string> = {
  june:   'Јунска',
  august: 'Августовска',
  march:  'Мартовска',
};
const SESSION_ORDER = ['june', 'august', 'march'];
const LANG_ORDER    = ['mk', 'al', 'tr'];
const LANG_FLAGS: Record<string, string> = { mk: 'МК', al: 'АЛ', tr: 'ТР' };
const TRACK_LABELS: Record<string, string> = {
  'gymnasium':           'Гимназиско образование',
  'vocational-it':       'Средно стручно — Информатика',
  'vocational-economics':'Средно стручно — Економија',
  'vocational-electro':  'Средно стручно — Електротехника',
  'vocational-mechanical':'Средно стручно — Машинство',
  'vocational-health':   'Средно стручно — Здравство',
  'vocational-civil':    'Средно стручно — Градежништво',
};
const TRACK_ORDER = [
  'gymnasium',
  'vocational-it','vocational-economics','vocational-electro',
  'vocational-mechanical','vocational-health','vocational-civil',
];
const TRACK_ACCENT: Record<string, { pill: string; header: string }> = {
  'gymnasium':            { pill: 'bg-indigo-100 text-indigo-800', header: 'text-indigo-700' },
  'vocational-it':        { pill: 'bg-teal-100 text-teal-800',     header: 'text-teal-700'   },
  'vocational-economics': { pill: 'bg-amber-100 text-amber-800',   header: 'text-amber-700'  },
  'vocational-electro':   { pill: 'bg-blue-100 text-blue-800',     header: 'text-blue-700'   },
  'vocational-mechanical':{ pill: 'bg-slate-100 text-slate-800',   header: 'text-slate-700'  },
  'vocational-health':    { pill: 'bg-rose-100 text-rose-800',     header: 'text-rose-700'   },
  'vocational-civil':     { pill: 'bg-orange-100 text-orange-800', header: 'text-orange-700' },
};
const DURATION_SECONDS = 180 * 60; // 3 hours

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'select' | 'exam' | 'grading' | 'results';

interface SimAnswers {
  mc:  Record<number, string>;
  p2a: Record<number, string>;
  p2b: Record<number, string>;
  p3:  Record<number, string>;
}

interface QGrade {
  score:     number;
  maxPoints: number;
  correct?:  boolean;
  feedback?: string;
}

interface SimResult {
  examId:          string;
  examTitle:       string;
  answers:         SimAnswers;
  grades:          Record<number, QGrade>;
  totalScore:      number;
  maxScore:        number;
  durationSeconds: number;
  completedAt:     string;
}

interface AIGrade {
  score:     number;
  maxScore:  number;
  feedback:  string;
  partA?:    boolean;
  partB?:    boolean;
  commentA?: string;
  commentB?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function gradeFromPercent(pct: number) {
  return GRADE_THRESHOLDS.find(g => pct >= g.min)!;
}

function examLabel(e: MaturaExamMeta): string {
  const sess = SESSION_LABELS[e.session] ?? e.session;
  const lang = LANG_FLAGS[e.language] ?? e.language.toUpperCase();
  return e.title || `Матура ${e.year} — ${sess} — ${lang}`;
}

function hasAnswer(q: MaturaQuestion, a: SimAnswers): boolean {
  if (q.part === 1) return Boolean(a.mc[q.questionNumber]);
  if (q.part === 2) return Boolean(a.p2a[q.questionNumber] || a.p2b[q.questionNumber]);
  return Boolean(a.p3[q.questionNumber]);
}

function safeParseJSON(text: string): Record<string, unknown> | null {
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

function progressKey(examId: string): string { return `matura_sim_progress_${examId}`; }
function resultKey(examId: string): string    { return `matura_sim_result_${examId}`; }

// ─── AI grading (with Firestore cache) ───────────────────────────────────────

const DEFAULT_MODEL = 'gemini-2.5-flash';

async function gradePart2(q: MaturaQuestion, answerA: string, answerB: string): Promise<AIGrade> {
  const cacheInput = `${answerA}|||${answerB}`;
  const cacheKey   = buildGradeCacheKey(q.examId, q.questionNumber, cacheInput);
  const cached     = await getCachedAIGrade(cacheKey);
  if (cached) {
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const prompt = `Ти си асистент за оценување матура на македонски јазик.
Задача Q${q.questionNumber}: ${q.questionText}
Точен одговор: ${q.correctAnswer}
Одговор на ученикот: А. ${answerA||'(нема)'} | Б. ${answerB||'(нема)'}
Оцени ги двата дела. Секој дел вреди 1 поен.
Врати САМО валиден JSON: {"score":0,"partA":false,"partB":false,"commentA":"...","commentB":"...","feedback":"..."}
- Споредувај математичко значење, не буквален текст. score = 0, 1 или 2.`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const p = safeParseJSON(resp.text);
  if (!p) throw new Error('Parse error');
  const grade: AIGrade = {
    score: Number(p.score ?? 0), maxScore: 2, feedback: String(p.feedback ?? ''),
    partA: Boolean(p.partA), partB: Boolean(p.partB),
    commentA: String(p.commentA ?? ''), commentB: String(p.commentB ?? ''),
  };
  saveAIGrade(cacheKey, {
    examId: q.examId, questionNumber: q.questionNumber,
    inputHash: cacheKey, score: grade.score, maxPoints: 2, feedback: grade.feedback,
  });
  return grade;
}

async function gradePart3(q: MaturaQuestion, desc: string): Promise<AIGrade> {
  const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, desc);
  const cached   = await getCachedAIGrade(cacheKey);
  if (cached) {
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const prompt = `Ти си асистент за оценување матура на македонски јазик.
Задача Q${q.questionNumber} (${q.points} поени): ${q.questionText}
Точен одговор: ${q.correctAnswer}
Опис на решението: ${desc||'(нема)'}
Врати САМО валиден JSON: {"score":0,"feedback":"коментар на македонски"}
- score: цел број 0..${q.points}. Биди праведен и охрабрувачки.`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const p = safeParseJSON(resp.text);
  if (!p) throw new Error('Parse error');
  const score    = Math.min(Number(p.score ?? 0), q.points);
  const feedback = String(p.feedback ?? '');
  saveAIGrade(cacheKey, {
    examId: q.examId, questionNumber: q.questionNumber,
    inputHash: cacheKey, score, maxPoints: q.points, feedback,
  });
  return { score, maxScore: q.points, feedback };
}

// ─── ExamCard ────────────────────────────────────────────────────────────────

const ExamCard: React.FC<{
  exam: MaturaExamMeta;
  pastResult: SimResult | null;
  onStart: () => void;
}> = ({ exam, pastResult, onStart }) => {
  const pct   = pastResult ? Math.round((pastResult.totalScore / pastResult.maxScore) * 100) : null;
  const grade = pct !== null ? gradeFromPercent(pct) : null;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:border-brand-primary hover:shadow-md transition-all">
      <div>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
          {SESSION_LABELS[exam.session] ?? exam.session} {exam.year} · {LANG_FLAGS[exam.language] ?? exam.language.toUpperCase()}
        </span>
        <h3 className="text-base font-black text-gray-800 mt-0.5">{examLabel(exam)}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {exam.questionCount} прашања · {DURATION_SECONDS / 60} мин · {exam.totalPoints} поени
        </p>
      </div>
      {grade && (
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
          <Trophy className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-700">
            Последен обид: <span className={grade.color}>{grade.label}</span>{' '}
            <span className="text-gray-400 font-normal">({pct}%)</span>
          </span>
        </div>
      )}
      <button type="button" onClick={onStart}
        className="mt-auto w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-primary to-blue-700 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition shadow-sm"
      >
        <Play className="w-4 h-4" />
        {grade ? 'Обиди се повторно' : 'Започни симулација'}
      </button>
    </div>
  );
};

// ─── Main View ────────────────────────────────────────────────────────────────

export const MaturaSimulationView: React.FC = () => {
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();
  const { firebaseUser } = useAuth();

  // ── Phase & exam selection ────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>('select');
  const [selectedExam, setSelectedExam] = useState<MaturaExamMeta | null>(null);
  const { exams, loading: examsLoading } = useMaturaExams();
  const { questions, loading: qLoading  } = useMaturaQuestions(
    selectedExam ? [selectedExam.id] : [],
    undefined,
    Boolean(selectedExam),
  );

  // ── Exam state ────────────────────────────────────────────────────────────
  const [answers,     setAnswers]     = useState<SimAnswers>({ mc: {}, p2a: {}, p2b: {}, p3: {} });
  const [currentIdx,  setCurrentIdx]  = useState(0);
  const [timeLeft,    setTimeLeft]    = useState(DURATION_SECONDS);
  const [viewMode,    setViewMode]    = useState<'single' | 'grid'>('single');
  const examStartRef                  = useRef<number>(0);

  // ── Grading state ─────────────────────────────────────────────────────────
  const [gradingProgress, setGradingProgress] = useState({ done: 0, total: 0 });

  // ── Results state ─────────────────────────────────────────────────────────
  const [result,       setResult]      = useState<SimResult | null>(null);
  const [aiAnalysis,   setAiAnalysis]  = useState('');
  const [aiLoading,    setAiLoading]   = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Past results from localStorage ───────────────────────────────────────
  const getPastResult = useCallback((examId: string): SimResult | null => {
    try {
      const raw = localStorage.getItem(resultKey(examId));
      return raw ? (JSON.parse(raw) as SimResult) : null;
    } catch { return null; }
  }, []);

  // ── Group exams by track → year → session → language ─────────────────────
  const examsByTrack = useMemo(() => {
    const trackMap = new Map<string, Map<number, Map<string, MaturaExamMeta[]>>>();
    for (const exam of exams) {
      const track = exam.track ?? 'gymnasium';
      if (!trackMap.has(track)) trackMap.set(track, new Map());
      const yearMap = trackMap.get(track)!;
      if (!yearMap.has(exam.year)) yearMap.set(exam.year, new Map());
      const sessMap = yearMap.get(exam.year)!;
      if (!sessMap.has(exam.session)) sessMap.set(exam.session, []);
      sessMap.get(exam.session)!.push(exam);
    }
    return Array.from(trackMap.entries())
      .sort(([a], [b]) => TRACK_ORDER.indexOf(a) - TRACK_ORDER.indexOf(b))
      .map(([track, yearMap]) => ({
        track,
        label: TRACK_LABELS[track] ?? track,
        accent: TRACK_ACCENT[track] ?? TRACK_ACCENT['gymnasium'],
        years: Array.from(yearMap.entries())
          .sort(([a], [b]) => b - a)
          .map(([year, sessMap]) => ({
            year,
            sessions: Array.from(sessMap.entries())
              .sort(([a], [b]) => SESSION_ORDER.indexOf(a) - SESSION_ORDER.indexOf(b))
              .map(([session, variants]) => ({
                session,
                variants: variants.sort(
                  (a, b) => LANG_ORDER.indexOf(a.language) - LANG_ORDER.indexOf(b.language)
                ),
              })),
          })),
      }));
  }, [exams]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // Auto-submit on timer expiry
  useEffect(() => {
    if (phase === 'exam' && timeLeft === 0) handleSubmit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, phase]);

  // ── Auto-save answers to localStorage ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'exam' || !selectedExam) return;
    localStorage.setItem(progressKey(selectedExam.id), JSON.stringify({
      examId: selectedExam.id, answers, timeLeft, savedAt: Date.now(),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  // ── Start exam ────────────────────────────────────────────────────────────
  const startExam = useCallback((exam: MaturaExamMeta) => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Check for saved progress (within 4 hours)
    let restoredAnswers: SimAnswers | null = null;
    let restoredTime: number | null = null;
    try {
      const saved = localStorage.getItem(progressKey(exam.id));
      if (saved) {
        const parsed = JSON.parse(saved) as { examId: string; answers: SimAnswers; timeLeft: number; savedAt: number };
        if (parsed.examId === exam.id && (Date.now() - parsed.savedAt) < 4 * 3600 * 1000) {
          if (window.confirm(`Најден е незавршен тест (${formatTime(parsed.timeLeft)} останато). Продолжи?`)) {
            restoredAnswers = parsed.answers;
            restoredTime    = parsed.timeLeft;
          }
        }
      }
    } catch { /* ignore */ }

    setSelectedExam(exam);
    setCurrentIdx(0);
    setAnswers(restoredAnswers ?? { mc: {}, p2a: {}, p2b: {}, p3: {} });
    setTimeLeft(restoredTime ?? DURATION_SECONDS);
    setViewMode('single');
    setResult(null);
    setAiAnalysis('');
    examStartRef.current = Date.now();
    setPhase('exam');
  }, []);

  // ── Submit → grade ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!selectedExam || phase === 'grading' || phase === 'results') return;
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.removeItem(progressKey(selectedExam.id));

    setPhase('grading');

    const openQs = questions.filter(q => q.part === 2 || q.part === 3);
    setGradingProgress({ done: 0, total: openQs.length });

    const grades: Record<number, QGrade> = {};

    // Part 1 — instant
    questions.filter(q => q.part === 1).forEach(q => {
      const userAns = answers.mc[q.questionNumber];
      const correct = (userAns ?? '').toUpperCase() === (q.correctAnswer ?? '').toUpperCase();
      grades[q.questionNumber] = { score: correct ? q.points : 0, maxPoints: q.points, correct };
    });

    // Part 2 + 3 — AI (cached)
    for (const q of openQs) {
      try {
        if (q.part === 2) {
          const g = await gradePart2(q, answers.p2a[q.questionNumber] ?? '', answers.p2b[q.questionNumber] ?? '');
          grades[q.questionNumber] = { score: g.score, maxPoints: g.maxScore, feedback: g.feedback };
        } else {
          const g = await gradePart3(q, answers.p3[q.questionNumber] ?? '');
          grades[q.questionNumber] = { score: g.score, maxPoints: g.maxScore, feedback: g.feedback };
        }
      } catch {
        grades[q.questionNumber] = { score: 0, maxPoints: q.points, feedback: 'Оценувањето не успеа.' };
      }
      setGradingProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    const totalScore = Object.values(grades).reduce((s, g) => s + g.score, 0);
    const maxScore   = questions.reduce((s, q) => s + q.points, 0);
    const durationSeconds = Math.round((Date.now() - examStartRef.current) / 1000);

    const simResult: SimResult = {
      examId: selectedExam.id,
      examTitle: examLabel(selectedExam),
      answers, grades, totalScore, maxScore, durationSeconds,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(resultKey(selectedExam.id), JSON.stringify(simResult));

    if (firebaseUser?.uid) {
      void saveUserMaturaResult(firebaseUser.uid, {
        examId: simResult.examId,
        examTitle: simResult.examTitle,
        grades: simResult.grades,
        totalScore: simResult.totalScore,
        maxScore: simResult.maxScore,
        durationSeconds: simResult.durationSeconds,
        completedAt: simResult.completedAt,
      });
    }

    setResult(simResult);
    setPhase('results');
  }, [selectedExam, phase, questions, answers, firebaseUser]);

  // ── AI analysis of results ────────────────────────────────────────────────
  const requestAiAnalysis = useCallback(async () => {
    if (!result || aiLoading) return;
    setAiLoading(true);
    try {
      const weakTopics = Object.entries(topicBreakdown)
        .filter(([, v]) => v.score < v.max * 0.5)
        .map(([t, v]) => `${t}: ${v.score}/${v.max}`)
        .join(', ');
      const pct = Math.round((result.totalScore / result.maxScore) * 100);
      const prompt = `Ученик полагаше симулација на матура по математика.
Резултат: ${result.totalScore}/${result.maxScore} поени (${pct}%).
Слаби теми: ${weakTopics || 'нема забележани'}.
Дај кратка, охрабрувачка анализа (3–4 реченици на македонски) со конкретни совети.`;
      const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
      });
      setAiAnalysis(resp.text);
    } catch {
      addNotification('AI анализата не е достапна моментално.', 'error');
    } finally {
      setAiLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, aiLoading]);

  // ── Topic breakdown ───────────────────────────────────────────────────────
  const topicBreakdown = useMemo(() => {
    if (!result) return {} as Record<string, { score: number; max: number }>;
    return questions.reduce((acc, q) => {
      const t = q.topicArea ?? q.topic ?? 'Друго';
      if (!acc[t]) acc[t] = { score: 0, max: 0 };
      acc[t].max   += q.points;
      acc[t].score += result.grades[q.questionNumber]?.score ?? 0;
      return acc;
    }, {} as Record<string, { score: number; max: number }>);
  }, [result, questions]);

  // ── Part breakdown ────────────────────────────────────────────────────────
  const partBreakdown = useMemo(() => {
    if (!result) return null;
    const parts = [1, 2, 3] as const;
    return parts.map(p => {
      const qs = questions.filter(q => q.part === p);
      const score = qs.reduce((s, q) => s + (result.grades[q.questionNumber]?.score ?? 0), 0);
      const max   = qs.reduce((s, q) => s + q.points, 0);
      return { part: p, score, max, count: qs.length };
    });
  }, [result, questions]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: SELECT
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'select') {
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Симулација на матура</h1>
            <p className="text-sm text-gray-500">ДИМ — Државна испитна матура · Математика · 180 минути</p>
          </div>
        </div>

        {examsLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : exams.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <GraduationCap className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-400">Нема достапни тестови</h3>
            <p className="text-sm text-gray-400 mt-2">Увезете ДИМ тестови за да започнете.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {examsByTrack.map(({ track, label, accent, years }) => (
              <div key={track}>
                {/* Track header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${accent.pill}`}>
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-400">
                    {years.reduce((t, y) => t + y.sessions.reduce((s, ses) => s + ses.variants.length, 0), 0)} верзии
                  </span>
                </div>

                {/* Years within this track */}
                <div className="space-y-4">
                  {years.map(({ year, sessions }) => (
                    <div key={year} className="space-y-1.5">
                      {/* Year sub-header */}
                      <div className="flex items-center gap-2 pl-1">
                        <span className={`text-xs font-black tracking-widest ${accent.header}`}>{year}</span>
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-xs text-slate-400">
                          {sessions.reduce((n: number, s: { variants: MaturaExamMeta[] }) => n + s.variants.length, 0)} верзии
                        </span>
                      </div>

                      {/* Session rows */}
                      {sessions.map(({ session, variants }: { session: string; variants: MaturaExamMeta[] }) => {
                        const meta = variants[0];
                        return (
                          <div key={session} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-4 hover:border-slate-300 transition-all">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-sm">{SESSION_LABELS[session] ?? session} сесија</p>
                              <p className="text-xs text-slate-400 mt-0.5">{meta.questionCount} пр. · {meta.totalPoints} поени · 180 мин</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {variants.map((exam: MaturaExamMeta) => {
                                const past  = getPastResult(exam.id);
                                const pct   = past ? Math.round((past.totalScore / past.maxScore) * 100) : null;
                                const grade = pct !== null ? gradeFromPercent(pct) : null;
                                return (
                                  <button
                                    key={exam.id}
                                    type="button"
                                    onClick={() => startExam(exam)}
                                    title={`Започни ${LANG_FLAGS[exam.language] ?? exam.language.toUpperCase()} верзија`}
                                    className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition group ${
                                      grade
                                        ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400'
                                        : 'border-slate-200 bg-white hover:border-brand-primary hover:bg-brand-primary/5'
                                    }`}
                                  >
                                    <span className={`text-xs font-black ${grade ? 'text-emerald-700' : 'text-slate-700 group-hover:text-brand-primary'}`}>
                                      {LANG_FLAGS[exam.language] ?? exam.language.toUpperCase()}
                                    </span>
                                    {pct !== null ? (
                                      <span className="text-[10px] font-bold text-emerald-600">{pct}%</span>
                                    ) : (
                                      <Play className="w-2.5 h-2.5 text-slate-400 group-hover:text-brand-primary" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-brand-primary text-sm">Совети за симулација</p>
              <ul className="mt-2 space-y-1 text-sm text-blue-800">
                <li>• Реши го тестот во тишина, без прекини — баш како вистински испит</li>
                <li>• Дел I: MC прашања (1 поен) · Дел II: кратки одговори (2 поени) · Дел III: задачи (3–5 поени)</li>
                <li>• По предавање, AI автоматски ги оценува отворените прашања</li>
                <li>• Напредокот се зачувува — ако го затвориш прелистувачот, можеш да продолжиш</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: EXAM (wait for questions)
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'exam' && qLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
        <p className="text-gray-500 font-semibold">Вчитување прашања…</p>
      </div>
    );
  }

  if (phase === 'exam' && selectedExam && questions.length > 0) {
    const q        = questions[currentIdx];
    const answered = questions.filter(qq => hasAnswer(qq, answers)).length;
    const total    = questions.length;
    const timerPct = (timeLeft / DURATION_SECONDS) * 100;
    const timerColor = timerPct > 30 ? 'bg-emerald-500' : timerPct > 10 ? 'bg-amber-500' : 'bg-red-500';

    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 sticky top-2 z-10">
          <div className="flex items-center gap-2">
            <button type="button"
              title="Откажи и врати се на избор на тест"
              aria-label="Откажи и врати се на избор на тест"
              onClick={() => { if (window.confirm('Ќе ги изгубиш неодговорените. Откажи?')) setPhase('select'); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <span className="font-bold text-gray-700 text-sm hidden sm:block truncate max-w-[180px]">
              {examLabel(selectedExam)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 font-semibold">{answered}/{total}</span>
            <div className="flex items-center gap-1.5">
              <Clock className={`w-4 h-4 ${timeLeft < 600 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
              <span className={`font-mono font-bold text-sm ${timeLeft < 600 ? 'text-red-600' : 'text-gray-700'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <button type="button" title={viewMode === 'single' ? 'Преглед' : 'Едно по едно'}
              onClick={() => setViewMode(v => v === 'single' ? 'grid' : 'single')}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              {viewMode === 'single' ? <Grid3x3 className="w-4 h-4 text-gray-500" /> : <List className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <progress
            className={`w-full h-full ${timerColor.includes('red') ? 'accent-red-500' : 'accent-emerald-500'}`}
            max={100}
            value={timerPct}
          />
        </div>

        {/* Low-time warning */}
        {timeLeft < 600 && timeLeft > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-700">Останати помалку од 10 минути!</p>
          </div>
        )}

        {viewMode === 'grid' ? (
          /* Grid overview */
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Преглед на прашања</p>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {questions.map((qq, i) => {
                const done = hasAnswer(qq, answers);
                return (
                  <button key={qq.questionNumber} type="button"
                    onClick={() => { setCurrentIdx(i); setViewMode('single'); }}
                    className={`aspect-square rounded-xl text-xs font-bold transition-all ${
                      i === currentIdx
                        ? 'bg-brand-primary text-white ring-2 ring-brand-primary ring-offset-1'
                        : done
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {qq.questionNumber}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 rounded" />Одговорено</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 rounded" />Не одговорено</span>
            </div>
          </div>
        ) : (
          /* Single question */
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-full">
                  Прашање {currentIdx + 1} / {total}
                </span>
                {q.topicArea && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{q.topicArea}</span>
                )}
                <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  Дел {q.part === 1 ? 'I' : q.part === 2 ? 'II' : 'III'}
                </span>
                {q.dokLevel && <DokBadge level={q.dokLevel as 1|2|3|4} size="compact" />}
              </div>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
                {q.points} {q.points === 1 ? 'поен' : 'поени'}
              </span>
            </div>

            {/* Question text */}
            <div className="text-base font-semibold text-gray-800 leading-relaxed">
              <MathRenderer text={q.questionText} />
            </div>

            {/* Images */}
            {q.imageUrls?.map((url, i) => (
              <img key={i} src={url} alt={q.imageDescription ?? `Слика ${i + 1}`}
                className="max-w-full rounded-xl border border-gray-200 shadow-sm" />
            ))}

            {/* Part 1 — MC choices */}
            {q.part === 1 && q.choices && Object.keys(q.choices).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CHOICES.map(choice => {
                  const text     = q.choices?.[choice];
                  if (!text) return null;
                  const selected = answers.mc[q.questionNumber] === choice;
                  return (
                    <button key={choice} type="button"
                      onClick={() => setAnswers(prev => ({ ...prev, mc: { ...prev.mc, [q.questionNumber]: choice } }))}
                      className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        selected
                          ? `border-transparent bg-gradient-to-r ${CHOICE_COLORS[choice]} text-white shadow-md scale-[1.02]`
                          : `${CHOICE_LIGHT[choice]} hover:scale-[1.01]`
                      }`}
                    >
                      <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${
                        selected ? 'bg-white/20' : 'bg-white/80'
                      }`}>{choice}</span>
                      <span className="text-sm font-medium"><MathRenderer text={text} /></span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Part 2 — два текстуални одговори */}
            {q.part === 2 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <PenLine className="w-3.5 h-3.5" /> Твои одговори
                </p>
                {['А', 'Б'].map(ltr => {
                  const key = ltr === 'А' ? 'p2a' : 'p2b';
                  return (
                    <div key={ltr}>
                      <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Дел {ltr}:</label>
                      <input
                        type="text"
                        value={answers[key][q.questionNumber] ?? ''}
                        onChange={e => setAnswers(prev => ({ ...prev, [key]: { ...prev[key], [q.questionNumber]: e.target.value } }))}
                        placeholder={`Одговор за дел ${ltr}…`}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Part 3 — опис на решение */}
            {q.part === 3 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Опис на твоето решение
                </p>
                <textarea
                  rows={4}
                  value={answers.p3[q.questionNumber] ?? ''}
                  onChange={e => setAnswers(prev => ({ ...prev, p3: { ...prev.p3, [q.questionNumber]: e.target.value } }))}
                  placeholder="Опишај ги чекорите на твоето решение. AI ќе го оцени математичкото размислување, не буквалниот текст."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
                />
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button type="button" disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(i => i - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Претходно
          </button>

          {currentIdx < total - 1 ? (
            <button type="button"
              onClick={() => setCurrentIdx(i => i + 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
            >
              Следно <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="button"
              onClick={() => {
                const unanswered = total - answered;
                const msg = unanswered > 0
                  ? `Има ${unanswered} неодговорени прашања. Предај?`
                  : 'Сигурен/на си дека сакаш да предадеш?';
                if (window.confirm(msg)) handleSubmit();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold hover:opacity-90 transition shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" /> Предај тест
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: GRADING
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'grading') {
    const pct = gradingProgress.total > 0
      ? Math.round((gradingProgress.done / gradingProgress.total) * 100)
      : 0;
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-8">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-xl animate-pulse">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-gray-800">AI оценување во тек…</h2>
          <p className="text-sm text-gray-500">
            {gradingProgress.total === 0
              ? 'Оценување на дел I…'
              : `Дел II + III: ${gradingProgress.done} / ${gradingProgress.total} прашања`}
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <progress
              className="w-full h-full accent-indigo-600"
              max={100}
              value={gradingProgress.total > 0 ? pct : 30}
            />
          </div>
          {gradingProgress.total > 0 && (
            <p className="text-center text-xs font-bold text-indigo-600 mt-2">{pct}%</p>
          )}
        </div>
        <p className="text-xs text-gray-400 max-w-xs text-center">
          Прашањата со ист одговор се вчитуваат од кеш — нема дополнителни AI повици.
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: RESULTS
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'results' && result && selectedExam) {
    const pct   = Math.round((result.totalScore / result.maxScore) * 100);
    const grade = gradeFromPercent(pct);

    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Back */}
        <button type="button" onClick={() => setPhase('select')}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-brand-primary transition"
        >
          <ChevronLeft className="w-4 h-4" /> Назад кон избор
        </button>

        {/* Score hero */}
        <div className="bg-gradient-to-br from-brand-primary to-blue-700 rounded-3xl p-8 text-white text-center space-y-3 shadow-xl">
          <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider">
            {result.examTitle}
          </p>
          <div className="text-7xl font-black">{pct}%</div>
          <div className="text-2xl font-bold">{result.totalScore} / {result.maxScore} поени</div>
          <div className="inline-block bg-white/20 backdrop-blur px-4 py-2 rounded-full text-base font-bold">
            {grade.label}
          </div>
          <p className="text-blue-200 text-xs">
            Траење: {formatTime(result.durationSeconds)} · {new Date(result.completedAt).toLocaleDateString('mk-MK')}
          </p>
        </div>

        {/* Part breakdown */}
        {partBreakdown && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-5 h-5 text-brand-primary" />
              <h2 className="font-black text-gray-800">Резултати по делови</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {partBreakdown.map(({ part, score, max, count }) => {
                const p = max > 0 ? Math.round((score / max) * 100) : 0;
                const color = p >= 75 ? 'text-emerald-600' : p >= 50 ? 'text-amber-600' : 'text-red-600';
                const bg    = p >= 75 ? 'bg-emerald-50 border-emerald-200' : p >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
                return (
                  <div key={part} className={`rounded-2xl border p-4 text-center ${bg}`}>
                    <p className="text-xs font-bold text-gray-500 mb-1">Дел {part === 1 ? 'I' : part === 2 ? 'II' : 'III'}</p>
                    <p className={`text-2xl font-black ${color}`}>{p}%</p>
                    <p className="text-xs text-gray-500 mt-1">{score}/{max} п · {count} пр.</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Topic breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-brand-primary" />
            <h2 className="font-black text-gray-800">Резултати по теми</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(topicBreakdown).sort(([,a],[,b]) => (a.score/a.max) - (b.score/b.max)).map(([topic, { score, max }]) => {
              const tPct   = max > 0 ? Math.round((score / max) * 100) : 0;
              const barClr = tPct >= 75 ? 'bg-emerald-500' : tPct >= 50 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={topic}>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <span className="text-gray-700">{topic}</span>
                    <span className={tPct >= 75 ? 'text-emerald-600' : tPct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                      {score}/{max} ({tPct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <progress
                      className={`w-full h-full ${barClr === 'bg-emerald-500' ? 'accent-emerald-500' : barClr === 'bg-amber-500' ? 'accent-amber-500' : 'accent-red-500'}`}
                      max={100}
                      value={tPct}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* AI Analysis */}
        <Card className="bg-indigo-50 border-indigo-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="font-black text-indigo-800">AI Анализа</h2>
            </div>
            {!aiAnalysis && (
              <button type="button" onClick={requestAiAnalysis} disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiLoading ? 'Анализира…' : 'Анализирај'}
              </button>
            )}
          </div>
          {aiAnalysis
            ? <p className="mt-3 text-sm text-indigo-800 leading-relaxed">{aiAnalysis}</p>
            : <p className="mt-2 text-sm text-indigo-500 italic">Притисни „Анализирај" за персонализиран AI коментар.</p>}
        </Card>

        {/* Per-question review */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-brand-primary" />
            <h2 className="font-black text-gray-800">Преглед по прашања</h2>
          </div>
          <div className="space-y-2">
            {questions.map((q, i) => {
              const g       = result.grades[q.questionNumber];
              const correct = g?.correct ?? (g ? g.score === g.maxPoints : false);
              const rowBg   = correct ? 'bg-emerald-50' : g?.score ? 'bg-amber-50' : 'bg-red-50';
              return (
                <div key={q.questionNumber} className={`flex items-start gap-3 p-3 rounded-xl ${rowBg}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {correct
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      : g?.score ? <AlertTriangle className="w-5 h-5 text-amber-500" />
                      : <XCircle className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 line-clamp-1">
                      {i + 1}. <MathRenderer text={q.questionText} />
                    </p>
                    {/* Part 1 answer */}
                    {q.part === 1 && (
                      <p className="text-xs mt-0.5">
                        <span className={correct ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                          {answers.mc[q.questionNumber] ? `Твој: ${answers.mc[q.questionNumber]}` : 'Не одговорено'}
                        </span>
                        {!correct && (
                          <span className="ml-2 text-emerald-600 font-semibold">· Точно: {q.correctAnswer}</span>
                        )}
                      </p>
                    )}
                    {/* Part 2/3 feedback */}
                    {(q.part === 2 || q.part === 3) && g?.feedback && (
                      <p className="text-xs mt-0.5 text-gray-600 italic line-clamp-2">{g.feedback}</p>
                    )}
                  </div>
                  <span className="text-xs font-black text-gray-500 flex-shrink-0">
                    {g?.score ?? 0}/{q.points}п
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Next actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button type="button" onClick={() => startExam(selectedExam)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-brand-primary to-blue-700 text-white font-bold hover:opacity-90 transition shadow-md"
          >
            <RotateCcw className="w-4 h-4" /> Обиди се повторно
          </button>
          <button type="button" onClick={() => navigate('/matura-stats')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white border border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-50 transition"
          >
            <BarChart2 className="w-4 h-4" /> Отвори M5 Аналитика
          </button>
        </div>
      </div>
    );
  }

  return null;
};
