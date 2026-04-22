import React from 'react';
import { TOPIC_COLORS, TOPIC_LABELS } from './maturaPracticeHelpers';

export function TopicChip({ topic, active, onClick }: { topic: string; active: boolean; onClick: () => void }) {
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

export function ProgressBar({ current, total, score, maxScore }: { current: number; total: number; score: number; maxScore: number }) {
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

export function ScorePill({ score, max, size = 'sm' }: { score: number; max: number; size?: 'sm' | 'lg' }) {
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
