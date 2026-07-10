import React, { useState, useCallback, useRef } from 'react';
import { Eye, PenLine, Target, RefreshCw } from 'lucide-react';
import {
  type Fraction, type FractionGradeRange, GRADE_CONFIGS,
  simplifyFraction, toDecimal, fractionToString, generateFractionsSet, randomProperFraction,
} from './fractionsMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';

// ─── Bar model — draggable boundary between shaded/unshaded segments ────────
const BAR_W = 320, BAR_H = 64;

interface BarModelProps { num: number; den: number; onChange?: (num: number) => void }

const BarModel: React.FC<BarModelProps> = ({ num, den, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const segW = BAR_W / den;

  const emitFromX = useCallback((clientX: number) => {
    if (!onChange) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = BAR_W / rect.width;
    const x = (clientX - rect.left) * scale;
    onChange(Math.max(0, Math.min(den, Math.round(x / segW))));
  }, [onChange, den, segW]);

  const onDown = useCallback(() => { if (onChange) dragging.current = true; }, [onChange]);
  const onMove = useCallback((e: React.MouseEvent) => { if (!dragging.current) return; emitFromX(e.clientX); }, [emitFromX]);
  const onUp = useCallback(() => { dragging.current = false; }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => { e.preventDefault(); emitFromX(e.touches[0].clientX); }, [emitFromX]);
  const onSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => { emitFromX(e.clientX); }, [emitFromX]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BAR_W} ${BAR_H}`}
      role="img"
      aria-label={`Бар модел, ${num} од ${den} засенчени`}
      className={`w-full max-w-[340px] select-none ${onChange ? 'cursor-ew-resize' : ''}`}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      onClick={onChange ? onSvgClick : undefined}
    >
      {Array.from({ length: den }, (_, i) => (
        <rect
          key={i}
          x={i * segW} y={0} width={segW} height={BAR_H}
          fill={i < num ? '#4f46e5' : '#eef2ff'}
          stroke="#c7d2fe" strokeWidth={1.5}
          className="transition-colors"
        />
      ))}
      <rect x={0} y={0} width={BAR_W} height={BAR_H} fill="none" stroke="#4338ca" strokeWidth={2} rx={4} />
      {onChange && (
        <line x1={num * segW} y1={-4} x2={num * segW} y2={BAR_H + 4} stroke="#f59e0b" strokeWidth={3} />
      )}
    </svg>
  );
};

// ─── Circle model — synced read-only view (wedge geometry) ──────────────────
const CIRCLE_R = 68, CIRCLE_CX = 80, CIRCLE_CY = 80;

function wedgePath(startFrac: number, endFrac: number): string {
  const a0 = startFrac * 2 * Math.PI - Math.PI / 2;
  const a1 = endFrac * 2 * Math.PI - Math.PI / 2;
  const x0 = CIRCLE_CX + CIRCLE_R * Math.cos(a0), y0 = CIRCLE_CY + CIRCLE_R * Math.sin(a0);
  const x1 = CIRCLE_CX + CIRCLE_R * Math.cos(a1), y1 = CIRCLE_CY + CIRCLE_R * Math.sin(a1);
  const largeArc = (endFrac - startFrac) > 0.5 ? 1 : 0;
  return `M ${CIRCLE_CX} ${CIRCLE_CY} L ${x0} ${y0} A ${CIRCLE_R} ${CIRCLE_R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

const CircleModel: React.FC<{ num: number; den: number }> = ({ num, den }) => (
  <svg viewBox="0 0 160 160" role="img" aria-label={`Круг модел, ${num} од ${den} засенчени`} className="w-full max-w-[180px]">
    {Array.from({ length: den }, (_, i) => (
      <path
        key={i}
        d={wedgePath(i / den, (i + 1) / den)}
        fill={i < num ? '#4f46e5' : '#eef2ff'}
        stroke="#c7d2fe" strokeWidth={1.5}
        className="transition-colors"
      />
    ))}
    <circle cx={CIRCLE_CX} cy={CIRCLE_CY} r={CIRCLE_R} fill="none" stroke="#4338ca" strokeWidth={2} />
  </svg>
);

// ─── Number line model — draggable marker, snaps to nearest 1/den tick ──────
const LINE_W = 320, TICK_H = 10;

interface NumberLineProps { num: number; den: number; onChange?: (num: number) => void }

const NumberLineModel: React.FC<NumberLineProps> = ({ num, den, onChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const segW = LINE_W / den;

  const emitFromX = useCallback((clientX: number) => {
    if (!onChange) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = LINE_W / rect.width;
    const x = (clientX - rect.left) * scale;
    onChange(Math.max(0, Math.min(den, Math.round(x / segW))));
  }, [onChange, den, segW]);

  const onDown = useCallback(() => { if (onChange) dragging.current = true; }, [onChange]);
  const onMove = useCallback((e: React.MouseEvent) => { if (!dragging.current) return; emitFromX(e.clientX); }, [emitFromX]);
  const onUp = useCallback(() => { dragging.current = false; }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => { e.preventDefault(); emitFromX(e.touches[0].clientX); }, [emitFromX]);
  const onSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => { emitFromX(e.clientX); }, [emitFromX]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${LINE_W} 50`}
      role="img"
      aria-label={`Бројна права, точка на ${num}/${den}`}
      className={`w-full max-w-[340px] select-none ${onChange ? 'cursor-ew-resize' : ''}`}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      onClick={onChange ? onSvgClick : undefined}
    >
      <line x1={0} y1={25} x2={LINE_W} y2={25} stroke="#94a3b8" strokeWidth={2} />
      {Array.from({ length: den + 1 }, (_, i) => (
        <g key={i}>
          <line x1={i * segW} y1={25 - TICK_H / 2} x2={i * segW} y2={25 + TICK_H / 2} stroke="#64748b" strokeWidth={1.5} />
          {(i === 0 || i === den) && (
            <text x={i * segW} y={44} fontSize={10} textAnchor="middle" fill="#64748b">{i === 0 ? '0' : '1'}</text>
          )}
        </g>
      ))}
      <circle cx={num * segW} cy={25} r={8} fill="white" stroke="#f59e0b" strokeWidth={2.5} style={{ cursor: onChange ? 'grab' : 'default' }} />
    </svg>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = 'show' | 'practice' | 'build';

export const FractionsLab: React.FC = () => {
  const [grade, setGrade] = useState<FractionGradeRange>('g4');
  const [mode, setMode] = useState<Mode>('show');
  const cfg = GRADE_CONFIGS[grade];

  // Show mode — {num, den} drives all three synced visuals
  const [frac, setFrac] = useState<Fraction>({ num: 3, den: 4 });
  const clampedFrac = { num: Math.min(frac.num, frac.den), den: frac.den };
  const simplified = simplifyFraction(clampedFrac);
  const decimal = toDecimal(clampedFrac);

  const setNum = useCallback((n: number) => setFrac(f => ({ ...f, num: n })), []);
  const setDen = useCallback((d: number) => setFrac(f => ({ num: Math.min(f.num, d), den: d })), []);

  // Practice mode — connected to quiz_results via useLabSession
  const session = useLabSession('fractions', 'Дропки — Бар, Круг и Бројна права');
  const [difficulty, setDifficulty] = useLabDifficulty('fractions');
  const { loadExercises } = session;
  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateFractionsSet(grade, level));
  }, [grade, difficulty, loadExercises]);

  // Build mode — drag the bar to match a target fraction
  const [target, setTarget] = useState<Fraction>(() => randomProperFraction(4));
  const [buildFrac, setBuildFrac] = useState<Fraction>({ num: 0, den: target.den });
  const [buildChecked, setBuildChecked] = useState(false);
  const buildCorrect = buildFrac.num === target.num && buildFrac.den === target.den;

  const newBuildTarget = useCallback(() => {
    const t = randomProperFraction(Math.min(cfg.maxDenominator, 8));
    setTarget(t);
    setBuildFrac({ num: 0, den: t.den });
    setBuildChecked(false);
  }, [cfg.maxDenominator]);

  const MODES: { id: Mode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'show',     label: 'Прикажи',  icon: Eye     },
    { id: 'practice', label: 'Вежбај',   icon: PenLine },
    { id: 'build',    label: 'Состави',  icon: Target  },
  ];

  const GRADES: FractionGradeRange[] = ['g3', 'g4', 'g5', 'g6'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Дропки — Бар, Круг и Бројна права</h2>
          <p className="text-xs text-gray-500 mt-0.5">{cfg.description}</p>
        </div>
        {/* Grade selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {GRADES.map(g => (
            <button key={g} type="button"
              onClick={() => {
                setGrade(g);
                setFrac({ num: 1, den: 2 });
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                grade === g ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {GRADE_CONFIGS[g].label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setMode(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
              mode === id
                ? 'border-emerald-500 text-emerald-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── MODE: SHOW ──────────────────────────────────────────────────────── */}
      {mode === 'show' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-semibold text-gray-700">Именител:</label>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {Array.from({ length: cfg.maxDenominator - 1 }, (_, i) => i + 2).map(d => (
                  <button key={d} type="button" onClick={() => setDen(d)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                      clampedFrac.den === d ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-2 text-center">
              <p className="text-2xl font-black text-indigo-700">{fractionToString(clampedFrac)}</p>
              <p className="text-xs text-indigo-500">
                = {fractionToString(simplified)} = {decimal.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">Влечи ја портокаловата линија на барот или точката на бројната права:</p>

          <div className="flex flex-wrap items-start gap-6">
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl border border-indigo-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Бар модел</p>
              <BarModel num={clampedFrac.num} den={clampedFrac.den} onChange={setNum} />
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl border border-indigo-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Круг модел</p>
              <CircleModel num={clampedFrac.num} den={clampedFrac.den} />
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl border border-indigo-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Бројна права</p>
            <NumberLineModel num={clampedFrac.num} den={clampedFrac.den} onChange={setNum} />
          </div>
        </div>
      )}

      {/* ── MODE: PRACTICE ──────────────────────────────────────────────────── */}
      {mode === 'practice' && (
        <div className="space-y-3">
          <LabExercisePanel
            session={session}
            onNewSet={loadSet}
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
          />
        </div>
      )}

      {/* ── MODE: BUILD ──────────────────────────────────────────────────────── */}
      {mode === 'build' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-2">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Состави ја дропката</p>
              <p className="text-2xl font-black text-amber-700">{fractionToString(target)}</p>
            </div>
            <button type="button" onClick={newBuildTarget}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition">
              <RefreshCw className="w-4 h-4" />
              Нова дропка
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-amber-50 rounded-2xl border border-amber-100 p-4">
            <p className="text-xs text-gray-500 mb-2">Влечи ја линијата за да засенчиш {target.num} од {target.den} делови:</p>
            <BarModel num={buildFrac.num} den={buildFrac.den} onChange={n => { setBuildFrac(f => ({ ...f, num: n })); setBuildChecked(false); }} />
          </div>

          <button
            type="button"
            onClick={() => setBuildChecked(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
          >
            Провери
          </button>

          {buildChecked && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              buildCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {buildCorrect
                ? `✓ Точно! ${fractionToString(buildFrac)} = ${fractionToString(target)}`
                : `Не сосема — ти имаш ${fractionToString(buildFrac)}, целта е ${fractionToString(target)}.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
