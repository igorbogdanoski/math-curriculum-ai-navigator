/**
 * MaturaLibraryView — M2 (Firestore edition)
 *
 * Data source: Firestore matura_exams + matura_questions (lazy per exam).
 * Scales to 78+ exams without bundle growth.
 *
 * Browse mode  : filter / reveal answers.
 * Practice mode:
 *   Part 1 MC  → auto-grade (click choice).
 *   Part 2 open → Gemini AI text-grade.
 *   Part 3 open → Self-assess rubric + optional AI.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { MathRenderer }    from '../components/common/MathRenderer';
import { DokBadge }        from '../components/common/DokBadge';
import { callGeminiProxy } from '../services/gemini/core';
import { useMaturaExams, useMaturaQuestions } from '../hooks/useMatura';
import {
  buildGradeCacheKey,
  getCachedAIGrade,
  saveAIGrade,
} from '../services/firestoreService.matura';
import type { MaturaQuestion, MaturaExamMeta } from '../services/firestoreService.matura';
import type { MaturaChoice, DokLevel } from '../types';
import { SECONDARY_TRACK_TO_MATURA_TRACKS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─── Constants ───────────────────────────────────────────────────────────────
const CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];

const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Алгебра', analiza: 'Анализа', geometrija: 'Геометрија',
  trigonometrija: 'Тригонометрија', 'matrici-vektori': 'Матрици/Вектори',
  broevi: 'Броеви', statistika: 'Статистика', kombinatorika: 'Комбинаторика',
};
const TOPIC_COLORS: Record<string, string> = {
  algebra: 'bg-blue-100 text-blue-800', analiza: 'bg-purple-100 text-purple-800',
  geometrija: 'bg-green-100 text-green-800', trigonometrija: 'bg-orange-100 text-orange-800',
  'matrici-vektori': 'bg-teal-100 text-teal-800', broevi: 'bg-gray-100 text-gray-700',
  statistika: 'bg-yellow-100 text-yellow-800', kombinatorika: 'bg-pink-100 text-pink-800',
};
const PART_LABELS: Record<number, string> = { 1: 'Дел I', 2: 'Дел II', 3: 'Дел III' };
const PART_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-700', 2: 'bg-amber-100 text-amber-700', 3: 'bg-rose-100 text-rose-700',
};
const LANG_FLAGS: Record<string, string> = { mk: '🇲🇰 МК', al: '🇦🇱 АЛ', tr: '🇹🇷 ТР' };
const SESSION_LABELS: Record<string, string> = {
  june:       'Јуни',
  august:     'Август',
  march:      'Март',
  // Концепција 2025 — Државен испитен центар
  ucilisna:   'Училишна матура',
  bank:       'Базен прашања',
  zavrshen:   'Завршен испит',
};
const TRACK_LABELS: Record<string, string> = {
  // Државна матура (ДИЦ)
  'gymnasium':            'Државна гимназиска матура',
  // Стручна матура — по профил
  'vocational-it':        'Стручна матура — ИТ',
  'vocational-economics': 'Стручна матура — Економија',
  'vocational-electro':   'Стручна матура — Електро',
  'vocational-mechanical':'Стручна матура — Машинство',
  'vocational-health':    'Стручна матура — Здравство',
  'vocational-civil':     'Стручна матура — Градежништво',
  'vocational-art':       'Уметничка матура',
  // Завршен испит (2–3 год. стручно)
  'vocational3-zavrshen': 'Завршен испит — Стручно 3-год',
  'vocational2-zavrshen': 'Завршен испит — Стручно 2-год',
  // Generic fallback
  'vocational4':          'Стручна матура (4-год)',
};

// ─── AI grade type ───────────────────────────────────────────────────────────
interface AIGrade {
  score: number; maxScore: number; feedback: string;
  partA?: boolean; partB?: boolean; commentA?: string; commentB?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isOpen(q: MaturaQuestion): boolean {
  if (q.questionType === 'open' || q.questionType === 'short') return true;
  if (q.questionType === 'mc') return false;
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
function examLabel(e: MaturaExamMeta): string {
  const session = SESSION_LABELS[e.session] ?? e.session;
  const lang    = LANG_FLAGS[e.language]    ?? e.language.toUpperCase();
  return `${session} ${e.year} — ${lang}`;
}

// ─── AI grading ──────────────────────────────────────────────────────────────
async function gradePart2(q: MaturaQuestion, answerA: string, answerB: string): Promise<AIGrade> {
  const cacheInput = `${answerA}|||${answerB}`;
  const cacheKey   = buildGradeCacheKey(q.examId, q.questionNumber, cacheInput);

  // Cache hit — skip Gemini call entirely
  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    return {
      score: cached.score, maxScore: cached.maxPoints,
      feedback: cached.feedback,
      partA: undefined, partB: undefined,
      commentA: undefined, commentB: undefined,
    };
  }

  const prompt = `Ти си асистент за оценување матура на македонски јазик.
Задача Q${q.questionNumber}: ${q.questionText}
Точен одговор: ${q.correctAnswer}
Одговор на ученикот: А. ${answerA||'(нема)'} | Б. ${answerB||'(нема)'}
Оцени ги двата дела (А и Б). Секој дел вреди 1 поен.
Врати САМО валиден JSON:
{"score":0,"partA":false,"partB":false,"commentA":"...","commentB":"...","feedback":"..."}
- Споредувај математичко значење, не буквален текст.
- score = 0, 1 или 2.`;

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
Опис на решението: ${desc||'(нема)'}
Врати САМО валиден JSON:
{"score":0,"feedback":"коментар на македонски"}
- score: цел број 0..${q.points}. Биди праведен и охрабрувачки.`;

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

// ─── Skeleton loader ──────────────────────────────────────────────────────────
function QuestionSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="h-4 w-8 bg-gray-200 rounded" />
        <div className="h-4 w-14 bg-gray-200 rounded-full" />
        <div className="h-4 w-20 bg-gray-200 rounded-full" />
        <div className="ml-auto h-4 w-12 bg-gray-200 rounded" />
      </div>
      <div className="px-4 py-4 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-4/5" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
      </div>
      <div className="px-4 pb-4 space-y-1.5">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-9 bg-gray-100 rounded-lg w-full" />
        ))}
      </div>
    </div>
  );
}

// ─── DoK bar ─────────────────────────────────────────────────────────────────
function DokBar({ questions }: { questions: MaturaQuestion[] }) {
  const total  = questions.length;
  if (!total) return null;
  const counts = [1,2,3,4].map(l => questions.filter(q => q.dokLevel === l).length);
  const colors  = ['bg-green-400','bg-blue-400','bg-orange-400','bg-red-400'];
  const labels  = ['DoK 1','DoK 2','DoK 3','DoK 4'];
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 rounded-full overflow-hidden flex-1 min-w-[80px]">
        {counts.map((c, i) => c > 0 && (
          <div key={i} className={`${colors[i]} h-full`} style={{ width: `${(c/total)*100}%` }} title={`${labels[i]}: ${c}`} />
        ))}
      </div>
      <span className="text-xs text-gray-500 shrink-0">{total} пр.</span>
    </div>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0;
  const cls = pct >= 0.9 ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : pct >= 0.5 ? 'bg-amber-100 text-amber-800 border-amber-300'
            :               'bg-red-100 text-red-800 border-red-300';
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>
      {score}/{max}
    </span>
  );
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────
interface CardProps {
  q: MaturaQuestion;
  revealed: boolean;
  onReveal: () => void;
  onHide: () => void;
  practiceMode: boolean;
  mcPick?: string;
  onMcPick?: (ch: string) => void;
  answerA: string; setAnswerA: (v: string) => void;
  answerB: string; setAnswerB: (v: string) => void;
  onGradeP2: () => void;
  gradingP2: boolean;
  aiGrade?: AIGrade;
  selfChecks: boolean[];
  onSelfCheck: (idx: number, val: boolean) => void;
  aiDesc: string; setAiDesc: (v: string) => void;
  onGradeP3: () => void;
  gradingP3: boolean;
  aiGradeP3?: AIGrade;
  aiError?: string;
}

function QuestionCard({
  q, revealed, onReveal, onHide, practiceMode,
  mcPick, onMcPick,
  answerA, setAnswerA, answerB, setAnswerB, onGradeP2, gradingP2, aiGrade,
  selfChecks, onSelfCheck,
  aiDesc, setAiDesc, onGradeP3, gradingP3, aiGradeP3, aiError,
}: CardProps) {
  const open         = isOpen(q);
  const hasSubParts  = open && q.part === 2 && /[АA]\./.test(q.correctAnswer);
  const sub          = hasSubParts ? parseSubParts(q.correctAnswer) : null;
  const ta           = q.topicArea ?? '';
  const selfScore    = selfChecks.filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
        <span className="font-bold text-gray-700 text-sm">Q{q.questionNumber}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PART_COLORS[q.part]}`}>{PART_LABELS[q.part]}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${open ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
          {open ? 'Отворена' : 'MC'}
        </span>
        {ta && <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TOPIC_COLORS[ta] ?? 'bg-gray-100 text-gray-600'}`}>{TOPIC_LABELS[ta] ?? ta}</span>}
        {q.dokLevel != null && <DokBadge level={q.dokLevel as DokLevel} size="compact" showTooltip />}
        <span className="ml-auto text-xs font-bold text-gray-500">{q.points} {q.points === 1 ? 'поен' : 'поени'}</span>
      </div>

      {/* Question text */}
      <div className="px-4 pt-3 pb-2 flex-1">
        {q.hasImage && q.imageUrls?.[0] && (
          <img src={q.imageUrls[0]} alt={q.imageDescription ?? 'Слика кон задача'}
            className="mb-3 max-h-56 rounded-xl border border-gray-100 shadow-sm object-contain" />
        )}
        {q.hasImage && !q.imageUrls?.[0] && (
          <div className="mb-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
            <span>📷</span><span>{q.imageDescription ?? 'Слика/Figure'}</span>
          </div>
        )}
        <div className="text-sm leading-relaxed text-gray-800">
          <MathRenderer text={q.questionText} />
        </div>
      </div>

      {/* MC choices */}
      {!open && q.choices && (
        <div className="px-4 pb-2 space-y-1">
          {CHOICES.map(ch => {
            const text = (q.choices as Record<string,string>)[ch];
            if (!text) return null;
            const isCorrect = revealed && q.correctAnswer === ch;
            const isWrong   = practiceMode && revealed && mcPick === ch && ch !== q.correctAnswer;
            const isPicked  = practiceMode && mcPick === ch;
            const cls = isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : isWrong   ? 'bg-red-50 border-red-300 text-red-700'
                      : isPicked  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      :             'bg-gray-50 border-gray-100 text-gray-700 hover:border-indigo-200';
            return (
              <button key={ch} type="button"
                onClick={() => practiceMode && !revealed && onMcPick?.(ch)}
                disabled={!practiceMode || revealed}
                className={`w-full flex items-start gap-2 rounded-lg px-3 py-2 text-sm border transition-colors text-left ${cls}`}
              >
                <span className="shrink-0 font-bold w-5">{ch}</span>
                <span className="flex-1"><MathRenderer text={text} /></span>
                {isCorrect && <span className="shrink-0 text-emerald-600 font-bold">✓</span>}
                {isWrong   && <span className="shrink-0 text-red-600 font-bold">✗</span>}
              </button>
            );
          })}
          {practiceMode && mcPick && revealed && (
            <div className={`text-xs font-semibold mt-1 px-2 py-1.5 rounded-lg ${mcPick === q.correctAnswer ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {mcPick === q.correctAnswer ? '✅ Точно! +1 поен' : `❌ Нeточно. Точен одговор: ${q.correctAnswer}`}
            </div>
          )}
        </div>
      )}

      {/* Part 2 — AI grading (practice, before reveal) */}
      {open && q.part === 2 && practiceMode && !revealed && (
        <div className="px-4 pb-3 space-y-2">
          <p className="text-xs text-gray-500 font-medium">Внеси го твојот одговор:</p>
          {(['А','Б'] as const).map((ltr, i) => {
            const val    = i === 0 ? answerA : answerB;
            const setVal = i === 0 ? setAnswerA : setAnswerB;
            return (
              <div key={ltr}>
                <label htmlFor={`p2-${q.questionNumber}-${ltr}`} className="text-xs font-bold text-gray-600">{ltr}.</label>
                <input
                  id={`p2-${q.questionNumber}-${ltr}`}
                  type="text" value={val} onChange={e => setVal(e.target.value)}
                  disabled={!!aiGrade}
                  placeholder={`Одговор ${ltr}…`}
                  className="mt-0.5 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-indigo-300 focus:border-indigo-400 disabled:bg-gray-50" />
                {aiGrade && (
                  <p className={`text-xs mt-0.5 font-medium ${(i===0?aiGrade.partA:aiGrade.partB)?'text-emerald-600':'text-red-600'}`}>
                    {(i===0?aiGrade.partA:aiGrade.partB)?'✓ ':'✗ '}
                    {i===0?aiGrade.commentA:aiGrade.commentB}
                  </p>
                )}
              </div>
            );
          })}
          {aiGrade ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-indigo-700">AI оценка</span>
                <ScoreBadge score={aiGrade.score} max={aiGrade.maxScore} />
              </div>
              <p className="text-xs text-indigo-700">{aiGrade.feedback}</p>
            </div>
          ) : (
            <button type="button" disabled={gradingP2 || (!answerA && !answerB)} onClick={onGradeP2}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
              {gradingP2 ? 'Оценување…' : 'Провери со AI'}
            </button>
          )}
          {aiError && <p className="text-xs text-red-600">{aiError}</p>}
        </div>
      )}

      {/* Part 3 self-assess (practice, after reveal) */}
      {open && q.part === 3 && practiceMode && revealed && (
        <div className="px-4 pb-3 space-y-2">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs font-bold text-amber-700 mb-2">Самооценување ({selfScore}/{q.points}pt)</p>
            <div className="grid grid-cols-2 gap-1">
              {Array.from({ length: q.points }).map((_, pi) => (
                <label key={pi} className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700">
                  <input type="checkbox" checked={selfChecks[pi] ?? false}
                    onChange={e => onSelfCheck(pi, e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-600" />
                  Поен {pi+1}
                </label>
              ))}
            </div>
          </div>
          {!aiGradeP3 && (
            <div className="space-y-1">
              <p className="text-xs text-gray-500 font-medium">Опционално — Провери со AI:</p>
              <textarea value={aiDesc} onChange={e => setAiDesc(e.target.value)} rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-purple-300 resize-none"
                placeholder="Накратко опиши го твоето решение…" />
              <button type="button" disabled={gradingP3 || !aiDesc.trim()} onClick={onGradeP3}
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                {gradingP3 ? 'AI оценува…' : 'Провери со AI'}
              </button>
            </div>
          )}
          {aiGradeP3 && (
            <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-700">AI оценка</span>
                <ScoreBadge score={aiGradeP3.score} max={aiGradeP3.maxScore} />
              </div>
              <p className="text-xs text-purple-700 leading-relaxed">{aiGradeP3.feedback}</p>
            </div>
          )}
          {aiError && <p className="text-xs text-red-600">{aiError}</p>}
        </div>
      )}

      {/* Reveal / Hide */}
      <div className="px-4 pb-4 mt-auto">
        {(!open || q.part === 3 || !practiceMode) && (
          !revealed ? (
            <button type="button" onClick={onReveal}
              className="w-full py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
              {open ? (practiceMode ? '📖 Прикажи модел + самооценувај' : '👁 Прикажи одговор') : '👁 Прикажи точен'}
            </button>
          ) : (
            <button type="button" onClick={onHide}
              className="w-full py-2 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
              Скриј одговор
            </button>
          )
        )}
        {revealed && (
          <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold mb-1">Точен одговор:</p>
            <div className="text-sm text-gray-800"><MathRenderer text={q.correctAnswer} /></div>
          </div>
        )}
        {open && q.part === 2 && practiceMode && revealed && (
          <button type="button" onClick={onHide}
            className="w-full mt-2 py-2 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
            Скриј одговор
          </button>
        )}
      </div>
    </div>
  );
}

// ─── InternalMaturaTab ────────────────────────────────────────────────────────

interface InternalQuestion {
  questionNumber: number;
  part: 1 | 2;
  questionType: 'mc' | 'open';
  questionText: string;
  choices?: Record<string, string>;
  correctAnswer: string;
  topic: string;
  topicArea: string;
  dokLevel: DokLevel;
  conceptIds: string[];
  hints?: string[];
  aiSolution?: string;
  successRatePercent?: number;
}

type IntPracticePhase = 'browse' | 'practice' | 'results';

const INT_CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];
const INT_PAGE_SIZE = 20;
const INT_MC_COUNT  = 15;
const INT_OPEN_COUNT = 4;

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function InternalMaturaTab() {
  const { firebaseUser } = useAuth();
  const [allQuestions, setAllQuestions] = useState<InternalQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Browse filters
  const [filterTopic,  setFilterTopic]  = useState('');
  const [filterDok,    setFilterDok]    = useState<0|1|2|3|4>(0);
  const [filterType,   setFilterType]   = useState<''|'mc'|'open'>('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(0);
  const [revealedIds,  setRevealedIds]  = useState<Set<number>>(new Set());

  // Practice state
  const [phase,           setPhase]           = useState<IntPracticePhase>('browse');
  const [practiceQs,      setPracticeQs]      = useState<InternalQuestion[]>([]);
  const [practiceIdx,     setPracticeIdx]      = useState(0);
  const [mcPicks,         setMcPicks]         = useState<Record<number,string>>({});
  const [openRevealed,    setOpenRevealed]    = useState<Set<number>>(new Set());
  const [selfScores,      setSelfScores]      = useState<Record<number, number>>({});
  const [saving,          setSaving]          = useState(false);
  const savedRef = useRef(false);

  // Lazy load JSON
  useEffect(() => {
    import('../data/matura/raw/internal-matura-bank-gymnasium-mk.json')
      .then((mod) => {
        setAllQuestions((mod.default as unknown as { questions: InternalQuestion[] }).questions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [filterTopic, filterDok, filterType, search]);

  const topics = useMemo(
    () => [...new Set(allQuestions.map(q => q.topicArea))].sort(),
    [allQuestions],
  );

  const filtered = useMemo(() => allQuestions.filter(q => {
    if (filterTopic && q.topicArea !== filterTopic)   return false;
    if (filterDok   && q.dokLevel  !== filterDok)     return false;
    if (filterType === 'mc'   && q.questionType !== 'mc')   return false;
    if (filterType === 'open' && q.questionType !== 'open') return false;
    if (search) {
      const s = search.toLowerCase();
      return q.questionText.toLowerCase().includes(s) || q.topicArea.toLowerCase().includes(s);
    }
    return true;
  }), [allQuestions, filterTopic, filterDok, filterType, search]);

  const pageQs    = filtered.slice(page * INT_PAGE_SIZE, (page + 1) * INT_PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / INT_PAGE_SIZE);

  const stats = useMemo(() => allQuestions.length > 0 ? {
    total: allQuestions.length,
    mc:    allQuestions.filter(q => q.questionType === 'mc').length,
    open:  allQuestions.filter(q => q.questionType !== 'mc').length,
  } : null, [allQuestions]);

  // ── Practice helpers ──
  function startPractice() {
    const mc   = shuffle(allQuestions.filter(q => q.questionType === 'mc')).slice(0, INT_MC_COUNT);
    const open = shuffle(allQuestions.filter(q => q.questionType !== 'mc')).slice(0, INT_OPEN_COUNT);
    setPracticeQs(shuffle([...mc, ...open]));
    setPracticeIdx(0);
    setMcPicks({});
    setOpenRevealed(new Set());
    setSelfScores({});
    savedRef.current = false;
    setPhase('practice');
  }

  function nextQuestion() {
    if (practiceIdx + 1 < practiceQs.length) {
      setPracticeIdx(i => i + 1);
    } else {
      finishPractice();
    }
  }

  function finishPractice() {
    setPhase('results');
    if (!savedRef.current && firebaseUser) {
      savedRef.current = true;
      const mcQs = practiceQs.filter(q => q.questionType === 'mc');
      const correctMC = mcQs.filter(q => mcPicks[q.questionNumber] === q.correctAnswer).length;
      const openPts = practiceQs
        .filter(q => q.questionType !== 'mc')
        .reduce((sum, q) => sum + (selfScores[q.questionNumber] ?? 0), 0);
      const maxPts = mcQs.length + practiceQs.filter(q => q.questionType !== 'mc').length * 4;
      const scored  = correctMC + openPts;
      const pct = maxPts > 0 ? Math.round(scored / maxPts * 100) : 0;
      setSaving(true);
      firestoreService.saveQuizResult({
        quizId:         'internal-matura-gymnasium',
        quizTitle:      'Вежба — Училишна матура (Гимназиско)',
        score:          scored,
        correctCount:   correctMC,
        totalQuestions: practiceQs.length,
        percentage:     pct,
        gradeLevel:     13,
        conceptId:      undefined,
      }).catch(() => {/* fire-and-forget */}).finally(() => setSaving(false));
    }
  }

  // ── Render: results phase ──
  if (phase === 'results') {
    const mcQs     = practiceQs.filter(q => q.questionType === 'mc');
    const openQs   = practiceQs.filter(q => q.questionType !== 'mc');
    const correctMC = mcQs.filter(q => mcPicks[q.questionNumber] === q.correctAnswer).length;
    const openPts   = openQs.reduce((s, q) => s + (selfScores[q.questionNumber] ?? 0), 0);
    const maxPts    = mcQs.length + openQs.length * 4;
    const scored    = correctMC + openPts;
    const pct       = maxPts > 0 ? Math.round(scored / maxPts * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">{pct >= 70 ? '🎉' : pct >= 50 ? '📚' : '💪'}</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Резултат: {pct}%</h2>
        <p className="text-gray-500 mb-1">{scored} / {maxPts} поени</p>
        <p className="text-sm text-gray-400 mb-6">MC: {correctMC}/{mcQs.length} · Отворени: {openPts}/{openQs.length * 4} pt</p>
        {saving && <p className="text-xs text-violet-500 mb-3">Се зачувува резултатот…</p>}
        <div className="flex justify-center gap-3">
          <button type="button" onClick={startPractice}
            className="px-6 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 text-sm">
            Вежбај повторно
          </button>
          <button type="button" onClick={() => setPhase('browse')}
            className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 text-sm">
            Назад кон библиотека
          </button>
        </div>
      </div>
    );
  }

  // ── Render: practice phase ──
  if (phase === 'practice' && practiceQs.length > 0) {
    const q  = practiceQs[practiceIdx];
    const n  = q.questionNumber;
    const isMC   = q.questionType === 'mc';
    const picked = mcPicks[n];
    const revealed = openRevealed.has(n);
    const isLast = practiceIdx + 1 >= practiceQs.length;

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.round(((practiceIdx + 1) / practiceQs.length) * 100)}%` }}
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0">
            {practiceIdx + 1} / {practiceQs.length}
          </span>
          <button type="button" onClick={finishPractice}
            className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0">
            Заврши
          </button>
        </div>

        {/* Question card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isMC ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
              {isMC ? 'MC · 1 поен' : 'Отворено · 4 поени'}
            </span>
            <DokBadge level={q.dokLevel} size="compact" />
            <span className="text-xs text-gray-400 ml-auto">{q.topicArea}</span>
          </div>

          <div className="text-sm text-gray-800 mb-4 leading-relaxed">
            <MathRenderer text={q.questionText} />
          </div>

          {/* MC choices */}
          {isMC && q.choices && (
            <div className="space-y-2">
              {INT_CHOICES.map(ch => {
                const label = q.choices![ch];
                if (!label) return null;
                const isChosen  = picked === ch;
                const isCorrect = q.correctAnswer === ch;
                const showResult = picked !== undefined;
                let cls = 'border-gray-200 bg-white text-gray-700 hover:border-violet-300';
                if (showResult && isCorrect)              cls = 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold';
                else if (showResult && isChosen)          cls = 'border-red-400 bg-red-50 text-red-700';
                return (
                  <button key={ch} type="button"
                    disabled={picked !== undefined}
                    onClick={() => setMcPicks(p => ({ ...p, [n]: ch }))}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${cls}`}>
                    <span className="font-semibold mr-2">{ch}.</span>
                    <MathRenderer text={label} />
                  </button>
                );
              })}
              {picked && (
                <p className={`text-xs font-semibold mt-1 ${picked === q.correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}>
                  {picked === q.correctAnswer ? '✓ Точно!' : `✗ Точен: ${q.correctAnswer}`}
                </p>
              )}
            </div>
          )}

          {/* Open question */}
          {!isMC && (
            <div className="space-y-3">
              {!revealed ? (
                <button type="button"
                  onClick={() => setOpenRevealed(s => { const n2 = new Set(s); n2.add(n); return n2; })}
                  className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100">
                  👁 Прикажи точен одговор
                </button>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Точен одговор:</p>
                  <div className="text-sm text-gray-800"><MathRenderer text={q.correctAnswer} /></div>
                </div>
              )}
              {revealed && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Самооценување (0–4 поени):</p>
                  <div className="flex gap-2">
                    {[0,1,2,3,4].map(pts => (
                      <button key={pts} type="button"
                        onClick={() => setSelfScores(p => ({ ...p, [n]: pts }))}
                        className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                          selfScores[n] === pts ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                        }`}>
                        {pts}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <button type="button"
            onClick={() => setPracticeIdx(i => Math.max(0, i - 1))}
            disabled={practiceIdx === 0}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 disabled:opacity-40">
            ← Претходно
          </button>
          <button type="button"
            onClick={nextQuestion}
            disabled={isMC && picked === undefined}
            className="px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40">
            {isLast ? 'Завршувам' : 'Следно →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: browse phase ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">📝 Базен прашања — Училишна матура (Гимназиско)</h2>
              {stats && (
                <p className="text-xs text-gray-500">
                  {stats.total} прашања · {stats.mc} MC · {stats.open} отворени
                </p>
              )}
            </div>
            <button type="button" onClick={startPractice}
              disabled={allQuestions.length === 0}
              className="ml-auto px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 shadow-sm">
              ✏️ Вежбај ({INT_MC_COUNT} MC + {INT_OPEN_COUNT} отворени)
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input type="text" placeholder="Пребарај…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <select title="Избери тема" aria-label="Избери тема" value={filterTopic} onChange={e => setFilterTopic(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:ring-violet-300">
            <option value="">Сите теми</option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select title="Избери тип" aria-label="Избери тип" value={filterType} onChange={e => setFilterType(e.target.value as ''|'mc'|'open')}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700">
            <option value="">Сите типови</option>
            <option value="mc">MC</option>
            <option value="open">Отворени</option>
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs font-semibold text-gray-500">DoK:</span>
          {([0,1,2,3,4] as const).map(d => (
            <button key={d} type="button" onClick={() => setFilterDok(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${filterDok===d?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {d === 0 ? 'Сите' : `DoK ${d}`}
            </button>
          ))}
          <span className="ml-2 text-xs text-gray-400">{filtered.length} прашања</span>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : pageQs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">Нема резултати</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {pageQs.map(q => {
              const n = q.questionNumber;
              const isRev = revealedIds.has(n);
              return (
                <div key={n} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-400">#{n}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${q.questionType === 'mc' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                      {q.questionType === 'mc' ? 'MC' : 'Отворено'}
                    </span>
                    <DokBadge level={q.dokLevel} size="compact" />
                    <span className="text-xs text-gray-400 ml-auto">{q.topicArea}</span>
                  </div>
                  <div className="text-sm text-gray-800 leading-relaxed">
                    <MathRenderer text={q.questionText} />
                  </div>
                  {q.questionType === 'mc' && q.choices && (
                    <div className="space-y-1">
                      {INT_CHOICES.map(ch => q.choices?.[ch] ? (
                        <div key={ch} className={`text-xs px-3 py-1.5 rounded-lg border ${isRev && q.correctAnswer===ch ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold' : 'border-gray-100 text-gray-600'}`}>
                          <span className="font-semibold mr-1">{ch}.</span><MathRenderer text={q.choices[ch]!} />
                        </div>
                      ) : null)}
                    </div>
                  )}
                  {isRev && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-700 mb-0.5">Точен одговор:</p>
                      <div className="text-xs text-gray-800"><MathRenderer text={q.correctAnswer} /></div>
                    </div>
                  )}
                  <button type="button"
                    onClick={() => setRevealedIds(prev => {
                      const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s;
                    })}
                    className="text-xs text-violet-600 hover:underline self-start mt-auto">
                    {isRev ? '🙈 Скриј' : '👁 Прикажи одговор'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:border-violet-300 disabled:opacity-40">
              ← Претх.
            </button>
            <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:border-violet-300 disabled:opacity-40">
              Следна →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────
export function MaturaLibraryView() {
  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'dim' | 'ucilisna'>('dim');

  // ── Firestore data ──
  const { exams, loading: examsLoading, error: examsError } = useMaturaExams();
  const { user } = useAuth();

  // ── Exam selection (smart default: prefer teacher's secondary track) ──
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  useEffect(() => {
    if (examsLoading || !exams.length || selectedExamId) return;
    const relevantTracks = user?.secondaryTrack
      ? SECONDARY_TRACK_TO_MATURA_TRACKS[user.secondaryTrack] ?? []
      : [];
    const smartDefault = relevantTracks.length > 0
      ? exams.find(e => relevantTracks.includes(e.track ?? ''))
      : undefined;
    if (smartDefault) setSelectedExamId(smartDefault.id);
    // No fallback needed — resolvedId handles it via exams[0]
  }, [exams, examsLoading, user?.secondaryTrack]);

  const resolvedId = selectedExamId || exams[0]?.id || '';

  // Stable array reference for the hook
  const examIdArray = useMemo(() => resolvedId ? [resolvedId] : [], [resolvedId]);
  const { questions: allQuestions, loading: qLoading, error: qError } = useMaturaQuestions(examIdArray);

  const selectedExam = exams.find(e => e.id === resolvedId);

  // ── Filters ──
  const [filterPart,  setFilterPart]  = useState<0|1|2|3>(0);
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDok,   setFilterDok]   = useState<0|1|2|3|4>(0);
  const [filterType,  setFilterType]  = useState<''|'mc'|'open'>('');
  const [search,      setSearch]      = useState('');

  // ── Practice mode ──
  const [practiceMode, setPracticeMode] = useState(false);

  // ── Reveal state ──
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [revealAll,   setRevealAll]   = useState(false);

  // ── Per-question state ──
  const [mcPicks,    setMcPicks]    = useState<Record<number,string>>({});
  const [p2AnswersA, setP2AnswersA] = useState<Record<number,string>>({});
  const [p2AnswersB, setP2AnswersB] = useState<Record<number,string>>({});
  const [aiGrades,   setAiGrades]   = useState<Record<number,AIGrade>>({});
  const [gradingP2,  setGradingP2]  = useState<Set<number>>(new Set());
  const [selfChecks, setSelfChecks] = useState<Record<number,boolean[]>>({});
  const [aiDescs,    setAiDescs]    = useState<Record<number,string>>({});
  const [aiGradesP3, setAiGradesP3] = useState<Record<number,AIGrade>>({});
  const [gradingP3,  setGradingP3]  = useState<Set<number>>(new Set());
  const [aiErrors,   setAiErrors]   = useState<Record<number,string>>({});

  const topicAreas = useMemo(
    () => [...new Set(allQuestions.map(q => q.topicArea).filter(Boolean))] as string[],
    [allQuestions],
  );

  const questions = useMemo(() => allQuestions.filter(q => {
    if (filterPart  && q.part !== filterPart)        return false;
    if (filterDok   && q.dokLevel !== filterDok)     return false;
    if (filterTopic && q.topicArea !== filterTopic)  return false;
    if (filterType === 'mc'   &&  isOpen(q))         return false;
    if (filterType === 'open' && !isOpen(q))         return false;
    if (search) {
      const s = search.toLowerCase();
      return q.questionText.toLowerCase().includes(s) || (q.topic ?? '').toLowerCase().includes(s);
    }
    return true;
  }), [allQuestions, filterPart, filterDok, filterTopic, filterType, search]);

  const stats = useMemo(() => {
    if (!allQuestions.length) return null;
    return {
      total: allQuestions.length,
      mc:    allQuestions.filter(q => !isOpen(q)).length,
      open:  allQuestions.filter(isOpen).length,
      pts:   allQuestions.reduce((s,q) => s + q.points, 0),
    };
  }, [allQuestions]);

  // Reset per-question state on exam switch
  const switchExam = useCallback((id: string) => {
    setSelectedExamId(id);
    setRevealedIds(new Set()); setRevealAll(false);
    setMcPicks({}); setP2AnswersA({}); setP2AnswersB({});
    setAiGrades({}); setAiGradesP3({}); setSelfChecks({});
    setAiDescs({}); setAiErrors({});
    setFilterPart(0); setFilterDok(0); setFilterTopic('');
    setFilterType(''); setSearch('');
  }, []);

  const toggleReveal = useCallback((n: number) => {
    setRevealedIds(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  }, []);
  const hideQ = useCallback((n: number) => {
    setRevealAll(false);
    setRevealedIds(prev => { const s = new Set(prev); s.delete(n); return s; });
  }, []);
  const handleRevealAll = () => {
    if (revealAll) { setRevealedIds(new Set()); setRevealAll(false); }
    else { setRevealedIds(new Set(questions.map(q => q.questionNumber))); setRevealAll(true); }
  };

  const handleGradeP2 = useCallback(async (q: MaturaQuestion) => {
    const n = q.questionNumber;
    setGradingP2(prev => { const s = new Set(prev); s.add(n); return s; });
    setAiErrors(prev => ({ ...prev, [n]: '' }));
    try {
      const grade = await gradePart2(q, p2AnswersA[n] ?? '', p2AnswersB[n] ?? '');
      setAiGrades(prev => ({ ...prev, [n]: grade }));
      setRevealedIds(prev => { const s = new Set(prev); s.add(n); return s; });
    } catch {
      setAiErrors(prev => ({ ...prev, [n]: 'AI грешка — обидете се повторно.' }));
    } finally {
      setGradingP2(prev => { const s = new Set(prev); s.delete(n); return s; });
    }
  }, [p2AnswersA, p2AnswersB]);

  const handleGradeP3 = useCallback(async (q: MaturaQuestion) => {
    const n   = q.questionNumber;
    const desc = aiDescs[n] ?? '';
    if (!desc.trim()) return;
    setGradingP3(prev => { const s = new Set(prev); s.add(n); return s; });
    setAiErrors(prev => ({ ...prev, [n]: '' }));
    try {
      const grade = await gradePart3(q, desc);
      setAiGradesP3(prev => ({ ...prev, [n]: grade }));
    } catch {
      setAiErrors(prev => ({ ...prev, [n]: 'AI грешка — обидете се повторно.' }));
    } finally {
      setGradingP3(prev => { const s = new Set(prev); s.delete(n); return s; });
    }
  }, [aiDescs]);

  const handleSelfCheck = (n: number, maxPts: number, idx: number, val: boolean) => {
    setSelfChecks(prev => {
      const arr = [...(prev[n] ?? Array(maxPts).fill(false))];
      arr[idx] = val; return { ...prev, [n]: arr };
    });
  };

  // ── Render ──
  const loading = examsLoading || qLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ══ Sticky header ══ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">📚 Библиотека — Матура и Испити</h1>
              <p className="text-xs text-gray-500">Државна · Училишна · Завршен испит · {exams.length > 0 ? `${exams.length} испити во базата` : 'Се вчитува…'}</p>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
              <button type="button"
                onClick={() => setActiveTab('dim')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'dim' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                🏛 Државна матура
              </button>
              <button type="button"
                onClick={() => setActiveTab('ucilisna')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'ucilisna' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                📝 Училишна матура
              </button>
            </div>

            {/* DIM-only controls */}
            {activeTab === 'dim' && (
              <>
                <button type="button"
                  onClick={() => setPracticeMode(m => !m)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                    practiceMode ? 'bg-violet-600 text-white border-violet-600 shadow' : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50'
                  }`}
                >
                  {practiceMode ? '✏️ Режим: Вежба' : '📖 Режим: Прелистувај'}
                </button>

                <div className="ml-auto">
                  {examsLoading ? (
                    <div className="flex gap-1">
                      {[1,2,3].map(i => <div key={i} className="h-9 w-28 bg-gray-100 animate-pulse rounded-xl" />)}
                    </div>
                  ) : (
                    <select
                      title="Избери испит"
                      aria-label="Избери испит"
                      value={resolvedId}
                      onChange={e => switchExam(e.target.value)}
                      className="text-sm border border-gray-200 rounded-xl px-3 py-2 font-semibold text-gray-700 bg-white focus:ring-indigo-300 focus:border-indigo-400 max-w-xs"
                    >
                      {(() => {
                        const trackMap = new Map<string, MaturaExamMeta[]>();
                        for (const e of exams) {
                          const t = e.track ?? 'gymnasium';
                          if (!trackMap.has(t)) trackMap.set(t, []);
                          trackMap.get(t)!.push(e);
                        }
                        return Array.from(trackMap.entries()).map(([track, trackExams]) => (
                          <optgroup key={track} label={TRACK_LABELS[track] ?? track}>
                            {trackExams.map(e => (
                              <option key={e.id} value={e.id}>{examLabel(e)}</option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats row — DIM only */}
        {activeTab === 'dim' && stats && !loading && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-4">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-600"><span className="font-bold text-gray-900">{stats.total}</span> пр.</span>
              <span className="text-gray-600"><span className="font-bold text-indigo-700">{stats.mc}</span> MC</span>
              <span className="text-gray-600"><span className="font-bold text-violet-700">{stats.open}</span> отворени</span>
              <span className="text-gray-600"><span className="font-bold text-emerald-700">{stats.pts}</span> поени</span>
            </div>
            <div className="flex-1 min-w-[120px]"><DokBar questions={allQuestions} /></div>
            {practiceMode && (
              <div className="text-xs text-violet-600 font-medium bg-violet-50 px-2 py-1 rounded-lg">
                Дел II: AI оценување · Дел III: самооценување + опц. AI
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Училишна матура tab ══ */}
      {activeTab === 'ucilisna' && <InternalMaturaTab />}

      {/* ══ DIM content ══ */}
      {activeTab === 'dim' && (examsError || qError) && (
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-medium">
            ⚠️ {examsError ?? qError}
          </div>
        </div>
      )}

      {/* ══ Filter bar ══ */}
      {activeTab === 'dim' && !examsLoading && (
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input type="text" placeholder="Пребарај прашање или тема…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <button type="button" onClick={handleRevealAll}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${revealAll ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
              {revealAll ? '🙈 Скриј сè' : '👁 Прикажи сè'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Дел:</span>
            {([0,1,2,3] as const).map(p => (
              <button key={p} type="button" onClick={() => setFilterPart(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterPart===p?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {p === 0 ? 'Сите' : PART_LABELS[p]}
              </button>
            ))}
            <span className="ml-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Тип:</span>
            {([['','Сите'],['mc','MC'],['open','Отворена']] as const).map(([v,l]) => (
              <button key={v} type="button" onClick={() => setFilterType(v)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterType===v?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {l}
              </button>
            ))}
            <span className="ml-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">DoK:</span>
            {([0,1,2,3,4] as const).map(d => (
              <button key={d} type="button" onClick={() => setFilterDok(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterDok===d?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {d === 0 ? 'Сите' : `DoK ${d}`}
              </button>
            ))}
          </div>

          {topicAreas.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Тема:</span>
              <button type="button" onClick={() => setFilterTopic('')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterTopic===''?'bg-gray-700 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                Сите
              </button>
              {topicAreas.map(ta => (
                <button key={ta} type="button" onClick={() => setFilterTopic(ta === filterTopic ? '' : ta)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterTopic===ta?'bg-gray-700 text-white':`${TOPIC_COLORS[ta]??'bg-gray-100 text-gray-600'} hover:opacity-80`}`}>
                  {TOPIC_LABELS[ta] ?? ta}
                </button>
              ))}
            </div>
          )}

          {!loading && (
            <div className="text-xs text-gray-500">
              {questions.length} прашање{questions.length !== 1 ? 'а' : ''} пронајдено
              {(filterPart || filterDok || filterTopic || filterType || search) && (
                <button type="button"
                  onClick={() => { setFilterPart(0); setFilterDok(0); setFilterTopic(''); setFilterType(''); setSearch(''); }}
                  className="ml-2 text-indigo-600 hover:underline">
                  Исчисти филтри
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ Question grid (DIM) ══ */}
      {activeTab === 'dim' && <div className="max-w-6xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {Array.from({ length: 6 }).map((_, i) => <QuestionSkeleton key={i} />)}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">Нема резултати</p>
            <p className="text-sm mt-1">Промени ги филтрите или пребарувањето</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {questions.map(q => {
              const n      = q.questionNumber;
              const checks = selfChecks[n] ?? Array(q.points).fill(false);
              return (
                <QuestionCard
                  key={`${resolvedId}-${n}`}
                  q={q}
                  revealed={revealAll || revealedIds.has(n)}
                  onReveal={() => toggleReveal(n)}
                  onHide={() => hideQ(n)}
                  practiceMode={practiceMode}
                  mcPick={mcPicks[n]}
                  onMcPick={ch => setMcPicks(p => ({ ...p, [n]: ch }))}
                  answerA={p2AnswersA[n] ?? ''}   setAnswerA={v => setP2AnswersA(p => ({ ...p, [n]: v }))}
                  answerB={p2AnswersB[n] ?? ''}   setAnswerB={v => setP2AnswersB(p => ({ ...p, [n]: v }))}
                  onGradeP2={() => handleGradeP2(q)}
                  gradingP2={gradingP2.has(n)}
                  aiGrade={aiGrades[n]}
                  selfChecks={checks}
                  onSelfCheck={(i, v) => handleSelfCheck(n, q.points, i, v)}
                  aiDesc={aiDescs[n] ?? ''}       setAiDesc={v => setAiDescs(p => ({ ...p, [n]: v }))}
                  onGradeP3={() => handleGradeP3(q)}
                  gradingP3={gradingP3.has(n)}
                  aiGradeP3={aiGradesP3[n]}
                  aiError={aiErrors[n]}
                />
              );
            })}
          </div>
        )}
      </div>}
    </div>
  );
}

export default MaturaLibraryView;
