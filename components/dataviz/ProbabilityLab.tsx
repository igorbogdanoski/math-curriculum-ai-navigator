import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BarChart2, RefreshCw } from 'lucide-react';
import type { TableData } from './DataTable';
import type { ChartConfig } from './ChartPreview';
import {
  type ExperimentType, type SpinnerSector,
  SPINNER_COLORS, DEFAULT_SECTORS, DIE_FACES, EXPERIMENTS, EXP_LABEL,
  wilsonCI, combinations, permutations,
  getOutcomes, theoretical, rollOne,
  generateProbabilitySet,
} from './probabilityMath';
import { ConditionalProbabilityVenn, ProbabilityTreeBuilder, BinomialDistributionChart } from './ProbabilityLabPanels';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';

export interface ProbabilityLabProps {
  onSendToDataViz: (tableData: TableData, config: Partial<ChartConfig>) => void;
  onGoToChart: () => void;
}

// ── Exercises sub-panel ───────────────────────────────────────────────────────
function ProbExercisesPanel() {
  const session = useLabSession('probability', 'Веројатност');
  const [difficulty, setDifficulty] = useLabDifficulty('probability');
  const { loadExercises } = session;
  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateProbabilitySet(level));
  }, [difficulty, loadExercises]);
  return <LabExercisePanel session={session} onNewSet={loadSet} difficulty={difficulty} onDifficultyChange={setDifficulty} />;
}

// ── SpinnerSVG ────────────────────────────────────────────────────────────────
const SpinnerSVG: React.FC<{ sectors: SpinnerSector[]; lastResult?: string }> = ({ sectors, lastResult }) => {
  const total = sectors.reduce((s, x) => s + x.weight, 0);
  if (!total || !sectors.length) return null;
  const cx = 100, cy = 100, r = 82;
  let ang = -Math.PI / 2;

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[240px]">
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
  const flashTimerRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [view, setView]             = useState<'sim' | 'ex'>('sim');

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
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlash(false);
      flashTimerRef.current = null;
    }, 350);
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

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

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
      <div className="flex gap-1.5">
        {(['sim', 'ex'] as const).map(v => (
          <button key={v} type="button" onClick={() => setView(v)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${view === v ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {v === 'sim' ? '🎲 Симулација' : '✏️ Вежбај'}
          </button>
        ))}
      </div>
      {view === 'ex' && <ProbExercisesPanel />}
      {view === 'sim' && <>

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

      {/* ── Probability tree builder ─────────────────────────────────────────── */}
      <ProbabilityTreeBuilder />
      </>}

    </div>
  );
};
