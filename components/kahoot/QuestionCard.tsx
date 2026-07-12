import React, { useState } from 'react';
import { Check, ArrowUp, ArrowDown, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { KahootQuestion } from '../../services/geminiService';
import { DokBadge } from '../common/DokBadge';
import { DOK_META, type DokLevel } from '../../types';
import { DIFF_COLORS } from './kahootConstants';

interface QuestionCardProps {
  q: KahootQuestion;
  idx: number;
  total: number;
  onChange: (q: KahootQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  'border-red-300 bg-red-50 focus:border-red-500',
  'border-blue-300 bg-blue-50 focus:border-blue-500',
  'border-yellow-300 bg-yellow-50 focus:border-yellow-500',
  'border-green-300 bg-green-50 focus:border-green-500',
];

export function QuestionCard({ q, idx, total, onChange, onDelete, onMoveUp, onMoveDown }: QuestionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isComplete = q.question.trim().length > 0 && q.options.every((o: string) => o.trim().length > 0);

  return (
    <div className={`rounded-2xl border-2 transition-all ${isComplete ? 'border-indigo-200 bg-white' : 'border-amber-200 bg-amber-50/30'}`}>
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </span>
        <p className={`flex-1 text-sm font-semibold min-w-0 truncate ${q.question.trim() ? 'text-gray-800' : 'text-gray-400 italic'}`}>
          {q.question.trim() || 'Внеси прашање...'}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isComplete && <Check className="w-3.5 h-3.5 text-emerald-500" />}
          {q.dokLevel && <DokBadge level={q.dokLevel} size="compact" showTooltip={false} />}
          <button type="button" onClick={onMoveUp} disabled={idx === 0} aria-label="Помести нагоре"
            className="p-1 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={idx === total - 1} aria-label="Помести надолу"
            className="p-1 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? 'Прошири' : 'Собери'}
            className="p-1 rounded text-gray-400 hover:text-indigo-600 transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onDelete} aria-label="Избриши прашање"
            className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editable body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* Question text */}
          <textarea
            value={q.question}
            onChange={e => onChange({ ...q, question: e.target.value })}
            placeholder="Текст на прашањето (може да содржи LaTeX: $x^2 + 2x + 1$)"
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:border-indigo-400 transition"
          />

          {/* Answer options */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Одговори — означи го точниот со ○
            </p>
            {q.options.map((opt: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...q, correctIndex: i as 0 | 1 | 2 | 3 })}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all text-xs font-black ${
                    q.correctIndex === i
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300 text-gray-400 hover:border-emerald-300'
                  }`}
                  title={`Означи "${OPTION_LABELS[i]}" како точен одговор`}
                >
                  {OPTION_LABELS[i]}
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={e => {
                    const next: [string, string, string, string] = [...q.options] as [string, string, string, string];
                    next[i] = e.target.value;
                    onChange({ ...q, options: next });
                  }}
                  placeholder={`Одговор ${OPTION_LABELS[i]}${i === q.correctIndex ? ' (точен)' : ''}`}
                  className={`flex-1 rounded-xl border-2 px-3 py-1.5 text-sm focus:outline-none transition ${
                    q.correctIndex === i
                      ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-500'
                      : OPTION_COLORS[i]
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Difficulty */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Тежина:</span>
            {(['basic', 'intermediate', 'advanced'] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ ...q, difficulty: d })}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold transition-all ${
                  q.difficulty === d ? DIFF_COLORS[d] : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {d === 'basic' ? 'Лесно' : d === 'intermediate' ? 'Средно' : 'Тешко'}
              </button>
            ))}
          </div>

          {/* DoK Level */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DoK:</span>
            {([1, 2, 3, 4] as DokLevel[]).map(lvl => (
              <button
                key={lvl}
                type="button"
                onClick={() => onChange({ ...q, dokLevel: lvl })}
                title={DOK_META[lvl].title}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold transition-all ${
                  q.dokLevel === lvl
                    ? DOK_META[lvl].color
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {DOK_META[lvl].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
