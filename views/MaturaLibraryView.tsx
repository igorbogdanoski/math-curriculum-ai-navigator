/**
 * MaturaLibraryView — M2
 * Browse all matura exams: filter by session / language / topic / DoK / part.
 * For open questions: reveal correct answer + self-assess rubric display.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { MathRenderer } from '../components/common/MathRenderer';
import { DokBadge } from '../components/common/DokBadge';
import type { MaturaQuestion, MaturaChoice, MaturaTopicArea, DokLevel } from '../types';

// ─── Raw JSON imports ──────────────────────────────────────────────────────────
import augustMK from '../data/matura/raw/dim-gymnasium-2025-august-mk.json';
import augustAL from '../data/matura/raw/dim-gymnasium-2025-august-al.json';
import juneMK   from '../data/matura/raw/dim-gymnasium-2025-june-mk.json';
import juneAL   from '../data/matura/raw/dim-gymnasium-2025-june-al.json';

// ─── Exam registry ─────────────────────────────────────────────────────────────
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

const EXAMS: { id: string; label: string; session: 'june' | 'august'; lang: 'МК' | 'АЛ'; data: RawExamFile }[] = [
  { id: 'dim-gymnasium-2025-june-mk',   label: 'Јуни 2025 — МК',   session: 'june',   lang: 'МК', data: juneMK   as RawExamFile },
  { id: 'dim-gymnasium-2025-june-al',   label: 'Јуни 2025 — АЛ',   session: 'june',   lang: 'АЛ', data: juneAL   as RawExamFile },
  { id: 'dim-gymnasium-2025-august-mk', label: 'Август 2025 — МК', session: 'august', lang: 'МК', data: augustMK as RawExamFile },
  { id: 'dim-gymnasium-2025-august-al', label: 'Август 2025 — АЛ', session: 'august', lang: 'АЛ', data: augustAL as RawExamFile },
];

// ─── Constants ─────────────────────────────────────────────────────────────────
const CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];

const TOPIC_LABELS: Record<string, string> = {
  algebra:          'Алгебра',
  analiza:          'Анализа',
  geometrija:       'Геометрија',
  statistika:       'Статистика',
  kombinatorika:    'Комбинаторика',
  trigonometrija:   'Тригонометрија',
  'matrici-vektori':'Матрици/Вектори',
  broevi:           'Броеви',
};

const TOPIC_COLORS: Record<string, string> = {
  algebra:          'bg-blue-100 text-blue-800',
  analiza:          'bg-purple-100 text-purple-800',
  geometrija:       'bg-green-100 text-green-800',
  statistika:       'bg-yellow-100 text-yellow-800',
  kombinatorika:    'bg-pink-100 text-pink-800',
  trigonometrija:   'bg-orange-100 text-orange-800',
  'matrici-vektori':'bg-teal-100 text-teal-800',
  broevi:           'bg-gray-100 text-gray-700',
};

const PART_LABELS: Record<number, string> = { 1: 'Дел I', 2: 'Дел II', 3: 'Дел III' };
const PART_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-700',
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-rose-100 text-rose-700',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

// ─── QuestionCard ──────────────────────────────────────────────────────────────
interface QuestionCardProps {
  q: RawQuestion;
  revealed: boolean;
  onReveal: () => void;
  onHide: () => void;
}

function QuestionCard({ q, revealed, onReveal, onHide }: QuestionCardProps) {
  const open = isOpen(q);
  const hasSubParts = open && q.part <= 2 && /[АA]\./.test(q.correctAnswer);
  const subParts = hasSubParts ? parseSubParts(q.correctAnswer) : null;
  const topicArea = q.topicArea ?? '';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100 flex-wrap">
        <span className="font-bold text-gray-700 text-sm">Q{q.questionNumber}</span>

        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PART_COLORS[q.part]}`}>
          {PART_LABELS[q.part]}
        </span>

        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          open ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'
        }`}>
          {open ? 'Отворена' : 'MC'}
        </span>

        {q.topicArea && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TOPIC_COLORS[topicArea] ?? 'bg-gray-100 text-gray-600'}`}>
            {TOPIC_LABELS[topicArea] ?? topicArea}
          </span>
        )}

        {q.dokLevel != null && (
          <DokBadge level={q.dokLevel as DokLevel} size="compact" showTooltip />
        )}

        <span className="ml-auto text-xs font-bold text-gray-500">
          {q.points} {q.points === 1 ? 'поен' : 'поени'}
        </span>
      </div>

      {/* Question text */}
      <div className="px-4 pt-3 pb-2">
        {q.hasImage && (
          <div className="mb-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
            <span>📷</span>
            <span>{q.imageDescription ?? 'Слика/Figure'}</span>
          </div>
        )}
        <div className="text-sm leading-relaxed text-gray-800">
          <MathRenderer text={q.questionText} />
        </div>
      </div>

      {/* MC choices (always visible) */}
      {!open && q.choices && (
        <div className="px-4 pb-3 grid grid-cols-1 gap-1">
          {CHOICES.map(ch => {
            const text = (q.choices as Record<string, string>)[ch];
            if (!text) return null;
            const isCorrect = revealed && q.correctAnswer === ch;
            return (
              <div
                key={ch}
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isCorrect
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
                    : 'bg-gray-50 border border-gray-100 text-gray-700'
                }`}
              >
                <span className={`shrink-0 font-bold w-5 ${isCorrect ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {ch}
                </span>
                <MathRenderer text={text} />
                {isCorrect && <span className="ml-auto shrink-0 text-emerald-600 font-bold">✓</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Open question answer reveal */}
      {open && revealed && (
        <div className="mx-4 mb-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          {q.part === 3 ? (
            // Part 3: full model answer + self-assess prompt
            <>
              <div className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                <span>✅</span> Точен одговор / Модел
              </div>
              <div className="text-sm text-gray-800 leading-relaxed">
                <MathRenderer text={q.correctAnswer} />
              </div>
              <div className="mt-3 pt-2 border-t border-emerald-200">
                <p className="text-xs text-emerald-600 italic">
                  Споредете го вашето решение со моделот чекор по чекор.
                  Бројте ги само точните чекори.
                </p>
              </div>
            </>
          ) : subParts ? (
            // Part 2: А + Б sub-parts
            <div className="space-y-2">
              <div className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                <span>✅</span> Точни одговори
              </div>
              {subParts.A && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0 font-bold text-emerald-700 text-sm">А.</span>
                  <div className="text-sm text-gray-800"><MathRenderer text={subParts.A} /></div>
                </div>
              )}
              {subParts.B && (
                <div className="flex items-start gap-2">
                  <span className="shrink-0 font-bold text-emerald-700 text-sm">Б.</span>
                  <div className="text-sm text-gray-800"><MathRenderer text={subParts.B} /></div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-800">
              <div className="text-xs font-semibold text-emerald-700 mb-1">✅ Точен одговор</div>
              <MathRenderer text={q.correctAnswer} />
            </div>
          )}
        </div>
      )}

      {/* Reveal / Hide button */}
      <div className="px-4 pb-4 flex gap-2">
        {!revealed ? (
          <button
            onClick={onReveal}
            className="w-full py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            {open ? '👁 Прикажи одговор' : '👁 Прикажи точен'}
          </button>
        ) : (
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

// ─── DoK distribution mini-bar ─────────────────────────────────────────────────
function DokBar({ questions }: { questions: RawQuestion[] }) {
  const total = questions.length;
  if (total === 0) return null;
  const counts = [1,2,3,4].map(lvl => questions.filter(q => q.dokLevel === lvl).length);
  const colors = ['bg-green-400','bg-blue-400','bg-orange-400','bg-red-400'];
  const labels = ['DoK 1','DoK 2','DoK 3','DoK 4'];

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

// ─── Main View ─────────────────────────────────────────────────────────────────
export function MaturaLibraryView() {
  const [activeSession, setActiveSession] = useState<'june' | 'august'>('june');
  const [activeLang, setActiveLang]       = useState<'МК' | 'АЛ'>('МК');
  const [filterPart, setFilterPart]       = useState<0|1|2|3>(0);
  const [filterTopic, setFilterTopic]     = useState<string>('');
  const [filterDok, setFilterDok]         = useState<0|1|2|3|4>(0);
  const [filterType, setFilterType]       = useState<''|'mc'|'open'>('');
  const [search, setSearch]               = useState('');
  const [revealedIds, setRevealedIds]     = useState<Set<number>>(new Set());
  const [revealAll, setRevealAll]         = useState(false);

  // Current exam
  const examEntry = useMemo(() =>
    EXAMS.find(e => e.session === activeSession && e.lang === activeLang),
    [activeSession, activeLang]
  );
  const exam = examEntry?.data;

  // All available topic areas in current exam
  const topicAreas = useMemo(() => {
    if (!exam) return [];
    return [...new Set(exam.questions.map(q => q.topicArea).filter(Boolean))] as string[];
  }, [exam]);

  // Filtered questions
  const questions = useMemo(() => {
    if (!exam) return [];
    return exam.questions.filter(q => {
      if (filterPart && q.part !== filterPart) return false;
      if (filterDok  && q.dokLevel !== filterDok) return false;
      if (filterTopic && q.topicArea !== filterTopic) return false;
      if (filterType === 'mc'   && isOpen(q)) return false;
      if (filterType === 'open' && !isOpen(q)) return false;
      if (search) {
        const s = search.toLowerCase();
        return q.questionText.toLowerCase().includes(s) || (q.topic ?? '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [exam, filterPart, filterDok, filterTopic, filterType, search]);

  // Stats
  const stats = useMemo(() => {
    if (!exam) return null;
    const qs = exam.questions;
    return {
      total: qs.length,
      mc: qs.filter(q => !isOpen(q)).length,
      open: qs.filter(q => isOpen(q)).length,
      pts: qs.reduce((s, q) => s + q.points, 0),
    };
  }, [exam]);

  const toggleReveal = useCallback((n: number) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });
  }, []);

  const handleRevealAll = () => {
    if (revealAll) {
      setRevealedIds(new Set());
      setRevealAll(false);
    } else {
      setRevealedIds(new Set(questions.map(q => q.questionNumber)));
      setRevealAll(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">📚 Библиотека — Државна Матура</h1>
              <p className="text-xs text-gray-500">Гимназиско образование · Сите прашања со одговори</p>
            </div>

            {/* Session selector */}
            <div className="flex gap-1 ml-auto bg-gray-100 rounded-xl p-1">
              {(['june','august'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => { setActiveSession(s); setRevealedIds(new Set()); setRevealAll(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    activeSession === s
                      ? 'bg-white shadow text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s === 'june' ? 'Јуни 2025' : 'Август 2025'}
                </button>
              ))}
            </div>

            {/* Language selector */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {(['МК','АЛ'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => { setActiveLang(l); setRevealedIds(new Set()); setRevealAll(false); }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    activeLang === l
                      ? 'bg-white shadow text-indigo-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats row ── */}
        {stats && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-4">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-600">
                <span className="font-bold text-gray-900">{stats.total}</span> прашања
              </span>
              <span className="text-gray-600">
                <span className="font-bold text-indigo-700">{stats.mc}</span> MC
              </span>
              <span className="text-gray-600">
                <span className="font-bold text-violet-700">{stats.open}</span> отворени
              </span>
              <span className="text-gray-600">
                <span className="font-bold text-emerald-700">{stats.pts}</span> поени вкупно
              </span>
            </div>
            <div className="flex-1 min-w-[120px]">
              <DokBar questions={exam?.questions ?? []} />
            </div>
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 space-y-3">
        {/* Search + reveal-all */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Пребарај прашање или тема..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <button
            onClick={handleRevealAll}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              revealAll
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            {revealAll ? '🙈 Скриј сè' : '👁 Прикажи сè'}
          </button>
        </div>

        {/* Part filter */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Дел:</span>
          {([0,1,2,3] as const).map(p => (
            <button
              key={p}
              onClick={() => setFilterPart(p)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterPart === p
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {p === 0 ? 'Сите' : PART_LABELS[p]}
            </button>
          ))}

          <span className="ml-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Тип:</span>
          {([['', 'Сите'], ['mc', 'MC'], ['open', 'Отворена']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilterType(v)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterType === v
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {label}
            </button>
          ))}

          <span className="ml-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">DoK:</span>
          {([0,1,2,3,4] as const).map(d => (
            <button
              key={d}
              onClick={() => setFilterDok(d)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                filterDok === d
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
              }`}
            >
              {d === 0 ? 'Сите' : `DoK ${d}`}
            </button>
          ))}
        </div>

        {/* Topic area chips */}
        {topicAreas.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Тема:</span>
            <button
              onClick={() => setFilterTopic('')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filterTopic === ''
                  ? 'bg-gray-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'
              }`}
            >
              Сите
            </button>
            {topicAreas.map(ta => (
              <button
                key={ta}
                onClick={() => setFilterTopic(ta === filterTopic ? '' : ta)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  filterTopic === ta
                    ? 'bg-gray-700 text-white'
                    : `${TOPIC_COLORS[ta] ?? 'bg-gray-100 text-gray-600'} hover:opacity-80`
                }`}
              >
                {TOPIC_LABELS[ta] ?? ta}
              </button>
            ))}
          </div>
        )}

        {/* Result count */}
        <div className="text-xs text-gray-500">
          {questions.length} прашање{questions.length !== 1 ? 'а' : ''} пронајдено
          {(filterPart || filterDok || filterTopic || filterType || search) && (
            <button
              onClick={() => { setFilterPart(0); setFilterDok(0); setFilterTopic(''); setFilterType(''); setSearch(''); }}
              className="ml-2 text-indigo-600 hover:underline"
            >
              Исчисти филтри
            </button>
          )}
        </div>
      </div>

      {/* ── Question grid ── */}
      <div className="max-w-6xl mx-auto px-4 pb-12">
        {questions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">Нема резултати</p>
            <p className="text-sm mt-1">Промени ги филтрите или пребарувањето</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {questions.map(q => (
              <QuestionCard
                key={q.questionNumber}
                q={q}
                revealed={revealAll || revealedIds.has(q.questionNumber)}
                onReveal={() => toggleReveal(q.questionNumber)}
                onHide={() => {
                  setRevealAll(false);
                  setRevealedIds(prev => { const n = new Set(prev); n.delete(q.questionNumber); return n; });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MaturaLibraryView;
