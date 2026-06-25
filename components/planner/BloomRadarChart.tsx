import React from 'react';
import { BLOOM_AXES } from './planAnalyticsHelpers';

export const BloomRadarChart: React.FC<{ scores: number[]; targets: number[] }> = ({ scores, targets }) => {
  const SIZE = 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 80;

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

  const maxVal = 100;
  const ringSteps = [25, 50, 75, 100];
  const labelPt = (i: number) => pt(i, R + 22);

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="w-full max-w-xs mx-auto"
      aria-label="Bloom's Taxonomy radar chart"
    >
      {ringSteps.map(pct => (
        <polygon
          key={pct}
          points={BLOOM_AXES.map((_, i) => { const { x, y } = pt(i, (pct / 100) * R); return `${x},${y}`; }).join(' ')}
          fill="none" stroke="#e5e7eb" strokeWidth="1"
        />
      ))}
      {BLOOM_AXES.map((_, i) => {
        const { x, y } = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="1" />;
      })}
      <polygon points={polyPts(targets, maxVal)} fill="rgba(99,102,241,0.08)" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="4 3" />
      <polygon points={polyPts(scores, maxVal)} fill="rgba(6,182,212,0.2)" stroke="#06b6d4" strokeWidth="2" />
      {BLOOM_AXES.map((ax, i) => {
        const { x, y } = pt(i, (scores[i] / maxVal) * R);
        return <circle key={i} cx={x} cy={y} r="3.5" fill={ax.color} />;
      })}
      {BLOOM_AXES.map((ax, i) => {
        const { x, y } = labelPt(i);
        const anchor = x < cx - 5 ? 'end' : x > cx + 5 ? 'start' : 'middle';
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize="8" fontWeight="600" fill={ax.color}>
            {ax.label}
          </text>
        );
      })}
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="7" fill="#9ca3af">Bloom</text>
    </svg>
  );
};
