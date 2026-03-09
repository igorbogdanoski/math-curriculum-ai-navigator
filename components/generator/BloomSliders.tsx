import React from 'react';
import type { BloomDistribution } from '../../types';

type BloomKey = 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating';

const BLOOM_LEVELS: { key: BloomKey; label: string; color: string; bg: string }[] = [
  { key: 'Remembering',   label: 'Помнење',      color: 'bg-blue-400',   bg: 'bg-blue-50'   },
  { key: 'Understanding', label: 'Разбирање',    color: 'bg-cyan-400',   bg: 'bg-cyan-50'   },
  { key: 'Applying',      label: 'Примена',      color: 'bg-green-400',  bg: 'bg-green-50'  },
  { key: 'Analyzing',     label: 'Анализа',      color: 'bg-yellow-400', bg: 'bg-yellow-50' },
  { key: 'Evaluating',    label: 'Евалуација',   color: 'bg-orange-400', bg: 'bg-orange-50' },
  { key: 'Creating',      label: 'Креирање',     color: 'bg-rose-400',   bg: 'bg-rose-50'   },
];

const DEFAULT_DIST: BloomDistribution = {
  Remembering: 25,
  Understanding: 20,
  Applying: 25,
  Analyzing: 15,
  Evaluating: 10,
  Creating: 5,
};

interface Props {
  value: BloomDistribution;
  onChange: (dist: BloomDistribution) => void;
}

export const BloomSliders: React.FC<Props> = ({ value, onChange }) => {
  const dist: BloomDistribution = Object.keys(value).length > 0 ? value : DEFAULT_DIST;
  const total = Object.values(dist).reduce((s, v) => s + (v ?? 0), 0);

  const handleChange = (key: BloomKey, raw: number) => {
    const newDist = { ...dist, [key]: raw };
    onChange(newDist);
  };

  const handleReset = () => onChange(DEFAULT_DIST);

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-slate-700">Bloom's Taxonomy — распределба (%)</p>
          <p className="text-xs text-slate-400">Постави колку % прашања да бидат на секое когнитивно ниво</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="text-xs font-semibold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-lg transition"
        >
          Ресетирај
        </button>
      </div>

      <div className="space-y-3">
        {BLOOM_LEVELS.map(({ key, label, color, bg }) => {
          const val = dist[key] ?? 0;
          return (
            <div key={key} className={`${bg} rounded-xl px-3 py-2`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">{label}</span>
                <span className="text-xs font-black text-slate-600 w-8 text-right">{val}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={val}
                onChange={e => handleChange(key, Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-slate-600"
              />
            </div>
          );
        })}
      </div>

      {/* Distribution bar */}
      <div className="mt-3 flex h-3 rounded-full overflow-hidden gap-px">
        {BLOOM_LEVELS.map(({ key, color }) => {
          const pct = total > 0 ? ((dist[key] ?? 0) / total) * 100 : 0;
          return pct > 0 ? (
            <div
              key={key}
              className={`${color} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${key}: ${dist[key]}%`}
            />
          ) : null;
        })}
      </div>
      <p className={`text-xs mt-1 font-semibold text-right ${total !== 100 ? 'text-amber-600' : 'text-green-600'}`}>
        Вкупно: {total}% {total !== 100 && '— препорачано е 100%'}
      </p>
    </div>
  );
};

/** Donut chart (SVG) showing distribution of generated questions by cognitiveLevel */
interface DonutProps {
  questions: { cognitiveLevel?: string }[];
}

export const BloomDonutChart: React.FC<DonutProps> = ({ questions }) => {
  const counts: Record<string, number> = {};
  questions.forEach(q => {
    const lvl = q.cognitiveLevel ?? 'Unknown';
    counts[lvl] = (counts[lvl] ?? 0) + 1;
  });

  const total = questions.length;
  if (total === 0) return null;

  const COLOR_MAP: Record<string, string> = {
    Remembering: '#60a5fa',
    Understanding: '#22d3ee',
    Applying: '#4ade80',
    Analyzing: '#facc15',
    Evaluating: '#fb923c',
    Creating: '#f87171',
  };

  const R = 40;
  const CX = 60;
  const CY = 60;
  const STROKE = 20;
  const circumference = 2 * Math.PI * R;

  let offset = 0;
  const segments = BLOOM_LEVELS.map(({ key, label }) => {
    const count = counts[key] ?? 0;
    const pct = count / total;
    const dash = pct * circumference;
    const seg = { key, label, count, pct, dash, offset, color: COLOR_MAP[key] };
    offset += dash;
    return seg;
  }).filter(s => s.count > 0);

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 mt-4">
      <p className="text-sm font-bold text-slate-700 mb-3">Реална Bloom распределба на прашањата</p>
      <div className="flex items-center gap-6">
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={STROKE} />
          {segments.map(s => (
            <circle
              key={s.key}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={STROKE}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset + circumference * 0.25}
              strokeLinecap="butt"
            />
          ))}
          <text x={CX} y={CY + 5} textAnchor="middle" className="text-xs font-black" fontSize={12} fontWeight="bold" fill="#334155">
            {total}
          </text>
        </svg>
        <div className="flex flex-col gap-1.5">
          {segments.map(s => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs text-slate-600 font-semibold">{s.label}</span>
              <span className="text-xs text-slate-400">({s.count} / {Math.round(s.pct * 100)}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
