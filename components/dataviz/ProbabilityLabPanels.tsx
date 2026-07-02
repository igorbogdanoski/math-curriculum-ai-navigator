import React, { useState } from 'react';
import { binomialPMF, normalPDF } from './probabilityMath';
// ── ConditionalProbabilityVenn ────────────────────────────────────────────────
export const ConditionalProbabilityVenn: React.FC = () => {
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

// ── ProbabilityTreeBuilder ────────────────────────────────────────────────────
interface PTreeBranch { label: string; p: string; }

const TREE_COLORS_L1 = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
const TREE_COLORS_L2 = ['#818cf8', '#34d399', '#fbbf24', '#f87171'];
const LEAF_H = 46;

export const ProbabilityTreeBuilder: React.FC = () => {
  const [l1, setL1] = useState<PTreeBranch[]>([
    { label: 'A', p: '0.6' },
    { label: 'B', p: '0.4' },
  ]);
  const [l2, setL2] = useState<PTreeBranch[][]>([
    [{ label: 'X', p: '0.7' }, { label: 'Y', p: '0.3' }],
    [{ label: 'X', p: '0.5' }, { label: 'Y', p: '0.5' }],
  ]);

  const pNum = (s: string) => Math.max(0, Math.min(1, parseFloat(s) || 0));
  const l1Sum = l1.reduce((s, b) => s + pNum(b.p), 0);
  const l1Ok  = Math.abs(l1Sum - 1) < 0.005;
  const l2Sums = l2.map(br => br.reduce((s, b) => s + pNum(b.p), 0));
  const l2Oks  = l2Sums.map(s => Math.abs(s - 1) < 0.005);

  const updL1 = (i: number, field: keyof PTreeBranch, val: string) =>
    setL1(prev => prev.map((b, j) => j === i ? { ...b, [field]: val } : b));
  const addL1 = () => {
    if (l1.length >= 4) return;
    const labels = ['A','B','C','D'];
    setL1(prev => [...prev, { label: labels[prev.length] || `E${prev.length}`, p: '0' }]);
    setL2(prev => [...prev, [{ label: 'X', p: '0.5' }, { label: 'Y', p: '0.5' }]]);
  };
  const delL1 = (i: number) => {
    if (l1.length <= 2) return;
    setL1(prev => prev.filter((_, j) => j !== i));
    setL2(prev => prev.filter((_, j) => j !== i));
  };

  const updL2 = (i: number, j: number, field: keyof PTreeBranch, val: string) =>
    setL2(prev => prev.map((br, ii) => ii !== i ? br : br.map((b, jj) => jj === j ? { ...b, [field]: val } : b)));
  const addL2 = (i: number) => {
    if ((l2[i] || []).length >= 4) return;
    setL2(prev => prev.map((br, ii) => ii !== i ? br : [...br, { label: `Z${br.length}`, p: '0' }]));
  };
  const delL2 = (i: number, j: number) => {
    if ((l2[i] || []).length <= 2) return;
    setL2(prev => prev.map((br, ii) => ii !== i ? br : br.filter((_, jj) => jj !== j)));
  };

  // ── SVG geometry ───────────────────────────────────────────────────────────
  const totalLeaves = l2.reduce((s, br) => s + br.length, 0);
  const svgH   = Math.max(180, totalLeaves * LEAF_H + 40);
  const rootX  = 32; const l1X = 162; const l2X = 318; const probX = 340;
  const svgW   = 510;

  let curY = 20 + LEAF_H / 2;
  const l2Ys: number[][] = [];
  const l1Ys: number[]   = [];
  for (let i = 0; i < l1.length; i++) {
    const ys = (l2[i] || []).map(() => { const y = curY; curY += LEAF_H; return y; });
    l2Ys.push(ys);
    l1Ys.push(ys.length > 0 ? ys.reduce((a, b) => a + b, 0) / ys.length : curY - LEAF_H / 2);
  }
  const rootY = l1Ys.length > 0 ? l1Ys.reduce((a, b) => a + b, 0) / l1Ys.length : svgH / 2;

  // ── Leaf joint-prob table ──────────────────────────────────────────────────
  const leaves = l1.flatMap((b1, i) =>
    (l2[i] || []).map((b2) => ({
      path:  `${b1.label || `A${i+1}`} ∩ ${b2.label || 'X'}`,
      p1:    pNum(b1.p),
      p2:    pNum(b2.p),
      joint: pNum(b1.p) * pNum(b2.p),
      color: TREE_COLORS_L1[i % TREE_COLORS_L1.length],
    }))
  );
  const totalJoint = leaves.reduce((s, l) => s + l.joint, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        Дрво на веројатности — Општо · МОН IX–XI одд.
      </p>

      {/* ── Input editor ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Level 1 */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center justify-between">
            <span>Прво ниво</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${l1Ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              Σ = {l1Sum.toFixed(3)} {l1Ok ? '✓' : '≠ 1'}
            </span>
          </p>
          <div className="space-y-1.5">
            {l1.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: TREE_COLORS_L1[i % TREE_COLORS_L1.length] }} />
                <input
                  aria-label={`Ознака настан ${i + 1}`}
                  value={b.label}
                  onChange={e => updL1(i, 'label', e.target.value)}
                  maxLength={6}
                  placeholder="A"
                  className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <input
                  aria-label={`P(${b.label || `A${i+1}`})`}
                  type="number" min="0" max="1" step="0.01"
                  value={b.p}
                  onChange={e => updL1(i, 'p', e.target.value)}
                  placeholder="0.5"
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <span className="text-xs text-gray-400">{b.label ? `P(${b.label})` : ''}</span>
                {l1.length > 2 && (
                  <button type="button" title={`Отстрани настан ${b.label}`} onClick={() => delL1(i)}
                    className="ml-auto text-red-400 hover:text-red-600 font-bold text-sm w-5 flex-shrink-0">✕</button>
                )}
              </div>
            ))}
            {l1.length < 4 && (
              <button type="button" onClick={addL1}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1">
                + Додај настан
              </button>
            )}
          </div>
        </div>

        {/* Level 2 — per L1 node */}
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-2">Второ ниво (условни веројатности)</p>
          <div className="space-y-2">
            {l1.map((b1, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold" style={{ color: TREE_COLORS_L1[i % TREE_COLORS_L1.length] }}>
                    При {b1.label || `A${i + 1}`}:
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${l2Oks[i] ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    Σ = {l2Sums[i].toFixed(3)} {l2Oks[i] ? '✓' : '≠ 1'}
                  </span>
                </div>
                <div className="space-y-1">
                  {(l2[i] || []).map((b2, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: TREE_COLORS_L2[j % TREE_COLORS_L2.length] }} />
                      <input
                        aria-label={`Ознака гранка ${j + 1} при ${b1.label}`}
                        value={b2.label}
                        onChange={e => updL2(i, j, 'label', e.target.value)}
                        maxLength={6}
                        placeholder="X"
                        className="w-14 border border-gray-200 rounded-lg px-1.5 py-0.5 text-xs font-bold bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <input
                        aria-label={`P(${b2.label}|${b1.label})`}
                        type="number" min="0" max="1" step="0.01"
                        value={b2.p}
                        onChange={e => updL2(i, j, 'p', e.target.value)}
                        className="w-16 border border-gray-200 rounded-lg px-1.5 py-0.5 text-xs text-center font-mono bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      />
                      <span className="text-[10px] text-gray-400 hidden sm:inline">P({b2.label}|{b1.label})</span>
                      {(l2[i] || []).length > 2 && (
                        <button type="button" title={`Отстрани гранка ${b2.label}`} onClick={() => delL2(i, j)}
                          className="ml-auto text-red-400 hover:text-red-600 font-bold text-xs w-4 flex-shrink-0">✕</button>
                      )}
                    </div>
                  ))}
                  {(l2[i] || []).length < 4 && (
                    <button type="button" onClick={() => addL2(i)}
                      className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 mt-0.5">
                      + Додај гранка
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SVG tree ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-slate-50 p-2">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ minWidth: 360, width: '100%', maxHeight: 400, display: 'block' }}>
          <text x={rootX} y={12} textAnchor="middle" fontSize={8} fill="#94a3b8" fontWeight="bold">Корен</text>
          <text x={l1X}   y={12} textAnchor="middle" fontSize={8} fill="#94a3b8" fontWeight="bold">Ниво 1</text>
          <text x={l2X}   y={12} textAnchor="middle" fontSize={8} fill="#94a3b8" fontWeight="bold">Ниво 2</text>
          <text x={probX + 25} y={12} textAnchor="start" fontSize={8} fill="#94a3b8" fontWeight="bold">P(∩)</text>

          {/* Root node */}
          <circle cx={rootX} cy={rootY} r={14} fill="#6366f1" />
          <text x={rootX} y={rootY} textAnchor="middle" dominantBaseline="middle" fontSize={7.5} fill="white" fontWeight="bold">Старт</text>

          {l1.map((b1, i) => {
            const y1 = l1Ys[i];
            const c1 = TREE_COLORS_L1[i % TREE_COLORS_L1.length];
            return (
              <g key={i}>
                {/* Root → L1 */}
                <line x1={rootX + 14} y1={rootY} x2={l1X - 14} y2={y1} stroke="#e2e8f0" strokeWidth={1.8} />
                <text x={(rootX + 14 + l1X - 14) / 2} y={(rootY + y1) / 2 - 5}
                  textAnchor="middle" fontSize={8.5} fill={c1} fontWeight="bold">
                  {pNum(b1.p).toFixed(2)}
                </text>
                {/* L1 node */}
                <circle cx={l1X} cy={y1} r={14} fill={c1} />
                <text x={l1X} y={y1} textAnchor="middle" dominantBaseline="middle"
                  fontSize={9} fill="white" fontWeight="bold">
                  {(b1.label || `A${i+1}`).slice(0, 4)}
                </text>

                {(l2[i] || []).map((b2, j) => {
                  const y2  = (l2Ys[i] || [])[j] ?? y1;
                  const c2  = TREE_COLORS_L2[j % TREE_COLORS_L2.length];
                  const jp  = pNum(b1.p) * pNum(b2.p);
                  return (
                    <g key={j}>
                      {/* L1 → L2 */}
                      <line x1={l1X + 14} y1={y1} x2={l2X - 11} y2={y2} stroke="#e2e8f0" strokeWidth={1.5} />
                      <text x={(l1X + 14 + l2X - 11) / 2} y={(y1 + y2) / 2 - 4}
                        textAnchor="middle" fontSize={8} fill={c2} fontWeight="bold">
                        {pNum(b2.p).toFixed(2)}
                      </text>
                      {/* L2 leaf */}
                      <circle cx={l2X} cy={y2} r={11} fill={c2} />
                      <text x={l2X} y={y2} textAnchor="middle" dominantBaseline="middle"
                        fontSize={8} fill="white" fontWeight="bold">
                        {(b2.label || `X${j}`).slice(0, 3)}
                      </text>
                      {/* Joint probability */}
                      <text x={probX + 25} y={y2} textAnchor="start" dominantBaseline="middle"
                        fontSize={8.5} fill="#475569" fontWeight="bold">
                        {jp.toFixed(4)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Leaf table ──────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-1.5 px-2 text-gray-400 font-semibold">Пат</th>
              <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">P(Н1)</th>
              <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">P(Н2 | Н1)</th>
              <th className="text-center py-1.5 px-2 text-gray-400 font-semibold">P(∩) = P1 × P2</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((leaf, idx) => (
              <tr key={idx} className={`border-b border-gray-50 ${idx % 2 === 0 ? 'bg-gray-50/50' : ''}`}>
                <td className="py-1.5 px-2 font-bold" style={{ color: leaf.color }}>{leaf.path}</td>
                <td className="py-1.5 px-2 text-center font-mono text-gray-600">{leaf.p1.toFixed(4)}</td>
                <td className="py-1.5 px-2 text-center font-mono text-gray-600">{leaf.p2.toFixed(4)}</td>
                <td className="py-1.5 px-2 text-center font-mono font-bold text-indigo-700">{leaf.joint.toFixed(4)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-200">
              <td className="py-1.5 px-2 font-bold text-gray-600" colSpan={3}>Сума на сите P(∩)</td>
              <td className={`py-1.5 px-2 text-center font-black ${Math.abs(totalJoint - 1) < 0.005 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totalJoint.toFixed(4)} {Math.abs(totalJoint - 1) < 0.005 ? '✓ = 1' : '≠ 1'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3 text-xs text-indigo-700">
        <strong>Правило за множење:</strong> P(A∩B) = P(A) · P(B|A).
        Збирот на сите листови мора да биде 1. Зелено ✓ = веројатностите се коректни.
      </div>
    </div>
  );
};

// ── BinomialDistributionChart ─────────────────────────────────────────────────
export interface BinomialChartProps {
  n: number;
  p: number;
  counts: Record<string, number>;
  total: number;
}
export const BinomialDistributionChart: React.FC<BinomialChartProps> = ({ n, p, counts, total }) => {
  const pmf = binomialPMF(n, p);
  const mu = n * p;
  const sigma = Math.sqrt(n * p * (1 - p));
  const maxPMF = Math.max(...pmf);

  const W = 680; const H = 340;
  const padL = 48; const padR = 24; const padT = 36; const padB = 56;
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