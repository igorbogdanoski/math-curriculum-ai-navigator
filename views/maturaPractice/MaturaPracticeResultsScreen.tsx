import React from 'react';
import { MathRenderer } from '../../components/common/MathRenderer';
import { DokBadge } from '../../components/common/DokBadge';
import type { DokLevel } from '../../types';
import type { PracticeItem, QuestionState } from './maturaPracticeHelpers';
import { TOPIC_LABELS, TOPIC_COLORS, isOpen } from './maturaPracticeHelpers';
import { ScorePill } from './MaturaPracticeUI';

export function ResultsScreen({
  items, states, onRetryWrong, onNewSession,
}: {
  items: PracticeItem[];
  states: QuestionState[];
  onRetryWrong: (wrongItems: PracticeItem[]) => void;
  onNewSession: () => void;
}) {
  function getScored(item: PracticeItem, s: QuestionState): { scored: number; max: number; correct: boolean } {
    // Officially voided questions carry no correct answer and are excluded from scoring
    // entirely (neither counted right nor wrong, no points either way). Same treatment for
    // needsReview questions — our own data defect, not a state-committee void.
    if (item.voided || item.needsReview) return { scored: 0, max: 0, correct: true };
    if (!isOpen(item)) {
      const correct = s.submitted && s.mcPick === item.correctAnswer?.trim();
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

  const weakTopics = topicResults.filter(t => t.max > 0 && (t.scored / t.max) < 0.6);
  const wrongItems = results.filter(r => !r.item.voided && !r.item.needsReview && (!r.correct || r.state.skipped)).map(r => r.item);

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
          <p className="text-sm text-amber-700">Зајакни ги овие теми со повеќе вежба:</p>
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
                  <div className="text-xs text-gray-700 line-clamp-2"><MathRenderer text={r.item.questionText} /></div>
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
          <button type="button" onClick={() => onRetryWrong(wrongItems)}
            className="flex-1 py-3 rounded-xl font-black bg-rose-500 text-white hover:bg-rose-600 shadow-lg hover:-translate-y-0.5 transition-all">
            🔁 Повтори грешки ({wrongItems.length})
          </button>
        )}
        <button type="button" onClick={onNewSession}
          className="flex-1 py-3 rounded-xl font-black bg-brand-primary text-white hover:bg-brand-secondary shadow-lg hover:-translate-y-0.5 transition-all">
          ✦ Нова сесија
        </button>
      </div>
    </div>
  );
}
