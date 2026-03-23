/**
 * MaturaSimulationView — Симулација на Државна Испитна Матура (ДИМ)
 *
 * Три режими:
 *  select  — избор на тест (track × година)
 *  exam    — полагање (тајмер, навигација, А/Б/В/Г)
 *  results — резултати + topic breakdown + AI анализа
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  GraduationCap, Clock, ChevronLeft, ChevronRight, CheckCircle2,
  XCircle, BarChart2, BookOpen, Sparkles, AlertTriangle, Trophy,
  RotateCcw, Loader2, Play, List, Grid,
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { MathRenderer } from '../components/common/MathRenderer';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { geminiService } from '../services/geminiService';
import { sanitizePromptInput } from '../services/gemini/core';
import type { MaturaChoice, MaturaExam, MaturaQuestion } from '../types';
import { SECONDARY_TRACK_LABELS } from '../types';
import type { SecondaryTrack } from '../types';
import { maturaExams, getExamsByTrack, MATURA_YEARS } from '../data/matura/index';

// ─── Constants ───────────────────────────────────────────────────────────────

const CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];
const CHOICE_COLORS: Record<MaturaChoice, string> = {
  А: 'from-blue-500 to-blue-600',
  Б: 'from-violet-500 to-violet-600',
  В: 'from-amber-500 to-amber-600',
  Г: 'from-rose-500 to-rose-600',
};
const CHOICE_LIGHT: Record<MaturaChoice, string> = {
  А: 'border-blue-300 bg-blue-50 text-blue-800',
  Б: 'border-violet-300 bg-violet-50 text-violet-800',
  В: 'border-amber-300 bg-amber-50 text-amber-800',
  Г: 'border-rose-300 bg-rose-50 text-rose-800',
};
const GRADE_THRESHOLDS = [
  { min: 90, label: '5 — Одличен', color: 'text-emerald-600' },
  { min: 75, label: '4 — Многу добар', color: 'text-blue-600' },
  { min: 55, label: '3 — Добар', color: 'text-amber-600' },
  { min: 40, label: '2 — Доволен', color: 'text-orange-600' },
  { min: 0,  label: '1 — Незадоволителен', color: 'text-red-600' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function gradeFromPercent(pct: number) {
  return GRADE_THRESHOLDS.find((g) => pct >= g.min)!;
}

function getStorageKey(examId: string) {
  return `matura_result_${examId}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type Mode = 'select' | 'exam' | 'results';

interface ExamResult {
  examId: string;
  answers: Record<string, MaturaChoice>;
  score: number;
  totalPoints: number;
  durationSeconds: number;
  completedAt: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

const ExamCard: React.FC<{
  exam: MaturaExam;
  onStart: () => void;
  pastResult?: ExamResult | null;
}> = ({ exam, onStart, pastResult }) => {
  const pct = pastResult
    ? Math.round((pastResult.score / pastResult.totalPoints) * 100)
    : null;
  const grade = pct !== null ? gradeFromPercent(pct) : null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3 hover:border-brand-primary hover:shadow-md transition-all group">
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {SECONDARY_TRACK_LABELS[exam.track]}
          </span>
          <h3 className="text-lg font-black text-gray-800 mt-0.5">
            {exam.title ?? `Матура ${exam.year}`}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {exam.questions.length} прашања · {exam.durationMinutes} мин ·{' '}
            {exam.questions.reduce((s, q) => s + q.points, 0)} поени
          </p>
        </div>
        {exam.id.startsWith('demo') && (
          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
            ДЕМО
          </span>
        )}
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

      <button
        type="button"
        onClick={onStart}
        className="mt-auto w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-primary to-blue-700 text-white font-bold py-2.5 rounded-xl hover:opacity-90 transition shadow-sm"
      >
        <Play className="w-4 h-4" />
        {grade ? 'Обиди се повторно' : 'Започни симулација'}
      </button>
    </div>
  );
};

// ─── Main View ───────────────────────────────────────────────────────────────

export const MaturaSimulationView: React.FC = () => {
  const { addNotification } = useNotification();
  const { user } = useAuth();

  const [mode, setMode] = useState<Mode>('select');
  const [activeTrack, setActiveTrack] = useState<SecondaryTrack>('gymnasium');
  const [selectedExam, setSelectedExam] = useState<MaturaExam | null>(null);

  // Exam state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, MaturaChoice>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [examStart, setExamStart] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');

  // Results state
  const [result, setResult] = useState<ExamResult | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Saved results ────────────────────────────────────────────────────────
  const getPastResult = useCallback((examId: string): ExamResult | null => {
    try {
      const raw = localStorage.getItem(getStorageKey(examId));
      return raw ? (JSON.parse(raw) as ExamResult) : null;
    } catch {
      return null;
    }
  }, []);

  // ── Exams for active track ───────────────────────────────────────────────
  const trackExams = useMemo(() => getExamsByTrack(activeTrack), [activeTrack]);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'exam' || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, submitted]);

  // ── Start exam ───────────────────────────────────────────────────────────
  const startExam = useCallback((exam: MaturaExam) => {
    setSelectedExam(exam);
    setCurrentIdx(0);
    setAnswers({});
    setTimeLeft(exam.durationMinutes * 60);
    setExamStart(Date.now());
    setSubmitted(false);
    setAiAnalysis('');
    setMode('exam');
  }, []);

  // ── Submit exam ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    if (!selectedExam || submitted) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSubmitted(true);

    const totalPoints = selectedExam.questions.reduce((s, q) => s + q.points, 0);
    const score = selectedExam.questions.reduce((s, q) => {
      return answers[q.id] === q.correctAnswer ? s + q.points : s;
    }, 0);
    const durationSeconds = Math.round((Date.now() - examStart) / 1000);

    const r: ExamResult = {
      examId: selectedExam.id,
      answers,
      score,
      totalPoints,
      durationSeconds,
      completedAt: new Date().toISOString(),
    };
    localStorage.setItem(getStorageKey(selectedExam.id), JSON.stringify(r));
    setResult(r);
    setMode('results');
  }, [selectedExam, submitted, answers, examStart]);

  // ── AI analysis ──────────────────────────────────────────────────────────
  const requestAiAnalysis = async () => {
    if (!selectedExam || !result || aiLoading) return;
    setAiLoading(true);

    const weakTopics = Object.entries(topicBreakdown)
      .filter(([, v]) => v.correct < v.total)
      .map(([topic, v]) => `${topic}: ${v.correct}/${v.total} точни`)
      .join(', ');

    const safeExamTitle = sanitizePromptInput(selectedExam.title ?? String(selectedExam.year), 100);
    const prompt = `Ученик полагаше симулација на матура по математика (${safeExamTitle}).
Резултат: ${result.score}/${result.totalPoints} поени (${Math.round((result.score / result.totalPoints) * 100)}%).
Слаби теми: ${weakTopics || 'нема'}.
Дај кратка, охрабрувачка анализа (3–4 реченици на македонски) со конкретни совети за подобрување.`;

    try {
      const text = await geminiService.analyzeReflection(prompt, '');
      setAiAnalysis(text);
    } catch {
      addNotification('AI анализата не е достапна моментално.', 'error');
    } finally {
      setAiLoading(false);
    }
  };

  // ── Topic breakdown (memoized) ───────────────────────────────────────────
  const topicBreakdown = useMemo(() => {
    if (!selectedExam || !result) return {} as Record<string, { correct: number; total: number }>;
    return selectedExam.questions.reduce(
      (acc, q) => {
        if (!acc[q.topic]) acc[q.topic] = { correct: 0, total: 0 };
        acc[q.topic].total += 1;
        if (result.answers[q.id] === q.correctAnswer) acc[q.topic].correct += 1;
        return acc;
      },
      {} as Record<string, { correct: number; total: number }>,
    );
  }, [selectedExam, result]);

  // ── Render: SELECT ───────────────────────────────────────────────────────
  if (mode === 'select') {
    const tracks: SecondaryTrack[] = ['gymnasium', 'vocational4', 'vocational3'];
    return (
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Симулација на матура</h1>
            <p className="text-sm text-gray-500">ДИМ — Државна испитна матура · Математика</p>
          </div>
        </div>

        {/* Track tabs */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
          {tracks.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTrack(t)}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                activeTrack === t
                  ? 'bg-white shadow text-brand-primary'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {SECONDARY_TRACK_LABELS[t].split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Exam grid */}
        {trackExams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trackExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onStart={() => startExam(exam)}
                pastResult={getPastResult(exam.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <GraduationCap className="w-14 h-14 text-gray-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-400">Тестовите наскоро</h3>
            <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">
              Официјалните ДИМ тестови за{' '}
              <strong>{SECONDARY_TRACK_LABELS[activeTrack]}</strong> ќе бидат
              достапни по верификација со МОН.
            </p>
          </div>
        )}

        {/* Tips card */}
        <Card className="bg-blue-50 border-blue-100">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-bold text-brand-primary text-sm">Совети за подготовка</p>
              <ul className="mt-2 space-y-1 text-sm text-blue-800">
                <li>• Реши по еден тест дневно во условии на тишина</li>
                <li>• Не прескокнувај прашања — секоен поен брои</li>
                <li>• По завршувањето, бара AI анализа на слабостите</li>
                <li>• Фокусирај се на темите со најмногу прашања во матурата</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // ── Render: EXAM ─────────────────────────────────────────────────────────
  if (mode === 'exam' && selectedExam) {
    const q: MaturaQuestion = selectedExam.questions[currentIdx];
    const answered = Object.keys(answers).length;
    const total = selectedExam.questions.length;
    const timerPct = (timeLeft / (selectedExam.durationMinutes * 60)) * 100;
    const timerColor = timerPct > 30 ? 'bg-emerald-500' : timerPct > 10 ? 'bg-amber-500' : 'bg-red-500';

    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        {/* Top bar */}
        <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <button
              type="button"
              title="Откажи и врати се на избор на тест"
              onClick={() => { if (confirm('Ќе ги изгубиш одговорите. Сигурен/на си?')) setMode('select'); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500" />
            </button>
            <span className="font-bold text-gray-700 text-sm">
              {selectedExam.title ?? `Матура ${selectedExam.year}`}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">
              {answered}/{total} одговорени
            </span>
            <div className="flex items-center gap-1.5">
              <Clock className={`w-4 h-4 ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-gray-500'}`} />
              <span className={`font-mono font-bold text-sm ${timeLeft < 300 ? 'text-red-600' : 'text-gray-700'}`}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <button
              type="button"
              title={viewMode === 'single' ? 'Прикажи преглед' : 'Еден по еден'}
              onClick={() => setViewMode(v => v === 'single' ? 'grid' : 'single')}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition"
            >
              {viewMode === 'single'
                ? <Grid className="w-4 h-4 text-gray-500" />
                : <List className="w-4 h-4 text-gray-500" />}
            </button>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${timerColor} transition-all duration-1000`}
            style={{ width: `${timerPct}%` }}
          />
        </div>

        {viewMode === 'grid' ? (
          /* Question grid overview */
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Преглед на прашања</p>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
              {selectedExam.questions.map((qg, i) => (
                <button
                  key={qg.id}
                  type="button"
                  onClick={() => { setCurrentIdx(i); setViewMode('single'); }}
                  className={`aspect-square rounded-xl text-sm font-bold transition-all ${
                    i === currentIdx
                      ? 'bg-brand-primary text-white ring-2 ring-brand-primary ring-offset-1'
                      : answers[qg.id]
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Single question */
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            {/* Question header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-full">
                  Прашање {currentIdx + 1} / {total}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {q.topic}
                </span>
              </div>
              <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
                {q.points} {q.points === 1 ? 'поен' : 'поени'}
              </span>
            </div>

            {/* Question text */}
            <div className="text-base font-semibold text-gray-800 leading-relaxed">
              <MathRenderer text={q.questionText} />
            </div>

            {/* Choices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHOICES.map((choice) => {
                const selected = answers[q.id] === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: choice }))}
                    className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                      selected
                        ? `border-transparent bg-gradient-to-r ${CHOICE_COLORS[choice]} text-white shadow-md scale-[1.02]`
                        : `${CHOICE_LIGHT[choice]} hover:scale-[1.01]`
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      selected ? 'bg-white/20' : 'bg-white/80'
                    }`}>
                      {choice}
                    </span>
                    <span className="text-sm font-medium">
                      <MathRenderer text={q.choices[choice]} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx((i) => i - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Претходно
          </button>

          {currentIdx < total - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentIdx((i) => i + 1)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
            >
              Следно <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const unanswered = total - answered;
                const msg = unanswered > 0
                  ? `Има ${unanswered} неодговорени прашања. Сигурен/на си дека сакаш да предадеш?`
                  : 'Сигурен/на си дека сакаш да предадеш?';
                if (confirm(msg)) handleSubmit();
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold hover:opacity-90 transition shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" /> Предај тест
            </button>
          )}
        </div>

        {/* Low time warning */}
        {timeLeft < 300 && timeLeft > 0 && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-red-700">
              Останати помалку од 5 минути!
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── Render: RESULTS ──────────────────────────────────────────────────────
  if (mode === 'results' && selectedExam && result) {
    const pct = Math.round((result.score / result.totalPoints) * 100);
    const grade = gradeFromPercent(pct);

    return (
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Back */}
        <button
          type="button"
          onClick={() => setMode('select')}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-brand-primary transition"
        >
          <ChevronLeft className="w-4 h-4" /> Назад кон избор
        </button>

        {/* Score hero */}
        <div className="bg-gradient-to-br from-brand-primary to-blue-700 rounded-3xl p-8 text-white text-center space-y-3 shadow-xl">
          <p className="text-blue-200 text-sm font-semibold uppercase tracking-wider">
            {selectedExam.title ?? `Матура ${selectedExam.year}`}
          </p>
          <div className="text-7xl font-black">{pct}%</div>
          <div className="text-2xl font-bold">{result.score} / {result.totalPoints} поени</div>
          <div className={`inline-block bg-white/20 backdrop-blur px-4 py-2 rounded-full text-base font-bold ${grade.color.replace('text-', 'text-white')}`}>
            {grade.label}
          </div>
          <p className="text-blue-200 text-xs">
            Траење: {formatTime(result.durationSeconds)} · {new Date(result.completedAt).toLocaleDateString('mk-MK')}
          </p>
        </div>

        {/* Topic breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-brand-primary" />
            <h2 className="font-black text-gray-800">Резултати по теми</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(topicBreakdown).map(([topic, stats]) => {
              const tPct = Math.round((stats.correct / stats.total) * 100);
              const barColor = tPct >= 75 ? 'bg-emerald-500' : tPct >= 50 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={topic}>
                  <div className="flex justify-between text-sm font-semibold mb-1">
                    <span className="text-gray-700">{topic}</span>
                    <span className={tPct >= 75 ? 'text-emerald-600' : tPct >= 50 ? 'text-amber-600' : 'text-red-600'}>
                      {stats.correct}/{stats.total} ({tPct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${tPct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* AI analysis */}
        <Card className="bg-indigo-50 border-indigo-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="font-black text-indigo-800">AI Анализа</h2>
            </div>
            {!aiAnalysis && (
              <button
                type="button"
                onClick={requestAiAnalysis}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition disabled:opacity-60"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiLoading ? 'Анализира...' : 'Анализирај'}
              </button>
            )}
          </div>
          {aiAnalysis ? (
            <p className="mt-3 text-sm text-indigo-800 leading-relaxed">{aiAnalysis}</p>
          ) : (
            <p className="mt-2 text-sm text-indigo-500 italic">
              Притисни „Анализирај" за AI коментар за твоите резултати.
            </p>
          )}
        </Card>

        {/* Per-question review */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-brand-primary" />
            <h2 className="font-black text-gray-800">Преглед по прашања</h2>
          </div>
          <div className="space-y-3">
            {selectedExam.questions.map((q, i) => {
              const userAns = result.answers[q.id];
              const correct = userAns === q.correctAnswer;
              return (
                <div key={q.id} className={`flex items-start gap-3 p-3 rounded-xl ${correct ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {correct
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      : <XCircle className="w-5 h-5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {i + 1}. <MathRenderer text={q.questionText} />
                    </p>
                    <p className="text-xs mt-0.5">
                      {userAns
                        ? <span className={correct ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                            Твој одговор: {userAns} — {q.choices[userAns]}
                          </span>
                        : <span className="text-gray-400 italic">Не одговорено</span>}
                      {!correct && (
                        <span className="ml-2 text-emerald-600 font-semibold">
                          Точно: {q.correctAnswer} — {q.choices[q.correctAnswer]}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-gray-400 flex-shrink-0">
                    {q.points}п
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Retry */}
        <button
          type="button"
          onClick={() => startExam(selectedExam)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-brand-primary to-blue-700 text-white font-bold hover:opacity-90 transition shadow-md"
        >
          <RotateCcw className="w-4 h-4" /> Обиди се повторно
        </button>
      </div>
    );
  }

  return null;
};
