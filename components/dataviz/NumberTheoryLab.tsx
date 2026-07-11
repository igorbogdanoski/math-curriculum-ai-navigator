import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  isPrime, primeFactors, sieve, sieveSteps, radialPos, ulamSpiralPositions, euclideanSteps, gcd, lcm,
  modTable, fibonacci, arithmeticSeq, geometricSeq,
  generateNumberTheorySet,
  NUMTHEORY_CURRICULUM, type CurriculumRef,
} from './numberTheoryMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';

// ── Curriculum badges ──────────────────────────────────────────────────────────
function CurriculumBadges({ cur }: { cur: CurriculumRef }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {cur.primary?.map(p => (
        <span key={p} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН {p} одд.</span>
      ))}
      {cur.gymnasium?.map(g => (
        <span key={g} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. {g}</span>
      ))}
    </div>
  );
}

// ── Tab 1: Primes & Sieve ─────────────────────────────────────────────────────
const SIEVE_COLORS: Record<number, string> = {
  2: 'bg-red-200 text-red-800',
  3: 'bg-blue-200 text-blue-800',
  5: 'bg-amber-200 text-amber-800',
  7: 'bg-violet-200 text-violet-800',
};

function getCellStyle(n: number, sieveMap: boolean[]): string {
  if (sieveMap[n]) return 'bg-emerald-100 text-emerald-800 font-bold ring-1 ring-emerald-300';
  for (const p of [2, 3, 5, 7] as const) {
    if (n % p === 0) return SIEVE_COLORS[p];
  }
  return 'bg-slate-100 text-slate-500 line-through';
}

// Animated radial reveal of the Sieve of Eratosthenes — numbers 2-100 placed around a
// ring, stepping through sieveSteps() one prime at a time. Auto-play uses the same
// boolean-flag + effect-scheduled-loop pattern as Geometry3DLab's PolyhedraExplorer
// auto-spin, adapted from a continuous rAF angle to a discrete step index.
const RADIAL_LIMIT = 100;
const RADIAL_CX = 180, RADIAL_CY = 180, RADIAL_R = 150;
const RADIAL_STEP_MS = 900;

function RadialSieveView() {
  const steps = useMemo(() => sieveSteps(RADIAL_LIMIT), []);
  const numbers = useMemo(() => Array.from({ length: RADIAL_LIMIT - 1 }, (_, i) => i + 2), []);
  const [stepIdx, setStepIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const finished = stepIdx >= steps.length;

  useEffect(() => {
    if (!playing) return;
    if (finished) { setPlaying(false); return; }
    const t = setTimeout(() => setStepIdx(i => i + 1), RADIAL_STEP_MS);
    return () => clearTimeout(t);
  }, [playing, finished, stepIdx]);

  const crossedOut = useMemo(() => {
    const s = new Set<number>();
    for (let i = 0; i < stepIdx; i++) {
      for (const n of steps[i].crossedOut) s.add(n);
    }
    return s;
  }, [stepIdx, steps]);

  const currentPrime = stepIdx > 0 && stepIdx <= steps.length ? steps[stepIdx - 1].prime : null;
  const primeCount = numbers.filter(n => !crossedOut.has(n)).length;

  const togglePlay = useCallback(() => {
    if (finished) setStepIdx(0);
    setPlaying(p => !p);
  }, [finished]);
  const reset = useCallback(() => { setStepIdx(0); setPlaying(false); }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button type="button" onClick={togglePlay}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
            playing ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {playing ? '⏸ Пауза' : finished ? '▶ Прегледај повторно' : '▶ Играј'}
        </button>
        <button type="button" onClick={reset}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
          ↺ Ресетирај
        </button>
        {currentPrime !== null && !finished && (
          <span className="text-xs font-bold text-amber-600">Тековен прост број: {currentPrime}</span>
        )}
        {finished && (
          <span className="text-xs font-bold text-emerald-700">Готово — {primeCount} прости броеви до 100</span>
        )}
      </div>
      <svg viewBox="0 0 360 360" role="img" aria-label="Анимирано решето на Ератостен, кружен приказ" className="w-full max-w-[380px]">
        {numbers.map((n, i) => {
          const pos = radialPos(i, numbers.length, RADIAL_CX, RADIAL_CY, RADIAL_R);
          const isCrossed = crossedOut.has(n);
          const isCurrentPrime = n === currentPrime;
          const fill = isCurrentPrime ? '#f59e0b' : isCrossed ? '#e2e8f0' : '#10b981';
          return (
            <g key={n}>
              <circle
                cx={pos.x} cy={pos.y} r={isCurrentPrime ? 13 : 10}
                fill={fill}
                stroke={isCurrentPrime ? '#b45309' : 'none'} strokeWidth={2}
                className="transition-all duration-500"
              />
              <text
                x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                fontSize={8} fontWeight="bold"
                fill={isCrossed ? '#94a3b8' : 'white'}
                className="transition-colors duration-500"
              >
                {n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Static Ulam spiral — unlike the radial reveal, its value is the pattern visible at a
// glance (primes cluster along diagonals), not a step-by-step animation.
const ULAM_LIMIT = 400;
const ULAM_CELL = 9;

function UlamSpiralView() {
  const points = useMemo(() => ulamSpiralPositions(ULAM_LIMIT), []);
  const sieveMap = useMemo(() => sieve(ULAM_LIMIT), []);

  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const width = (maxX - minX + 1) * ULAM_CELL;
  const height = (maxY - minY + 1) * ULAM_CELL;

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[11px] text-slate-500 text-center max-w-md">
        Секој број 1–{ULAM_LIMIT} е поставен во спирала; простите броеви се обоени. Забележи ги дијагоналните „траги" — тоа е класичниот Улам-ефект.
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Улам спирала на прости броеви" className="w-full max-w-[420px]">
        {points.map(p => {
          const isP = sieveMap[p.n];
          const cx = (p.x - minX) * ULAM_CELL + ULAM_CELL / 2;
          const cy = (maxY - p.y) * ULAM_CELL + ULAM_CELL / 2;
          const tooltip = p.n < 2
            ? `${p.n}`
            : isP
              ? `${p.n} е прост`
              : `${p.n} = ${primeFactors(p.n).map(f => f.exp > 1 ? `${f.base}^${f.exp}` : `${f.base}`).join('·')}`;
          return (
            <rect
              key={p.n}
              x={cx - ULAM_CELL / 2 + 0.5} y={cy - ULAM_CELL / 2 + 0.5}
              width={ULAM_CELL - 1} height={ULAM_CELL - 1}
              fill={isP ? '#10b981' : '#f1f5f9'}
            >
              <title>{tooltip}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

function PrimesTab() {
  const [checkN, setCheckN] = useState('');
  const [sieveView, setSieveView] = useState<'grid' | 'radial' | 'spiral'>('grid');

  const sieveMap = useMemo(() => sieve(100), []);
  const primesTo100 = useMemo(
    () => Array.from({ length: 99 }, (_, i) => i + 2).filter(n => sieveMap[n]),
    [sieveMap],
  );

  const parsed = parseInt(checkN, 10);
  const isValid = !isNaN(parsed) && parsed >= 2 && parsed <= 9999;
  const checkIsPrime = isValid ? isPrime(parsed) : null;
  const factors = isValid && !checkIsPrime ? primeFactors(parsed) : [];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
          <h3 className="text-sm font-bold text-slate-700">🔢 Решето на Ератостен (2–100)</h3>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
            <button type="button" onClick={() => setSieveView('grid')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                sieveView === 'grid' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🔲 Мрежа
            </button>
            <button type="button" onClick={() => setSieveView('radial')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                sieveView === 'radial' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ⭕ Кружен приказ
            </button>
            <button type="button" onClick={() => setSieveView('spiral')}
              className={`px-2.5 py-1 rounded text-xs font-bold transition ${
                sieveView === 'spiral' ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🌀 Улам спирала
            </button>
          </div>
        </div>
        {sieveView === 'grid' && (
          <>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 99 }, (_, i) => i + 2).map(n => (
                <span
                  key={n}
                  title={
                    sieveMap[n]
                      ? `${n} е прост`
                      : `${n} = ${primeFactors(n).map(f => f.exp > 1 ? `${f.base}^${f.exp}` : `${f.base}`).join('·')}`
                  }
                  className={`inline-flex items-center justify-center w-8 h-8 rounded text-xs cursor-default transition-transform hover:scale-110 ${getCellStyle(n, sieveMap)}`}
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-slate-600">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-emerald-200 ring-1 ring-emerald-300" /> Прост</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-200" /> Делив со 2</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-blue-200" /> Делив со 3</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-amber-200" /> Делив со 5</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-violet-200" /> Делив со 7</span>
            </div>
          </>
        )}
        {sieveView === 'radial' && <RadialSieveView />}
        {sieveView === 'spiral' && <UlamSpiralView />}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">🔍 Тест на простост и факторизација</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="number"
            min={2}
            max={9999}
            value={checkN}
            onChange={e => setCheckN(e.target.value)}
            placeholder="Внеси број (2–9999)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
          {isValid && (
            checkIsPrime ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">✓ Прост број!</span>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">Составен број</span>
                <span className="font-mono text-sm text-slate-700">
                  {parsed} = {factors.map((f, i) => (
                    <React.Fragment key={f.base}>
                      {i > 0 && <span className="text-slate-400 mx-0.5">·</span>}
                      <span className="font-bold">{f.base}</span>
                      {f.exp > 1 && <sup>{f.exp}</sup>}
                    </React.Fragment>
                  ))}
                </span>
              </div>
            )
          )}
        </div>
        {isValid && (
          <p className="text-xs text-slate-500 mt-2">
            Простите броеви до √{parsed} ≈ {Math.sqrt(parsed).toFixed(1)}:{' '}
            {primesTo100.filter(p => p <= Math.ceil(Math.sqrt(parsed))).join(', ')}
          </p>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Прости броеви до 100: <strong>{primesTo100.length}</strong> — 2, 3, 5, 7, 11, … 97
      </p>
    </div>
  );
}

// ── Tab 2: GCD / LCM ─────────────────────────────────────────────────────────
function GcdLcmTab() {
  const [a, setA] = useState(48);
  const [b, setB] = useState(18);

  const aVal = Math.max(1, Math.min(999, a));
  const bVal = Math.max(1, Math.min(999, b));
  const bigFirst = Math.max(aVal, bVal);
  const smallFirst = Math.min(aVal, bVal);

  const steps = useMemo(() => euclideanSteps(bigFirst, smallFirst), [bigFirst, smallFirst]);
  const g = useMemo(() => gcd(aVal, bVal), [aVal, bVal]);
  const l = useMemo(() => lcm(aVal, bVal), [aVal, bVal]);
  const factA = useMemo(() => primeFactors(aVal), [aVal]);
  const factB = useMemo(() => primeFactors(bVal), [bVal]);

  function FactDisplay({ n, factors }: { n: number; factors: ReturnType<typeof primeFactors> }) {
    return (
      <div className="flex items-center gap-1 text-sm">
        <span className="font-bold w-14 text-right text-slate-700">{n} =</span>
        {factors.length === 0
          ? <span className="text-slate-400">1</span>
          : factors.map((f, i) => (
              <React.Fragment key={f.base}>
                {i > 0 && <span className="text-slate-400">·</span>}
                <span className="font-mono font-bold text-indigo-700">
                  {f.base}{f.exp > 1 && <sup>{f.exp}</sup>}
                </span>
              </React.Fragment>
            ))
        }
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Број a</label>
          <input type="number" min={1} max={999} value={a}
            onChange={e => setA(Number(e.target.value))}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Број b</label>
          <input type="number" min={1} max={999} value={b}
            onChange={e => setB(Number(e.target.value))}
            className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3 text-center">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">НЗД (GCD)</p>
            <p className="text-3xl font-black text-emerald-700">{g}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-3 text-center">
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">НЗС (LCM)</p>
            <p className="text-3xl font-black text-blue-700">{l}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Разложување на прости множители</h3>
        <FactDisplay n={aVal} factors={factA} />
        <FactDisplay n={bVal} factors={factB} />
        <p className="text-xs text-slate-500 mt-2">
          НЗД = производ на заеднички прости делители (помали степени) ·
          НЗС = производ на сите прости делители (поголеми степени)
        </p>
      </div>

      <div>
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
          Euclidean Algorithm — {steps.length} чекор{steps.length === 1 ? '' : 'а'}
        </h3>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 text-xs font-bold">
                <th className="px-3 py-2 text-left rounded-tl-lg">Чекор</th>
                <th className="px-3 py-2 text-center">a</th>
                <th className="px-3 py-2 text-center">b</th>
                <th className="px-3 py-2 text-center">q = ⌊a÷b⌋</th>
                <th className="px-3 py-2 text-center rounded-tr-lg">r = a mod b</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-slate-700">{s.a}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold text-slate-700">{s.b}</td>
                  <td className="px-3 py-2 text-center font-mono text-indigo-600">{s.q}</td>
                  <td className={`px-3 py-2 text-center font-mono font-bold ${s.r === 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {s.r === 0 ? `0 ← НЗД = ${s.b}` : s.r}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Modular Arithmetic ─────────────────────────────────────────────────
const CX = 120, CY = 120, CR = 90;

function clockPos(val: number, m: number) {
  return radialPos(val, m, CX, CY, CR);
}

function ModularTab() {
  const [m, setM] = useState(7);
  const [a, setA] = useState(3);
  const [b, setB] = useState(5);
  const [op, setOp] = useState<'add' | 'mul'>('add');
  const [tableOp, setTableOp] = useState<'add' | 'mul'>('mul');

  const mVal = Math.max(2, Math.min(12, m));
  const aVal = ((a % mVal) + mVal) % mVal;
  const bVal = ((b % mVal) + mVal) % mVal;
  const result = op === 'add' ? (aVal + bVal) % mVal : (aVal * bVal) % mVal;

  const table = useMemo(() => modTable(mVal, tableOp), [mVal, tableOp]);
  const labels = Array.from({ length: mVal }, (_, i) => i);

  function cellColor(v: number): string {
    const hue = Math.round((v / mVal) * 300);
    return `hsl(${hue}, 65%, 88%)`;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Модул m (2–12)</label>
          <input type="number" min={2} max={12} value={m}
            onChange={e => setM(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">a</label>
          <input type="number" min={0} value={a}
            onChange={e => setA(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div className="flex gap-1 mb-0.5">
          {(['add', 'mul'] as const).map(o => (
            <button key={o} type="button" onClick={() => setOp(o)}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition ${op === o ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {o === 'add' ? '+' : '×'}
            </button>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">b</label>
          <input type="number" min={0} value={b}
            onChange={e => setB(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
          />
        </div>
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2 text-center mb-0.5">
          <p className="text-xs text-indigo-500 font-semibold">{aVal} {op === 'add' ? '+' : '×'} {bVal} ≡</p>
          <p className="text-2xl font-black text-indigo-700">{result}</p>
          <p className="text-xs text-indigo-500">(mod {mVal})</p>
        </div>
      </div>

      <div className="flex gap-6 flex-wrap items-start">
        <div className="flex-shrink-0">
          <svg width={240} height={240} className="rounded-2xl border border-slate-200 bg-slate-50">
            <circle cx={CX} cy={CY} r={CR} fill="none" stroke="#e2e8f0" strokeWidth={2} />
            {labels.map(i => {
              const pos = clockPos(i, mVal);
              const isA = i === aVal, isB = i === bVal, isRes = i === result;
              const fill = isRes ? '#4f46e5' : isA ? '#16a34a' : isB ? '#dc2626' : '#f8fafc';
              const stroke = isRes ? '#3730a3' : isA ? '#15803d' : isB ? '#b91c1c' : '#cbd5e1';
              return (
                <g key={i}>
                  <circle cx={pos.x} cy={pos.y} r={14} fill={fill} stroke={stroke} strokeWidth={2} />
                  <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fontWeight="bold"
                    fill={isRes || isA || isB ? 'white' : '#475569'}>
                    {i}
                  </text>
                </g>
              );
            })}
            <text x={CX} y={CY - 8} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#475569">mod {mVal}</text>
            <text x={CX} y={CY + 9} textAnchor="middle" fontSize={11} fill="#64748b">
              {aVal} {op === 'add' ? '+' : '×'} {bVal} ≡ {result}
            </text>
          </svg>
          <div className="flex gap-3 mt-2 text-[11px] justify-center">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-emerald-600" /> a</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-600" /> b</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-indigo-600" /> резултат</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Табела mod {mVal}</h3>
            <div className="flex gap-1">
              {(['add', 'mul'] as const).map(o => (
                <button key={o} type="button" onClick={() => setTableOp(o)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition ${tableOp === o ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {o === 'add' ? 'Собирање' : 'Множење'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="w-7 h-7 bg-slate-200 text-slate-500 font-bold text-center">{tableOp === 'add' ? '+' : '×'}</th>
                  {labels.map(j => (
                    <th key={j} className="w-7 h-7 bg-slate-100 font-bold text-slate-600 text-center">{j}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labels.map(i => (
                  <tr key={i}>
                    <th className="w-7 h-7 bg-slate-100 font-bold text-slate-600 text-center">{i}</th>
                    {table[i].map((v, j) => (
                      <td key={j} className="w-7 h-7 text-center font-bold text-slate-700"
                        style={{ backgroundColor: cellColor(v) }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Sequences ──────────────────────────────────────────────────────────
function MiniBarChart({ values }: { values: number[] }) {
  if (!values.length) return null;
  const finite = values.filter(isFinite);
  const maxV = Math.max(...finite.map(Math.abs), 1);
  const barW = 22, gap = 6;
  const width = Math.min(values.length * (barW + gap), 520);
  return (
    <svg height={90} width={width} className="overflow-visible mt-1">
      {values.map((v, i) => {
        const safeV = isFinite(v) ? v : 0;
        const barH = Math.max(2, (Math.abs(safeV) / maxV) * 65);
        return (
          <g key={i} transform={`translate(${i * (barW + gap)}, 0)`}>
            <rect x={0} y={65 - barH} width={barW} height={barH} rx={3}
              fill={safeV >= 0 ? '#10b981' : '#ef4444'} opacity={0.8} />
            <text x={barW / 2} y={80} textAnchor="middle" fontSize={9} fill="#64748b">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SequencesTab() {
  const [seqType, setSeqType] = useState<'fib' | 'arith' | 'geo'>('fib');
  const [a1, setA1] = useState(1);
  const [d, setD] = useState(3);
  const [r, setR] = useState(2);
  const [nTerms, setNTerms] = useState(8);

  const fibSeq = useMemo(() => fibonacci(12), []);
  const arithSeq = useMemo(() => arithmeticSeq(a1, d, Math.max(2, Math.min(15, nTerms))), [a1, d, nTerms]);
  const geoSeq = useMemo(() => geometricSeq(a1, r, Math.max(2, Math.min(12, nTerms))), [a1, r, nTerms]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {([
          { id: 'fib' as const, label: '🌀 Фибоначи' },
          { id: 'arith' as const, label: '➕ Аритметичка' },
          { id: 'geo' as const, label: '✖️ Геометриска' },
        ]).map(t => (
          <button key={t.id} type="button" onClick={() => setSeqType(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${seqType === t.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {seqType === 'fib' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {fibSeq.map((f, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="flex h-10 min-w-[40px] px-1 items-center justify-center rounded-lg bg-emerald-100 font-bold text-sm text-emerald-800">{f}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">F{i + 1}</span>
              </div>
            ))}
          </div>
          <MiniBarChart values={fibSeq} />
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <p className="text-xs font-bold text-amber-700">Златен однос φ ≈ 1.6180339… — приближување низ соодносот F(n+1)/F(n):</p>
            <div className="flex flex-wrap gap-2">
              {fibSeq.slice(1).map((f, i) => (
                <span key={i} className="text-xs font-mono bg-white rounded px-2 py-0.5 border border-amber-200 text-slate-600">
                  {f}/{fibSeq[i]} = {(f / fibSeq[i]).toFixed(4)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {seqType === 'arith' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Прв член a₁</label>
              <input type="number" value={a1} onChange={e => setA1(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Разлика d</label>
              <input type="number" value={d} onChange={e => setD(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Членови n</label>
              <input type="number" min={2} max={15} value={nTerms} onChange={e => setNTerms(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {arithSeq.map((v, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="flex h-10 min-w-[40px] px-1 items-center justify-center rounded-lg bg-cyan-100 font-bold text-sm text-cyan-800">{v}</span>
                <span className="text-[9px] text-slate-400 mt-0.5">a{i + 1}</span>
              </div>
            ))}
          </div>
          <MiniBarChart values={arithSeq} />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
            <p className="text-xs text-slate-700">
              <span className="font-bold">Општ член:</span>{' '}
              <span className="font-mono">a_n = {a1} + (n−1)·({d}) = {d}n + {a1 - d}</span>
            </p>
            <p className="text-xs text-slate-700">
              <span className="font-bold">Сума S_n</span> = n·(a₁ + a_n) / 2
            </p>
          </div>
        </div>
      )}

      {seqType === 'geo' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Прв член a₁</label>
              <input type="number" value={a1} onChange={e => setA1(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Количник r</label>
              <input type="number" step={0.5} value={r} onChange={e => setR(Number(e.target.value))}
                className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Членови n</label>
              <input type="number" min={2} max={12} value={nTerms} onChange={e => setNTerms(Number(e.target.value))}
                className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {geoSeq.map((v, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="flex h-10 min-w-[44px] px-1 items-center justify-center rounded-lg bg-violet-100 font-bold text-sm text-violet-800">
                  {Number.isInteger(v) ? v : isFinite(v) ? v.toFixed(2) : '∞'}
                </span>
                <span className="text-[9px] text-slate-400 mt-0.5">a{i + 1}</span>
              </div>
            ))}
          </div>
          <MiniBarChart values={geoSeq.map(v => isFinite(v) ? Math.sign(v) * Math.min(Math.abs(v), 1e6) : 0)} />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
            <p className="text-xs text-slate-700">
              <span className="font-bold">Општ член:</span>{' '}
              <span className="font-mono">a_n = {a1}·{r}^(n−1)</span>
            </p>
            {Math.abs(r) < 1 && a1 !== 0 && (
              <p className="text-xs text-slate-700">
                <span className="font-bold">S_∞</span> = {a1} / (1 − {r}) ={' '}
                <span className="font-mono text-emerald-700">{(a1 / (1 - r)).toFixed(4)}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab 5: Вежбај ────────────────────────────────────────────────────────────
function ExercisesTab() {
  const session = useLabSession('number-theory', 'Теорија на броеви');
  const [difficulty, setDifficulty] = useLabDifficulty('number-theory');
  const { loadExercises } = session;

  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateNumberTheorySet(level));
  }, [difficulty, loadExercises]);

  return (
    <LabExercisePanel
      session={session}
      onNewSet={loadSet}
      difficulty={difficulty}
      onDifficultyChange={setDifficulty}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
type Tab = 'primes' | 'gcd' | 'modular' | 'sequences' | 'exercises';

export default function NumberTheoryLab() {
  const [tab, setTab] = useState<Tab>('primes');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'primes',    label: '🔢 Прости броеви' },
    { id: 'gcd',       label: '⊂ НЗД / НЗС' },
    { id: 'modular',   label: '🕐 Модуларна' },
    { id: 'sequences', label: '📈 Низи' },
    { id: 'exercises', label: '✏️ Вежбај' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-4">
        <h2 className="text-base font-bold text-gray-800">Лабораторија за теорија на броеви</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Прости броеви · НЗД &amp; НЗС · Модуларна аритметика · Низи · Вежбај
        </p>
        <CurriculumBadges cur={NUMTHEORY_CURRICULUM} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        {tab === 'primes'    && <PrimesTab />}
        {tab === 'gcd'       && <GcdLcmTab />}
        {tab === 'modular'   && <ModularTab />}
        {tab === 'sequences' && <SequencesTab />}
        {tab === 'exercises' && <ExercisesTab />}
      </div>
    </div>
  );
}
