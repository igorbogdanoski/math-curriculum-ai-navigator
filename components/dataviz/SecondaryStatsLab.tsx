import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateStatsSet } from './statsExerciseMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';
import { useLanguage } from '../../i18n/LanguageContext';

// ── Math Utilities ─────────────────────────────────────────────────────────────

function normalPDF(x: number, mu: number, sigma: number): number {
  return (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function normalCDF_approx(z: number): number {
  // Abramowitz & Stegun approximation (error < 7.5e-8)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422820 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
  return z >= 0 ? 1 - p : p;
}

function normalArea(a: number, b: number, mu: number, sigma: number): number {
  return normalCDF_approx((b - mu) / sigma) - normalCDF_approx((a - mu) / sigma);
}

function round4(n: number): number { return Math.round(n * 10000) / 10000; }
function round2(n: number): number { return Math.round(n * 100) / 100; }

// ── Regression Utilities ───────────────────────────────────────────────────────

function calcRegression(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return null;
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sx2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sx2 - sx * sx;
  if (Math.abs(denom) < 1e-10) return null;
  const b = (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  const yMean = sy / n;
  const ssTot = pts.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
  const ssRes = pts.reduce((s, p) => s + (p.y - (a + b * p.x)) ** 2, 0);
  const r2 = ssTot < 1e-10 ? 1 : 1 - ssRes / ssTot;
  const r = Math.sign(b) * Math.sqrt(Math.max(0, r2));
  return { a, b, r2, r };
}

// ── Chi-Squared utility ────────────────────────────────────────────────────────

function chiSquared(observed: number[], expected: number[]): number {
  return observed.reduce((s, o, i) => s + (expected[i] > 0 ? (o - expected[i]) ** 2 / expected[i] : 0), 0);
}

// ── Sub-tab types ──────────────────────────────────────────────────────────────

type SubTab = 'normal' | 'regression' | 'bayes' | 'montecarlo' | 'chisq' | 'exercises';

// label fields hold i18n keys (not literal text) — see DuggaQuestionEditor's Q_TYPES/TEST_TYPES convention
const SUB_TABS: { id: SubTab; label: string; emoji: string }[] = [
  { id: 'normal',      label: 'dataviz.statsLab.tabNormal',     emoji: '🔔' },
  { id: 'regression',  label: 'dataviz.statsLab.tabRegression', emoji: '📈' },
  { id: 'bayes',       label: 'dataviz.statsLab.tabBayes',      emoji: '🔀' },
  { id: 'montecarlo',  label: 'dataviz.statsLab.tabMonteCarlo', emoji: '🎯' },
  { id: 'chisq',       label: 'dataviz.statsLab.tabChisq',      emoji: '📊' },
  { id: 'exercises',   label: 'dataviz.statsLab.tabExercises',  emoji: '✏️'  },
];

// ── Exercises sub-panel ───────────────────────────────────────────────────────
function StatsExercisesTab() {
  const session = useLabSession('secondary-stats', 'Статистика и веројатност');
  const [difficulty, setDifficulty] = useLabDifficulty('secondary-stats');
  const { loadExercises } = session;
  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateStatsSet(level));
  }, [difficulty, loadExercises]);
  return <LabExercisePanel session={session} onNewSet={loadSet} difficulty={difficulty} onDifficultyChange={setDifficulty} />;
}

// ══════════════════════════════════════════════════════════════════════════════
// NORMAL DISTRIBUTION
// ══════════════════════════════════════════════════════════════════════════════

function NormalDistribution() {
  const { t } = useLanguage();
  const [mu, setMu]       = useState(0);
  const [sigma, setSigma] = useState(1);
  const [lo, setLo]       = useState(-1);
  const [hi, setHi]       = useState(1);

  const W = 600, H = 280, padL = 50, padR = 20, padT = 20, padB = 50;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xMin = mu - 4 * sigma;
  const xMax = mu + 4 * sigma;
  const steps = 300;
  const dx = (xMax - xMin) / steps;

  const toSvgX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const toSvgY = (y: number, maxY: number) => padT + plotH - (y / maxY) * plotH;

  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const x = xMin + i * dx;
    return { x, y: normalPDF(x, mu, sigma) };
  });
  const maxY = Math.max(...pts.map(p => p.y)) * 1.1;

  const curvePath = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${toSvgX(p.x).toFixed(1)},${toSvgY(p.y, maxY).toFixed(1)}`
  ).join(' ');

  // Shaded area
  const loC = Math.max(xMin, lo);
  const hiC = Math.min(xMax, hi);
  const shadePts = pts.filter(p => p.x >= loC && p.x <= hiC);
  const shadePath = shadePts.length >= 2
    ? `M${toSvgX(loC).toFixed(1)},${toSvgY(0, maxY).toFixed(1)} ` +
      shadePts.map(p => `L${toSvgX(p.x).toFixed(1)},${toSvgY(p.y, maxY).toFixed(1)}`).join(' ') +
      ` L${toSvgX(hiC).toFixed(1)},${toSvgY(0, maxY).toFixed(1)} Z`
    : '';

  const prob = round4(normalArea(lo, hi, mu, sigma));
  const zLo = round2((lo - mu) / sigma);
  const zHi = round2((hi - mu) / sigma);

  // X-axis ticks
  const ticks = Array.from({ length: 9 }, (_, i) => xMin + i * (xMax - xMin) / 8);

  return (
    <div className="space-y-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-100 rounded-xl bg-white">
        {/* Grid */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f} x1={padL} y1={padT + plotH * (1 - f)} x2={padL + plotW} y2={padT + plotH * (1 - f)}
            stroke="#f1f5f9" strokeWidth={1} />
        ))}
        {/* Shaded area */}
        {shadePath && <path d={shadePath} fill="#6366f1" opacity={0.25} />}
        {/* μ vertical line */}
        <line x1={toSvgX(mu)} y1={padT} x2={toSvgX(mu)} y2={padT + plotH} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
        {/* Axis */}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#cbd5e1" strokeWidth={1.5} />
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#cbd5e1" strokeWidth={1} />
        {/* Curve */}
        <path d={curvePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinejoin="round" />
        {/* Ticks */}
        {ticks.map(x => (
          <g key={x}>
            <line x1={toSvgX(x)} y1={padT + plotH} x2={toSvgX(x)} y2={padT + plotH + 5} stroke="#94a3b8" strokeWidth={1} />
            <text x={toSvgX(x)} y={padT + plotH + 17} fontSize={10} fill="#64748b" textAnchor="middle">{round2(x)}</text>
          </g>
        ))}
        {/* Labels */}
        <text x={padL + plotW / 2} y={H - 4} fontSize={11} fill="#6366f1" textAnchor="middle" fontWeight="600">
          μ = {mu}  σ = {sigma}
        </text>
        <text x={padL - 6} y={padT + 5} fontSize={10} fill="#94a3b8" textAnchor="end">{round4(normalPDF(mu, mu, sigma))}</text>
      </svg>

      {/* Result badge */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex flex-wrap gap-6 items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">P({lo} &lt; X &lt; {hi})</p>
          <p className="text-3xl font-black text-indigo-700">{(prob * 100).toFixed(2)}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">{t('dataviz.statsLab.zValues')}</p>
          <p className="text-lg font-bold text-gray-700">[{zLo}, {zHi}]</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400">{t('dataviz.statsLab.probability')}</p>
          <p className="text-lg font-bold text-gray-700">{prob}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t('dataviz.statsLab.muMean'), val: mu, set: setMu, min: -5, max: 5, step: 0.5 },
          { label: t('dataviz.statsLab.sigmaStdDev'), val: sigma, set: setSigma, min: 0.3, max: 4, step: 0.1 },
          { label: t('dataviz.calcLab.lowerBound'), val: lo, set: setLo, min: mu - 4 * sigma, max: hi - 0.1, step: 0.1 },
          { label: t('dataviz.calcLab.upperBound'), val: hi, set: setHi, min: lo + 0.1, max: mu + 4 * sigma, step: 0.1 },
        ].map(({ label, val, set, min, max, step }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-bold text-gray-500 mb-1">{label}</p>
            <p className="text-xl font-black text-gray-800 mb-1">{round2(val)}</p>
            <input type="range" min={min} max={max} step={step} value={val}
              onChange={e => set(Number(e.target.value))}
              className="w-full accent-indigo-600" />
          </div>
        ))}
      </div>

      {/* Quick σ presets */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-xs font-bold text-gray-400 self-center">{t('dataviz.statsLab.quickRule')}</span>
        {[
          { label: '68% (1σ)', a: -1, b: 1 },
          { label: '95% (2σ)', a: -2, b: 2 },
          { label: '99.7% (3σ)', a: -3, b: 3 },
        ].map(p => (
          <button key={p.label} type="button"
            onClick={() => { setLo(mu + p.a * sigma); setHi(mu + p.b * sigma); setMu(0); setSigma(1); }}
            className="px-3 py-1 text-xs font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full hover:bg-indigo-100 transition">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REGRESSION
// ══════════════════════════════════════════════════════════════════════════════

const DEFAULT_POINTS = [
  { x: 1, y: 2.1 }, { x: 2, y: 3.8 }, { x: 3, y: 5.2 },
  { x: 4, y: 6.9 }, { x: 5, y: 8.1 }, { x: 6, y: 9.4 }, { x: 7, y: 11 },
];

function RegressionLab() {
  const { t } = useLanguage();
  const [points, setPoints] = useState(DEFAULT_POINTS);
  const [newX, setNewX] = useState('');
  const [newY, setNewY] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  const reg = calcRegression(points);

  const W = 560, H = 320, padL = 48, padR = 20, padT = 20, padB = 48;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xVals = points.map(p => p.x);
  const yVals = points.map(p => p.y);
  const xMin = Math.min(...xVals) - 1, xMax = Math.max(...xVals) + 1;
  const yMin = Math.min(...yVals) - 1, yMax = Math.max(...yVals) + 1;

  const toX = (x: number) => padL + ((x - xMin) / (xMax - xMin)) * plotW;
  const toY = (y: number) => padT + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;
    const x = round2(xMin + ((svgX - padL) / plotW) * (xMax - xMin));
    const y = round2(yMin + (1 - (svgY - padT) / plotH) * (yMax - yMin));
    if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
      setPoints(prev => [...prev, { x, y }]);
    }
  };

  return (
    <div className="space-y-4">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full border border-gray-100 rounded-xl bg-white cursor-crosshair"
        onClick={handleSvgClick}>
        {/* Grid */}
        {[0.25, 0.5, 0.75].map(f => (
          <g key={f}>
            <line x1={padL} y1={padT + plotH * f} x2={padL + plotW} y2={padT + plotH * f} stroke="#f1f5f9" strokeWidth={1} />
            <line x1={padL + plotW * f} y1={padT} x2={padL + plotW * f} y2={padT + plotH} stroke="#f1f5f9" strokeWidth={1} />
          </g>
        ))}
        {/* Axes */}
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#cbd5e1" strokeWidth={1.5} />
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#cbd5e1" strokeWidth={1.5} />
        {/* Axis labels */}
        {[xMin, (xMin + xMax) / 2, xMax].map(x => (
          <text key={x} x={toX(x)} y={padT + plotH + 18} fontSize={10} fill="#64748b" textAnchor="middle">{round2(x)}</text>
        ))}
        {[yMin, (yMin + yMax) / 2, yMax].map(y => (
          <text key={y} x={padL - 6} y={toY(y) + 4} fontSize={10} fill="#64748b" textAnchor="end">{round2(y)}</text>
        ))}
        {/* Regression line */}
        {reg && (() => {
          const x1 = xMin, x2 = xMax;
          const y1 = reg.a + reg.b * x1, y2 = reg.a + reg.b * x2;
          return <line x1={toX(x1)} y1={toY(y1)} x2={toX(x2)} y2={toY(y2)}
            stroke="#ef4444" strokeWidth={2} strokeDasharray="6 3" opacity={0.8} />;
        })()}
        {/* Points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={toX(p.x)} cy={toY(p.y)} r={6} fill="#6366f1" opacity={0.85}
              onClick={(e) => { e.stopPropagation(); setPoints(prev => prev.filter((_, j) => j !== i)); }} />
          </g>
        ))}
        {/* Hint */}
        <text x={padL + plotW / 2} y={padT - 6} fontSize={10} fill="#94a3b8" textAnchor="middle">
          {t('dataviz.statsLab.regressionHint')}
        </text>
      </svg>

      {/* Stats */}
      {reg ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: t('dataviz.statsLab.slopeB'), val: round4(reg.b), color: 'text-red-600' },
            { label: t('dataviz.statsLab.interceptA'), val: round4(reg.a), color: 'text-blue-600' },
            { label: t('dataviz.statsLab.rSquared'), val: round4(reg.r2), color: 'text-emerald-600' },
            { label: t('dataviz.statsLab.rPearson'), val: round4(reg.r), color: 'text-violet-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 font-semibold">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4 bg-gray-50 rounded-xl border border-gray-200 p-3 text-center">
            <p className="text-sm font-bold text-gray-700">ŷ = {round4(reg.a)} + {round4(reg.b)} · x</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {t('dataviz.statsLab.correlationLabel')} {Math.abs(reg.r) > 0.9 ? t('dataviz.statsLab.veryStrong') : Math.abs(reg.r) > 0.7 ? t('dataviz.statsLab.strong') : Math.abs(reg.r) > 0.5 ? t('dataviz.statsLab.moderate') : t('dataviz.statsLab.weak')} {reg.r > 0 ? t('dataviz.statsLab.positive') : t('dataviz.statsLab.negative')}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-center text-sm text-gray-400">{t('dataviz.statsLab.addAtLeast2Points')}</p>
      )}

      {/* Manual add + reset */}
      <div className="flex gap-2 flex-wrap">
        <input type="number" placeholder="x" value={newX} onChange={e => setNewX(e.target.value)}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <input type="number" placeholder="y" value={newY} onChange={e => setNewY(e.target.value)}
          className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
        <button type="button" onClick={() => {
          const x = parseFloat(newX), y = parseFloat(newY);
          if (!isNaN(x) && !isNaN(y)) { setPoints(p => [...p, { x, y }]); setNewX(''); setNewY(''); }
        }} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition">
          {t('dataviz.statsLab.addPointBtn')}
        </button>
        <button type="button" onClick={() => setPoints(DEFAULT_POINTS)}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition ml-auto">
          {t('dataviz.statsLab.resetBtn')}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// BAYES THEOREM
// ══════════════════════════════════════════════════════════════════════════════

function BayesLab() {
  const { t } = useLanguage();
  const [pA,   setPa]   = useState(0.3);
  const [pBgA, setPBgA] = useState(0.9);
  const [pBgnA,setPBgnA]= useState(0.2);

  const pB   = pBgA * pA + pBgnA * (1 - pA);
  const pAgB = (pBgA * pA) / pB;

  const N = 100;
  const nA    = Math.round(N * pA);
  const nNotA = N - nA;
  const nAandB    = Math.round(nA * pBgA);
  const nNotAandB = Math.round(nNotA * pBgnA);

  return (
    <div className="space-y-5">
      {/* Visual grid of 100 icons */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{t('dataviz.statsLab.bayes100Cases')}</p>
        <div className="flex flex-wrap gap-0.5">
          {Array.from({ length: N }, (_, i) => {
            const isA = i < nA;
            const isAandB = i < nAandB;
            const isNotAandB = i >= nA && i < nA + nNotAandB;
            const color = isAandB ? 'bg-indigo-500' : isNotAandB ? 'bg-rose-400' : isA ? 'bg-indigo-200' : 'bg-gray-200';
            return <span key={i} className={`w-4 h-4 rounded-sm ${color} transition-colors`} title={
              isAandB ? t('dataviz.statsLab.bayesAandB') : isNotAandB ? t('dataviz.statsLab.bayesNotAandB') : isA ? t('dataviz.statsLab.bayesAandNotB') : t('dataviz.statsLab.bayesNotAandNotB')
            } />;
          })}
        </div>
        <div className="flex gap-4 mt-3 flex-wrap text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" /> {t('dataviz.statsLab.bayesAandB')} ({nAandB})</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" /> {t('dataviz.statsLab.bayesNotAandB')} ({nNotAandB})</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-200 inline-block" /> {t('dataviz.statsLab.bayesAandNotB')} ({nA - nAandB})</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> {t('dataviz.statsLab.bayesNotAandNotB')} ({nNotA - nNotAandB})</span>
        </div>
      </div>

      {/* Result */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-center">
        <p className="text-sm font-bold text-indigo-600 mb-1">{t('dataviz.statsLab.bayesTheoremTitle')}</p>
        <p className="text-xs text-gray-500 mb-3">= P(B|A)·P(A) / P(B) = {round4(pBgA)}·{round4(pA)} / {round4(pB)}</p>
        <p className="text-5xl font-black text-indigo-700">{(pAgB * 100).toFixed(1)}%</p>
        <p className="text-xs text-gray-400 mt-2">P(B) = {round4(pB)}</p>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: t('dataviz.statsLab.bayesPriorA'), val: pA, set: setPa },
          { label: t('dataviz.statsLab.bayesLikelihoodBgA'), val: pBgA, set: setPBgA },
          { label: t('dataviz.statsLab.bayesFalsePositive'), val: pBgnA, set: setPBgnA },
        ].map(({ label, val, set }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs font-bold text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-black text-gray-800 mb-1">{(val * 100).toFixed(0)}%</p>
            <input type="range" min={0.01} max={0.99} step={0.01} value={val}
              onChange={e => set(Number(e.target.value))} className="w-full accent-indigo-600" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MONTE CARLO
// ══════════════════════════════════════════════════════════════════════════════

interface MCPoint { x: number; y: number; inside: boolean; }

function MonteCarlo() {
  const { t } = useLanguage();
  const [points, setPoints]   = useState<MCPoint[]>([]);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const inside = points.filter(p => p.inside).length;
  const piEst  = points.length > 0 ? round4((inside / points.length) * 4) : 0;

  const addPoints = useCallback((n: number) => {
    setPoints(prev => {
      const next = [...prev];
      for (let i = 0; i < n; i++) {
        const x = Math.random() * 2 - 1;
        const y = Math.random() * 2 - 1;
        next.push({ x, y, inside: x * x + y * y <= 1 });
      }
      return next.slice(-2000); // keep last 2000
    });
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => addPoints(20), 50);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, addPoints]);

  const W = 320, H = 320;
  const toSvg = (v: number) => (v + 1) / 2 * W;

  const SHOW = points.slice(-800);

  return (
    <div className="space-y-4">
      <div className="flex gap-6 items-start justify-center flex-wrap">
        {/* SVG canvas */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-72 h-72 border border-gray-200 rounded-xl bg-white flex-shrink-0">
          {/* Quarter circle */}
          <path d={`M 0,${H} A ${W},${H} 0 0 1 ${W},0 L ${W},${H} Z`} fill="#6366f1" opacity={0.08} />
          <path d={`M 0,${H} A ${W},${H} 0 0 1 ${W},0`} fill="none" stroke="#6366f1" strokeWidth={2} />
          {/* Square border */}
          <rect x={0} y={0} width={W} height={H} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />
          {/* Points */}
          {SHOW.map((p, i) => (
            <circle key={i} cx={toSvg(p.x)} cy={H - toSvg(p.y)}
              r={2.5} fill={p.inside ? '#6366f1' : '#f87171'} opacity={0.7} />
          ))}
        </svg>

        {/* Stats */}
        <div className="space-y-3 min-w-[180px]">
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
            <p className="text-xs font-bold text-indigo-500 mb-1">{t('dataviz.statsLab.piEstimate')}</p>
            <p className="text-4xl font-black text-indigo-700">{piEst || '–'}</p>
            <p className="text-xs text-gray-400 mt-1">{t('dataviz.statsLab.exactPi')}</p>
            <p className="text-xs text-gray-400">{t('dataviz.statsLab.mcError')} {piEst ? Math.abs(piEst - Math.PI).toFixed(4) : '–'}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="flex justify-between text-sm">
              <span className="text-indigo-600 font-semibold">● {t('dataviz.statsLab.inside')}</span><span className="font-bold">{inside}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-red-400 font-semibold">● {t('dataviz.statsLab.outside')}</span><span className="font-bold">{points.length - inside}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 border-t border-gray-100 pt-1">
              <span className="font-semibold text-gray-600">{t('dataviz.statsLab.total')}</span><span className="font-bold">{points.length}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => setRunning(r => !r)}
              className={`w-full py-2 rounded-xl font-bold text-sm transition ${running ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
              {running ? t('dataviz.statsLab.pause') : t('dataviz.statsLab.start')}
            </button>
            <button type="button" onClick={() => { addPoints(100); }}
              className="w-full py-2 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
              {t('dataviz.statsLab.add100Points')}
            </button>
            <button type="button" onClick={() => { setPoints([]); setRunning(false); }}
              className="w-full py-2 rounded-xl font-bold text-sm bg-gray-100 text-gray-500 hover:bg-gray-200 transition">
              {t('dataviz.statsLab.resetBtn')}
            </button>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-gray-400">{t('dataviz.statsLab.piFormula')}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CHI-SQUARED TEST
// ══════════════════════════════════════════════════════════════════════════════

function ChiSquaredLab() {
  const { t } = useLanguage();
  const [rows, setRows] = useState([
    { category: 'A', observed: 30, expected: 25 },
    { category: 'B', observed: 20, expected: 25 },
    { category: 'C', observed: 28, expected: 25 },
    { category: 'D', observed: 22, expected: 25 },
  ]);

  const chi2 = chiSquared(rows.map(r => r.observed), rows.map(r => r.expected));
  const df   = rows.length - 1;
  const total = rows.reduce((s, r) => s + r.observed, 0);

  const updateRow = (i: number, field: 'category' | 'observed' | 'expected', val: string | number) => {
    setRows(prev => prev.map((r, j) => j === i ? { ...r, [field]: val } : r));
  };

  const addRow = () => setRows(prev => [...prev, { category: String.fromCharCode(65 + prev.length), observed: 0, expected: 0 }]);
  const removeRow = (i: number) => setRows(prev => prev.filter((_, j) => j !== i));

  // Chi-sq critical values (df: 1–9, α=0.05)
  const criticalValues: Record<number, number> = { 1:3.84,2:5.99,3:7.81,4:9.49,5:11.07,6:12.59,7:14.07,8:15.51,9:16.92 };
  const critical = criticalValues[df] ?? criticalValues[9];
  const reject = chi2 > critical;

  const W = 520, H = 200, pad = 48;
  const plotW = W - pad * 2;
  const maxBar = Math.max(...rows.map(r => Math.max(r.observed, r.expected)));

  return (
    <div className="space-y-4">
      {/* Bar comparison chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {rows.map((r, i) => {
            const gw = plotW / rows.length;
            const bw = gw * 0.3;
            const gx = pad + i * gw + gw * 0.1;
            const oh = r.observed / maxBar * (H - pad - 30);
            const eh = r.expected / maxBar * (H - pad - 30);
            return (
              <g key={i}>
                <rect x={gx} y={H - pad - oh} width={bw} height={oh} fill="#6366f1" rx={3} opacity={0.85} />
                <rect x={gx + bw + 4} y={H - pad - eh} width={bw} height={eh} fill="#f59e0b" rx={3} opacity={0.85} />
                <text x={gx + bw + 2} y={H - pad + 16} fontSize={11} fill="#475569" textAnchor="middle">{r.category}</text>
                <text x={gx + bw / 2} y={H - pad - oh - 4} fontSize={9} fill="#6366f1" textAnchor="middle">{r.observed}</text>
                <text x={gx + bw * 1.5 + 4} y={H - pad - eh - 4} fontSize={9} fill="#f59e0b" textAnchor="middle">{r.expected}</text>
              </g>
            );
          })}
          <line x1={pad} y1={H - pad} x2={pad + plotW} y2={H - pad} stroke="#cbd5e1" strokeWidth={1.5} />
          <rect x={pad + plotW - 120} y={10} width={10} height={10} fill="#6366f1" rx={2} />
          <text x={pad + plotW - 106} y={19} fontSize={10} fill="#475569">{t('dataviz.statsLab.observed')}</text>
          <rect x={pad + plotW - 120} y={26} width={10} height={10} fill="#f59e0b" rx={2} />
          <text x={pad + plotW - 106} y={35} fontSize={10} fill="#475569">{t('dataviz.statsLab.expected')}</text>
        </svg>
      </div>

      {/* Data table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-bold text-gray-500">{t('dataviz.statsLab.category')}</th>
              <th className="px-3 py-2 text-center text-xs font-bold text-indigo-600">{t('dataviz.statsLab.observedO')}</th>
              <th className="px-3 py-2 text-center text-xs font-bold text-amber-600">{t('dataviz.statsLab.expectedE')}</th>
              <th className="px-3 py-2 text-center text-xs font-bold text-gray-500">(O−E)²/E</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const contrib = r.expected > 0 ? round4((r.observed - r.expected) ** 2 / r.expected) : 0;
              return (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-1.5">
                    <input value={r.category} onChange={e => updateRow(i, 'category', e.target.value)}
                      className="w-12 text-center font-bold border border-gray-200 rounded px-1 py-0.5 text-xs" />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="number" value={r.observed} onChange={e => updateRow(i, 'observed', Number(e.target.value))}
                      className="w-16 text-center border border-indigo-200 bg-indigo-50 rounded px-1 py-0.5 text-sm font-semibold" />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    <input type="number" value={r.expected} onChange={e => updateRow(i, 'expected', Number(e.target.value))}
                      className="w-16 text-center border border-amber-200 bg-amber-50 rounded px-1 py-0.5 text-sm font-semibold" />
                  </td>
                  <td className="px-3 py-1.5 text-center font-mono text-sm text-gray-700">{contrib}</td>
                  <td className="px-2 py-1.5">
                    {rows.length > 2 && (
                      <button type="button" onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="p-2 flex justify-between items-center">
          <button type="button" onClick={addRow}
            className="px-3 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">
            {t('dataviz.statsLab.addCategory')}
          </button>
          <span className="text-xs text-gray-400">n = {total}</span>
        </div>
      </div>

      {/* Result */}
      <div className={`rounded-xl border p-4 text-center ${reject ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
        <div className="flex justify-center gap-8 flex-wrap">
          <div>
            <p className="text-xs font-bold text-gray-500">{t('dataviz.statsLab.chiSqStat')}</p>
            <p className="text-3xl font-black text-gray-800">{round4(chi2)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">{t('dataviz.statsLab.criticalValue')}</p>
            <p className="text-3xl font-black text-gray-800">{critical}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500">{t('dataviz.statsLab.dfLabel')}</p>
            <p className="text-3xl font-black text-gray-800">{df}</p>
          </div>
        </div>
        <p className={`mt-3 font-bold text-lg ${reject ? 'text-rose-700' : 'text-emerald-700'}`}>
          {reject ? t('dataviz.statsLab.rejectH0') : t('dataviz.statsLab.failToRejectH0')}
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ══════════════════════════════════════════════════════════════════════════════

export const SecondaryStatsLab: React.FC = () => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<SubTab>('normal');

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map(st => (
          <button key={st.id} type="button" onClick={() => setTab(st.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border transition ${
              tab === st.id ? 'bg-violet-600 text-white border-violet-600 shadow' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300 hover:text-violet-700'
            }`}>
            <span>{st.emoji}</span> {t(st.label)}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'normal'     && <NormalDistribution />}
      {tab === 'regression' && <RegressionLab />}
      {tab === 'bayes'      && <BayesLab />}
      {tab === 'montecarlo' && <MonteCarlo />}
      {tab === 'chisq'      && <ChiSquaredLab />}
      {tab === 'exercises'  && <StatsExercisesTab />}
    </div>
  );
};
