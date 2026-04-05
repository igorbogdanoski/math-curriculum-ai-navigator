/**
 * MaturaLibraryView — M2 (Hybrid grading edition)
 *
 * Browse mode  : filter / reveal answers.
 * Practice mode:
 *   Part 1 MC  → auto-grade (click choice).
 *   Part 2 open → Gemini AI text-grade (answers are short, ≤2 calls per Q).
 *   Part 3 open → Self-assess rubric checklist +
 *                 optional "Провери со AI" (student describes solution → Gemini scores).
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import { MathRenderer }   from '../components/common/MathRenderer';
import { DokBadge }       from '../components/common/DokBadge';
import { callGeminiProxy } from '../services/gemini/core';
import type { MaturaChoice, DokLevel }  from '../types';

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─── Raw JSON imports ───────────────────────────────────────────────────────────
import augustMK from '../data/matura/raw/dim-gymnasium-2025-august-mk.json';
import augustAL from '../data/matura/raw/dim-gymnasium-2025-august-al.json';
import juneMK   from '../data/matura/raw/dim-gymnasium-2025-june-mk.json';
import juneAL   from '../data/matura/raw/dim-gymnasium-2025-june-al.json';

// ─── Types ──────────────────────────────────────────────────────────────────────
interface RawExamFile {
  exam: { id: string; year: number; session: string; language: string; title: string; durationMinutes: number };
  questions: RawQuestion[];
}
interface RawQuestion {
  questionNumber: number;
  part: 1 | 2 | 3;
  points: number;
  questionType?: 'mc' | 'open';
  questionText: string;
  choices?: Record<string, string> | null;
  correctAnswer: string;
  topic?: string;
  topicArea?: string;
  dokLevel?: number;
  hasImage?: boolean;
  imageDescription?: string | null;
  imageUrls?: string[];
}

// AI grading result (Part 2 and Part 3)
interface AIGrade {
  score: number;
  maxScore: number;
  feedback: string;
  partA?: boolean;
  partB?: boolean;
  commentA?: string;
  commentB?: string;
}

// ─── Exam registry ──────────────────────────────────────────────────────────────
const EXAMS = [
  { id: 'dim-gymnasium-2025-june-mk',   label: 'Јуни 2025 — МК',   session: 'june'   as const, lang: 'МК' as const, data: juneMK   as RawExamFile },
  { id: 'dim-gymnasium-2025-june-al',   label: 'Јуни 2025 — АЛ',   session: 'june'   as const, lang: 'АЛ' as const, data: juneAL   as RawExamFile },
  { id: 'dim-gymnasium-2025-august-mk', label: 'Август 2025 — МК', session: 'august' as const, lang: 'МК' as const, data: augustMK as RawExamFile },
  { id: 'dim-gymnasium-2025-august-al', label: 'Август 2025 — АЛ', session: 'august' as const, lang: 'АЛ' as const, data: augustAL as RawExamFile },
];

// ─── Constants ──────────────────────────────────────────────────────────────────
const CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];

const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Алгебра', analiza: 'Анализа', geometrija: 'Геометрија',
  statistika: 'Статистика', kombinatorika: 'Комбинаторика',
  trigonometrija: 'Тригонометрија', 'matrici-vektori': 'Матрици/Вектори', broevi: 'Броеви',
};
const TOPIC_COLORS: Record<string, string> = {
  algebra: 'bg-blue-100 text-blue-800', analiza: 'bg-purple-100 text-purple-800',
  geometrija: 'bg-green-100 text-green-800', statistika: 'bg-yellow-100 text-yellow-800',
  kombinatorika: 'bg-pink-100 text-pink-800', trigonometrija: 'bg-orange-100 text-orange-800',
  'matrici-vektori': 'bg-teal-100 text-teal-800', broevi: 'bg-gray-100 text-gray-700',
};
const PART_LABELS: Record<number, string> = { 1: 'Дел I', 2: 'Дел II', 3: 'Дел III' };
const PART_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-700', 2: 'bg-amber-100 text-amber-700', 3: 'bg-rose-100 text-rose-700',
};

// ─── Helpers ────────────────────────────────────────────────────────────────────
function isOpen(q: RawQuestion): boolean {
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
  try {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch { return null; }
}

// ─── AI grading helpers ─────────────────────────────────────────────────────────
async function gradePart2(q: RawQuestion, answerA: string, answerB: string): Promise<AIGrade> {
  const sub = parseSubParts(q.correctAnswer);
  const prompt = `Ти си асистент за оценување на матура на македонски јазик.

Задача (Q${q.questionNumber}): ${q.questionText}
Точен одговор: ${q.correctAnswer}
Одговор на ученикот:  А. ${answerA || '(нема одговор)'}  |  Б. ${answerB || '(нема одговор)'}

Оцени ги ОДД ЕЛН О двата дела (А и Б). Секој дел вреди 1 поен.
Врати САМО валиден JSON без дополнителен текст:
{"score":0,"partA":false,"partB":false,"commentA":"...","commentB":"...","feedback":"..."}

Правила:
- Споредувај математички значење, не буквален текст.
- Биди охрабрувачки и краток (1-2 реченици по дел).
- score = број точни делови (0, 1 или 2).`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const parsed = safeParseJSON(resp.text);
  if (!parsed) throw new Error('Parse error');
  return {
    score: Number(parsed.score ?? 0),
    maxScore: 2,
    feedback: parsed.feedback ?? '',
    partA: Boolean(parsed.partA),
    partB: Boolean(parsed.partB),
    commentA: parsed.commentA,
    commentB: parsed.commentB,
  };
}

async function gradePart3(q: RawQuestion, studentDesc: string): Promise<AIGrade> {
  const prompt = `Ти си асистент за оценување на матура на македонски јазик.

Задача (Q${q.questionNumber}, ${q.points} поени): ${q.questionText}
Точен одговор / модел: ${q.correctAnswer}
Максимум поени: ${q.points}

Опис на решението на ученикот: ${studentDesc || '(нема опис)'}

Оцени го решението чекор по чекор. Врати САМО валиден JSON:
{"score":0,"feedback":"детален коментар на македонски"}

Правила:
- score е цел број од 0 до ${q.points}.
- feedback: коментирај ги добиените и изгубените чекори.
- Биди праведен, конструктивен и охрабрувачки.`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const parsed = safeParseJSON(resp.text);
  if (!parsed) throw new Error('Parse error');
  return {
    score: Math.min(Number(parsed.score ?? 0), q.points),
    maxScore: q.points,
    feedback: parsed.feedback ?? '',
  };
}

// ─── DoK distribution bar ───────────────────────────────────────────────────────
function DokBar({ questions }: { questions: RawQuestion[] }) {
  const total = questions.length;
  if (!total) return null;
  const counts = [1,2,3,4].map(l => questions.filter(q => q.dokLevel === l).length);
  const colors  = ['bg-green-400','bg-blue-400','bg-orange-400','bg-red-400'];
  const labels  = ['DoK 1','DoK 2','DoK 3','DoK 4'];
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 rounded-full overflow-hidden flex-1 min-w-[80px]">
        {counts.map((c,i) => c > 0 && (
          <div key={i} className={`${colors[i]} h-full`} style={{width:`${(c/total)*100}%`}} title={`${labels[i]}: ${c}`}/>
        ))}
      </div>
      <span className="text-xs text-gray-500 shrink-0">{total} пр.</span>
    </div>
  );
}

// ─── Score badge ────────────────────────────────────────────────────────────────
function ScoreBadge({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? score / max : 0;
  const cls = pct >= 0.9 ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : pct >= 0.5 ? 'bg-amber-100 text-amber-800 border-amber-300'
            : 'bg-red-100 text-red-800 border-red-300';
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-bold px-2.5 py-0.5 rounded-full border ${cls}`}>
      {score}/{max}
    </span>
  );
}

// ─── QuestionCard ───────────────────────────────────────────────────────────────
interface CardProps {
  q: RawQuestion;
  revealed: boolean;
  onReveal: () => void;
  onHide: () => void;
  practiceMode: boolean;
  // MC
  mcPick?: string;
  onMcPick?: (ch: string) => void;
  // Part 2
  answerA: string; setAnswerA: (v: string) => void;
  answerB: string; setAnswerB: (v: string) => void;
  onGradeP2: () => void;
  gradingP2: boolean;
  aiGrade?: AIGrade;
  // Part 3 self-assess
  selfChecks: boolean[];
  onSelfCheck: (idx: number, val: boolean) => void;
  // Part 3 AI opt-in
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
  const open = isOpen(q);
  const hasSubParts = open && q.part === 2 && /[АA]\./.test(q.correctAnswer);
  const sub = hasSubParts ? parseSubParts(q.correctAnswer) : null;
  const ta  = q.topicArea ?? '';
  const selfScore = selfChecks.filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
        <span className="font-bold text-gray-700 text-sm">Q{q.questionNumber}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PART_COLORS[q.part]}`}>{PART_LABELS[q.part]}</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${open ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'}`}>
          {open ? 'Отворена' : 'MC'}
        </span>
        {ta && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TOPIC_COLORS[ta] ?? 'bg-gray-100 text-gray-600'}`}>
            {TOPIC_LABELS[ta] ?? ta}
          </span>
        )}
        {q.dokLevel != null && <DokBadge level={q.dokLevel as DokLevel} size="compact" showTooltip />}
        <span className="ml-auto text-xs font-bold text-gray-500">{q.points} {q.points===1?'поен':'поени'}</span>
      </div>

      {/* ── Question text ── */}
      <div className="px-4 pt-3 pb-2 flex-1">
        {q.hasImage && (
          <div className="mb-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
            <span>📷</span><span>{q.imageDescription ?? 'Слика/Figure'}</span>
          </div>
        )}
        <div className="text-sm leading-relaxed text-gray-800">
          <MathRenderer text={q.questionText} />
        </div>
      </div>

      {/* ════════════════════ MC ════════════════════ */}
      {!open && q.choices && (
        <div className="px-4 pb-2 space-y-1">
          {CHOICES.map(ch => {
            const text = (q.choices as Record<string,string>)[ch];
            if (!text) return null;
            const isCorrect  = revealed && q.correctAnswer === ch;
            const isWrong    = practiceMode && revealed && mcPick === ch && ch !== q.correctAnswer;
            const isPicked   = practiceMode && mcPick === ch;
            const cls = isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : isWrong   ? 'bg-red-50 border-red-300 text-red-700'
                      : isPicked  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-gray-50 border-gray-100 text-gray-700 hover:border-indigo-200';
            return (
              <button
                key={ch}
                onClick={() => practiceMode && !revealed && onMcPick?.(ch)}
                disabled={!practiceMode || revealed}
                className={`w-full flex items-start gap-2 rounded-lg px-3 py-2 text-sm border transition-colors text-left ${cls}`}
              >
                <span className="shrink-0 font-bold w-5 text-inherit">{ch}</span>
                <span className="flex-1"><MathRenderer text={text} /></span>
                {isCorrect && <span className="shrink-0 text-emerald-600 font-bold">✓</span>}
                {isWrong   && <span className="shrink-0 text-red-600 font-bold">✗</span>}
              </button>
            );
          })}
          {/* MC practice result */}
          {practiceMode && mcPick && revealed && (
            <div className={`text-xs font-semibold mt-1 px-2 py-1.5 rounded-lg ${mcPick === q.correctAnswer ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {mcPick === q.correctAnswer ? '✅ Точно! +1 поен' : `❌ Нeточно. Точен одговор: ${q.correctAnswer}`}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ OPEN PART 2 (practice) ════════════════════ */}
      {open && q.part === 2 && practiceMode && !revealed && (
        <div className="px-4 pb-3 space-y-2">
          {hasSubParts ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-500 w-5 shrink-0">А.</span>
                <input
                  type="text"
                  value={answerA}
                  onChange={e => setAnswerA(e.target.value)}
                  placeholder="Ваш одговор за А..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-500 w-5 shrink-0">Б.</span>
                <input
                  type="text"
                  value={answerB}
                  onChange={e => setAnswerB(e.target.value)}
                  placeholder="Ваш одговор за Б..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </>
          ) : (
            <input
              type="text"
              value={answerA}
              onChange={e => setAnswerA(e.target.value)}
              placeholder="Ваш одговор..."
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          )}
          <button
            onClick={onGradeP2}
            disabled={gradingP2 || (!answerA && !answerB)}
            className="w-full py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2"
          >
            {gradingP2 ? <><span className="animate-spin">⏳</span> AI оценува...</> : '🤖 Провери со AI'}
          </button>
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
        </div>
      )}

      {/* ── Part 2 AI grade result ── */}
      {open && q.part === 2 && aiGrade && (
        <div className="mx-4 mb-3 rounded-xl p-3 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-700">🤖 AI оценка</span>
            <ScoreBadge score={aiGrade.score} max={aiGrade.maxScore} />
          </div>
          {aiGrade.commentA && (
            <div className="flex items-start gap-2">
              <span className={`shrink-0 text-sm font-bold ${aiGrade.partA ? 'text-emerald-600' : 'text-red-500'}`}>{aiGrade.partA?'✓':'✗'} А.</span>
              <p className="text-xs text-gray-700">{aiGrade.commentA}</p>
            </div>
          )}
          {aiGrade.commentB && (
            <div className="flex items-start gap-2">
              <span className={`shrink-0 text-sm font-bold ${aiGrade.partB ? 'text-emerald-600' : 'text-red-500'}`}>{aiGrade.partB?'✓':'✗'} Б.</span>
              <p className="text-xs text-gray-700">{aiGrade.commentB}</p>
            </div>
          )}
          {aiGrade.feedback && <p className="text-xs text-indigo-700 italic border-t border-indigo-100 pt-1">{aiGrade.feedback}</p>}
        </div>
      )}

      {/* ════════════════════ OPEN reveal ════════════════════ */}
      {open && revealed && (
        <div className="mx-4 mb-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          {q.part === 3 ? (
            <>
              <div className="text-xs font-semibold text-emerald-700 mb-2">✅ Точен одговор / Модел</div>
              <div className="text-sm text-gray-800 leading-relaxed"><MathRenderer text={q.correctAnswer} /></div>
            </>
          ) : sub ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-700 mb-1">✅ Точни одговори</div>
              {sub.A && <div className="flex items-start gap-2"><span className="shrink-0 font-bold text-emerald-700 text-sm">А.</span><div className="text-sm text-gray-800"><MathRenderer text={sub.A}/></div></div>}
              {sub.B && <div className="flex items-start gap-2"><span className="shrink-0 font-bold text-emerald-700 text-sm">Б.</span><div className="text-sm text-gray-800"><MathRenderer text={sub.B}/></div></div>}
            </div>
          ) : (
            <div className="text-sm text-gray-800">
              <div className="text-xs font-semibold text-emerald-700 mb-1">✅ Точен одговор</div>
              <MathRenderer text={q.correctAnswer} />
            </div>
          )}
        </div>
      )}

      {/* ════════════════════ PART 3 self-assess ════════════════════ */}
      {open && q.part === 3 && practiceMode && revealed && (
        <div className="mx-4 mb-3 space-y-3">
          {/* Self-assess checklist */}
          <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-violet-700">📝 Самооценувај се</span>
              <ScoreBadge score={selfScore} max={q.points} />
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: q.points }, (_, i) => (
                <label key={i} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={selfChecks[i] ?? false}
                    onChange={e => onSelfCheck(i, e.target.checked)}
                    className="w-4 h-4 rounded border-violet-300 text-violet-600 focus:ring-violet-400"
                  />
                  <span className={`text-xs transition-colors ${selfChecks[i] ? 'text-violet-800 font-medium' : 'text-gray-600 group-hover:text-violet-700'}`}>
                    Чекор {i+1} — 1 поен
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs text-violet-500 mt-2 italic">
              Чекирајте ги само чекорите кои ги имате точно решено.
            </p>
          </div>

          {/* Optional AI check for Part 3 */}
          {!aiGradeP3 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-3 space-y-2">
              <p className="text-xs text-gray-500 font-medium">⚡ Опционално: провери со AI</p>
              <textarea
                value={aiDesc}
                onChange={e => setAiDesc(e.target.value)}
                placeholder="Опишете го вашето решение накратко (чекори, краен резултат)..."
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              />
              <button
                onClick={onGradeP3}
                disabled={gradingP3 || !aiDesc.trim()}
                className="w-full py-1.5 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-900 disabled:opacity-40 text-white transition-colors flex items-center justify-center gap-2"
              >
                {gradingP3 ? <><span className="animate-spin">⏳</span> AI оценува...</> : '🤖 Провери со AI (опционално)'}
              </button>
              {aiError && <p className="text-xs text-red-500">{aiError}</p>}
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">🤖 AI оценка</span>
                <ScoreBadge score={aiGradeP3.score} max={aiGradeP3.maxScore} />
              </div>
              <p className="text-xs text-gray-700 leading-relaxed">{aiGradeP3.feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Reveal / Hide button ── */}
      <div className="px-4 pb-4 mt-auto">
        {(!open || q.part === 3 || !practiceMode) && (
          !revealed ? (
            <button
              onClick={onReveal}
              className="w-full py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              {open ? (practiceMode ? '📖 Прикажи модел + самооценувај' : '👁 Прикажи одговор') : '👁 Прикажи точен'}
            </button>
          ) : (
            <button
              onClick={onHide}
              className="w-full py-2 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
            >
              Скриј одговор
            </button>
          )
        )}
        {open && q.part === 2 && practiceMode && revealed && (
          <button
            onClick={onHide}
            className="w-full py-2 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            Скриј одговор
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main View ──────────────────────────────────────────────────────────────────
export function MaturaLibraryView() {
  // ── Exam selection ──
  const [activeSession, setActiveSession] = useState<'june'|'august'>('june');
  const [activeLang,    setActiveLang]    = useState<'МК'|'АЛ'>('МК');

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

  // ── MC picks (practice) ──
  const [mcPicks, setMcPicks] = useState<Record<number, string>>({});

  // ── Part 2 text answers ──
  const [p2AnswersA, setP2AnswersA] = useState<Record<number, string>>({});
  const [p2AnswersB, setP2AnswersB] = useState<Record<number, string>>({});
  const [aiGrades,   setAiGrades]   = useState<Record<number, AIGrade>>({});
  const [gradingP2,  setGradingP2]  = useState<Set<number>>(new Set());

  // ── Part 3 self-assess ──
  const [selfChecks, setSelfChecks] = useState<Record<number, boolean[]>>({});

  // ── Part 3 AI opt-in ──
  const [aiDescs,    setAiDescs]    = useState<Record<number, string>>({});
  const [aiGradesP3, setAiGradesP3] = useState<Record<number, AIGrade>>({});
  const [gradingP3,  setGradingP3]  = useState<Set<number>>(new Set());
  const [aiErrors,   setAiErrors]   = useState<Record<number, string>>({});

  // ── Current exam ──
  const examEntry = useMemo(() => EXAMS.find(e => e.session === activeSession && e.lang === activeLang), [activeSession, activeLang]);
  const exam = examEntry?.data;

  const topicAreas = useMemo(() => exam ? [...new Set(exam.questions.map(q => q.topicArea).filter(Boolean))] as string[] : [], [exam]);

  const questions = useMemo(() => {
    if (!exam) return [];
    return exam.questions.filter(q => {
      if (filterPart  && q.part !== filterPart)         return false;
      if (filterDok   && q.dokLevel !== filterDok)      return false;
      if (filterTopic && q.topicArea !== filterTopic)   return false;
      if (filterType === 'mc'   &&  isOpen(q))          return false;
      if (filterType === 'open' && !isOpen(q))          return false;
      if (search) {
        const s = search.toLowerCase();
        return q.questionText.toLowerCase().includes(s) || (q.topic ?? '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [exam, filterPart, filterDok, filterTopic, filterType, search]);

  const stats = useMemo(() => {
    if (!exam) return null;
    const qs = exam.questions;
    return { total: qs.length, mc: qs.filter(q => !isOpen(q)).length, open: qs.filter(isOpen).length, pts: qs.reduce((s,q) => s + q.points, 0) };
  }, [exam]);

  // ── Handlers ──
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
  const switchExam = () => { setRevealedIds(new Set()); setRevealAll(false); setMcPicks({}); setAiGrades({}); setAiGradesP3({}); setSelfChecks({}); setP2AnswersA({}); setP2AnswersB({}); setAiDescs({}); setAiErrors({}); };

  const handleGradeP2 = async (q: RawQuestion) => {
    const n = q.questionNumber;
    const a = p2AnswersA[n] ?? ''; const b = p2AnswersB[n] ?? '';
    setGradingP2(prev => { const s = new Set(prev); s.add(n); return s; });
    setAiErrors(prev => ({ ...prev, [n]: '' }));
    try {
      const grade = await gradePart2(q, a, b);
      setAiGrades(prev => ({ ...prev, [n]: grade }));
      // Auto-reveal after grading
      setRevealedIds(prev => { const s = new Set(prev); s.add(n); return s; });
    } catch (e: any) {
      setAiErrors(prev => ({ ...prev, [n]: 'AI грешка — обидете се повторно.' }));
    } finally {
      setGradingP2(prev => { const s = new Set(prev); s.delete(n); return s; });
    }
  };

  const handleGradeP3 = async (q: RawQuestion) => {
    const n = q.questionNumber;
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
  };

  const handleSelfCheck = (n: number, maxPts: number, idx: number, val: boolean) => {
    setSelfChecks(prev => {
      const arr = [...(prev[n] ?? Array(maxPts).fill(false))];
      arr[idx] = val;
      return { ...prev, [n]: arr };
    });
  };

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ══ Sticky header ══ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">📚 Библиотека — Државна Матура</h1>
              <p className="text-xs text-gray-500">Гимназиско образование · Сите прашања со одговори</p>
            </div>

            {/* Practice mode toggle */}
            <button
              onClick={() => setPracticeMode(m => !m)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                practiceMode
                  ? 'bg-violet-600 text-white border-violet-600 shadow'
                  : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50'
              }`}
            >
              {practiceMode ? '✏️ Режим: Вежба' : '📖 Режим: Прелистувај'}
            </button>

            {/* Session selector */}
            <div className="flex gap-1 ml-auto bg-gray-100 rounded-xl p-1">
              {(['june','august'] as const).map(s => (
                <button key={s} onClick={() => { setActiveSession(s); switchExam(); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeSession===s?'bg-white shadow text-indigo-700':'text-gray-500 hover:text-gray-700'}`}>
                  {s==='june'?'Јуни 2025':'Август 2025'}
                </button>
              ))}
            </div>

            {/* Language selector */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(['МК','АЛ'] as const).map(l => (
                <button key={l} onClick={() => { setActiveLang(l); switchExam(); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeLang===l?'bg-white shadow text-indigo-700':'text-gray-500 hover:text-gray-700'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-4">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-600"><span className="font-bold text-gray-900">{stats.total}</span> пр.</span>
              <span className="text-gray-600"><span className="font-bold text-indigo-700">{stats.mc}</span> MC</span>
              <span className="text-gray-600"><span className="font-bold text-violet-700">{stats.open}</span> отворени</span>
              <span className="text-gray-600"><span className="font-bold text-emerald-700">{stats.pts}</span> поени</span>
            </div>
            <div className="flex-1 min-w-[120px]"><DokBar questions={exam?.questions??[]} /></div>
            {practiceMode && (
              <div className="text-xs text-violet-600 font-medium bg-violet-50 px-2 py-1 rounded-lg">
                Part II: AI оценување · Part III: самооценување + опц. AI
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Filter bar ══ */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input type="text" placeholder="Пребарај прашање или тема..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <button onClick={handleRevealAll}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${revealAll?'bg-amber-100 text-amber-700 hover:bg-amber-200':'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
            {revealAll?'🙈 Скриј сè':'👁 Прикажи сè'}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Дел:</span>
          {([0,1,2,3] as const).map(p=>(
            <button key={p} onClick={()=>setFilterPart(p)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterPart===p?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {p===0?'Сите':PART_LABELS[p]}
            </button>
          ))}
          <span className="ml-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Тип:</span>
          {([['','Сите'],['mc','MC'],['open','Отворена']] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setFilterType(v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterType===v?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {l}
            </button>
          ))}
          <span className="ml-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">DoK:</span>
          {([0,1,2,3,4] as const).map(d=>(
            <button key={d} onClick={()=>setFilterDok(d)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterDok===d?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {d===0?'Сите':`DoK ${d}`}
            </button>
          ))}
        </div>

        {topicAreas.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Тема:</span>
            <button onClick={()=>setFilterTopic('')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterTopic===''?'bg-gray-700 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
              Сите
            </button>
            {topicAreas.map(ta=>(
              <button key={ta} onClick={()=>setFilterTopic(ta===filterTopic?'':ta)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterTopic===ta?'bg-gray-700 text-white':`${TOPIC_COLORS[ta]??'bg-gray-100 text-gray-600'} hover:opacity-80`}`}>
                {TOPIC_LABELS[ta]??ta}
              </button>
            ))}
          </div>
        )}

        <div className="text-xs text-gray-500">
          {questions.length} прашање{questions.length!==1?'а':''} пронајдено
          {(filterPart||filterDok||filterTopic||filterType||search) && (
            <button onClick={()=>{setFilterPart(0);setFilterDok(0);setFilterTopic('');setFilterType('');setSearch('');}}
              className="ml-2 text-indigo-600 hover:underline">Исчисти филтри</button>
          )}
        </div>
      </div>

      {/* ══ Question grid ══ */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {questions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">Нема резултати</p>
            <p className="text-sm mt-1">Промени ги филтрите или пребарувањето</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {questions.map(q => {
              const n = q.questionNumber;
              const checks = selfChecks[n] ?? Array(q.points).fill(false);
              return (
                <QuestionCard
                  key={n}
                  q={q}
                  revealed={revealAll || revealedIds.has(n)}
                  onReveal={() => toggleReveal(n)}
                  onHide={() => hideQ(n)}
                  practiceMode={practiceMode}
                  mcPick={mcPicks[n]}
                  onMcPick={ch => setMcPicks(p => ({ ...p, [n]: ch }))}
                  answerA={p2AnswersA[n] ?? ''}
                  setAnswerA={v => setP2AnswersA(p => ({ ...p, [n]: v }))}
                  answerB={p2AnswersB[n] ?? ''}
                  setAnswerB={v => setP2AnswersB(p => ({ ...p, [n]: v }))}
                  onGradeP2={() => handleGradeP2(q)}
                  gradingP2={gradingP2.has(n)}
                  aiGrade={aiGrades[n]}
                  selfChecks={checks}
                  onSelfCheck={(i, v) => handleSelfCheck(n, q.points, i, v)}
                  aiDesc={aiDescs[n] ?? ''}
                  setAiDesc={v => setAiDescs(p => ({ ...p, [n]: v }))}
                  onGradeP3={() => handleGradeP3(q)}
                  gradingP3={gradingP3.has(n)}
                  aiGradeP3={aiGradesP3[n]}
                  aiError={aiErrors[n]}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default MaturaLibraryView;
