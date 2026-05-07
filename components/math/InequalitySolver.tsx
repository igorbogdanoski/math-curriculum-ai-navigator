/**
 * InequalitySolver (T4.4)
 *
 * Two modes:
 *   1. |x − a| <op> b   — drag a/b sliders.
 *   2. Polynomial (x − r1)(x − r2)…(x − rk) <op> 0 — drag root chips.
 *
 * Renders an interactive number line with open/closed endpoints + a
 * step-by-step disclosure (expand/collapse).
 */
import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import {
  buildNumberLine, formatSolution,
  solveAbs, solvePolynomial,
  type CmpOp,
} from './inequalitySolverHelpers';

const OPS: { key: CmpOp; label: string }[] = [
  { key: '<',  label: '<' },
  { key: '<=', label: '≤' },
  { key: '>',  label: '>' },
  { key: '>=', label: '≥' },
];

export type InequalityKind = 'abs' | 'poly';

export interface InequalitySolverProps {
  initialKind?: InequalityKind;
}

export const InequalitySolver: React.FC<InequalitySolverProps> = ({
  initialKind = 'abs',
}) => {
  const [kind, setKind] = useState<InequalityKind>(initialKind);

  // Abs state
  const [a, setA] = useState(2);
  const [b, setB] = useState(3);
  const [absOp, setAbsOp] = useState<CmpOp>('<');

  // Poly state
  const [roots, setRoots] = useState<number[]>([-2, 1, 3]);
  const [polyOp, setPolyOp] = useState<CmpOp>('<');
  const [leading, setLeading] = useState<1 | -1>(1);

  const [stepsOpen, setStepsOpen] = useState(false);

  const solution = useMemo(() => {
    if (kind === 'abs') return solveAbs({ a, b, op: absOp });
    return solvePolynomial({ roots, op: polyOp, leading });
  }, [kind, a, b, absOp, roots, polyOp, leading]);

  const line = useMemo(() => buildNumberLine(solution), [solution]);
  const { min, max } = line.range;
  const W = 480;
  const H = 80;
  const yMid = H / 2;
  const padX = 24;
  const toScreen = (x: number) => {
    if (max === min) return W / 2;
    return padX + ((x - min) / (max - min)) * (W - 2 * padX);
  };

  const reset = () => {
    if (kind === 'abs') { setA(2); setB(3); setAbsOp('<'); }
    else { setRoots([-2, 1, 3]); setPolyOp('<'); setLeading(1); }
  };

  const updateRoot = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = [...roots];
    next[idx] = Number(e.target.value);
    setRoots(next);
  };
  const addRoot = () => setRoots((r) => [...r, (r[r.length - 1] ?? 0) + 1]);
  const removeRoot = (idx: number) => setRoots((r) => r.filter((_, i) => i !== idx));

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
      data-testid="inequality-solver"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-black text-gray-800">Решавач на неравенки</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setKind('abs')}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${kind === 'abs' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
            data-testid="ineq-kind-abs"
            aria-pressed={kind === 'abs'}
          >
            |x − a|
          </button>
          <button
            type="button"
            onClick={() => setKind('poly')}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${kind === 'poly' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
            data-testid="ineq-kind-poly"
            aria-pressed={kind === 'poly'}
          >
            Полиномска
          </button>
          <button
            type="button"
            onClick={reset}
            className="ml-1 inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
            data-testid="ineq-reset"
          >
            <RotateCcw className="w-3 h-3" /> Ресет
          </button>
        </div>
      </div>

      {/* Inequality display */}
      <code
        className="block px-2 py-1.5 font-mono bg-indigo-50 text-indigo-800 rounded-md border border-indigo-100 text-xs"
        data-testid="ineq-formula"
      >
        {kind === 'abs'
          ? `|x ${a < 0 ? `+ ${-a}` : `− ${a}`}| ${absOp.replace('<=', '≤').replace('>=', '≥')} ${b}`
          : `${leading === -1 ? '−' : ''}(${roots.map((r) => `x ${r < 0 ? `+ ${-r}` : `− ${r}`}`).join(')(')}) ${polyOp.replace('<=', '≤').replace('>=', '≥')} 0`}
      </code>

      {/* Number line */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto bg-gray-50 rounded-xl border border-gray-100"
        role="img"
        aria-label="Бројна права со решение"
        data-testid="ineq-numberline"
      >
        <line x1={padX} y1={yMid} x2={W - padX} y2={yMid} stroke="#374151" strokeWidth={1.5} />
        {/* Tick marks */}
        {Array.from({ length: 11 }, (_, i) => min + (i / 10) * (max - min)).map((tx) => {
          const sx = toScreen(tx);
          return (
            <g key={`t${tx}`}>
              <line x1={sx} y1={yMid - 4} x2={sx} y2={yMid + 4} stroke="#9ca3af" strokeWidth={1} />
              <text x={sx} y={yMid + 18} fontSize={9} fill="#6b7280" textAnchor="middle">
                {Number(tx).toFixed(0)}
              </text>
            </g>
          );
        })}
        {/* Solution segments */}
        {line.segments.map((seg, i) => (
          <line
            key={`seg${i}`}
            x1={toScreen(seg.from)}
            y1={yMid - 6}
            x2={toScreen(seg.to)}
            y2={yMid - 6}
            stroke="#dc2626"
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        {/* Endpoints */}
        {line.points.map((p, i) => (
          <circle
            key={`pt${i}`}
            cx={toScreen(p.x)}
            cy={yMid - 6}
            r={5}
            fill={p.filled ? '#dc2626' : '#fff'}
            stroke="#dc2626"
            strokeWidth={2}
          />
        ))}
      </svg>

      <div className="text-xs">
        <strong className="text-gray-700">Решение: </strong>
        <code className="font-mono font-bold text-rose-700" data-testid="ineq-solution">
          x ∈ {formatSolution(solution)}
        </code>
      </div>

      {/* Controls */}
      {kind === 'abs' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <label className="font-semibold text-gray-700 space-y-1">
            <span>a = <span className="font-mono font-bold text-indigo-700">{a}</span></span>
            <input type="range" min={-5} max={5} step={0.5} value={a} onChange={(e) => setA(Number(e.target.value))}
              className="w-full accent-indigo-600" data-testid="ineq-abs-a" aria-label="Параметар a" />
          </label>
          <label className="font-semibold text-gray-700 space-y-1">
            <span>b = <span className="font-mono font-bold text-indigo-700">{b}</span></span>
            <input type="range" min={0} max={6} step={0.5} value={b} onChange={(e) => setB(Number(e.target.value))}
              className="w-full accent-indigo-600" data-testid="ineq-abs-b" aria-label="Параметар b" />
          </label>
          <div className="font-semibold text-gray-700 space-y-1">
            <span>Релација:</span>
            <div className="flex gap-1">
              {OPS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAbsOp(key)}
                  className={`px-2 py-1 rounded-md text-xs font-bold border ${absOp === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                  data-testid={`ineq-abs-op-${key}`}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-700">Корени:</span>
            {roots.map((r, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                <input
                  type="number"
                  value={r}
                  step={0.5}
                  onChange={updateRoot(i)}
                  className="w-14 bg-transparent text-center font-mono font-bold text-indigo-700"
                  data-testid={`ineq-root-${i}`}
                  aria-label={`Корен ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeRoot(i)}
                  className="text-gray-400 hover:text-rose-600 text-xs"
                  data-testid={`ineq-root-remove-${i}`}
                  aria-label={`Отстрани корен ${i + 1}`}
                >×</button>
              </span>
            ))}
            <button
              type="button"
              onClick={addRoot}
              className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 hover:bg-indigo-100"
              data-testid="ineq-root-add"
            >+ корен</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-700">Водечки коеф.:</span>
            <button type="button" onClick={() => setLeading(1)}
              className={`px-2 py-1 rounded-md text-xs font-bold border ${leading === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
              data-testid="ineq-leading-pos">+</button>
            <button type="button" onClick={() => setLeading(-1)}
              className={`px-2 py-1 rounded-md text-xs font-bold border ${leading === -1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
              data-testid="ineq-leading-neg">−</button>
            <span className="font-semibold text-gray-700 ml-2">Релација:</span>
            {OPS.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setPolyOp(key)}
                className={`px-2 py-1 rounded-md text-xs font-bold border ${polyOp === key ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-gray-50 text-gray-600 border-gray-200'}`}
                data-testid={`ineq-poly-op-${key}`}
              >{label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Steps disclosure */}
      <button
        type="button"
        onClick={() => setStepsOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:text-indigo-900"
        data-testid="ineq-steps-toggle"
      >
        {stepsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Чекори по чекор
      </button>
      {stepsOpen && (
        <div
          className="bg-gray-50 rounded-xl border border-gray-100 p-3 text-xs text-gray-700 space-y-1"
          data-testid="ineq-steps"
        >
          {kind === 'abs' ? (
            <>
              <p>1. Препиши: |x − {a}| {absOp.replace('<=', '≤').replace('>=', '≥')} {b}.</p>
              <p>2. Расцепи: {absOp === '<' || absOp === '<=' ? `−${b} ${absOp.replace('<=', '≤')} x − ${a} ${absOp.replace('<=', '≤')} ${b}` : `x − ${a} ${absOp.replace('>=', '≥')} ${b}  или  x − ${a} ${absOp.replace('>=', '≥')} −${b}`}.</p>
              <p>3. Додај {a} насекаде.</p>
              <p>4. Решение: <span className="font-mono font-bold">x ∈ {formatSolution(solution)}</span>.</p>
            </>
          ) : (
            <>
              <p>1. Корени (подредени): {Array.from(new Set(roots)).sort((x, y) => x - y).join(', ')}.</p>
              <p>2. Знак на полиномот менува секаде каде што има прост корен.</p>
              <p>3. Земи ги интервалите со посакуваниот знак.</p>
              <p>4. Решение: <span className="font-mono font-bold">x ∈ {formatSolution(solution)}</span>.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
