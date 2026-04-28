import React, { useState, useMemo } from 'react';

// ─── Math helpers ─────────────────────────────────────────────────────────────
type FnDef = { label: string; f: (x: number) => number; df: (x: number) => number; antiderivative?: (x: number) => number; latexLabel: string };

const FUNCTIONS: FnDef[] = [
  { label: 'x²', latexLabel: 'f(x) = x²', f: x => x * x, df: x => 2 * x, antiderivative: x => x ** 3 / 3 },
  { label: 'x³', latexLabel: 'f(x) = x³', f: x => x ** 3, df: x => 3 * x * x, antiderivative: x => x ** 4 / 4 },
  { label: 'sin(x)', latexLabel: 'f(x) = sin(x)', f: x => Math.sin(x), df: x => Math.cos(x), antiderivative: x => -Math.cos(x) },
  { label: 'cos(x)', latexLabel: 'f(x) = cos(x)', f: x => Math.cos(x), df: x => -Math.sin(x), antiderivative: x => Math.sin(x) },
  { label: 'eˣ', latexLabel: 'f(x) = eˣ', f: x => Math.exp(x), df: x => Math.exp(x), antiderivative: x => Math.exp(x) },
  { label: '√x', latexLabel: 'f(x) = √x', f: x => x >= 0 ? Math.sqrt(x) : NaN, df: x => x > 0 ? 1 / (2 * Math.sqrt(x)) : NaN, antiderivative: x => x >= 0 ? (2 / 3) * x ** 1.5 : NaN },
  { label: '1/x', latexLabel: 'f(x) = 1/x', f: x => x !== 0 ? 1 / x : NaN, df: x => x !== 0 ? -1 / (x * x) : NaN, antiderivative: x => x !== 0 ? Math.log(Math.abs(x)) : NaN },
];

const LIMIT_FUNCTIONS = [
  { label: '(x²−1)/(x−1)', approach: 1, expected: 2, f: (x: number) => Math.abs(x - 1) < 1e-9 ? NaN : (x * x - 1) / (x - 1) },
  { label: 'sin(x)/x', approach: 0, expected: 1, f: (x: number) => Math.abs(x) < 1e-9 ? NaN : Math.sin(x) / x },
  { label: '(eˣ−1)/x', approach: 0, expected: 1, f: (x: number) => Math.abs(x) < 1e-9 ? NaN : (Math.exp(x) - 1) / x },
  { label: '(1+x)^(1/x)', approach: 0, expected: Math.E, f: (x: number) => Math.abs(x) < 1e-9 ? NaN : (1 + x) ** (1 / x) },
];

const W = 480, H = 280;
const pad = { left: 40, right: 16, top: 16, bottom: 32 };
const iW = W - pad.left - pad.right;
const iH = H - pad.top - pad.bottom;

function toSVG(x: number, y: number, xMin: number, xMax: number, yMin: number, yMax: number) {
  const sx = pad.left + ((x - xMin) / (xMax - xMin)) * iW;
  const sy = pad.top + (1 - (y - yMin) / (yMax - yMin)) * iH;
  return { sx, sy };
}

function buildPath(fn: (x: number) => number, xMin: number, xMax: number, yMin: number, yMax: number, steps = 300) {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin + (i / steps) * (xMax - xMin);
    const y = fn(x);
    if (!isFinite(y)) { pts.push('M'); continue; }
    const { sx, sy } = toSVG(x, y, xMin, xMax, yMin, yMax);
    pts.push(pts.length === 0 || pts[pts.length - 1] === 'M' ? `M${sx.toFixed(1)},${sy.toFixed(1)}` : `L${sx.toFixed(1)},${sy.toFixed(1)}`);
  }
  return pts.filter(p => p !== 'M').join(' ');
}

function fmt(v: number) { return isNaN(v) || !isFinite(v) ? '—' : v.toFixed(4); }

// ─── Derivative sub-tab ───────────────────────────────────────────────────────
function DerivativeLab() {
  const [fnIdx, setFnIdx] = useState(0);
  const [xPos, setXPos] = useState(1.0);
  const fn = FUNCTIONS[fnIdx];

  const xMin = -3, xMax = 3;
  const pts = useMemo(() => {
    const ys: number[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = xMin + (i / 200) * (xMax - xMin);
      const y = fn.f(x);
      if (isFinite(y)) ys.push(y);
    }
    return ys;
  }, [fn]);

  const yMin = Math.max(-6, Math.min(...pts) - 0.5);
  const yMax = Math.min(6, Math.max(...pts) + 0.5);

  const fx = fn.f(xPos);
  const dfx = fn.df(xPos);
  const tanLen = 1.5;
  const x1t = xPos - tanLen, x2t = xPos + tanLen;
  const y1t = fx + dfx * (x1t - xPos);
  const y2t = fx + dfx * (x2t - xPos);

  const pt = toSVG(xPos, fx, xMin, xMax, yMin, yMax);
  const { sx: tx1, sy: ty1 } = toSVG(x1t, y1t, xMin, xMax, yMin, yMax);
  const { sx: tx2, sy: ty2 } = toSVG(x2t, y2t, xMin, xMax, yMin, yMax);
  const curvePath = buildPath(fn.f, xMin, xMax, yMin, yMax);
  const zeroY = toSVG(0, 0, xMin, xMax, yMin, yMax);
  const zeroX = toSVG(0, 0, xMin, xMax, yMin, yMax);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {FUNCTIONS.map((f, i) => (
          <button key={i} type="button" onClick={() => setFnIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition ${fnIdx === i ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-gray-600 w-16">x =</label>
        <input type="range" min={xMin} max={xMax} step={0.05} value={xPos}
          onChange={e => setXPos(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-600" aria-label="x позиција" />
        <span className="w-14 text-right text-sm font-bold text-indigo-700">{xPos.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: fn.latexLabel, value: '—', sub: 'функција' },
          { label: `f(${xPos.toFixed(2)})`, value: fmt(fx), sub: 'вредност' },
          { label: `f′(${xPos.toFixed(2)})`, value: fmt(dfx), sub: 'извод', highlight: true },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className={`rounded-xl p-3 text-center border ${highlight ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-[11px] text-gray-400 font-semibold">{sub}</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{label}</p>
            <p className={`text-lg font-extrabold mt-0.5 ${highlight ? 'text-indigo-700' : 'text-gray-700'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
          {/* axes */}
          <line x1={pad.left} y1={zeroX.sy} x2={W - pad.right} y2={zeroX.sy} stroke="#d1d5db" strokeWidth={1} />
          <line x1={zeroY.sx} y1={pad.top} x2={zeroY.sx} y2={H - pad.bottom} stroke="#d1d5db" strokeWidth={1} />
          {/* grid */}
          {[-3,-2,-1,0,1,2,3].map(v => {
            const { sx } = toSVG(v, 0, xMin, xMax, yMin, yMax);
            const { sy } = toSVG(0, v, xMin, xMax, yMin, yMax);
            return (
              <g key={v}>
                <line x1={sx} y1={pad.top} x2={sx} y2={H - pad.bottom} stroke="#f3f4f6" strokeWidth={1} />
                <line x1={pad.left} y1={sy} x2={W - pad.right} y2={sy} stroke="#f3f4f6" strokeWidth={1} />
                <text x={sx} y={H - pad.bottom + 12} textAnchor="middle" fontSize={9} fill="#9ca3af">{v}</text>
                {v !== 0 && <text x={pad.left - 4} y={sy + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>}
              </g>
            );
          })}
          {/* curve */}
          <path d={curvePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" />
          {/* tangent line */}
          <line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" />
          {/* point */}
          <circle cx={pt.sx} cy={pt.sy} r={5} fill="#f59e0b" stroke="white" strokeWidth={2} />
          {/* labels */}
          <text x={W - pad.right} y={zeroX.sy - 4} textAnchor="end" fontSize={11} fill="#6366f1" fontWeight="bold">{fn.label}</text>
          <text x={tx2 + 4} y={ty2} fontSize={10} fill="#f59e0b" fontWeight="bold">f′</text>
        </svg>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
        <strong>Геометриско значење:</strong> Изводот f′(x₀) е наклонот на тангентата на кривата во точката (x₀, f(x₀)).
        Нумеричка апроксимација: f′(x) ≈ [f(x+h)−f(x−h)] / 2h за мало h.
      </div>
    </div>
  );
}

// ─── Riemann Integrals sub-tab ────────────────────────────────────────────────
type RiemannMethod = 'left' | 'right' | 'midpoint' | 'trapezoid';

function RiemannLab() {
  const [fnIdx, setFnIdx] = useState(0);
  const [a, setA] = useState(0);
  const [b, setB] = useState(2);
  const [n, setN] = useState(8);
  const [method, setMethod] = useState<RiemannMethod>('midpoint');
  const fn = FUNCTIONS[fnIdx];

  const xMin = -0.5, xMax = 3.5;

  const pts = useMemo(() => {
    const ys: number[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = xMin + (i / 200) * (xMax - xMin);
      const y = fn.f(x);
      if (isFinite(y)) ys.push(y);
    }
    return ys;
  }, [fn]);

  const yMin = -0.3;
  const yMax = Math.min(8, Math.max(...pts) + 0.5);

  const dx = (b - a) / n;
  const approx = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const x0 = a + i * dx;
      const x1 = x0 + dx;
      if (method === 'left') sum += fn.f(x0) * dx;
      else if (method === 'right') sum += fn.f(x1) * dx;
      else if (method === 'midpoint') sum += fn.f((x0 + x1) / 2) * dx;
      else sum += ((fn.f(x0) + fn.f(x1)) / 2) * dx;
    }
    return sum;
  }, [fn, a, b, n, method, dx]);

  const exact = fn.antiderivative ? fn.antiderivative(b) - fn.antiderivative(a) : null;
  const error = exact !== null ? Math.abs(approx - exact) : null;

  const rects = useMemo(() => {
    const result: { x: number; y: number; h: number }[] = [];
    for (let i = 0; i < n; i++) {
      const x0 = a + i * dx;
      const x1 = x0 + dx;
      let yVal: number;
      if (method === 'left') yVal = fn.f(x0);
      else if (method === 'right') yVal = fn.f(x1);
      else if (method === 'midpoint') yVal = fn.f((x0 + x1) / 2);
      else yVal = (fn.f(x0) + fn.f(x1)) / 2;
      result.push({ x: x0, y: Math.max(0, yVal), h: Math.abs(yVal) });
    }
    return result;
  }, [fn, a, b, n, method, dx]);

  const curvePath = buildPath(fn.f, xMin, xMax, yMin, yMax);
  const zeroY = toSVG(0, 0, xMin, xMax, yMin, yMax);

  const METHODS: { id: RiemannMethod; label: string }[] = [
    { id: 'left', label: 'Лева' }, { id: 'right', label: 'Десна' },
    { id: 'midpoint', label: 'Средина' }, { id: 'trapezoid', label: 'Трапез' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {FUNCTIONS.map((f, i) => (
          <button key={i} type="button" onClick={() => setFnIdx(i)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition ${fnIdx === i ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Долна граница a', val: a, setVal: setA, min: -2, max: b - 0.1, step: 0.1, color: 'emerald' },
          { label: 'Горна граница b', val: b, setVal: setB, min: a + 0.1, max: 3, step: 0.1, color: 'emerald' },
          { label: `Правоаголници n = ${n}`, val: n, setVal: (v: number) => setN(Math.round(v)), min: 1, max: 50, step: 1, color: 'emerald' },
        ].map(({ label, val, setVal, min, max, step, color }) => (
          <div key={label}>
            <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
              <span>{label}</span><span className={`text-${color}-600`}>{typeof val === 'number' ? val.toFixed(step < 1 ? 1 : 0) : val}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={val}
              onChange={e => (setVal as (v: number) => void)(parseFloat(e.target.value))}
              className={`w-full accent-${color}-600`} aria-label={label} />
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {METHODS.map(m => (
          <button key={m.id} type="button" onClick={() => setMethod(m.id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition ${method === m.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-emerald-300'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 text-center bg-emerald-50 border border-emerald-200">
          <p className="text-[11px] text-gray-400 font-semibold">Апроксимација</p>
          <p className="text-lg font-extrabold text-emerald-700">{fmt(approx)}</p>
        </div>
        <div className="rounded-xl p-3 text-center bg-gray-50 border border-gray-200">
          <p className="text-[11px] text-gray-400 font-semibold">Точна вредност</p>
          <p className="text-lg font-extrabold text-gray-700">{exact !== null ? fmt(exact) : '—'}</p>
        </div>
        <div className="rounded-xl p-3 text-center bg-amber-50 border border-amber-200">
          <p className="text-[11px] text-gray-400 font-semibold">Грешка |Δ|</p>
          <p className="text-lg font-extrabold text-amber-700">{error !== null ? fmt(error) : '—'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 300 }}>
          <line x1={pad.left} y1={zeroY.sy} x2={W - pad.right} y2={zeroY.sy} stroke="#d1d5db" strokeWidth={1} />
          <line x1={zeroY.sx} y1={pad.top} x2={zeroY.sx} y2={H - pad.bottom} stroke="#d1d5db" strokeWidth={1} />
          {[-0, 1, 2, 3].map(v => {
            const { sx } = toSVG(v, 0, xMin, xMax, yMin, yMax);
            return <text key={v} x={sx} y={H - pad.bottom + 12} textAnchor="middle" fontSize={9} fill="#9ca3af">{v}</text>;
          })}
          {/* rectangles */}
          {rects.map((r, i) => {
            const { sx: rx } = toSVG(r.x, 0, xMin, xMax, yMin, yMax);
            const { sx: rx2 } = toSVG(r.x + dx, 0, xMin, xMax, yMin, yMax);
            const { sy: ry } = toSVG(0, r.y, xMin, xMax, yMin, yMax);
            const rw = Math.max(0, rx2 - rx - 1);
            const rh = Math.max(0, zeroY.sy - ry);
            return (
              <rect key={i} x={rx} y={ry} width={rw} height={rh}
                fill="#10b981" fillOpacity={0.35} stroke="#10b981" strokeWidth={0.5} />
            );
          })}
          {/* curve */}
          <path d={curvePath} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" />
          {/* a-b markers */}
          {[a, b].map(v => {
            const { sx } = toSVG(v, 0, xMin, xMax, yMin, yMax);
            return <line key={v} x1={sx} y1={pad.top} x2={sx} y2={H - pad.bottom} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />;
          })}
          <text x={W - pad.right} y={zeroY.sy - 4} textAnchor="end" fontSize={11} fill="#6366f1" fontWeight="bold">{fn.label}</text>
        </svg>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
        <strong>Римановата сума:</strong> ∫ᵃᵇ f(x) dx ≈ Σ f(xᵢ*)·Δx &nbsp;|&nbsp;
        Зголемувањето на n ја намалува грешката. Методот трапез конвергира побрзо (ред O(h²) наспроти O(h)).
      </div>
    </div>
  );
}

// ─── Limits sub-tab ───────────────────────────────────────────────────────────
function LimitsLab() {
  const [fnIdx, setFnIdx] = useState(0);
  const lf = LIMIT_FUNCTIONS[fnIdx];

  const deltas = [0.5, 0.1, 0.05, 0.01, 0.001, 0.0001];
  const leftRows = deltas.map(d => ({ x: lf.approach - d, y: lf.f(lf.approach - d) }));
  const rightRows = deltas.map(d => ({ x: lf.approach + d, y: lf.f(lf.approach + d) }));

  const xMin = lf.approach - 1.2, xMax = lf.approach + 1.2;
  const allY = [...leftRows, ...rightRows].map(r => r.y).filter(isFinite);
  const yMin = Math.min(...allY) - 0.3;
  const yMax = Math.max(...allY, lf.expected) + 0.3;

  const curvePath = useMemo(() => {
    const pts: string[] = [];
    const steps = 400;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      if (Math.abs(x - lf.approach) < (xMax - xMin) / steps * 2) continue;
      const y = lf.f(x);
      if (!isFinite(y)) { pts.push('M'); continue; }
      const { sx, sy } = toSVG(x, y, xMin, xMax, yMin, yMax);
      pts.push(pts.length === 0 || pts[pts.length - 1] === 'M' ? `M${sx.toFixed(1)},${sy.toFixed(1)}` : `L${sx.toFixed(1)},${sy.toFixed(1)}`);
    }
    return pts.filter(p => p !== 'M').join(' ');
  }, [fnIdx]);

  const limitPt = toSVG(lf.approach, lf.expected, xMin, xMax, yMin, yMax);
  const zeroY = toSVG(lf.approach, (yMin + yMax) / 2, xMin, xMax, yMin, yMax);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {LIMIT_FUNCTIONS.map((f, i) => (
          <button key={i} type="button" onClick={() => setFnIdx(i)}
            className={`px-3 py-2 rounded-lg text-sm font-bold border-2 transition ${fnIdx === i ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-600 hover:border-violet-300'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl bg-violet-50 border border-violet-200 p-3 text-center">
        <p className="text-xs text-violet-500 font-semibold">lim<sub>x→{lf.approach}</sub> {lf.label}</p>
        <p className="text-2xl font-extrabold text-violet-700 mt-1">= {lf.expected.toFixed(6)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { label: `x → ${lf.approach}⁻ (оддолу)`, rows: leftRows, color: 'rose' },
          { label: `x → ${lf.approach}⁺ (одгоре)`, rows: rightRows, color: 'indigo' },
        ].map(({ label, rows, color }) => (
          <div key={label}>
            <p className={`text-[11px] font-bold text-${color}-600 mb-1.5 uppercase tracking-wide`}>{label}</p>
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-gray-200">
                <th className="text-left text-gray-400 font-semibold py-0.5">x</th>
                <th className="text-right text-gray-400 font-semibold py-0.5">f(x)</th>
              </tr></thead>
              <tbody>
                {rows.map(({ x, y }) => (
                  <tr key={x} className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-600">{x.toPrecision(5)}</td>
                    <td className="py-0.5 text-right text-gray-800 font-bold">{isFinite(y) ? y.toPrecision(6) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 260 }}>
          <line x1={pad.left} y1={zeroY.sy} x2={W - pad.right} y2={zeroY.sy} stroke="#d1d5db" strokeWidth={1} />
          <path d={curvePath} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={limitPt.sx} cy={limitPt.sy} r={6} fill="white" stroke="#7c3aed" strokeWidth={2.5} />
          <line x1={limitPt.sx} y1={pad.top} x2={limitPt.sx} y2={H - pad.bottom} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" />
          <text x={limitPt.sx + 6} y={limitPt.sy - 6} fontSize={10} fill="#7c3aed" fontWeight="bold">L={lf.expected.toFixed(4)}</text>
        </svg>
      </div>

      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-700">
        <strong>Дефиниција:</strong> Ако f(x) → L кога x → a и оддолу и одгоре, велиме дека lim<sub>x→a</sub> f(x) = L.
        Шупливиот круг покажува дека f(a) може да не биде дефинирана во таа точка.
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type CalcTab = 'deriv' | 'riemann' | 'limits';

export function CalculusLab() {
  const [tab, setTab] = useState<CalcTab>('deriv');

  const TABS: { id: CalcTab; label: string; color: string }[] = [
    { id: 'deriv',   label: '∂ Изводи',             color: 'indigo' },
    { id: 'riemann', label: '∫ Риманови суми',       color: 'emerald' },
    { id: 'limits',  label: 'lim Граници',           color: 'violet' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === t.id ? `border-${t.color}-500 bg-${t.color}-50 text-${t.color}-700` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'deriv'   && <DerivativeLab />}
      {tab === 'riemann' && <RiemannLab />}
      {tab === 'limits'  && <LimitsLab />}
    </div>
  );
}
