import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  toRad, toDeg, radLabel, unitCirclePoint, QUADRANT_LABELS, SPECIAL_ANGLES,
  generateWavePoints, period, TRIG_IDENTITIES, generateTrigSet,
  TRIG_CURRICULUM, type CurriculumRef,
} from './trigMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';

// ── Curriculum badges ─────────────────────────────────────────────────────────
function CurriculumBadges({ cur }: { cur: CurriculumRef }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {cur.primary?.map(p => (
        <span key={p} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН {p} одд.</span>
      ))}
      {cur.gymnasium?.map(g => (
        <span key={g} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. {g}</span>
      ))}
      {cur.vocational?.map(v => (
        <span key={v} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">{v}</span>
      ))}
    </div>
  );
}

// ── Unit Circle Tab ───────────────────────────────────────────────────────────
const CX = 160, CY = 160, R = 120;

function UnitCircleTab() {
  const [deg, setDeg] = useState(45);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const pt = useMemo(() => unitCirclePoint(deg, CX, CY, R), [deg]);
  const qInfo = QUADRANT_LABELS[pt.quadrant];

  const angleFromPointer = useCallback((cx: number, cy: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = cx - rect.left;
    const py = cy - rect.top;
    const scale = 320 / rect.width;
    const dx = (px * scale) - CX;
    const dy = CY - (py * scale);
    const raw = toDeg(Math.atan2(dy, dx));
    setDeg(((raw % 360) + 360) % 360);
  }, []);

  const onMouseDown = useCallback(() => { dragging.current = true; }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    angleFromPointer(e.clientX, e.clientY);
  }, [angleFromPointer]);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    angleFromPointer(e.touches[0].clientX, e.touches[0].clientY);
  }, [angleFromPointer]);
  const onSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    angleFromPointer(e.clientX, e.clientY);
  }, [angleFromPointer]);

  const fmt = (n: number) => (n < 0 ? '−' + Math.abs(n).toFixed(4) : n.toFixed(4));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
          Интерактивна единечна кружница — влечи точката
        </p>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* SVG circle */}
          <svg
            ref={svgRef}
            viewBox="0 0 320 320"
            className="w-full max-w-[320px] cursor-crosshair select-none"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchMove={onTouchMove}
            onTouchEnd={onMouseUp}
            onClick={onSvgClick}
          >
            {/* Axes */}
            <line x1="20" y1={CY} x2="300" y2={CY} stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1={CX} y1="20" x2={CX} y2="300" stroke="#cbd5e1" strokeWidth="1.5" />
            <text x="298" y={CY - 6} fontSize="11" fill="#64748b">x</text>
            <text x={CX + 5} y="18" fontSize="11" fill="#64748b">y</text>
            {/* Quadrant labels */}
            <text x={CX + 10} y={CY - 10} fontSize="9" fill="#16a34a" opacity="0.6">I</text>
            <text x={CX - 18} y={CY - 10} fontSize="9" fill="#2563eb" opacity="0.6">II</text>
            <text x={CX - 18} y={CY + 18} fontSize="9" fill="#dc2626" opacity="0.6">III</text>
            <text x={CX + 10} y={CY + 18} fontSize="9" fill="#9333ea" opacity="0.6">IV</text>
            {/* Unit circle */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Special angle ticks */}
            {SPECIAL_ANGLES.map(a => {
              const rad = toRad(a);
              const x1 = CX + Math.cos(rad) * (R - 5), y1 = CY - Math.sin(rad) * (R - 5);
              const x2 = CX + Math.cos(rad) * (R + 5), y2 = CY - Math.sin(rad) * (R + 5);
              return <line key={a} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="1" />;
            })}
            {/* Angle arc */}
            {deg > 2 && (
              <path
                d={`M ${CX + 28} ${CY} A 28 28 0 ${deg > 180 ? 1 : 0} 0 ${CX + 28 * Math.cos(toRad(deg))} ${CY - 28 * Math.sin(toRad(deg))}`}
                fill="none" stroke="#f59e0b" strokeWidth="1.5"
              />
            )}
            {/* Cos line (horizontal) */}
            <line x1={CX} y1={CY} x2={pt.x} y2={CY} stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 2" />
            {/* Sin line (vertical) */}
            <line x1={pt.x} y1={CY} x2={pt.x} y2={pt.y} stroke="#16a34a" strokeWidth="1.5" strokeDasharray="4 2" />
            {/* Radius */}
            <line x1={CX} y1={CY} x2={pt.x} y2={pt.y} stroke="#475569" strokeWidth="2" />
            {/* Point */}
            <circle cx={pt.x} cy={pt.y} r="8" fill="white" stroke="#f43f5e" strokeWidth="2.5" style={{ cursor: 'grab' }} />
            {/* Angle label */}
            <text x={CX + 34} y={CY - 12} fontSize="11" fill="#f59e0b" fontWeight="bold">{Math.round(deg)}°</text>
            {/* Axis labels */}
            <text x={CX - 18} y={CY + 13} fontSize="10" fill="#94a3b8">−1</text>
            <text x={CX + R + 4} y={CY + 13} fontSize="10" fill="#94a3b8">1</text>
            <text x={CX + 3} y={CY - R - 4} fontSize="10" fill="#94a3b8">1</text>
            <text x={CX + 3} y={CY + R + 13} fontSize="10" fill="#94a3b8">−1</text>
          </svg>

          {/* Values panel */}
          <div className="flex-1 space-y-3 min-w-[200px]">
            <div className={`rounded-xl px-3 py-2 text-xs font-semibold`} style={{ background: qInfo.color + '18', color: qInfo.color }}>
              {qInfo.label} · {qInfo.signs}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-amber-50 rounded-xl p-2">
                <p className="text-amber-500 font-bold uppercase tracking-wide text-[9px]">Агол</p>
                <p className="text-amber-800 font-mono text-sm font-bold">{Math.round(deg)}°</p>
                <p className="text-amber-600 font-mono">{radLabel(toRad(deg))}</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-2">
                <p className="text-blue-500 font-bold uppercase tracking-wide text-[9px]">cos θ</p>
                <p className="text-blue-800 font-mono text-sm font-bold">{fmt(pt.cos)}</p>
                <p className="text-blue-400 text-[10px]">x-координата</p>
              </div>
              <div className="bg-green-50 rounded-xl p-2">
                <p className="text-green-500 font-bold uppercase tracking-wide text-[9px]">sin θ</p>
                <p className="text-green-800 font-mono text-sm font-bold">{fmt(pt.sin)}</p>
                <p className="text-green-400 text-[10px]">y-координата</p>
              </div>
              <div className="bg-purple-50 rounded-xl p-2">
                <p className="text-purple-500 font-bold uppercase tracking-wide text-[9px]">tan θ</p>
                <p className="text-purple-800 font-mono text-sm font-bold">
                  {pt.tan === null ? '∞' : fmt(pt.tan)}
                </p>
                <p className="text-purple-400 text-[10px]">sin/cos</p>
              </div>
            </div>
            {/* Special angle buttons */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Специјални агли</p>
              <div className="flex flex-wrap gap-1">
                {[0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 270, 330].map(a => (
                  <button
                    key={a}
                    onClick={() => setDeg(a)}
                    className={`px-2 py-0.5 text-[10px] rounded-lg border transition-colors ${Math.round(deg) === a ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-indigo-50'}`}
                  >
                    {a}°
                  </button>
                ))}
              </div>
            </div>
            {/* Slider */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                Агол: {Math.round(deg)}°
              </label>
              <input
                type="range" min="0" max="359" step="1"
                value={Math.round(deg)}
                onChange={e => setDeg(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Wave Explorer Tab ─────────────────────────────────────────────────────────
type WaveFn = 'sin' | 'cos' | 'tan';

const W = 500, H = 200;
const X_MIN = -2 * Math.PI, X_MAX = 2 * Math.PI;
const Y_RANGE = 3.5;

function toSvgX(x: number) { return W * (x - X_MIN) / (X_MAX - X_MIN); }
function toSvgY(y: number) { return H / 2 - (y / Y_RANGE) * (H / 2 - 10); }

function WaveExplorerTab() {
  const [fn, setFn] = useState<WaveFn>('sin');
  const [A, setA] = useState(1);
  const [B, setB] = useState(1);
  const [C, setC] = useState(0);
  const [D, setD] = useState(0);

  const pts = useMemo(() => generateWavePoints(fn, A, B, C, D, X_MIN, X_MAX, 600), [fn, A, B, C, D]);

  const pathD = useMemo(() => {
    let d = '';
    let inPath = false;
    for (const p of pts) {
      if (p.y === null || Math.abs(p.y) > Y_RANGE * 1.5) {
        inPath = false;
        continue;
      }
      const sx = toSvgX(p.x), sy = toSvgY(p.y);
      if (!inPath) { d += `M ${sx} ${sy} `; inPath = true; }
      else { d += `L ${sx} ${sy} `; }
    }
    return d;
  }, [pts]);

  const T = period(B);
  const piTicks = [-2, -1, 0, 1, 2].map(n => ({ val: n * Math.PI, label: n === 0 ? '0' : n === 1 ? 'π' : n === -1 ? '-π' : `${n}π` }));
  const yTicks = [-2, -1, 0, 1, 2].filter(y => Math.abs(y) <= Y_RANGE);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
          Бранов Истражувач — y = A·{fn}(Bx + C) + D
        </p>
        {/* Function selector */}
        <div className="flex gap-2 mb-4">
          {(['sin', 'cos', 'tan'] as WaveFn[]).map(f => (
            <button
              key={f}
              onClick={() => setFn(f)}
              className={`px-4 py-1.5 rounded-xl text-sm font-bold transition-colors ${fn === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50'}`}
            >
              {f}(x)
            </button>
          ))}
        </div>
        {/* SVG graph */}
        <div className="bg-slate-50 rounded-xl overflow-hidden mb-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {/* Y ticks */}
            {yTicks.map(y => (
              <g key={y}>
                <line x1={0} y1={toSvgY(y)} x2={W} y2={toSvgY(y)} stroke={y === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={y === 0 ? 1.5 : 1} />
                <text x={4} y={toSvgY(y) - 2} fontSize="9" fill="#94a3b8">{y}</text>
              </g>
            ))}
            {/* X ticks (π labels) */}
            {piTicks.map(t => (
              <g key={t.label}>
                <line x1={toSvgX(t.val)} y1={0} x2={toSvgX(t.val)} y2={H} stroke={t.val === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={t.val === 0 ? 1.5 : 1} />
                <text x={toSvgX(t.val) + 3} y={H - 3} fontSize="9" fill="#94a3b8">{t.label}</text>
              </g>
            ))}
            {/* Amplitude reference lines */}
            {A !== 0 && (
              <>
                <line x1={0} y1={toSvgY(A + D)} x2={W} y2={toSvgY(A + D)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
                <line x1={0} y1={toSvgY(-A + D)} x2={W} y2={toSvgY(-A + D)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
                {Math.abs(A + D) <= Y_RANGE && <text x={W - 28} y={toSvgY(A + D) - 2} fontSize="8" fill="#f59e0b">{(A + D).toFixed(1)}</text>}
              </>
            )}
            {/* Wave path */}
            <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* Sliders */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'A (Амплитуда)', val: A, set: setA, min: -3, max: 3, step: 0.1, color: 'text-amber-600' },
            { label: 'B (Фреквенција)', val: B, set: setB, min: 0.1, max: 4, step: 0.1, color: 'text-blue-600' },
            { label: 'C (Фазен поместај)', val: C, set: setC, min: -Math.PI, max: Math.PI, step: 0.05, color: 'text-green-600' },
            { label: 'D (Вертик. поместај)', val: D, set: setD, min: -3, max: 3, step: 0.1, color: 'text-purple-600' },
          ].map(({ label, val, set, min, max, step, color }) => (
            <div key={label}>
              <label className={`text-[10px] font-bold uppercase tracking-wide ${color}`}>{label}</label>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e => set(Number(e.target.value))}
                className="w-full mt-1"
              />
              <p className="text-xs text-center font-mono text-gray-700">{val.toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>
      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Амплитуда', val: Math.abs(A).toFixed(2), color: 'bg-amber-50 text-amber-700' },
          { label: 'Период', val: `${T.toFixed(3)} ≈ ${(T / Math.PI).toFixed(2)}π`, color: 'bg-blue-50 text-blue-700' },
          { label: 'Фреквенција', val: (1 / T).toFixed(3), color: 'bg-green-50 text-green-700' },
          { label: 'Вертик. поместај', val: D.toFixed(2), color: 'bg-purple-50 text-purple-700' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`rounded-xl p-3 text-xs ${color}`}>
            <p className="font-bold uppercase tracking-wide text-[9px] opacity-70 mb-1">{label}</p>
            <p className="font-mono font-bold text-sm">{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trig Identities Tab ───────────────────────────────────────────────────────
function TrigIdentitiesTab() {
  const [angle, setAngle] = useState(37);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
          Тригонометриски идентитети — нумеричка верификација
        </p>
        <div className="flex items-center gap-4 mb-4">
          <label className="text-sm font-semibold text-gray-700">θ = {angle}°</label>
          <input
            type="range" min="0" max="359" value={angle}
            onChange={e => setAngle(Number(e.target.value))}
            className="flex-1"
          />
          <div className="flex flex-wrap gap-1">
            {[0, 30, 45, 60, 90, 120].map(a => (
              <button
                key={a}
                onClick={() => setAngle(a)}
                className={`px-2 py-0.5 text-[10px] rounded-lg border transition-colors ${angle === a ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-indigo-50'}`}
              >
                {a}°
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TRIG_IDENTITIES.map(id => {
            const { lhs, rhs } = id.verify(angle);
            const isValid = isNaN(lhs) ? null : Math.abs(lhs - rhs) < 1e-5;
            return (
              <div
                key={id.id}
                className={`rounded-xl border p-3 ${
                  isValid === null ? 'border-gray-200 bg-gray-50'
                  : isValid ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{id.name}</p>
                    <p className="text-sm font-mono font-bold text-gray-800 mt-0.5">{id.latex}</p>
                  </div>
                  {isValid !== null && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {isValid ? '✓ Точно' : '✗ Грешка'}
                    </span>
                  )}
                </div>
                {isNaN(lhs) ? (
                  <p className="text-xs text-gray-400 mt-2">Не е дефинирано за θ = {angle}°</p>
                ) : (
                  <div className="flex gap-4 mt-2 text-xs font-mono">
                    <span className="text-blue-700">Лева: <strong>{lhs.toFixed(6)}</strong></span>
                    <span className="text-purple-700">Десна: <strong>{rhs.toFixed(6)}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {/* Quick reference table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Табела на специјални агли</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-center text-gray-500">
                <th className="py-1 px-2 text-left">θ</th>
                {[0, 30, 45, 60, 90, 120, 135, 150, 180, 270, 360].map(a => (
                  <th key={a} className="py-1 px-2">{a}°</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(['sin', 'cos', 'tan'] as const).map(fn => (
                <tr key={fn} className="text-center border-t border-gray-100">
                  <td className="py-1 px-2 text-left font-bold text-gray-600">{fn}</td>
                  {[0, 30, 45, 60, 90, 120, 135, 150, 180, 270, 360].map(a => {
                    const r = toRad(a);
                    let val: string;
                    if (fn === 'sin') val = parseFloat(Math.sin(r).toFixed(4)).toString().replace(/\.?0+$/, '') || '0';
                    else if (fn === 'cos') val = parseFloat(Math.cos(r).toFixed(4)).toString().replace(/\.?0+$/, '') || '0';
                    else {
                      const t = Math.cos(r);
                      val = Math.abs(t) < 1e-9 ? '∞' : parseFloat((Math.sin(r) / t).toFixed(4)).toString().replace(/\.?0+$/, '') || '0';
                    }
                    const isSelected = a === angle;
                    return (
                      <td key={a} className={`py-1 px-2 font-mono ${isSelected ? 'bg-indigo-100 text-indigo-700 font-bold rounded' : 'text-gray-700'}`}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tab 4: Вежбај ─────────────────────────────────────────────────────────────
function TrigExercisesTab() {
  const session = useLabSession('trigonometry', 'Тригонометрија');
  const [difficulty, setDifficulty] = useLabDifficulty('trigonometry');
  const { loadExercises } = session;

  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateTrigSet(level));
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

// ── Main component ─────────────────────────────────────────────────────────────
type Tab = 'circle' | 'wave' | 'identity' | 'exercises';

export default function TrigonometryLab() {
  const [tab, setTab] = useState<Tab>('circle');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'circle',    label: '⭕ Единечна кружница' },
    { id: 'wave',      label: '〰 Бранов истражувач' },
    { id: 'identity',  label: '≡ Идентитети' },
    { id: 'exercises', label: '✏️ Вежбај' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">Тригонометриска Лабораторија</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Единечна кружница · Амплитуда и Период · Идентитети · Вежбај
            </p>
            <CurriculumBadges cur={TRIG_CURRICULUM} />
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'circle'    && <UnitCircleTab />}
      {tab === 'wave'      && <WaveExplorerTab />}
      {tab === 'identity'  && <TrigIdentitiesTab />}
      {tab === 'exercises' && <TrigExercisesTab />}
    </div>
  );
}
