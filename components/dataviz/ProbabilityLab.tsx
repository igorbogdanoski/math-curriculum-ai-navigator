import React, { useState, useCallback, useRef } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import type { TableData } from './DataTable';
import type { ChartConfig } from './ChartPreview';

// ── Types ─────────────────────────────────────────────────────────────────────
type ExperimentType = 'coin' | 'die' | 'two-dice' | 'dice-coin' | 'spinner' | 'binomial';

interface SpinnerSector { label: string; weight: number; }

export interface ProbabilityLabProps {
  onSendToDataViz: (tableData: TableData, config: Partial<ChartConfig>) => void;
  onGoToChart: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const SPINNER_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];
const DEFAULT_SECTORS: SpinnerSector[] = [
  { label: 'Сино',   weight: 3 },
  { label: 'Зелено', weight: 2 },
  { label: 'Жолто',  weight: 2 },
  { label: 'Црвено', weight: 1 },
];
const DIE_FACES = [4, 6, 8, 10, 12, 20] as const;

const EXPERIMENTS: { id: ExperimentType; label: string; emoji: string; desc: string }[] = [
  { id: 'coin',      label: 'Монета',       emoji: '🪙',    desc: '2 исходи' },
  { id: 'die',       label: 'Коцка',        emoji: '🎲',    desc: 'N страни' },
  { id: 'two-dice',  label: 'Две коцки',    emoji: '🎲🎲', desc: 'Сума 2–12' },
  { id: 'dice-coin', label: 'Коцка+Монета', emoji: '🎲🪙', desc: '12 исходи' },
  { id: 'spinner',   label: 'Спинер',       emoji: '🎡',    desc: 'Прилагоди' },
  { id: 'binomial',  label: 'Биномна расп.', emoji: '📉',  desc: 'B(n,p) + нормална' },
];

const EXP_LABEL: Record<ExperimentType, string> = Object.fromEntries(
  EXPERIMENTS.map(e => [e.id, e.label])
) as Record<ExperimentType, string>;

// ── Statistical helpers ───────────────────────────────────────────────────────
/** Wilson score 95% CI for a proportion. Returns [lo, hi] clamped to [0,1]. */
function wilsonCI(count: number, total: number): [number, number] {
  if (total === 0) return [0, 1];
  const p = count / total;
  const z = 1.96; // 95%
  const z2n = (z * z) / total;
  const center = (p + z2n / 2) / (1 + z2n);
  const margin = (z / (1 + z2n)) * Math.sqrt(p * (1 - p) / total + z2n / (4 * total));
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/** Exact factorial for small n (≤20); returns Infinity otherwise */
function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 20) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/** C(n,k) exact */
function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return binomCoeff(n, k);
}

/** P(n,k) = n! / (n-k)! */
function permutations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = n - k + 1; i <= n; i++) r *= i;
  return r;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
function binomCoeff(n: number, k: number): number {
  if (k === 0 || k === n) return 1;
  if (k > n) return 0;
  let c = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) c = c * (n - i) / (i + 1);
  return c;
}

export function binomialPMF(n: number, p: number): number[] {
  return Array.from({ length: n + 1 }, (_, k) => binomCoeff(n, k) * p ** k * (1 - p) ** (n - k));
}

function normalPDF(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

function getOutcomes(exp: ExperimentType, df: number, sec: SpinnerSector[], bn = 10): string[] {
  switch (exp) {
    case 'coin':      return ['Глава', 'Писмо'];
    case 'die':       return Array.from({ length: df }, (_, i) => String(i + 1));
    case 'two-dice':  return Array.from({ length: 11 }, (_, i) => `Сума ${i + 2}`);
    case 'dice-coin': {
      const out: string[] = [];
      for (let i = 1; i <= 6; i++) { out.push(`${i}-Г`); out.push(`${i}-П`); }
      return out;
    }
    case 'spinner':   return sec.map(s => s.label);
    case 'binomial':  return Array.from({ length: bn + 1 }, (_, k) => `k=${k}`);
  }
}

function theoretical(exp: ExperimentType, df: number, sec: SpinnerSector[], bn = 10, bp = 0.5): Record<string, number> {
  switch (exp) {
    case 'coin':      return { 'Глава': 0.5, 'Писмо': 0.5 };
    case 'die':       return Object.fromEntries(Array.from({ length: df }, (_, i) => [String(i + 1), 1 / df]));
    case 'two-dice':  return Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => {
        const s = i + 2;
        return [`Сума ${s}`, (6 - Math.abs(s - 7)) / 36];
      })
    );
    case 'dice-coin': {
      const e: [string, number][] = [];
      for (let i = 1; i <= 6; i++) { e.push([`${i}-Г`, 1/12]); e.push([`${i}-П`, 1/12]); }
      return Object.fromEntries(e);
    }
    case 'spinner': {
      const total = sec.reduce((s, x) => s + x.weight, 0) || 1;
      return Object.fromEntries(sec.map(x => [x.label, x.weight / total]));
    }
    case 'binomial': {
      const pmf = binomialPMF(bn, bp);
      return Object.fromEntries(pmf.map((p, k) => [`k=${k}`, p]));
    }
  }
}

function rollOne(exp: ExperimentType, df: number, sec: SpinnerSector[], bn = 10, bp = 0.5): string {
  switch (exp) {
    case 'coin':      return Math.random() < 0.5 ? 'Глава' : 'Писмо';
    case 'die':       return String(Math.floor(Math.random() * df) + 1);
    case 'two-dice':  return `Сума ${Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1}`;
    case 'dice-coin': return `${Math.floor(Math.random()*6)+1}-${Math.random()<0.5?'Г':'П'}`;
    case 'spinner': {
      const tot = sec.reduce((s, x) => s + x.weight, 0);
      if (!tot || sec.length === 0) return '—';
      let r = Math.random() * tot;
      for (const s of sec) { r -= s.weight; if (r <= 0) return s.label; }
      return sec[sec.length - 1].label;
    }
    case 'binomial': {
      if (bn <= 0) return 'k=0';
      let successes = 0;
      for (let i = 0; i < bn; i++) if (Math.random() < bp) successes++;
      return `k=${successes}`;
    }
  }
}

// ── SpinnerSVG ────────────────────────────────────────────────────────────────
const SpinnerSVG: React.FC<{ sectors: SpinnerSector[]; lastResult?: string }> = ({ sectors, lastResult }) => {
  const total = sectors.reduce((s, x) => s + x.weight, 0);
  if (!total || !sectors.length) return null;
  const cx = 100, cy = 100, r = 82;
  let ang = -Math.PI / 2;

  return (
    <svg viewBox="0 0 200 200" width="170" height="170">
      {sectors.map((sec, i) => {
        const sweep = (sec.weight / total) * 2 * Math.PI;
        const sa = ang; ang += sweep; const ea = ang;
        const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
        const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
        const ma = sa + sweep / 2;
        const lx = cx + r * 0.62 * Math.cos(ma), ly = cy + r * 0.62 * Math.sin(ma);
        const active = lastResult === sec.label;
        return (
          <g key={i}>
            <path
              d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2},${y2} Z`}
              fill={SPINNER_COLORS[i % SPINNER_COLORS.length]}
              stroke="white" strokeWidth="2.5"
              opacity={lastResult && !active ? 0.42 : 1}
              style={{ filter: active ? 'drop-shadow(0 0 5px rgba(0,0,0,0.35))' : 'none' }}
            />
            {sweep > 0.28 && (
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="10" fontWeight="bold" style={{ pointerEvents: 'none' }}>
                {sec.label.slice(0, 6)}
              </text>
            )}
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r="11" fill="white" stroke="#475569" strokeWidth="2" />
      <polygon points={`${cx},${cy-r-5} ${cx-5.5},${cy-r+11} ${cx+5.5},${cy-r+11}`} fill="#1e293b" />
    </svg>
  );
};

// ── TwoDiceGrid ───────────────────────────────────────────────────────────────
const TwoDiceGrid: React.FC<{ lastResult?: string }> = ({ lastResult }) => {
  const activeSum = lastResult ? parseInt(lastResult.replace('Сума ', '')) : null;
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse select-none">
        <thead>
          <tr>
            <th className="w-8 h-8 text-gray-400 text-center">+</th>
            {[1,2,3,4,5,6].map(d => (
              <th key={d} className="w-8 h-8 text-center font-bold text-indigo-600">{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1,2,3,4,5,6].map(r => (
            <tr key={r}>
              <td className="w-8 h-8 text-center font-bold text-indigo-600">{r}</td>
              {[1,2,3,4,5,6].map(c => {
                const s = r + c;
                const active = s === activeSum;
                const hue = 6 - Math.abs(s - 7); // 1..6
                return (
                  <td key={c}
                    className={`w-8 h-8 text-center font-bold rounded transition-all ${active ? 'ring-2 ring-violet-500 scale-110 z-10 relative' : ''}`}
                    style={{
                      backgroundColor: active ? '#7c3aed' : `hsl(220,55%,${97 - hue * 5}%)`,
                      color: active ? 'white' : '#334155',
                    }}>
                    {s}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-400 mt-2">Потемно = почеста сума · сума 7 е најверојатна (P = 6/36 ≈ 16.7%)</p>
    </div>
  );
};

// ── DiceCoinTree ──────────────────────────────────────────────────────────────
const DiceCoinTree: React.FC<{ lastResult?: string }> = ({ lastResult }) => {
  const ROW = 26;
  const H = 12 * ROW + 20;
  const rootX = 22, dieX = 120, coinX = 262, probX = 340;
  const rootY = H / 2;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 420 ${H}`} width="100%" style={{ maxWidth: 420, display: 'block' }}>
        {/* Root node */}
        <circle cx={rootX} cy={rootY} r="14" fill="#6366f1" />
        <text x={rootX} y={rootY} textAnchor="middle" dominantBaseline="middle"
          fontSize="8" fill="white" fontWeight="bold">Старт</text>

        {/* Column headers */}
        <text x={dieX}  y="9" textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="bold">Коцка</text>
        <text x={coinX} y="9" textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="bold">Монета</text>
        <text x={probX} y="9" textAnchor="start"  fontSize="9" fill="#94a3b8" fontWeight="bold">P</text>

        {[1,2,3,4,5,6].map((d, di) => {
          const dieY  = 36 + di * 52;
          const coinG = 23 + di * 52;
          const coinP = 23 + di * 52 + 26;
          const resG  = `${d}-Г`, resP = `${d}-П`;
          const activeG = lastResult === resG, activeP = lastResult === resP;
          const anyActive = activeG || activeP;

          return (
            <g key={d}>
              {/* Root → Die */}
              <line x1={rootX} y1={rootY} x2={dieX} y2={dieY} stroke="#e2e8f0" strokeWidth="1.5" />
              {/* Die → Coins */}
              <line x1={dieX} y1={dieY} x2={coinX} y2={coinG} stroke="#e2e8f0" strokeWidth="1" />
              <line x1={dieX} y1={dieY} x2={coinX} y2={coinP} stroke="#e2e8f0" strokeWidth="1" />
              {/* Die node */}
              <circle cx={dieX} cy={dieY} r="14"
                fill={anyActive ? '#6366f1' : '#e0e7ff'}
                stroke="#6366f1" strokeWidth="1.5" />
              <text x={dieX} y={dieY} textAnchor="middle" dominantBaseline="middle"
                fontSize="11" fontWeight="bold" fill={anyActive ? 'white' : '#4338ca'}>{d}</text>
              {/* Coin G */}
              <circle cx={coinX} cy={coinG} r="11"
                fill={activeG ? '#10b981' : '#d1fae5'} stroke="#10b981" strokeWidth="1.5" />
              <text x={coinX} y={coinG} textAnchor="middle" dominantBaseline="middle"
                fontSize="9" fontWeight="bold" fill={activeG ? 'white' : '#065f46'}>Г</text>
              {/* Coin P */}
              <circle cx={coinX} cy={coinP} r="11"
                fill={activeP ? '#f59e0b' : '#fef3c7'} stroke="#f59e0b" strokeWidth="1.5" />
              <text x={coinX} y={coinP} textAnchor="middle" dominantBaseline="middle"
                fontSize="9" fontWeight="bold" fill={activeP ? 'white' : '#78350f'}>П</text>
              {/* Probability */}
              <text x={probX} y={coinG} textAnchor="start" dominantBaseline="middle"
                fontSize="9" fill={activeG ? '#6366f1' : '#94a3b8'} fontWeight={activeG ? 'bold' : 'normal'}>1/12</text>
              <text x={probX} y={coinP} textAnchor="start" dominantBaseline="middle"
                fontSize="9" fill={activeP ? '#6366f1' : '#94a3b8'} fontWeight={activeP ? 'bold' : 'normal'}>1/12</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ── CombinatoricsCalculator ───────────────────────────────────────────────────
const CombinatoricsCalculator: React.FC = () => {
  const [n, setN] = useState(5);
  const [k, setK] = useState(2);
  const safeK = Math.min(k, n);
  const C = combinations(n, safeK);
  const P = permutations(n, safeK);

  const fmt = (v: number) =>
    v === Infinity ? '> 10²⁰' : Number.isNaN(v) ? '—' : v.toLocaleString();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Комбинаторика — C(n,k) · P(n,k) · МОН XI одд. (изборен)
      </p>

      {/* n and k sliders */}
      <div className="grid grid-cols-2 gap-4">
        {([
          { label: 'n (вкупно елементи)', val: n, set: setN, max: 20 },
          { label: 'k (избираме)',        val: k, set: setK, max: n  },
        ] as const).map(({ label, val, set, max }) => (
          <div key={label}>
            <label className="text-xs font-semibold text-gray-600 flex justify-between mb-1">
              <span>{label}</span>
              <span className="font-black text-indigo-700">{val}</span>
            </label>
            <input
              type="range" min={0} max={max} step={1} value={val}
              onChange={e => (set as (v: number) => void)(Number(e.target.value))}
              className="w-full accent-indigo-600"
              aria-label={label}
            />
          </div>
        ))}
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-center">
          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide mb-1">
            Комбинации C({n},{safeK})
          </p>
          <p className="text-xs text-indigo-400 mb-1">
            <span className="font-mono">{n}! / ({safeK}! · {n - safeK}!)</span>
          </p>
          <p className="text-2xl font-black text-indigo-700">{fmt(C)}</p>
          <p className="text-[9px] text-indigo-400 mt-1">Редоследот НЕ е важен</p>
        </div>
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-3 text-center">
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wide mb-1">
            Пермутации P({n},{safeK})
          </p>
          <p className="text-xs text-violet-400 mb-1">
            <span className="font-mono">{n}! / {n - safeK}!</span>
          </p>
          <p className="text-2xl font-black text-violet-700">{fmt(P)}</p>
          <p className="text-[9px] text-violet-400 mt-1">Редоследот Е важен</p>
        </div>
      </div>

      {/* Педагошка белешка */}
      <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
        <p className="text-xs text-amber-700">
          <strong>Пример:</strong> Од {n} ученици избираме {safeK} —{' '}
          {C === Infinity ? 'premногу за прикажување' : (
            <>ако <em>редоследот не е важен</em> (одбор): <strong>{fmt(C)}</strong> начини;{' '}
            ако <em>редоследот е важен</em> (порота): <strong>{fmt(P)}</strong> начини.</>
          )}
        </p>
      </div>
    </div>
  );
};

// ── ConditionalProbabilityVenn ────────────────────────────────────────────────
const ConditionalProbabilityVenn: React.FC = () => {
  const [pA,  setPa]  = useState(0.40);
  const [pB,  setPb]  = useState(0.50);
  const [pAB, setPab] = useState(0.20);

  // Clamp P(A∩B) when sliders change
  const safeAB = Math.min(pAB, Math.min(pA, pB));

  const pAuB     = Math.min(1, pA + pB - safeAB);
  const pAgivenB = pB > 0 ? Math.min(1, safeAB / pB) : 0;
  const pBgivenA = pA > 0 ? Math.min(1, safeAB / pA) : 0;
  const indep     = Math.abs(pAgivenB - pA) < 0.02;

  // Visual: move circle centers based on overlap ratio
  const W = 420; const H = 200; const cy = 95;
  const rA = 70; const rB = 70;
  const overlapRatio = Math.min(pA, pB) > 0 ? safeAB / Math.min(pA, pB) : 0;
  const dist = Math.max(10, rA + rB - overlapRatio * (rA + rB - 4));
  const cx1 = W / 2 - dist / 2;
  const cx2 = W / 2 + dist / 2;

  const updatePab = (v: number) => setPab(Math.min(v, Math.min(pA, pB)));

  const rows = [
    { label: 'P(A)',    val: pA,                  cls: 'text-blue-600'    },
    { label: 'P(B)',    val: pB,                  cls: 'text-emerald-700' },
    { label: 'P(A∩B)', val: safeAB,               cls: 'text-violet-700'  },
    { label: 'P(A∪B)', val: Math.min(1, pAuB),   cls: 'text-gray-600'    },
    { label: 'P(A|B)',  val: pAgivenB,             cls: 'text-amber-600 text-lg' },
    { label: 'P(B|A)',  val: pBgivenA,             cls: 'text-red-600 text-lg'   },
    { label: "P(Ā)",    val: 1 - pA,              cls: 'text-slate-500'   },
    { label: "P(B̄)",    val: 1 - pB,              cls: 'text-slate-500'   },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Условна веројатност — P(A|B) · Venn дијаграм · МОН IX одд.
      </p>

      {/* Venn SVG */}
      <div className="flex justify-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg">
          <defs>
            <clipPath id="venn-clip-b"><circle cx={cx2} cy={cy} r={rB} /></clipPath>
          </defs>
          {/* A */}
          <circle cx={cx1} cy={cy} r={rA} fill="#3b82f6" fillOpacity={0.18} stroke="#3b82f6" strokeWidth={2.5} />
          {/* B */}
          <circle cx={cx2} cy={cy} r={rB} fill="#10b981" fillOpacity={0.18} stroke="#10b981" strokeWidth={2.5} />
          {/* A ∩ B overlay */}
          {safeAB > 0 && (
            <circle cx={cx1} cy={cy} r={rA} fill="#7c3aed" fillOpacity={0.38} clipPath="url(#venn-clip-b)" />
          )}
          {/* Labels */}
          <text x={cx1 - dist * 0.28} y={cy - 8}  textAnchor="middle" fontSize={13} fontWeight={800} fill="#1d4ed8">A</text>
          <text x={cx2 + dist * 0.28} y={cy - 8}  textAnchor="middle" fontSize={13} fontWeight={800} fill="#065f46">B</text>
          {safeAB > 0 && (
            <text x={W / 2} y={cy - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill="#4c1d95">A∩B</text>
          )}
          {/* P values inside circles */}
          <text x={cx1 - dist * 0.28} y={cy + 10} textAnchor="middle" fontSize={11} fill="#1d4ed8">{pA.toFixed(2)}</text>
          <text x={cx2 + dist * 0.28} y={cy + 10} textAnchor="middle" fontSize={11} fill="#065f46">{pB.toFixed(2)}</text>
          {safeAB > 0 && (
            <text x={W / 2} y={cy + 10} textAnchor="middle" fontSize={10} fill="#5b21b6">{safeAB.toFixed(2)}</text>
          )}
          {/* Universe box */}
          <rect x={4} y={4} width={W - 8} height={H - 8} fill="none" stroke="#e5e7eb" strokeWidth={1.5} rx={8} />
          <text x={10} y={16} fontSize={9} fill="#d1d5db" fontWeight={600}>Ω</text>
          <text x={W - 10} y={H - 6} textAnchor="end" fontSize={9} fill="#d1d5db">
            P(A∪B) = {Math.min(1, pAuB).toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([
          { label: 'P(A)',   val: pA,     set: setPa,     color: 'blue',   note: '' },
          { label: 'P(B)',   val: pB,     set: setPb,     color: 'emerald',note: '' },
          { label: 'P(A∩B)', val: safeAB, set: updatePab, color: 'violet', note: `max ${Math.min(pA, pB).toFixed(2)}` },
        ]).map(({ label, val, set, color, note }) => (
          <div key={label}>
            <label className={`text-xs font-bold text-${color}-600 mb-1 flex justify-between`}>
              <span>{label}{note ? <span className="text-gray-400 font-normal"> ({note})</span> : null}</span>
              <span className="font-extrabold">{val.toFixed(2)}</span>
            </label>
            <input type="range" min={0.01} max={0.99} step={0.01} value={val}
              onChange={e => (set as (v: number) => void)(parseFloat(e.target.value))}
              className={`w-full accent-${color}-600`}
              aria-label={label} title={label} />
          </div>
        ))}
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {rows.map(({ label, val, cls }) => (
          <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 p-2.5 text-center">
            <p className="text-[10px] text-gray-400 font-semibold mb-0.5">{label}</p>
            <p className={`font-black ${cls}`}>{val.toFixed(3)}</p>
          </div>
        ))}
      </div>

      {/* Independence check */}
      <div className={`rounded-xl p-3 text-xs font-semibold flex items-center gap-2 ${
        indep ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
      }`}>
        <span className="text-base">{indep ? '✓' : '≠'}</span>
        {indep
          ? 'Настаните A и B се НЕЗАВИСНИ — P(A|B) ≈ P(A)'
          : `Настаните A и B се ЗАВИСНИ — P(A|B) = ${pAgivenB.toFixed(3)} ≠ P(A) = ${pA.toFixed(3)}`
        }
      </div>

      <p className="text-[10px] text-gray-400">
        P(A|B) = P(A∩B) / P(B) — веројатноста на A под услов дека B се случило.
        Ако P(A|B) = P(A), тогаш A и B се независни.
      </p>
    </div>
  );
};

// ── BinomialDistributionChart ─────────────────────────────────────────────────
interface BinomialChartProps {
  n: number;
  p: number;
  counts: Record<string, number>;
  total: number;
}
const BinomialDistributionChart: React.FC<BinomialChartProps> = ({ n, p, counts, total }) => {
  const pmf = binomialPMF(n, p);
  const mu = n * p;
  const sigma = Math.sqrt(n * p * (1 - p));
  const maxPMF = Math.max(...pmf);

  const W = 560; const H = 280;
  const padL = 40; const padR = 20; const padT = 30; const padB = 50;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const barW = Math.min(28, plotW / (n + 2));
  const toX = (k: number) => padL + ((k + 0.5) / (n + 1)) * plotW;
  const toY = (v: number) => padT + plotH - (v / (maxPMF * 1.15)) * plotH;

  // Normal curve path: sample 200 points
  const curvePts: string[] = [];
  for (let i = 0; i <= 200; i++) {
    const x = (i / 200) * (n + 1);
    const xPx = padL + (x / (n + 1)) * plotW;
    const pdf = normalPDF(x - 0.5, mu, sigma);
    const yPx = toY(pdf);
    curvePts.push(`${i === 0 ? 'M' : 'L'}${xPx.toFixed(1)},${yPx.toFixed(1)}`);
  }

  // Y axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => f * maxPMF * 1.15);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
      {/* Grid */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={toY(v)} y2={toY(v)} stroke="#f0f0f0" strokeWidth={1} />
          <text x={padL - 4} y={toY(v) + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{(v * 100).toFixed(1)}%</text>
        </g>
      ))}

      {/* Theoretical PMF bars (blue) */}
      {pmf.map((prob, k) => {
        const bx = toX(k) - barW / 2;
        const by = toY(prob);
        const bh = toY(0) - by;
        return (
          <rect key={k} x={bx} y={by} width={barW} height={bh}
            fill="#3b82f6" fillOpacity={0.3} stroke="#3b82f6" strokeWidth={1} rx={2} />
        );
      })}

      {/* Empirical frequency overlay (violet) */}
      {total > 0 && pmf.map((_, k) => {
        const cnt = counts[`k=${k}`] ?? 0;
        const freq = cnt / total;
        const bx = toX(k) - barW * 0.35;
        const by = toY(freq);
        const bh = Math.max(0, toY(0) - by);
        return (
          <rect key={k} x={bx} y={by} width={barW * 0.7} height={bh}
            fill="#7c3aed" fillOpacity={0.7} rx={2} />
        );
      })}

      {/* Normal approximation curve (orange) */}
      {sigma > 0 && (
        <path d={curvePts.join(' ')} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" />
      )}

      {/* X axis labels */}
      {pmf.map((_, k) => (
        <text key={k} x={toX(k)} y={toY(0) + 14} textAnchor="middle" fontSize={9} fill="#374151">{k}</text>
      ))}

      {/* Axes */}
      <line x1={padL} x2={padL} y1={padT} y2={toY(0)} stroke="#d1d5db" strokeWidth={1.5} />
      <line x1={padL} x2={W - padR} y1={toY(0)} y2={toY(0)} stroke="#d1d5db" strokeWidth={1.5} />

      {/* μ marker */}
      <line x1={toX(mu)} x2={toX(mu)} y1={padT} y2={toY(0)} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={toX(mu)} y={padT - 4} textAnchor="middle" fontSize={9} fill="#ef4444" fontWeight={700}>μ={mu.toFixed(1)}</text>

      {/* Legend */}
      <rect x={padL + 4} y={padT} width={10} height={10} fill="#3b82f6" fillOpacity={0.4} />
      <text x={padL + 18} y={padT + 9} fontSize={9} fill="#374151">Теор. PMF</text>
      {total > 0 && <>
        <rect x={padL + 74} y={padT} width={10} height={10} fill="#7c3aed" fillOpacity={0.7} />
        <text x={padL + 88} y={padT + 9} fontSize={9} fill="#374151">Измерено</text>
      </>}
      <line x1={padL + 144} y1={padT + 5} x2={padL + 156} y2={padT + 5} stroke="#f97316" strokeWidth={2} strokeDasharray="4 2" />
      <text x={padL + 160} y={padT + 9} fontSize={9} fill="#374151">Нормална апрокс.</text>

      {/* Stats footer */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={9} fill="#6b7280">
        μ = {mu.toFixed(2)} · σ = {sigma.toFixed(2)} · σ² = {(sigma ** 2).toFixed(2)} · n={n} · p={p}
      </text>
    </svg>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const ProbabilityLab: React.FC<ProbabilityLabProps> = ({ onSendToDataViz, onGoToChart }) => {
  const [experiment, setExperiment] = useState<ExperimentType>('coin');
  const [dieFaces, setDieFaces]     = useState(6);
  const [sectors, setSectors]       = useState<SpinnerSector[]>(DEFAULT_SECTORS);
  const [binN, setBinN]             = useState(10);
  const [binP, setBinP]             = useState(0.5);
  const [counts, setCounts]         = useState<Record<string, number>>({});
  const [total, setTotal]           = useState(0);
  const [lastResult, setLastResult] = useState<string | undefined>();
  const [flash, setFlash]           = useState(false);
  const [animating, setAnimating]   = useState(false);
  const animTimerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);

  const theory   = theoretical(experiment, dieFaces, sectors, binN, binP);
  const outcomes = getOutcomes(experiment, dieFaces, sectors, binN);

  const reset = useCallback(() => {
    setCounts({}); setTotal(0); setLastResult(undefined);
  }, []);

  const switchExp = (exp: ExperimentType) => {
    setExperiment(exp); setCounts({}); setTotal(0); setLastResult(undefined);
  };

  const runN = useCallback((n: number) => {
    const nc = { ...counts };
    let last = '';
    for (let i = 0; i < n; i++) {
      const r = rollOne(experiment, dieFaces, sectors, binN, binP);
      nc[r] = (nc[r] ?? 0) + 1;
      last = r;
    }
    setCounts(nc);
    setTotal(prev => prev + n);
    setLastResult(last);
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  }, [counts, experiment, dieFaces, sectors, binN, binP]);

  // Animated single roll (×1 only)
  const runAnimated = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setLastResult(undefined);
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => {
      setAnimating(false);
      runN(1);
    }, 480);
  }, [animating, runN]);

  const handleSend = () => {
    if (!total) return;
    const tableData: TableData = {
      headers: ['Исход', 'Фреквенција', 'Експ. %', 'Теор. %'],
      rows: outcomes.map(o => [
        o,
        counts[o] ?? 0,
        +(((counts[o] ?? 0) / total) * 100).toFixed(1),
        +((theory[o] ?? 0) * 100).toFixed(1),
      ]),
    };
    const config: Partial<ChartConfig> = {
      title: `Веројатност — ${EXP_LABEL[experiment]}${experiment === 'die' ? ` (d${dieFaces})` : ''}`,
      xLabel: 'Исход',
      yLabel: 'Фреквенција',
      type: 'bar',
    };
    onSendToDataViz(tableData, config);
    onGoToChart();
  };

  return (
    <div className="space-y-4">

      {/* ── Experiment selector ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Избери експеримент</p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {EXPERIMENTS.map(exp => (
            <button key={exp.id} type="button"
              onClick={() => switchExp(exp.id)}
              className={`flex flex-col items-center p-3 rounded-xl border-2 transition ${
                experiment === exp.id
                  ? 'border-violet-500 bg-violet-50'
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50'
              }`}>
              <span className="text-2xl leading-none mb-1">{exp.emoji}</span>
              <span className={`text-[11px] font-bold text-center leading-tight ${
                experiment === exp.id ? 'text-violet-700' : 'text-gray-600'
              }`}>{exp.label}</span>
              <span className="text-[9px] text-gray-400">{exp.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Die config ─────────────────────────────────────────────────────── */}
      {experiment === 'die' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Број на страни</p>
          <div className="flex flex-wrap gap-2">
            {DIE_FACES.map(f => (
              <button key={f} type="button"
                onClick={() => { setDieFaces(f); reset(); }}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 transition ${
                  dieFaces === f
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                d{f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Spinner config ──────────────────────────────────────────────────── */}
      {experiment === 'spinner' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Сектори на спинер</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-start">
            <div className="space-y-2">
              {sectors.map((sec, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: SPINNER_COLORS[i % SPINNER_COLORS.length] }} />
                  <input
                    value={sec.label}
                    onChange={e => {
                      const s = [...sectors]; s[i] = { ...s[i], label: e.target.value };
                      setSectors(s); reset();
                    }}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    placeholder="Ознака"
                  />
                  <input type="number" min="1" max="20"
                    value={sec.weight}
                    onChange={e => {
                      const w = Math.max(1, parseInt(e.target.value) || 1);
                      const s = [...sectors]; s[i] = { ...s[i], weight: w };
                      setSectors(s); reset();
                    }}
                    className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-violet-300"
                    aria-label={`Тежина за ${sec.label || `сектор ${i + 1}`}`}
                    title={`Тежина за ${sec.label || `сектор ${i + 1}`}`}
                  />
                  {sectors.length > 2 && (
                    <button type="button"
                      onClick={() => { setSectors(prev => prev.filter((_, j) => j !== i)); reset(); }}
                      className="text-red-400 hover:text-red-600 text-sm font-bold w-5">✕</button>
                  )}
                </div>
              ))}
              {sectors.length < 8 && (
                <button type="button"
                  onClick={() => setSectors(prev => [...prev, { label: `S${prev.length + 1}`, weight: 1 }])}
                  className="text-xs font-bold text-violet-600 hover:text-violet-800 mt-1">
                  + Додај сектор
                </button>
              )}
            </div>
            <div className="flex justify-center">
              <SpinnerSVG sectors={sectors} lastResult={lastResult} />
            </div>
          </div>
        </div>
      )}

      {/* ── Binomial config ─────────────────────────────────────────────────── */}
      {experiment === 'binomial' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Параметри на биномна распределба B(n, p)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 flex justify-between">
                <span>n — број на обиди</span>
                <span className="text-violet-700 font-extrabold">{binN}</span>
              </label>
              <input type="range" min={1} max={30} step={1} value={binN}
                onChange={e => { setBinN(parseInt(e.target.value, 10)); reset(); }}
                className="w-full accent-violet-600"
                aria-label="Број на обиди n"
                title="Број на обиди n" />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5"><span>1</span><span>30</span></div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 flex justify-between">
                <span>p — веројатност на успех</span>
                <span className="text-violet-700 font-extrabold">{binP.toFixed(2)}</span>
              </label>
              <input type="range" min={0.01} max={0.99} step={0.01} value={binP}
                onChange={e => { setBinP(parseFloat(e.target.value)); reset(); }}
                className="w-full accent-violet-600"
                aria-label="Веројатност на успех p"
                title="Веројатност на успех p" />
              <div className="flex justify-between text-[9px] text-gray-400 mt-0.5"><span>0.01</span><span>0.99</span></div>
            </div>
          </div>
          <div className="bg-violet-50 rounded-xl p-3">
            <p className="text-xs text-violet-700 font-semibold mb-1">Теоретски параметри:</p>
            <div className="flex flex-wrap gap-4 text-xs text-violet-800">
              <span>μ = np = <strong>{(binN * binP).toFixed(2)}</strong></span>
              <span>σ² = np(1−p) = <strong>{(binN * binP * (1 - binP)).toFixed(2)}</strong></span>
              <span>σ = <strong>{Math.sqrt(binN * binP * (1 - binP)).toFixed(2)}</strong></span>
            </div>
          </div>
        </div>
      )}

      {/* ── Binomial distribution chart ──────────────────────────────────────── */}
      {experiment === 'binomial' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
            Биномна распределба B({binN}, {binP.toFixed(2)}) + нормална апроксимација
          </p>
          <BinomialDistributionChart n={binN} p={binP} counts={counts} total={total} />
        </div>
      )}

      {/* ── Run controls ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mr-1">Фрли</p>
          {/* Animated single roll */}
          <button type="button" onClick={runAnimated} disabled={animating}
            className={`px-4 py-2 text-white text-sm font-bold rounded-xl active:scale-95 transition shadow-sm ${
              animating ? 'bg-violet-400 cursor-wait' : 'bg-violet-600 hover:bg-violet-700'
            }`}>
            {animating ? '...' : '×1'}
          </button>
          {[10, 100, 1000].map(n => (
            <button key={n} type="button" onClick={() => runN(n)}
              className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 active:scale-95 transition shadow-sm">
              ×{n}
            </button>
          ))}
          <button type="button" onClick={reset}
            className="px-3 py-2 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Ресет
          </button>
          {total > 0 && (
            <span className="text-xs text-gray-400 ml-auto">
              Вкупно: <strong className="text-gray-700">{total.toLocaleString()}</strong> обиди
            </span>
          )}
        </div>
      </div>

      {/* ── Last result display ─────────────────────────────────────────────── */}
      {(animating || lastResult !== undefined) && (
        <div className={`rounded-2xl border-2 p-5 text-center transition-colors duration-200 ${
          flash ? 'bg-violet-50 border-violet-400' : 'bg-white border-violet-200'
        }`}>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">Последен резултат</p>
          <div className={`text-5xl font-black tracking-wide transition-all duration-200 ${
            animating ? 'text-violet-300 animate-bounce' : 'text-violet-700'
          }`}>{animating ? '?' : lastResult}</div>
          {experiment === 'coin' && (
            <div className={`mt-3 w-16 h-16 rounded-full mx-auto flex items-center justify-center text-2xl font-black border-4 transition ${
              lastResult === 'Глава'
                ? 'bg-amber-100 border-amber-400 text-amber-700'
                : 'bg-slate-100 border-slate-400 text-slate-700'
            }`}>
              {lastResult === 'Глава' ? 'Г' : 'П'}
            </div>
          )}
          {experiment === 'die' && (
            <div className="mt-3 w-16 h-16 rounded-xl mx-auto flex items-center justify-center text-3xl font-black bg-indigo-50 border-2 border-indigo-300 text-indigo-700">
              {lastResult}
            </div>
          )}
        </div>
      )}

      {/* ── Frequency table ─────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" /> Фреквенции
            </p>
            <p className="text-xs text-gray-400">{total.toLocaleString()} обиди</p>
          </div>
          <div className="p-4 space-y-2.5">
            {outcomes.map(o => {
              const cnt    = counts[o] ?? 0;
              const expPct = total > 0 ? cnt / total : 0;
              const thPct  = theory[o] ?? 0;
              const close  = Math.abs(expPct - thPct) < 0.05;
              const [ciLo, ciHi] = total >= 30 ? wilsonCI(cnt, total) : [0, 0];
              const thInCI = total >= 30 && thPct >= ciLo && thPct <= ciHi;
              return (
                <div key={o} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-700 shrink-0 w-16 truncate">{o}</span>
                  <div className="flex-1 relative h-4 bg-gray-100 rounded-full overflow-hidden">
                    {/* 95% CI band */}
                    {total >= 30 && (
                      <div className="absolute top-0 bottom-0 rounded-full bg-blue-200/60 z-0"
                        style={{ left: `${ciLo * 100}%`, width: `${(ciHi - ciLo) * 100}%` }} />
                    )}
                    {/* Theoretical marker */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
                      style={{ left: `${thPct * 100}%` }} />
                    {/* Experimental bar */}
                    <div className="absolute inset-0 rounded-full transition-all duration-200"
                      style={{
                        width: `${expPct * 100}%`,
                        backgroundColor: close ? '#10b981' : '#6366f1',
                        opacity: 0.85,
                      }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-11 text-right shrink-0">
                    {(expPct * 100).toFixed(1)}%
                  </span>
                  <span className="text-[10px] text-gray-400 w-11 text-right shrink-0">
                    ≈{(thPct * 100).toFixed(1)}%
                  </span>
                  {total >= 30 && (
                    <span className={`text-[9px] font-semibold w-20 text-right shrink-0 ${thInCI ? 'text-emerald-600' : 'text-amber-600'}`}
                      title="95% доверлив интервал (Вилсон)">
                      [{(ciLo * 100).toFixed(0)}–{(ciHi * 100).toFixed(0)}%]{thInCI ? ' ✓' : ''}
                    </span>
                  )}
                  <span className="text-xs font-bold text-gray-500 w-7 text-right shrink-0">{cnt}</span>
                </div>
              );
            })}
            <p className="text-[10px] text-gray-400 pt-1">
              Зелено = блиску до теор. · Сина лента = 95% CI (по 30+ обиди) · ✓ = теор. вредност е во CI
            </p>
          </div>
        </div>
      )}

      {/* ── Tree diagram: Dice+Coin ─────────────────────────────────────────── */}
      {experiment === 'dice-coin' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Дрво на настани — Коцка × Монета</p>
          <DiceCoinTree lastResult={lastResult} />
          <p className="text-[10px] text-gray-400 mt-2">12 рамноверојатни исходи · P(секој) = 1/12 ≈ 8.3%</p>
        </div>
      )}

      {/* ── Two-dice grid ────────────────────────────────────────────────────── */}
      {experiment === 'two-dice' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Решетка на суми — Две коцки (6×6)</p>
          <TwoDiceGrid lastResult={lastResult} />
        </div>
      )}

      {/* ── Spinner visual for non-spinner modes ────────────────────────────── */}
      {experiment === 'coin' && total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center justify-center gap-8">
          {(['Глава', 'Писмо'] as const).map(face => (
            <div key={face} className="text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-black border-4 transition ${
                lastResult === face
                  ? 'bg-violet-100 border-violet-500 text-violet-700 scale-110 shadow-lg'
                  : 'bg-gray-50 border-gray-200 text-gray-400'
              }`}>
                {face === 'Глава' ? 'Г' : 'П'}
              </div>
              <p className="text-xs font-semibold text-gray-500 mt-2">{face}</p>
              <p className="text-sm font-black text-gray-700">{counts[face] ?? 0}×</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Send to DataViz ──────────────────────────────────────────────────── */}
      {total > 0 && (
        <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-bold text-violet-800">Прати резултатите во DataViz Studio</p>
            <p className="text-xs text-violet-600 mt-0.5">
              Фреквенциската табела ќе се вчита во Градителот и ќе се нацрта бар-чарт со споредба теор. / мерена.
            </p>
          </div>
          <button type="button" onClick={handleSend}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 active:scale-95 transition shadow-sm whitespace-nowrap">
            <BarChart2 className="w-4 h-4" /> DataViz →
          </button>
        </div>
      )}

      {/* ── Bernoulli tip ────────────────────────────────────────────────────── */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
        <p className="text-xs text-amber-700">
          <strong>Теорема на Берну (Закон на големи броеви):</strong> Колку поголем е бројот на обиди, толку
          поблиску е <em>експерименталната</em> веројатност до <em>теоретската</em>. Пробај ×1000 и провери!
        </p>
      </div>

      {/* ── Permutation / Combination Calculator ────────────────────────────── */}
      <CombinatoricsCalculator />

      {/* ── Conditional probability / Venn ───────────────────────────────────── */}
      <ConditionalProbabilityVenn />

    </div>
  );
};
