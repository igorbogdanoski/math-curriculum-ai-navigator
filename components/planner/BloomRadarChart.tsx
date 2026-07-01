import React, { useState } from 'react';
import { BLOOM_AXES } from './planAnalyticsHelpers';

// ── Shared geometry ────────────────────────────────────────────────────────────
const R = 95;
const PAD = 46;        // padding around the polygon for labels
const INNER = 230;     // polygon area size
const SVG_W = INNER + PAD * 2;  // 322
const SVG_H = INNER + PAD * 2;
const cx = SVG_W / 2;
const cy = SVG_H / 2;

const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 6;
const pt = (i: number, r: number) => ({
  x: cx + r * Math.cos(angleOf(i)),
  y: cy + r * Math.sin(angleOf(i)),
});
const polyPts = (vals: number[], max: number) =>
  BLOOM_AXES.map((_, i) => {
    const { x, y } = pt(i, (vals[i] / max) * R);
    return `${x},${y}`;
  }).join(' ');

// ── Radar (reusable, no zoom state) ───────────────────────────────────────────
const RadarSVG: React.FC<{ scores: number[]; targets: number[]; size?: number }> = ({ scores, targets, size }) => {
  const maxVal = 100;
  const ringSteps = [25, 50, 75, 100];

  const labelOffset = R + 26;

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width={size ?? SVG_W}
      height={size ?? SVG_H}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="Bloom's Taxonomy radar chart"
    >
      {/* Grid rings */}
      {ringSteps.map(pct => (
        <polygon
          key={pct}
          points={BLOOM_AXES.map((_, i) => { const { x, y } = pt(i, (pct / 100) * R); return `${x},${y}`; }).join(' ')}
          fill="none" stroke="#e5e7eb" strokeWidth="1"
        />
      ))}
      {/* Grid lines */}
      {BLOOM_AXES.map((_, i) => {
        const { x, y } = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {/* Ring labels */}
      {[25, 50, 75].map(pct => {
        const { x, y } = pt(0, (pct / 100) * R);
        return (
          <text key={pct} x={x + 3} y={y - 2} fontSize="6.5" fill="#d1d5db" textAnchor="start">{pct}%</text>
        );
      })}
      {/* Target polygon */}
      <polygon points={polyPts(targets, maxVal)} fill="rgba(99,102,241,0.07)" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Actual polygon */}
      <polygon points={polyPts(scores, maxVal)} fill="rgba(6,182,212,0.18)" stroke="#06b6d4" strokeWidth="2" />
      {/* Dot per axis */}
      {BLOOM_AXES.map((ax, i) => {
        const { x, y } = pt(i, (scores[i] / maxVal) * R);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill={ax.color} />
            <title>{ax.label}: {scores[i]}%</title>
          </g>
        );
      })}
      {/* Axis labels — placed outside polygon with enough clearance */}
      {BLOOM_AXES.map((ax, i) => {
        const { x, y } = pt(i, labelOffset);
        const anchor = x < cx - 8 ? 'end' : x > cx + 8 ? 'start' : 'middle';
        const dy = y < cy - 8 ? -5 : y > cy + 8 ? 5 : 0;
        return (
          <text
            key={i}
            x={x}
            y={y + dy}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize="9"
            fontWeight="700"
            fill={ax.color}
          >
            {ax.label}
          </text>
        );
      })}
      {/* Center label */}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="7.5" fill="#9ca3af" fontWeight="600">
        Bloom
      </text>
    </svg>
  );
};

// ── Exported component with zoom toggle ───────────────────────────────────────
export const BloomRadarChart: React.FC<{ scores: number[]; targets: number[] }> = ({ scores, targets }) => {
  const [zoomed, setZoomed] = useState(false);

  return (
    <>
      <div className="relative group">
        <RadarSVG scores={scores} targets={targets} />
        <button
          type="button"
          onClick={() => setZoomed(true)}
          title="Зголеми радар дијаграм"
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 border border-gray-200 rounded-md px-1.5 py-0.5 text-[9px] font-bold text-gray-500 hover:text-gray-800 shadow-sm"
        >
          ⤢ Зголеми
        </button>
      </div>

      {zoomed && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setZoomed(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">Bloom's Taxonomy — Дистрибуција на цели</h3>
              <button
                type="button"
                onClick={() => setZoomed(false)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="Затвори"
              >
                ×
              </button>
            </div>
            <RadarSVG scores={scores} targets={targets} size={440} />
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {BLOOM_AXES.map((ax, i) => (
                <div key={ax.level} className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ax.color }} />
                  <span className="font-semibold text-gray-700">L{ax.level} {ax.label}</span>
                  <span className="text-gray-400 font-mono ml-auto">{scores[i]}%</span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-gray-400 mt-2 text-center">
              <span className="text-indigo-400">- - - Целна дистрибуција</span>
              {' · '}
              <span className="text-cyan-500">─── Планирана</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
};
