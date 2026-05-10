/**
 * LogExpLab — S62-B1/B2
 *
 * Interactive logarithm & exponential exploration:
 *   - Parallel plot of log_b(x) and b^x with live base slider
 *   - Tangent line at user-chosen x with analytical derivative display
 *   - Asymptotes, reflection line y=x (inverse relationship)
 *   - Derivative formulas: d/dx[log_b x] = 1/(x·ln b), d/dx[b^x] = b^x·ln b
 *   - Probability presets: Shannon entropy, log-likelihood, log-normal
 */
import React, { useMemo, useState } from 'react';

const W = 340, H = 240;
const PAD = { top: 16, right: 16, bottom: 24, left: 30 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function toSVG(x: number, y: number, xMin: number, xMax: number, yMin: number, yMax: number) {
  return {
    sx: PAD.left + ((x - xMin) / (xMax - xMin)) * plotW,
    sy: PAD.top  + plotH - ((y - yMin) / (yMax - yMin)) * plotH,
  };
}

function buildPath(
  f: (x: number) => number,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
  steps = 300,
): string {
  let d = '';
  let pen = false;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + (i / steps) * (xMax - xMin);
    const y = f(x);
    if (!isFinite(y) || y < yMin - 0.5 || y > yMax + 0.5) { pen = false; continue; }
    const { sx, sy } = toSVG(x, y, xMin, xMax, yMin, yMax);
    d += `${pen ? 'L' : 'M'}${sx.toFixed(1)},${sy.toFixed(1)} `;
    pen = true;
  }
  return d.trim();
}

function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  return n.toFixed(4);
}

// ─── Axes + grid helper ───────────────────────────────────────────────────────
function Axes({ xMin, xMax, yMin, yMax, ticks = [-4,-3,-2,-1,0,1,2,3,4] }: {
  xMin: number; xMax: number; yMin: number; yMax: number; ticks?: number[];
}) {
  const o = toSVG(0, 0, xMin, xMax, yMin, yMax);
  return (
    <>
      {ticks.map(v => {
        const { sx } = toSVG(v, 0, xMin, xMax, yMin, yMax);
        const { sy } = toSVG(0, v, xMin, xMax, yMin, yMax);
        if (sx < PAD.left || sx > W - PAD.right) return null;
        return (
          <g key={v}>
            {sy >= PAD.top && sy <= H - PAD.bottom && (
              <line x1={PAD.left} y1={sy} x2={W - PAD.right} y2={sy} stroke="#f3f4f6" strokeWidth={1} />
            )}
            <line x1={sx} y1={PAD.top} x2={sx} y2={H - PAD.bottom} stroke="#f3f4f6" strokeWidth={1} />
            {v !== 0 && (
              <text x={sx} y={H - PAD.bottom + 11} textAnchor="middle" fontSize={8} fill="#9ca3af">{v}</text>
            )}
          </g>
        );
      })}
      <line x1={PAD.left} y1={o.sy} x2={W - PAD.right} y2={o.sy} stroke="#d1d5db" strokeWidth={1} />
      <line x1={o.sx} y1={PAD.top} x2={o.sx} y2={H - PAD.bottom} stroke="#d1d5db" strokeWidth={1} />
    </>
  );
}

// ─── Single function plot panel ───────────────────────────────────────────────
interface PlotPanelProps {
  label: string;
  color: string;
  derivLabel: string;
  f: (x: number) => number;
  df: (x: number) => number;
  xMin: number; xMax: number; yMin: number; yMax: number;
  xPos: number;
  asymptoteX?: number;
  asymptoteY?: number;
  inverseFn?: (x: number) => number;
  inverseColor?: string;
}

function PlotPanel({
  label, color, derivLabel, f, df, xMin, xMax, yMin, yMax,
  xPos, asymptoteX, asymptoteY, inverseFn, inverseColor,
}: PlotPanelProps) {
  const curvePath = useMemo(() => buildPath(f, xMin, xMax, yMin, yMax), [f, xMin, xMax, yMin, yMax]);
  const invPath   = useMemo(
    () => inverseFn ? buildPath(inverseFn, xMin, xMax, yMin, yMax) : '',
    [inverseFn, xMin, xMax, yMin, yMax],
  );

  const fx  = f(xPos);
  const dfx = df(xPos);
  const tanLen = 1.5;
  const pt = isFinite(fx) ? toSVG(xPos, fx, xMin, xMax, yMin, yMax) : null;
  const t1 = isFinite(fx) ? toSVG(xPos - tanLen, fx + dfx * (-tanLen), xMin, xMax, yMin, yMax) : null;
  const t2 = isFinite(fx) ? toSVG(xPos + tanLen, fx + dfx * tanLen,    xMin, xMax, yMin, yMax) : null;

  const { sx: asxX } = asymptoteX != null ? toSVG(asymptoteX, 0, xMin, xMax, yMin, yMax) : { sx: -1 };
  const { sy: asxY } = asymptoteY != null ? toSVG(0, asymptoteY, xMin, xMax, yMin, yMax) : { sy: -1 };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-xs font-bold" style={{ color }}>{label}</span>
        <span className="text-[10px] text-gray-400 font-mono">{derivLabel}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[200px]">
        <Axes xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} />
        {/* y = x reflection line */}
        {(() => {
          const a = toSVG(xMin, xMin, xMin, xMax, yMin, yMax);
          const b = toSVG(xMax, xMax, xMin, xMax, yMin, yMax);
          return <line x1={a.sx} y1={a.sy} x2={b.sx} y2={b.sy} stroke="#e5e7eb" strokeWidth={1} strokeDasharray="3 3" />;
        })()}
        {/* inverse curve */}
        {invPath && <path d={invPath} fill="none" stroke={inverseColor ?? '#94a3b8'} strokeWidth={1.5} strokeDasharray="5 3" />}
        {/* asymptotes */}
        {asymptoteX != null && asxX > PAD.left && asxX < W - PAD.right && (
          <line x1={asxX} y1={PAD.top} x2={asxX} y2={H - PAD.bottom} stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="4 2" />
        )}
        {asymptoteY != null && asxY > PAD.top && asxY < H - PAD.bottom && (
          <line x1={PAD.left} y1={asxY} x2={W - PAD.right} y2={asxY} stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="4 2" />
        )}
        {/* main curve */}
        <path d={curvePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        {/* tangent */}
        {t1 && t2 && (
          <line x1={t1.sx} y1={t1.sy} x2={t2.sx} y2={t2.sy} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" />
        )}
        {/* tangent point */}
        {pt && (
          <circle cx={pt.sx} cy={pt.sy} r={4.5} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
        )}
      </svg>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-1 px-2 pb-2 text-center">
        {[
          { sub: 'x', val: xPos.toFixed(2) },
          { sub: 'f(x)', val: fmt(fx) },
          { sub: "f'(x)", val: fmt(dfx), hi: true },
        ].map(({ sub, val, hi }) => (
          <div key={sub} className={`rounded-lg py-1 px-1 ${hi ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}>
            <p className="text-[9px] text-gray-400 font-semibold">{sub}</p>
            <p className={`text-xs font-extrabold font-mono ${hi ? 'text-amber-700' : 'text-gray-700'}`}>{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Probability presets ──────────────────────────────────────────────────────
type ProbPreset = 'entropy' | 'loglik' | 'lognormal';

const PROB_PRESETS: { id: ProbPreset; label: string; desc: string }[] = [
  { id: 'entropy',   label: 'Shannon ентропија', desc: 'H(p) = −p·log₂(p) − (1−p)·log₂(1−p)' },
  { id: 'loglik',    label: 'Log-веројатност',   desc: 'ℓ(p;k,n) = k·ln(p) + (n−k)·ln(1−p)' },
  { id: 'lognormal', label: 'Log-нормална PDF',  desc: 'f(x) = exp(−(ln x)²/2) / (x√2π)' },
];

function ProbPresetsPanel({ base }: { base: number }) {
  const [preset, setPreset] = useState<ProbPreset>('entropy');

  const entropyPath = useMemo(() => buildPath(
    p => (p <= 0 || p >= 1) ? NaN : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)),
    0.01, 0.99, -0.1, 1.1,
  ), []);

  const logLikPath = useMemo(() => buildPath(
    p => (p <= 0 || p >= 1) ? NaN : 3 * Math.log(p) + 7 * Math.log(1 - p),
    0.01, 0.99, -20, 1,
  ), []);

  const logNormPath = useMemo(() => buildPath(
    x => x <= 0 ? NaN : Math.exp(-(Math.log(x) ** 2) / 2) / (x * Math.sqrt(2 * Math.PI)),
    0.05, 4, -0.05, 0.65,
  ), []);

  const PLOT_CONFIGS = {
    entropy:   { path: entropyPath,  xLabel: 'p ∈ (0,1)', yLabel: 'H(p)',       color: '#7c3aed', xMin: 0, xMax: 1, yMin: -0.1, yMax: 1.1 },
    loglik:    { path: logLikPath,   xLabel: 'p ∈ (0,1)', yLabel: 'ℓ(p;3,10)', color: '#0369a1', xMin: 0, xMax: 1, yMin: -20,  yMax: 1   },
    lognormal: { path: logNormPath,  xLabel: 'x > 0',     yLabel: 'f(x)',       color: '#059669', xMin: 0, xMax: 4, yMin: -0.05, yMax: 0.65 },
  } as const;

  const cfg = PLOT_CONFIGS[preset];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {PROB_PRESETS.map(pr => (
          <button
            key={pr.id}
            type="button"
            onClick={() => setPreset(pr.id)}
            className={`px-2 py-1 rounded-lg text-xs font-bold border transition ${preset === pr.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-violet-300'}`}
          >
            {pr.label}
          </button>
        ))}
      </div>
      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-700 font-mono">
        {PROB_PRESETS.find(p => p.id === preset)?.desc}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[200px]">
          <Axes xMin={cfg.xMin} xMax={cfg.xMax} yMin={cfg.yMin} yMax={cfg.yMax}
            ticks={preset === 'lognormal' ? [0,1,2,3,4] : [0,0.25,0.5,0.75,1]} />
          <path d={cfg.path} fill="none" stroke={cfg.color} strokeWidth={2.5} strokeLinecap="round" />
          <text x={W - PAD.right - 2} y={PAD.top + 10} textAnchor="end" fontSize={9} fill={cfg.color} fontWeight="bold">
            {cfg.yLabel}
          </text>
          <text x={W - PAD.right - 2} y={H - PAD.bottom + 11} textAnchor="end" fontSize={8} fill="#9ca3af">
            {cfg.xLabel}
          </text>
        </svg>
      </div>
      <p className="text-[11px] text-gray-500">
        База b = <strong>{base.toFixed(2)}</strong> — логаритмите и експоненцијалите се temeljot на оваа веројатносна статистика.
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type LogExpTab = 'logexp' | 'prob';

export function LogExpLab() {
  const [base, setBase]   = useState(Math.E);
  const [xPos, setXPos]   = useState(1.0);
  const [logExpTab, setLogExpTab] = useState<LogExpTab>('logexp');

  const lnBase = Math.log(Math.max(base, 1.001));

  const logFn = (x: number) => x > 0 && base > 0 && base !== 1 ? Math.log(x) / lnBase : NaN;
  const expFn = (x: number) => Math.pow(Math.max(base, 0.001), x);

  const logDeriv  = (x: number) => x > 0 ? 1 / (x * lnBase) : NaN;
  const expDeriv  = (x: number) => Math.pow(Math.max(base, 0.001), x) * lnBase;

  const baseLabel = base.toFixed(2) === Math.E.toFixed(2) ? 'e' : base.toFixed(2);
  const logDerivFormula = `f'(x) = 1/(x·ln ${baseLabel})`;
  const expDerivFormula = `f'(x) = ${baseLabel}ˣ · ln ${baseLabel}`;

  const xPosLog = Math.max(0.1, xPos);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap text-xs font-bold">
        {([['logexp', 'Лог / Експ'], ['prob', 'Веројатност']] as const).map(([id, lbl]) => (
          <button key={id} type="button" onClick={() => setLogExpTab(id)}
            className={`px-3 py-1.5 rounded-xl border-2 transition ${logExpTab === id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {logExpTab === 'logexp' && (
        <>
          {/* Base slider */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600 w-24">Основа b =</span>
              <input
                type="range" min={1.1} max={10} step={0.05} value={base}
                onChange={e => setBase(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500"
                aria-label="Основа b"
              />
              <span className="w-12 text-right text-sm font-extrabold text-amber-700 font-mono">
                {baseLabel}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600 w-24">Точка x =</span>
              <input
                type="range" min={0.1} max={4} step={0.05} value={xPos}
                onChange={e => setXPos(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500"
                aria-label="x позиција"
              />
              <span className="w-12 text-right text-sm font-extrabold text-amber-700 font-mono">
                {xPos.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Side-by-side plots */}
          <div className="grid md:grid-cols-2 gap-4">
            <PlotPanel
              label={`log_${baseLabel}(x)`}
              color="#7c3aed"
              derivLabel={logDerivFormula}
              f={logFn}
              df={logDeriv}
              xMin={-0.5} xMax={4} yMin={-3} yMax={3}
              xPos={xPosLog}
              asymptoteX={0}
              inverseFn={expFn}
              inverseColor="#fb923c"
            />
            <PlotPanel
              label={`${baseLabel}^x`}
              color="#ea580c"
              derivLabel={expDerivFormula}
              f={expFn}
              df={expDeriv}
              xMin={-3} xMax={3} yMin={-0.5} yMax={6}
              xPos={xPos}
              asymptoteY={0}
              inverseFn={logFn}
              inverseColor="#a78bfa"
            />
          </div>

          {/* Derivative formulas */}
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-800 space-y-1">
              <p className="font-bold">d/dx [log_b x]</p>
              <p className="font-mono text-sm">= 1 / (x · ln b)</p>
              <p className="text-[10px] text-purple-500 mt-1">
                При x={xPosLog.toFixed(2)}, b={baseLabel}: f′ = {logDeriv(xPosLog).toFixed(5)}
              </p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-800 space-y-1">
              <p className="font-bold">d/dx [b^x]</p>
              <p className="font-mono text-sm">= b^x · ln b</p>
              <p className="text-[10px] text-orange-500 mt-1">
                При x={xPos.toFixed(2)}, b={baseLabel}: f′ = {expDeriv(xPos).toFixed(5)}
              </p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
            <strong>Врска:</strong> log_b(x) и b^x се меѓусебни инверзи — рефлексија преку y = x (испрекинета сина линија).
            Случај b = e: ln(x) и eˣ се темел на природниот логаритам.
          </div>
        </>
      )}

      {logExpTab === 'prob' && <ProbPresetsPanel base={base} />}
    </div>
  );
}
