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
import { MathRenderer }    from '../components/common/MathRenderer';
import { DokBadge }        from '../components/common/DokBadge';
import { callGeminiProxy } from '../services/gemini/core';
import { useMaturaExams, useMaturaQuestions } from '../hooks/useMatura';
import { useMaturaMissions } from '../hooks/useMaturaMissions';
import {
  buildGradeCacheKey,
  getCachedAIGrade,
  saveAIGrade,
} from '../services/firestoreService.matura';
import type { MaturaQuestion, MaturaExamMeta } from '../services/firestoreService.matura';
import type { MaturaChoice, DokLevel } from '../types';

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─── Types ──────────────────────────────────────────────────────────────────
// MaturaQuestion is imported from the service — replaces the old RawQuestion.
// PracticeItem adds display metadata on top.
interface PracticeItem extends MaturaQuestion {
  examLabel: string;
}
interface AIGrade {
  score: number;
  maxScore: number;
  feedback: string;
  partA?: boolean;
  partB?: boolean;
  commentA?: string;
  commentB?: string;
}
interface QuestionState {
  mcPick?: string;
  answerA?: string;
  answerB?: string;
  aiGrade?: AIGrade;
  grading?: boolean;
  selfChecks?: boolean[];
  aiDesc?: string;
  aiGradeP3?: AIGrade;
  gradingP3?: boolean;
  aiError?: string;
  submitted: boolean;
  skipped?: boolean;
}
type Phase = 'setup' | 'practice' | 'results';

// ─── Display helpers ──────────────────────────────────────────────────────────
const SESSION_LABELS: Record<string, string> = { june: 'Јуни', august: 'Август', march: 'Март' };
const LANG_FLAGS:     Record<string, string> = { mk: '🇲🇰 МК', al: '🇦🇱 АЛ', tr: '🇹🇷 ТР' };
function examDisplayLabel(e: MaturaExamMeta): string {
  return `${SESSION_LABELS[e.session] ?? e.session} ${e.year} ${LANG_FLAGS[e.language] ?? e.language.toUpperCase()}`;
}

const CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];
const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Алгебра', analiza: 'Анализа', geometrija: 'Геометрија',
  trigonometrija: 'Тригонометрија', 'matrici-vektori': 'Матрици/Вектори',
  broevi: 'Броеви', statistika: 'Статистика', kombinatorika: 'Комбинаторика',
};
const TOPIC_COLORS: Record<string, string> = {
  algebra: 'bg-blue-100 text-blue-800 border-blue-200',
  analiza: 'bg-purple-100 text-purple-800 border-purple-200',
  geometrija: 'bg-green-100 text-green-800 border-green-200',
  trigonometrija: 'bg-orange-100 text-orange-800 border-orange-200',
  'matrici-vektori': 'bg-teal-100 text-teal-800 border-teal-200',
  broevi: 'bg-gray-100 text-gray-700 border-gray-200',
  statistika: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  kombinatorika: 'bg-pink-100 text-pink-800 border-pink-200',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isOpen(q: MaturaQuestion): boolean {
  if (q.questionType === 'open') return true;
  if (q.questionType === 'mc')   return false;
  return !q.choices || Object.keys(q.choices).length === 0;
}
function parseSubParts(answer: string): { A?: string; B?: string } {
  const aMatch = answer.match(/[АA]\.\s*([\s\S]+?)(?=\s*,?\s*[БB]\.|$)/);
  const bMatch = answer.match(/[БB]\.\s*([\s\S]+)/);
  return { A: aMatch?.[1]?.trim(), B: bMatch?.[1]?.trim() };
}
function safeParseJSON(text: string): any {
  try { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
  catch { return null; }
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── AI grading ──────────────────────────────────────────────────────────────
async function gradePart2(q: MaturaQuestion, answerA: string, answerB: string): Promise<AIGrade> {
  const cacheInput = `${answerA}|||${answerB}`;
  const cacheKey   = buildGradeCacheKey(q.examId, q.questionNumber, cacheInput);

  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    return {
      score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback,
      partA: undefined, partB: undefined, commentA: undefined, commentB: undefined,
    };
  }

  const prompt = `Ти си асистент за оценување матура на македонски јазик.

Задача Q${q.questionNumber}: ${q.questionText}
Точен одговор: ${q.correctAnswer}
Одговор на ученикот: А. ${answerA || '(нема)'} | Б. ${answerB || '(нема)'}

Оцени ги двата дела (А и Б). Секој дел вреди 1 поен.
Врати САМО валиден JSON:
{"score":0,"partA":false,"partB":false,"commentA":"...","commentB":"...","feedback":"..."}

- Споредувај математичко значење, не буквален текст.
- score = 0, 1 или 2 (вкупно точни делови).`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const p = safeParseJSON(resp.text);
  if (!p) throw new Error('Parse error');
  const grade: AIGrade = {
    score: Number(p.score ?? 0), maxScore: 2, feedback: p.feedback ?? '',
    partA: Boolean(p.partA), partB: Boolean(p.partB),
    commentA: p.commentA, commentB: p.commentB,
  };

  saveAIGrade(cacheKey, {
    examId: q.examId, questionNumber: q.questionNumber,
    inputHash: cacheKey, score: grade.score, maxPoints: 2, feedback: grade.feedback,
  });
  return grade;
}

async function gradePart3(q: MaturaQuestion, desc: string): Promise<AIGrade> {
  const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, desc);

  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const prompt = `Ти си асистент за оценување матура на македонски јазик.

Задача Q${q.questionNumber} (${q.points} поени): ${q.questionText}
Точен одговор: ${q.correctAnswer}
Опис на решението на ученикот: ${desc || '(нема опис)'}

Оцени го решението. Врати САМО валиден JSON:
{"score":0,"feedback":"детален коментар на македонски"}

- score: цел број 0..${q.points}
- Биди праведен, конструктивен и охрабрувачки.`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const p = safeParseJSON(resp.text);
  if (!p) throw new Error('Parse error');
  const score = Math.min(Number(p.score ?? 0), q.points);
  const feedback = p.feedback ?? '';

  saveAIGrade(cacheKey, {
    examId: q.examId, questionNumber: q.questionNumber,
    inputHash: cacheKey, score, maxPoints: q.points, feedback,
  });
  return { score, maxScore: q.points, feedback };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TopicChip({ topic, active, onClick }: { topic: string; active: boolean; onClick: () => void }) {
  const color = TOPIC_COLORS[topic] ?? 'bg-gray-100 text-gray-700 border-gray-200';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${
        active ? color + ' ring-2 ring-offset-1 ring-current shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
      }`}
    >
      {TOPIC_LABELS[topic] ?? topic}
    </button>
  );
}

function ProgressBar({ current, total, score, maxScore }: { current: number; total: number; score: number; maxScore: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <progress
          className="w-full h-full accent-indigo-600"
          max={100}
          value={pct}
        />
      </div>
      <span className="text-sm font-bold text-gray-600 shrink-0">{current}/{total}</span>
      <span className="text-sm font-bold text-emerald-600 shrink-0">{score}/{maxScore}pt</span>
    </div>
  );
}

function ScorePill({ score, max, size = 'sm' }: { score: number; max: number; size?: 'sm' | 'lg' }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  const color = pct >= 80 ? 'bg-emerald-100 text-emerald-800' : pct >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';
  if (size === 'lg') return (
    <div className={`inline-flex items-center gap-1 px-4 py-2 rounded-full font-black text-2xl ${color}`}>
      {score}/{max}
    </div>
  );
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${color}`}>{score}/{max}</span>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────
interface SetupConfig {
  langs: ('mk' | 'al')[];
  sessions: ('june' | 'august')[];
  topics: string[];
  parts: number[];
  dokLevels: number[];
  doShuffle: boolean;
  maxQ: number;
}

interface RecoveryPrefill {
  topicArea?: string | null;
  dokLevels?: number[];
  maxQ?: number;
  sourceConceptId?: string;
  sourceConceptTitle?: string;
  missionDay?: number;
}

function SetupScreen({ allTopics, exams, examsLoading, examsError, onStart, prefill, onDismissPrefill }: {
  allTopics: string[];
  exams: MaturaExamMeta[];
  examsLoading: boolean;
  examsError: string | null;
  onStart: (cfg: SetupConfig) => void;
  prefill: RecoveryPrefill | null;
  onDismissPrefill: () => void;
}) {
  // Derive available sessions/langs from actual Firestore exam list
  const availableSessions = useMemo(() => [...new Set(exams.map(e => e.session))].sort() as ('june'|'august')[], [exams]);
  const availableLangs    = useMemo(() => [...new Set(exams.map(e => e.language))].sort() as ('mk'|'al')[], [exams]);

  const [langs, setLangs]       = useState<('mk'|'al')[]>(['mk']);
  const [sessions, setSessions] = useState<('june'|'august')[]>(['june', 'august']);
  const [topics, setTopics]     = useState<string[]>(() => prefill?.topicArea ? [prefill.topicArea] : []);
  const [parts, setParts]       = useState<number[]>([1, 2, 3]);
  const [dokLevels, setDok]     = useState<number[]>(() => prefill?.dokLevels?.length ? prefill.dokLevels : [1, 2, 3, 4]);
  const [doShuffle, setShuffle] = useState(true);
  const [maxQ, setMaxQ]         = useState(prefill?.maxQ ?? 20);

  useEffect(() => {
    if (!prefill) return;
    if (prefill.topicArea && allTopics.includes(prefill.topicArea)) {
      setTopics([prefill.topicArea]);
    }
    if (prefill.dokLevels?.length) setDok(prefill.dokLevels);
    if (typeof prefill.maxQ === 'number') setMaxQ(prefill.maxQ);
  }, [prefill, allTopics]);

  // Preview count: estimate based on exam count × avg questions per exam
  const matchingExams = useMemo(
    () => exams.filter(e => langs.includes(e.language as 'mk'|'al') && sessions.includes(e.session as 'june'|'august')),
    [exams, langs, sessions],
  );
  const previewCount = useMemo(() => {
    // Each exam has ~30 questions; we can't filter by topic without loading questions,
    // so give an optimistic estimate capped at maxQ.
    const total = matchingExams.reduce((s, e) => s + e.questionCount, 0);
    const topicFactor = topics.length ? 0.4 : 1; // rough: topics cut ~60%
    return Math.min(Math.round(total * topicFactor), maxQ);
  }, [matchingExams, topics, maxQ]);

  function toggle<T>(arr: T[], val: T, min = 1): T[] {
    if (arr.includes(val)) {
      if (arr.length <= min) return arr;
      return arr.filter(v => v !== val);
    }
    return [...arr, val];
  }

  const canStart = previewCount > 0;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-4">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-blue-700 to-indigo-700 px-6 py-5 text-white shadow-lg">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,white_1.5px,transparent_0)] [background-size:22px_22px]" />
        <div className="relative">
          <h1 className="text-2xl font-black tracking-tight">Адаптивна практика</h1>
          <p className="text-white/70 text-sm mt-0.5">Вежбај матурски прашања по тема и следи го напредокот</p>
          {!examsLoading && (
            <div className="flex items-center gap-3 mt-3">
              <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-bold">{exams.length} испити</span>
              <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-bold">{exams.reduce((s,e)=>s+e.questionCount,0)} прашања</span>
              <span className="inline-flex items-center gap-1 bg-white/15 rounded-full px-2.5 py-1 text-xs font-bold">AI оценување</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Recovery banner ── */}
      {prefill && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-black text-emerald-700 uppercase tracking-wide">Recovery Session</p>
            <p className="text-sm text-emerald-800 mt-0.5">
              Препорачан фокус од M5 аналитика{prefill.sourceConceptTitle ? `: ${prefill.sourceConceptTitle}` : ''}.
            </p>
          </div>
          <button type="button" onClick={onDismissPrefill} className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex-shrink-0">Сокриј</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 divide-y divide-slate-100">

        {/* ── Lang + Session (2-col) ── */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Јазик</h3>
            {examsLoading ? (
              <div className="flex gap-2">{[1,2].map(i=><div key={i} className="h-9 w-16 bg-slate-100 animate-pulse rounded-lg"/>)}</div>
            ) : examsError ? (
              <p className="text-xs text-red-600">{examsError}</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {availableLangs.map(l => (
                  <button key={l} type="button" onClick={() => setLangs(prev => toggle(prev, l))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${langs.includes(l)?'bg-brand-primary text-white border-brand-primary shadow-sm':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    {LANG_FLAGS[l] ?? l.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Испитна сесија</h3>
            {examsLoading ? (
              <div className="flex gap-2">{[1,2].map(i=><div key={i} className="h-9 w-24 bg-slate-100 animate-pulse rounded-lg"/>)}</div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {availableSessions.map(s => {
                  const years = [...new Set(exams.filter(e=>e.session===s).map(e=>e.year))].sort();
                  return (
                    <button key={s} type="button" onClick={() => setSessions(prev => toggle(prev, s))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-all ${sessions.includes(s)?'bg-brand-primary text-white border-brand-primary shadow-sm':'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                      {SESSION_LABELS[s] ?? s}
                      <span className={`ml-1.5 text-[10px] font-semibold ${sessions.includes(s)?'text-white/70':'text-slate-400'}`}>{years.join('·')}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Topics ── */}
        <section className="p-4">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Теми</h3>
            <button type="button"
              onClick={() => setTopics(topics.length === allTopics.length ? [] : [...allTopics])}
              className="text-xs text-brand-primary font-semibold hover:underline">
              {topics.length === allTopics.length ? 'Откажи сè' : 'Избери сè'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button"
              onClick={() => setTopics([])}
              className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${topics.length === 0 ? 'bg-slate-800 text-white border-slate-800 shadow-sm' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
              Сите
            </button>
            {allTopics.map(t => (
              <TopicChip key={t} topic={t}
                active={topics.length === 0 || topics.includes(t)}
                onClick={() => setTopics(prev => {
                  if (prev.length === 0) return allTopics.filter(x => x !== t);
                  return toggle(prev, t, 1);
                })}
              />
            ))}
          </div>
        </section>

        {/* ── Parts + DoK (2-col) ── */}
        <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100">
          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Дел</h3>
            <div className="flex flex-col gap-1.5">
              {[
                { v: 1, label: 'Дел I', sub: 'MC · 1pt' },
                { v: 2, label: 'Дел II', sub: 'Отворено · 2pt' },
                { v: 3, label: 'Дел III', sub: 'Отворено · 3–5pt' },
              ].map(({ v, label, sub }) => (
                <button key={v} type="button" onClick={() => setParts(prev => toggle(prev, v))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all text-left ${parts.includes(v) ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/30 font-bold' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-black flex-shrink-0 ${parts.includes(v) ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500'}`}>{v}</span>
                  <span>{label}</span>
                  <span className={`ml-auto text-[10px] ${parts.includes(v) ? 'text-brand-primary/70' : 'text-slate-400'}`}>{sub}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="p-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Тежина (DoK)</h3>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { l: 1, label: 'Запомни',   on: 'bg-emerald-50 text-emerald-800 border-emerald-200', num: 'text-emerald-600' },
                { l: 2, label: 'Разбери',   on: 'bg-blue-50 text-blue-800 border-blue-200',           num: 'text-blue-600'    },
                { l: 3, label: 'Примени',   on: 'bg-amber-50 text-amber-800 border-amber-200',         num: 'text-amber-600'  },
                { l: 4, label: 'Анализирај',on: 'bg-rose-50 text-rose-800 border-rose-200',            num: 'text-rose-600'   },
              ] as const).map(({ l, label, on, num }) => (
                <button key={l} type="button" onClick={() => setDok(prev => toggle(prev, l))}
                  className={`px-2 py-2 rounded-lg border transition-all text-left font-bold ${dokLevels.includes(l) ? on : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}>
                  <span className={`text-lg font-black leading-none block ${dokLevels.includes(l) ? num : 'text-slate-300'}`}>{l}</span>
                  <span className="text-[10px] leading-tight mt-0.5 block">{label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ── Options ── */}
        <section className="px-4 py-3 flex items-center gap-6 bg-slate-50/50 rounded-b-2xl">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={doShuffle} onChange={e => setShuffle(e.target.checked)} className="w-4 h-4 accent-brand-primary" />
            <span className="text-sm font-medium text-slate-700">Мешај ред</span>
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm font-medium text-slate-500">Прашања:</span>
            <select title="Изберете број на прашања" aria-label="Изберете број на прашања" value={maxQ} onChange={e => setMaxQ(Number(e.target.value))}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 bg-white focus:ring-brand-primary focus:border-brand-primary">
              {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </section>
      </div>

      {/* ── Start button ── */}
      <button
        type="button"
        disabled={!canStart}
        onClick={() => onStart({ langs, sessions, topics, parts, dokLevels, doShuffle, maxQ })}
        className={`w-full py-3.5 rounded-2xl font-black text-lg transition-all ${
          canStart
            ? 'bg-gradient-to-r from-brand-primary to-blue-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99]'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {canStart
          ? `Започни практика · ${previewCount} прашања`
          : 'Нема прашања за избраните филтри'}
      </button>
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────────────────────
function QuestionCard({
  item, idx, total, state, onUpdate,
}: {
  item: PracticeItem;
  idx: number;
  total: number;
  state: QuestionState;
  onUpdate: (patch: Partial<QuestionState>) => void;
}) {
  const open = isOpen(item);
  const part2 = item.part === 2 && open;
  const part3 = item.part === 3 && open;
  const sub   = part2 ? parseSubParts(item.correctAnswer) : {};

  const topicColor = TOPIC_COLORS[item.topicArea ?? ''] ?? 'bg-gray-100 text-gray-700 border-gray-200';

  // MC submit on click
  const handleMC = useCallback((choice: string) => {
    if (state.submitted) return;
    const correct = item.correctAnswer.trim();
    onUpdate({ mcPick: choice, submitted: true });
  }, [state.submitted, item.correctAnswer, onUpdate]);

  // Part 2 AI grade
  const handleGradeP2 = useCallback(async () => {
    onUpdate({ grading: true, aiError: undefined });
    try {
      const grade = await gradePart2(item, state.answerA ?? '', state.answerB ?? '');
      onUpdate({ grading: false, aiGrade: grade, submitted: true });
    } catch {
      onUpdate({ grading: false, aiError: 'Грешка при оценување. Обидете се повторно.', submitted: false });
    }
  }, [item, state.answerA, state.answerB, onUpdate]);

  // Part 3 AI grade
  const handleGradeP3 = useCallback(async () => {
    onUpdate({ gradingP3: true, aiError: undefined });
    try {
      const grade = await gradePart3(item, state.aiDesc ?? '');
      onUpdate({ gradingP3: false, aiGradeP3: grade });
    } catch {
      onUpdate({ gradingP3: false, aiError: 'Грешка при AI оценување.' });
    }
  }, [item, state.aiDesc, onUpdate]);

  // Part 3 self-assess submit
  const handleSelfSubmit = useCallback(() => {
    onUpdate({ submitted: true });
  }, [onUpdate]);

  const mcCorrect  = !open && state.submitted && state.mcPick === item.correctAnswer.trim();
  const mcWrong    = !open && state.submitted && state.mcPick !== item.correctAnswer.trim();

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50/60">
        <span className="text-xs font-black text-gray-400">#{idx + 1}/{total}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${topicColor}`}>
          {TOPIC_LABELS[item.topicArea ?? ''] ?? item.topicArea}
        </span>
        {item.topic && <span className="text-xs text-gray-400">{item.topic}</span>}
        {item.dokLevel && <DokBadge level={item.dokLevel as DokLevel} size="compact" />}
        <span className="ml-auto text-xs font-bold text-gray-500">{item.points}pt • {item.examLabel}</span>
      </div>

      {/* Question text */}
      <div className="px-5 pt-4 pb-2">
        <div className="text-base font-medium text-gray-800 leading-relaxed">
          <MathRenderer text={item.questionText} />
        </div>
        {item.hasImage && item.imageUrls?.[0] && (
          <img src={item.imageUrls[0]} alt="Слика кон задача" className="mt-3 max-h-48 rounded-lg border" />
        )}
      </div>

      {/* ── Part 1 MC ── */}
      {!open && (
        <div className="px-5 pb-4 space-y-2 mt-2">
          {CHOICES.filter(c => item.choices?.[c]).map(choice => {
            const isCorrectChoice = choice === item.correctAnswer.trim();
            const isPicked        = state.mcPick === choice;
            let bg = 'bg-white border-gray-200 hover:border-brand-primary hover:bg-blue-50';
            if (state.submitted) {
              if (isCorrectChoice) bg = 'bg-emerald-50 border-emerald-400 text-emerald-800';
              else if (isPicked)   bg = 'bg-rose-50 border-rose-400 text-rose-800';
              else                 bg = 'bg-white border-gray-100 opacity-60';
            } else if (isPicked)  bg = 'bg-blue-50 border-brand-primary';
            return (
              <button
                key={choice} type="button"
                disabled={state.submitted}
                onClick={() => handleMC(choice)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 rounded-xl border-2 text-left transition-all font-medium ${bg}`}
              >
                <span className="font-black shrink-0">{choice}.</span>
                <MathRenderer text={item.choices![choice]!} />
              </button>
            );
          })}
          {state.submitted && (
            <p className={`text-sm font-bold mt-1 ${mcCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
              {mcCorrect ? '✓ Точно!' : `✗ Точен одговор: ${item.correctAnswer.trim()}`}
            </p>
          )}
        </div>
      )}

      {/* ── Part 2 open (AI grade) ── */}
      {part2 && (
        <div className="px-5 pb-4 space-y-3 mt-2">
          <p className="text-xs text-gray-500 font-medium">Внеси го твојот одговор (А и Б):</p>
          {['А', 'Б'].map((ltr, i) => {
            const val = i === 0 ? state.answerA : state.answerB;
            const setVal = (v: string) => onUpdate(i === 0 ? { answerA: v } : { answerB: v });
            const aiOk  = state.aiGrade ? (i === 0 ? state.aiGrade.partA : state.aiGrade.partB) : null;
            const comment = state.aiGrade ? (i === 0 ? state.aiGrade.commentA : state.aiGrade.commentB) : null;
            return (
              <div key={ltr}>
                <label className="text-xs font-bold text-gray-600 block mb-1">{ltr}.</label>
                <input
                  type="text" value={val ?? ''} disabled={!!state.aiGrade}
                  onChange={e => setVal(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-brand-primary focus:border-brand-primary disabled:bg-gray-50"
                  placeholder={`Одговор ${ltr}…`}
                />
                {state.aiGrade && (
                  <p className={`text-xs mt-1 font-medium ${aiOk ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {aiOk ? '✓' : '✗'} {comment}
                  </p>
                )}
              </div>
            );
          })}
          {state.aiGrade ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700 mb-1">
                Резултат: {state.aiGrade.score}/{state.aiGrade.maxScore}pt
              </p>
              <p className="text-xs text-blue-600">{state.aiGrade.feedback}</p>
              <div className="mt-2 pt-2 border-t border-blue-100">
                <p className="text-xs text-gray-500 font-medium">Точен одговор:</p>
                <div className="text-xs text-gray-700"><MathRenderer text={item.correctAnswer} /></div>
              </div>
            </div>
          ) : (
            <button
              type="button" disabled={!!state.grading || (!state.answerA && !state.answerB)}
              onClick={handleGradeP2}
              className="px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-secondary disabled:opacity-50 transition-colors"
            >
              {state.grading ? 'Оценување…' : 'Провери со AI'}
            </button>
          )}
          {state.aiError && <p className="text-xs text-rose-600">{state.aiError}</p>}
        </div>
      )}

      {/* ── Part 3 open (self-assess + opt-in AI) ── */}
      {part3 && (
        <div className="px-5 pb-4 space-y-3 mt-2">
          {!state.submitted ? (
            <>
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Реши ја задачата на хартија, па самооцени се подолу.
              </p>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500 font-medium">Штикирај за секој поен кој мислиш дека го заслужуваш:</p>
                {Array.from({ length: item.points }).map((_, pi) => {
                  const checked = state.selfChecks?.[pi] ?? false;
                  return (
                    <label key={pi} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox" checked={checked}
                        onChange={e => {
                          const arr = Array.from({ length: item.points }, (_, j) => state.selfChecks?.[j] ?? false);
                          arr[pi] = e.target.checked;
                          onUpdate({ selfChecks: arr });
                        }}
                        className="w-4 h-4 accent-brand-primary"
                      />
                      <span className="text-sm text-gray-700">Поен {pi + 1}</span>
                    </label>
                  );
                })}
              </div>
              <button type="button" onClick={handleSelfSubmit}
                className="px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-secondary transition-colors"
              >
                Потврди самооценка
              </button>
            </>
          ) : (
            <>
              {/* Self-assess result */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <p className="text-xs font-bold text-gray-600 mb-2">
                  Самооценка: {(state.selfChecks ?? []).filter(Boolean).length}/{item.points}pt
                </p>
                <p className="text-xs text-gray-500 font-semibold mb-1">Точен одговор / модел:</p>
                <div className="text-xs text-gray-700"><MathRenderer text={item.correctAnswer} /></div>
              </div>
              {/* Opt-in AI */}
              {!state.aiGradeP3 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Сакаш и AI оценка? Опиши го твоето решение:</p>
                  <textarea
                    value={state.aiDesc ?? ''}
                    onChange={e => onUpdate({ aiDesc: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-brand-primary focus:border-brand-primary resize-none"
                    rows={2}
                    placeholder="Пр: Прв го решив системот, потоа го пресметав детерминантот…"
                  />
                  <button
                    type="button" disabled={!!state.gradingP3 || !state.aiDesc?.trim()}
                    onClick={handleGradeP3}
                    className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {state.gradingP3 ? 'AI оценува…' : 'Провери со AI'}
                  </button>
                </div>
              )}
              {state.aiGradeP3 && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-purple-700 mb-1">
                    AI оценка: {state.aiGradeP3.score}/{state.aiGradeP3.maxScore}pt
                  </p>
                  <p className="text-xs text-purple-600">{state.aiGradeP3.feedback}</p>
                </div>
              )}
              {state.aiError && <p className="text-xs text-rose-600">{state.aiError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────
function ResultsScreen({
  items, states, onRetryWrong, onNewSession,
}: {
  items: PracticeItem[];
  states: QuestionState[];
  onRetryWrong: (wrongItems: PracticeItem[]) => void;
  onNewSession: () => void;
}) {
  // Compute scored / max per question
  function getScored(item: PracticeItem, s: QuestionState): { scored: number; max: number; correct: boolean } {
    if (!isOpen(item)) {
      const correct = s.submitted && s.mcPick === item.correctAnswer.trim();
      return { scored: correct ? 1 : 0, max: 1, correct };
    }
    if (item.part === 2 && s.aiGrade) {
      return { scored: s.aiGrade.score, max: s.aiGrade.maxScore, correct: s.aiGrade.score === s.aiGrade.maxScore };
    }
    if (item.part === 3) {
      const ai  = s.aiGradeP3;
      const self = (s.selfChecks ?? []).filter(Boolean).length;
      const scored = ai ? ai.score : self;
      return { scored, max: item.points, correct: scored === item.points };
    }
    return { scored: 0, max: item.points, correct: false };
  }

  const results = items.map((item, i) => ({ item, state: states[i], ...getScored(item, states[i]) }));
  const totalScored = results.reduce((a, r) => a + r.scored, 0);
  const totalMax    = results.reduce((a, r) => a + r.max, 0);
  const pct = totalMax > 0 ? Math.round((totalScored / totalMax) * 100) : 0;
  const pass = pct >= 57;

  // Per-topic breakdown
  const topicMap = new Map<string, { topic: string; topicArea: string; scored: number; max: number }>();
  results.forEach(r => {
    const key = r.item.topicArea ?? 'other';
    const entry = topicMap.get(key) ?? { topic: r.item.topic ?? key, topicArea: key, scored: 0, max: 0 };
    entry.scored += r.scored;
    entry.max    += r.max;
    topicMap.set(key, entry);
  });
  const topicResults = [...topicMap.values()].sort((a, b) => (b.scored / b.max) - (a.scored / a.max));

  // Weak topics (< 60%)
  const weakTopics = topicResults.filter(t => t.max > 0 && (t.scored / t.max) < 0.6);

  // Wrong/unanswered items
  const wrongItems = results.filter(r => !r.correct || r.state.skipped).map(r => r.item);

  // DoK breakdown
  const dokMap: Record<number, { scored: number; max: number }> = { 1:{scored:0,max:0}, 2:{scored:0,max:0}, 3:{scored:0,max:0}, 4:{scored:0,max:0} };
  results.forEach(r => {
    const lvl = r.item.dokLevel ?? 1;
    if (dokMap[lvl]) { dokMap[lvl].scored += r.scored; dokMap[lvl].max += r.max; }
  });

  const scoreColor = pct >= 80 ? 'text-emerald-600' : pct >= 57 ? 'text-amber-600' : 'text-rose-600';
  const ringColor  = pct >= 80 ? '#10b981' : pct >= 57 ? '#f59e0b' : '#ef4444';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Score ring */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center">
        <div className="relative inline-flex items-center justify-center mb-4">
          <svg className="w-36 h-36 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3.2"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke={ringColor} strokeWidth="3.2"
              strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round"/>
          </svg>
          <div className="absolute text-center">
            <span className={`text-3xl font-black ${scoreColor}`}>{pct}%</span>
            <p className="text-xs text-gray-400">{totalScored}/{totalMax}pt</p>
          </div>
        </div>
        <h2 className="text-xl font-black text-gray-800 mb-1">
          {pass ? '🎉 Одличен резултат!' : pct >= 40 ? '💪 Добар обид — продолжи!' : '📚 Треба повеќе вежба'}
        </h2>
        <p className="text-gray-500 text-sm">
          {pass ? 'Го поминуваш прагот за матура (≥57%)' : 'Прагот за матура е 57% — продолжи со вежбање'}
        </p>
      </div>

      {/* Topic breakdown */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
        <h3 className="font-black text-gray-700 mb-4">Резултат по тема</h3>
        <div className="space-y-3">
          {topicResults.map(t => {
            const tPct = t.max > 0 ? Math.round((t.scored / t.max) * 100) : 0;
            const barColor = tPct >= 80 ? 'bg-emerald-400' : tPct >= 60 ? 'bg-amber-400' : 'bg-rose-400';
            return (
              <div key={t.topicArea}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${TOPIC_COLORS[t.topicArea] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                      {TOPIC_LABELS[t.topicArea] ?? t.topicArea}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-600">{t.scored}/{t.max}pt ({tPct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <progress
                    className={`w-full h-full ${barColor === 'bg-emerald-400' ? 'accent-emerald-500' : barColor === 'bg-amber-400' ? 'accent-amber-500' : 'accent-rose-500'}`}
                    max={100}
                    value={tPct}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DoK breakdown */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
        <h3 className="font-black text-gray-700 mb-4">Резултат по DoK ниво</h3>
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(l => {
            const d = dokMap[l];
            const dp = d.max > 0 ? Math.round((d.scored / d.max) * 100) : null;
            return (
              <div key={l} className="text-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                <DokBadge level={l as DokLevel} size="compact" />
                <p className="text-lg font-black text-gray-800 mt-1">{dp !== null ? `${dp}%` : '—'}</p>
                <p className="text-xs text-gray-400">{d.scored}/{d.max}pt</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Adaptive recommendation */}
      {weakTopics.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="font-black text-amber-800 mb-2">📌 Препорака</h3>
          <p className="text-sm text-amber-700">
            Зајакни ги овие теми со повеќе вежба:
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {weakTopics.map(t => (
              <span key={t.topicArea} className={`text-xs font-bold px-2 py-1 rounded-full border ${TOPIC_COLORS[t.topicArea] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {TOPIC_LABELS[t.topicArea] ?? t.topicArea} ({Math.round((t.scored / t.max) * 100)}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Wrong questions summary */}
      {results.filter(r => !r.correct && !r.state.skipped).length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <h3 className="font-black text-gray-700 mb-3">
            Погрешни прашања ({results.filter(r => !r.correct && !r.state.skipped).length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {results.filter(r => !r.correct && !r.state.skipped).map(r => (
              <div key={r.item.questionNumber + r.item.examId} className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl">
                <span className="text-xs font-black text-rose-600 shrink-0 mt-0.5">Q{r.item.questionNumber}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 line-clamp-2"><MathRenderer text={r.item.questionText} /></p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.item.examLabel}</p>
                </div>
                <ScorePill score={r.scored} max={r.max} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {wrongItems.length > 0 && (
          <button
            type="button"
            onClick={() => onRetryWrong(wrongItems)}
            className="flex-1 py-3 rounded-xl font-black bg-rose-500 text-white hover:bg-rose-600 shadow-lg hover:-translate-y-0.5 transition-all"
          >
            🔁 Повтори грешки ({wrongItems.length})
          </button>
        )}
        <button
          type="button"
          onClick={onNewSession}
          className="flex-1 py-3 rounded-xl font-black bg-brand-primary text-white hover:bg-brand-secondary shadow-lg hover:-translate-y-0.5 transition-all"
        >
          ✦ Нова сесија
        </button>
      </div>
    </div>
  );
}

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

  const { completeDay } = useMaturaMissions();

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
      if (!item) return;
      max += item.points;
      if (!isOpen(item) && s.submitted && s.mcPick === item.correctAnswer.trim()) scored += 1;
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
      if (topicArea && item.topicArea !== topicArea) return;
      matched++;
      if (!isOpen(item)) {
        max += 1;
        if (s.submitted && s.mcPick === item.correctAnswer.trim()) scored += 1;
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
        if (!isOpen(item)) {
          max += 1;
          if (s.submitted && s.mcPick === item.correctAnswer.trim()) scored += 1;
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
    if (isLast) { saveConceptProgress(); setPhase('results'); return; }
    setCurrent(c => c + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isLast, saveConceptProgress]);

  const handleSkip = useCallback(() => {
    updateState(current, { skipped: true, submitted: false });
    if (isLast) { saveConceptProgress(); setPhase('results'); return; }
    setCurrent(c => c + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current, isLast, updateState, saveConceptProgress]);

  // Loading overlay while fetching questions after "Започни"
  if (pendingCfg && (qLoading || !firestoreQuestions.length)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-brand-primary border-t-transparent animate-spin" />
        <p className="text-gray-500 font-medium">Се вчитуваат прашањата…</p>
      </div>
    );
  }

  // ── Render ──
  if (phase === 'setup') {
    return (
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
    );
  }

  if (phase === 'results') {
    return (
      <ResultsScreen
        items={queue}
        states={states}
        onRetryWrong={handleRetryWrong}
        onNewSession={() => setPhase('setup')}
      />
    );
  }

  // practice
  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-black text-brand-primary flex-1">Адаптивна практика</h2>
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
    </div>
  );
}
