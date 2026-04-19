import React from 'react';
import { MathRenderer } from '../common/MathRenderer';
import { DokBadge }     from '../common/DokBadge';
import { CommunitySolutionsPanel } from './CommunitySolutionsPanel';
import type { MaturaQuestion } from '../../services/firestoreService.matura';
import type { DokLevel } from '../../types';
import {
  CHOICES, PART_COLORS, PART_LABELS, TOPIC_COLORS, TOPIC_LABELS,
  isOpen,
  type AIGrade,
} from './maturaLibrary.constants';

// ─── Skeleton loader ──────────────────────────────────────────────────────────
export function QuestionSkeleton() {
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
export function DokBar({ questions }: { questions: MaturaQuestion[] }) {
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
export function ScoreBadge({ score, max }: { score: number; max: number }) {
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
export interface CardProps {
  q: MaturaQuestion;
  revealed: boolean;
  onReveal: () => void;
  onHide: () => void;
  practiceMode: boolean;
  mcPick?: string;
  onMcPick?: (ch: string) => void;
  answer: string; setAnswer: (v: string) => void;
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
  questionDocId: string;
  currentUid: string | null;
  currentDisplayName: string;
}

export function QuestionCard({
  q, revealed, onReveal, onHide, practiceMode,
  mcPick, onMcPick,
  answer, setAnswer, onGradeP2, gradingP2, aiGrade,
  selfChecks, onSelfCheck,
  aiDesc, setAiDesc, onGradeP3, gradingP3, aiGradeP3, aiError,
  questionDocId, currentUid, currentDisplayName,
}: CardProps) {
  const open      = isOpen(q);
  const ta        = q.topicArea ?? '';
  const selfScore = selfChecks.filter(Boolean).length;

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
          <div>
            <input
              id={`p2-${q.questionNumber}`}
              type="text" value={answer} onChange={e => setAnswer(e.target.value)}
              disabled={!!aiGrade}
              placeholder="Одговор…"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-indigo-300 focus:border-indigo-400 disabled:bg-gray-50" />
            {aiGrade && (
              <p className={`text-xs mt-0.5 font-medium ${aiGrade.correct ? 'text-emerald-600' : 'text-red-600'}`}>
                {aiGrade.correct ? '✓ ' : '✗ '}{aiGrade.comment}
              </p>
            )}
          </div>
          {aiGrade ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-indigo-700">AI оценка</span>
                <ScoreBadge score={aiGrade.score} max={aiGrade.maxScore} />
              </div>
              <p className="text-xs text-indigo-700">{aiGrade.feedback}</p>
            </div>
          ) : (
            <button type="button" disabled={gradingP2 || !answer} onClick={onGradeP2}
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
      <CommunitySolutionsPanel
        questionDocId={questionDocId}
        currentUid={currentUid}
        currentDisplayName={currentDisplayName}
      />
    </div>
  );
}
