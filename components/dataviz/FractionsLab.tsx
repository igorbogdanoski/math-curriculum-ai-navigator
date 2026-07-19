import React, { useState, useCallback, useRef } from 'react';
import { Eye, PenLine, Target, RefreshCw, GitCompare, Divide } from 'lucide-react';
import {
  type Fraction, type FractionGradeRange, GRADE_CONFIGS,
  simplifyFraction, toDecimal, toPercent, fractionToString, generateFractionsSet, randomProperFraction,
  compareFractions, addFractions, subtractFractions, multiplyFractions, divideFractions,
} from './fractionsMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';
import { useLanguage } from '../../i18n/LanguageContext';

const gradeLabel = (g: FractionGradeRange, t: (k: string) => string): string =>
  ({ g3: t('fractionsLab.grade.g3'), g4: t('fractionsLab.grade.g4'), g5: t('fractionsLab.grade.g5'), g6: t('fractionsLab.grade.g6') }[g]);

const gradeDescription = (g: FractionGradeRange, t: (k: string) => string): string =>
  ({ g3: t('fractionsLab.grade.g3Desc'), g4: t('fractionsLab.grade.g4Desc'), g5: t('fractionsLab.grade.g5Desc'), g6: t('fractionsLab.grade.g6Desc') }[g]);

// ─── Bar model — draggable boundary between shaded/unshaded segments ────────
const BAR_W = 320, BAR_H = 64;

interface BarModelProps { num: number; den: number; onChange?: (num: number) => void }

const BarModel: React.FC<BarModelProps> = ({ num, den, onChange }) => {
  const { t } = useLanguage();
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
  const onKeyDown = useCallback((e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!onChange) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(den, num + 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, num - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(0); }
    else if (e.key === 'End') { e.preventDefault(); onChange(den); }
  }, [onChange, num, den]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BAR_W} ${BAR_H}`}
      role={onChange ? 'slider' : 'img'}
      aria-label={`${t('fractionsLab.model.bar')}, ${num} ${t('fractionsLab.aria.of')} ${den} ${t('fractionsLab.aria.shaded')}`}
      aria-valuemin={onChange ? 0 : undefined}
      aria-valuemax={onChange ? den : undefined}
      aria-valuenow={onChange ? num : undefined}
      aria-valuetext={onChange ? `${num} ${t('fractionsLab.aria.of')} ${den}` : undefined}
      tabIndex={onChange ? 0 : undefined}
      className={`w-full max-w-[340px] select-none ${onChange ? 'cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded' : ''}`}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      onClick={onChange ? onSvgClick : undefined}
      onKeyDown={onChange ? onKeyDown : undefined}
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

// ─── Circle model — draggable wedge picker (polar hit-testing) ──────────────
const CIRCLE_R = 68, CIRCLE_CX = 80, CIRCLE_CY = 80, CIRCLE_VB = 160;

function wedgePath(startFrac: number, endFrac: number): string {
  const a0 = startFrac * 2 * Math.PI - Math.PI / 2;
  const a1 = endFrac * 2 * Math.PI - Math.PI / 2;
  const x0 = CIRCLE_CX + CIRCLE_R * Math.cos(a0), y0 = CIRCLE_CY + CIRCLE_R * Math.sin(a0);
  const x1 = CIRCLE_CX + CIRCLE_R * Math.cos(a1), y1 = CIRCLE_CY + CIRCLE_R * Math.sin(a1);
  const largeArc = (endFrac - startFrac) > 0.5 ? 1 : 0;
  return `M ${CIRCLE_CX} ${CIRCLE_CY} L ${x0} ${y0} A ${CIRCLE_R} ${CIRCLE_R} 0 ${largeArc} 1 ${x1} ${y1} Z`;
}

interface CircleModelProps { num: number; den: number; onChange?: (num: number) => void }

const CircleModel: React.FC<CircleModelProps> = ({ num, den, onChange }) => {
  const { t } = useLanguage();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const emitFromPoint = useCallback((clientX: number, clientY: number) => {
    if (!onChange) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = CIRCLE_VB / rect.width;
    const x = (clientX - rect.left) * scale;
    const y = (clientY - rect.top) * scale;
    const dx = x - CIRCLE_CX, dy = y - CIRCLE_CY;
    // Undo wedgePath's -π/2 start offset so angle 0 lands on wedge 0 (12 o'clock, clockwise).
    const angle = (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    const wedgeIndex = Math.min(den - 1, Math.floor((angle / (2 * Math.PI)) * den));
    onChange(wedgeIndex + 1);
  }, [onChange, den]);

  const onDown = useCallback(() => { if (onChange) dragging.current = true; }, [onChange]);
  const onMove = useCallback((e: React.MouseEvent) => { if (!dragging.current) return; emitFromPoint(e.clientX, e.clientY); }, [emitFromPoint]);
  const onUp = useCallback(() => { dragging.current = false; }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => { e.preventDefault(); emitFromPoint(e.touches[0].clientX, e.touches[0].clientY); }, [emitFromPoint]);
  const onSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => { emitFromPoint(e.clientX, e.clientY); }, [emitFromPoint]);
  const onKeyDown = useCallback((e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!onChange) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(den, num + 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, num - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(0); }
    else if (e.key === 'End') { e.preventDefault(); onChange(den); }
  }, [onChange, num, den]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${CIRCLE_VB} ${CIRCLE_VB}`}
      role={onChange ? 'slider' : 'img'}
      aria-label={`${t('fractionsLab.model.circle')}, ${num} ${t('fractionsLab.aria.of')} ${den} ${t('fractionsLab.aria.shaded')}`}
      aria-valuemin={onChange ? 0 : undefined}
      aria-valuemax={onChange ? den : undefined}
      aria-valuenow={onChange ? num : undefined}
      aria-valuetext={onChange ? `${num} ${t('fractionsLab.aria.of')} ${den}` : undefined}
      tabIndex={onChange ? 0 : undefined}
      className={`w-full max-w-[180px] select-none ${onChange ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-full' : ''}`}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      onClick={onChange ? onSvgClick : undefined}
      onKeyDown={onChange ? onKeyDown : undefined}
    >
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
};

// ─── Number line model — draggable marker, snaps to nearest 1/den tick ──────
const LINE_W = 320, TICK_H = 10;

interface NumberLineProps { num: number; den: number; onChange?: (num: number) => void }

const NumberLineModel: React.FC<NumberLineProps> = ({ num, den, onChange }) => {
  const { t } = useLanguage();
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
  const onKeyDown = useCallback((e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!onChange) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(den, num + 1)); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(0, num - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); onChange(0); }
    else if (e.key === 'End') { e.preventDefault(); onChange(den); }
  }, [onChange, num, den]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${LINE_W} 50`}
      role={onChange ? 'slider' : 'img'}
      aria-label={`${t('fractionsLab.model.numberLine')}, ${t('fractionsLab.aria.point')} ${num}/${den}`}
      aria-valuemin={onChange ? 0 : undefined}
      aria-valuemax={onChange ? den : undefined}
      aria-valuenow={onChange ? num : undefined}
      aria-valuetext={onChange ? `${num} ${t('fractionsLab.aria.of')} ${den}` : undefined}
      tabIndex={onChange ? 0 : undefined}
      className={`w-full max-w-[340px] select-none ${onChange ? 'cursor-ew-resize focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded' : ''}`}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onUp}
      onClick={onChange ? onSvgClick : undefined}
      onKeyDown={onChange ? onKeyDown : undefined}
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

// ─── Area model — visualizes multiplication as overlapping row/column shading ────
const AREA_W = 240, AREA_H = 180;

interface AreaModelProps { fracA: Fraction; fracB: Fraction }

/**
 * fracA shades rows (denA rows, numA shaded), fracB shades columns (denB columns per
 * whole, numB shaded) — the overlap of both shadings is the product's numerator, out of
 * denA×denB total cells. Standard fraction-multiplication area model. Read-only (no
 * drag) — driven entirely by the two fraction pickers above it (or, for division, by
 * fracA and B's reciprocal — see FractionsLab's ÷ branch below).
 *
 * fracB may be IMPROPER (num > den) when this renders a division reciprocal (e.g. ÷1/4
 * passes the reciprocal 4/1). The grid used to silently assume num ≤ den — with an
 * improper fracB, `cols` collapsed to `fracB.den` (as low as 1) while `colShaded = c <
 * fracB.num` stayed true for every column that existed, degenerating the whole visual
 * to "column always fully shaded" regardless of the real value. Fixed by drawing enough
 * whole-widths side by side (`wholes = ceil(num/den)`) to actually fit the numerator,
 * each split into `den` sub-columns — reduces to the old proper-fraction behavior when
 * wholes === 1.
 */
const AreaModel: React.FC<AreaModelProps> = ({ fracA, fracB }) => {
  const { t } = useLanguage();
  const rows = fracA.den;
  const wholes = Math.max(1, Math.ceil(fracB.num / fracB.den));
  const cols = fracB.den * wholes;
  const width = AREA_W * wholes;
  const rowH = AREA_H / rows, colW = AREA_W / fracB.den;
  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rowShaded = r < fracA.num;
      const colShaded = c < fracB.num;
      const fill = rowShaded && colShaded ? '#7c3aed' : rowShaded ? '#ddd6fe' : colShaded ? '#fbcfe8' : '#f8fafc';
      cells.push(
        <rect key={`${r}-${c}`} x={c * colW} y={r * rowH} width={colW} height={rowH}
          fill={fill} stroke="#e2e8f0" strokeWidth={1} className="transition-colors" />
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${width} ${AREA_H}`} role="img"
      aria-label={`${t('fractionsLab.areaModel')}, ${fracA.num}/${fracA.den} ${t('fractionsLab.and')} ${fracB.num}/${fracB.den}`}
      className="w-full max-w-[260px]"
    >
      {cells}
      {Array.from({ length: wholes - 1 }, (_, i) => (
        <line key={`whole-${i}`} x1={(i + 1) * AREA_W} y1={0} x2={(i + 1) * AREA_W} y2={AREA_H} stroke="#6d28d9" strokeWidth={1.5} strokeDasharray="4 3" />
      ))}
      <rect x={0} y={0} width={width} height={AREA_H} fill="none" stroke="#6d28d9" strokeWidth={2} />
    </svg>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

type Operation = '+' | '-' | '×' | '÷';
type Mode = 'show' | 'compare' | 'operations' | 'practice' | 'build';

export const FractionsLab: React.FC = () => {
  const { t } = useLanguage();
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

  // Compare mode — two independent fractions, compared live via compareFractions
  const [fracA, setFracA] = useState<Fraction>({ num: 1, den: 2 });
  const [fracB, setFracB] = useState<Fraction>({ num: 2, den: 3 });
  const clampedA = { num: Math.min(fracA.num, fracA.den), den: fracA.den };
  const clampedB = { num: Math.min(fracB.num, fracB.den), den: fracB.den };
  const cmp = compareFractions(clampedA, clampedB);
  const cmpSymbol = cmp < 0 ? '<' : cmp > 0 ? '>' : '=';

  const setNumA = useCallback((n: number) => setFracA(f => ({ ...f, num: n })), []);
  const setDenA = useCallback((d: number) => setFracA(f => ({ num: Math.min(f.num, d), den: d })), []);
  const setNumB = useCallback((n: number) => setFracB(f => ({ ...f, num: n })), []);
  const setDenB = useCallback((d: number) => setFracB(f => ({ num: Math.min(f.num, d), den: d })), []);

  // Operations mode — independent {num,den} pair + a selected operation, own state so
  // dragging here never affects Compare mode's fracA/fracB and vice versa.
  const [opFracA, setOpFracA] = useState<Fraction>({ num: 1, den: 2 });
  const [opFracB, setOpFracB] = useState<Fraction>({ num: 1, den: 4 });
  const [operation, setOperation] = useState<Operation>('+');
  const clampedOpA = { num: Math.min(opFracA.num, opFracA.den), den: opFracA.den };
  const clampedOpB = { num: Math.min(opFracB.num, opFracB.den), den: opFracB.den };
  // BarModel lets the numerator be dragged down to 0, so B÷0 is reachable in this mode
  // (see divideFractions' null-on-zero contract) — every ÷-specific value below must be
  // guarded on this instead of computed unconditionally.
  const opDivByZero = operation === '÷' && clampedOpB.num === 0;
  const opResult = operation === '+' ? addFractions(clampedOpA, clampedOpB)
    : operation === '-' ? subtractFractions(clampedOpA, clampedOpB)
    : operation === '×' ? multiplyFractions(clampedOpA, clampedOpB)
    : divideFractions(clampedOpA, clampedOpB);
  const opReciprocalB: Fraction | null = opDivByZero ? null : { num: clampedOpB.den, den: clampedOpB.num };

  const setOpNumA = useCallback((n: number) => setOpFracA(f => ({ ...f, num: n })), []);
  const setOpDenA = useCallback((d: number) => setOpFracA(f => ({ num: Math.min(f.num, d), den: d })), []);
  const setOpNumB = useCallback((n: number) => setOpFracB(f => ({ ...f, num: n })), []);
  const setOpDenB = useCallback((d: number) => setOpFracB(f => ({ num: Math.min(f.num, d), den: d })), []);

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
    { id: 'show',       label: t('fractionsLab.mode.show'),       icon: Eye        },
    { id: 'compare',    label: t('fractionsLab.mode.compare'),    icon: GitCompare },
    { id: 'operations', label: t('fractionsLab.mode.operations'), icon: Divide     },
    { id: 'practice',   label: t('fractionsLab.mode.practice'),   icon: PenLine    },
    { id: 'build',      label: t('fractionsLab.mode.build'),      icon: Target     },
  ];

  const GRADES: FractionGradeRange[] = ['g3', 'g4', 'g5', 'g6'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">{t('fractionsLab.title')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{gradeDescription(grade, t)}</p>
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
              {gradeLabel(g, t)}
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
              <label className="text-sm font-semibold text-gray-700">{t('fractionsLab.show.denominatorLabel')}</label>
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
                = {fractionToString(simplified)} = {decimal.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} = {toPercent(clampedFrac)}%
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">{t('fractionsLab.show.instruction')}</p>

          <div className="flex flex-wrap items-start gap-6">
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl border border-indigo-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">{t('fractionsLab.model.bar')}</p>
              <BarModel num={clampedFrac.num} den={clampedFrac.den} onChange={setNum} />
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl border border-indigo-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">{t('fractionsLab.model.circle')}</p>
              <CircleModel num={clampedFrac.num} den={clampedFrac.den} onChange={setNum} />
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50 rounded-2xl border border-indigo-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">{t('fractionsLab.model.numberLine')}</p>
            <NumberLineModel num={clampedFrac.num} den={clampedFrac.den} onChange={setNum} />
          </div>
        </div>
      )}

      {/* ── MODE: COMPARE ───────────────────────────────────────────────────── */}
      {mode === 'compare' && (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">{t('fractionsLab.compare.instruction')}</p>
          <div className="flex flex-wrap items-start gap-6">
            <div className="bg-gradient-to-br from-slate-50 to-sky-50 rounded-2xl border border-sky-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('fractionsLab.fractionA')}</p>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                  {Array.from({ length: cfg.maxDenominator - 1 }, (_, i) => i + 2).map(d => (
                    <button key={d} type="button" onClick={() => setDenA(d)}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition ${
                        clampedA.den === d ? 'bg-white shadow text-sky-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <BarModel num={clampedA.num} den={clampedA.den} onChange={setNumA} />
              <p className="text-center text-lg font-black text-sky-700 mt-2">{fractionToString(clampedA)}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-rose-50 rounded-2xl border border-rose-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('fractionsLab.fractionB')}</p>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                  {Array.from({ length: cfg.maxDenominator - 1 }, (_, i) => i + 2).map(d => (
                    <button key={d} type="button" onClick={() => setDenB(d)}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition ${
                        clampedB.den === d ? 'bg-white shadow text-rose-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <BarModel num={clampedB.num} den={clampedB.den} onChange={setNumB} />
              <p className="text-center text-lg font-black text-rose-700 mt-2">{fractionToString(clampedB)}</p>
            </div>
          </div>
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 text-center">
            <p className="text-2xl font-black text-indigo-700">
              {fractionToString(clampedA)} {cmpSymbol} {fractionToString(clampedB)}
            </p>
            <p className="text-xs text-indigo-500 mt-1">
              {fractionToString(clampedA)} = {toDecimal(clampedA).toFixed(2)}, {fractionToString(clampedB)} = {toDecimal(clampedB).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* ── MODE: OPERATIONS ────────────────────────────────────────────────── */}
      {mode === 'operations' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">{t('fractionsLab.operations.label')}</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {(['+', '-', '×', '÷'] as Operation[]).map(op => (
                <button key={op} type="button" onClick={() => setOperation(op)}
                  className={`w-9 h-9 rounded-lg text-base font-black transition ${
                    operation === op ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <div className="bg-gradient-to-br from-slate-50 to-violet-50 rounded-2xl border border-violet-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('fractionsLab.fractionA')}</p>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                  {Array.from({ length: cfg.maxDenominator - 1 }, (_, i) => i + 2).map(d => (
                    <button key={d} type="button" onClick={() => setOpDenA(d)}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition ${
                        clampedOpA.den === d ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <BarModel num={clampedOpA.num} den={clampedOpA.den} onChange={setOpNumA} />
              <p className="text-center text-lg font-black text-violet-700 mt-2">{fractionToString(clampedOpA)}</p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-pink-50 rounded-2xl border border-pink-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{t('fractionsLab.fractionB')}</p>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                  {Array.from({ length: cfg.maxDenominator - 1 }, (_, i) => i + 2).map(d => (
                    <button key={d} type="button" onClick={() => setOpDenB(d)}
                      className={`w-5 h-5 rounded text-[10px] font-bold transition ${
                        clampedOpB.den === d ? 'bg-white shadow text-pink-700' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <BarModel num={clampedOpB.num} den={clampedOpB.den} onChange={setOpNumB} />
              <p className="text-center text-lg font-black text-pink-700 mt-2">{fractionToString(clampedOpB)}</p>
            </div>
          </div>

          {(operation === '+' || operation === '-') && (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm text-gray-700">
              {operation === '+' ? t('fractionsLab.operations.addPrefix') : t('fractionsLab.operations.subtractPrefix')}
              {clampedOpA.den} × {clampedOpB.den} = {clampedOpA.den * clampedOpB.den}
              {operation === '+' ? t('fractionsLab.operations.addSuffix') : t('fractionsLab.operations.subtractSuffix')}
            </div>
          )}

          {operation === '÷' && opDivByZero && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 font-semibold">
              {t('fractionsLab.divByZero')}
            </div>
          )}

          {(operation === '×' || (operation === '÷' && !opDivByZero)) && opReciprocalB && (
            <div className="bg-gradient-to-br from-slate-50 to-violet-50 rounded-2xl border border-violet-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">{t('fractionsLab.areaModel')}</p>
              <AreaModel fracA={clampedOpA} fracB={operation === '÷' ? opReciprocalB : clampedOpB} />
              {operation === '÷' && (
                <p className="text-xs text-gray-500 mt-2">
                  {t('fractionsLab.division.explanationPrefix')} {fractionToString(clampedOpA)} ÷ {fractionToString(clampedOpB)}
                  {' '}= {fractionToString(clampedOpA)} × {fractionToString(opReciprocalB)}
                </p>
              )}
            </div>
          )}

          {opResult && (
            <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3 text-center">
              <p className="text-2xl font-black text-violet-700">
                {fractionToString(clampedOpA)} {operation} {fractionToString(clampedOpB)} = {fractionToString(opResult)}
              </p>
            </div>
          )}
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
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">{t('fractionsLab.build.title')}</p>
              <p className="text-2xl font-black text-amber-700">{fractionToString(target)}</p>
            </div>
            <button type="button" onClick={newBuildTarget}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition">
              <RefreshCw className="w-4 h-4" />
              {t('fractionsLab.build.newFraction')}
            </button>
          </div>

          <div className="bg-gradient-to-br from-slate-50 to-amber-50 rounded-2xl border border-amber-100 p-4">
            <p className="text-xs text-gray-500 mb-2">{t('fractionsLab.build.dragInstructionPrefix')} {target.num} {t('fractionsLab.aria.of')} {target.den} {t('fractionsLab.build.dragInstructionSuffix')}</p>
            <BarModel num={buildFrac.num} den={buildFrac.den} onChange={n => { setBuildFrac(f => ({ ...f, num: n })); setBuildChecked(false); }} />
          </div>

          <button
            type="button"
            onClick={() => setBuildChecked(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition"
          >
            {t('fractionsLab.build.checkButton')}
          </button>

          {buildChecked && (
            <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${
              buildCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {buildCorrect
                ? `${t('fractionsLab.build.correctPrefix')} ${fractionToString(buildFrac)} = ${fractionToString(target)}`
                : `${t('fractionsLab.build.incorrectPrefix')} ${fractionToString(buildFrac)}${t('fractionsLab.build.incorrectMiddle')} ${fractionToString(target)}.`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
