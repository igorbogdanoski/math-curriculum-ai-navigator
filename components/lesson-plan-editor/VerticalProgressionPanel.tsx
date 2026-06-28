/**
 * VerticalProgressionPanel — S92
 * Shows where the current lesson topic fits in the K-9 vertical progression.
 * Uses vProgressionData (VI-IX БРО map) and concept priorKnowledgeIds.
 */
import React, { useMemo, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { vProgressionData } from '../../data/verticalProgression';

interface Props {
  /** Current lesson title or theme */
  topicTitle: string;
  /** Current grade level (numeric) */
  gradeLevel: number;
}

// ─── keyword matching ────────────────────────────────────────────────────────

const STOP = new Set(['на', 'со', 'во', 'за', 'и', 'или', 'е', 'ги', 'го', 'да', 'се', 'по', 'од']);

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[\s,.:;()/\-+×÷=]+/).filter(w => w.length >= 3 && !STOP.has(w));
}

function matchScore(tema: string, title: string): number {
  const temaTokens = tokenize(tema);
  const titleTokens = tokenize(title);
  return titleTokens.filter(t => temaTokens.some(tt => tt.includes(t) || t.includes(tt))).length;
}

// ─── Grade color helpers ─────────────────────────────────────────────────────

const GRADE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'VI':  { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-800',   dot: 'bg-blue-400' },
  'VII': { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-800', dot: 'bg-indigo-400' },
  'VIII':{ bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800', dot: 'bg-purple-400' },
  'IX':  { bg: 'bg-fuchsia-50',border: 'border-fuchsia-200',text: 'text-fuchsia-800',dot: 'bg-fuchsia-400' },
};
const DEFAULT_COLOR = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-300' };

// ─── Component ────────────────────────────────────────────────────────────────

export const VerticalProgressionPanel: React.FC<Props> = ({ topicTitle, gradeLevel }) => {
  const [expanded, setExpanded] = useState(false);

  // Find best matching tema in progression data
  const matched = useMemo(() => {
    if (!topicTitle.trim()) return null;
    let best: { tema: string; progresija: typeof vProgressionData.tematska_progresija[0]['progresija']; score: number } | null = null;
    for (const tp of vProgressionData.tematska_progresija) {
      const score = matchScore(tp.tema, topicTitle);
      if (!best || score > best.score) {
        best = { tema: tp.tema, progresija: tp.progresija, score };
      }
    }
    return best && best.score > 0 ? best : null;
  }, [topicTitle]);

  if (!matched) return null;

  const currentGradeLabel = gradeLevel >= 6 ? `${['VI', 'VII', 'VIII', 'IX'][gradeLevel - 6] ?? String(gradeLevel)}` : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          <span className="text-sm font-bold text-slate-700">Вертикална прогресија</span>
          <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded-full">{matched.tema}</span>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-[11px] text-slate-400">
            Прогресија на концептот низ одделенијата (VI–IX) според БРО стандарди
          </p>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-slate-200" aria-hidden="true" />

            <div className="space-y-3">
              {matched.progresija.map((row, idx) => {
                const colors = GRADE_COLORS[row.oddelenie] ?? DEFAULT_COLOR;
                const isCurrent = row.oddelenie === currentGradeLabel;

                return (
                  <div key={idx} className="relative pl-9">
                    {/* Dot */}
                    <div className={`absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 border-white ${colors.dot} ${isCurrent ? 'ring-2 ring-offset-1 ring-indigo-400 scale-125' : ''} transition-transform`} />

                    <div className={`rounded-xl border p-2.5 ${colors.bg} ${colors.border} ${isCurrent ? 'ring-2 ring-indigo-300' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-black ${colors.text}`}>
                          {row.oddelenie} одделение
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                            ▶ Тековно
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${colors.text} font-medium`}>
                        {row.poimi.replace(/\$[^$]+\$/g, m => m.replace(/\$/g, '').replace(/\\mathbb\{([^}]+)\}/g, '$1'))}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                        {row.rezultati_od_ucenje.replace(/\[[^\]]+\]/g, '').trim()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gap warning */}
          {currentGradeLabel && !matched.progresija.some(r => r.oddelenie === currentGradeLabel) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠️ Оваа тема е дефинирана само за VI–IX во БРО стандардите.
              {gradeLevel < 6 && ' За пониски одделенија користи ги прифатените МОН содржини.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
