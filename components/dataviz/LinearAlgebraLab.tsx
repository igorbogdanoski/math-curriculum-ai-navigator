import React, { useState, useMemo, useCallback } from 'react';
import { type Mat2, type Mat3, det2, det3, inv2, mul2, add2, transpose2, mul3, fmt, EMPTY2, EMPTY3, generateLinearAlgebraSet } from './linearAlgebraMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';
import { EigenLab } from './LinearAlgebraEigenLab';
import { MatrixInput, MatrixDisplay } from './LinearAlgebraInputs';
import { NxNSolverLab } from './LinearAlgebraAdvancedLab';

// ─── Matrices sub-tab ─────────────────────────────────────────────────────────
type MatOp = 'add' | 'mul' | 'invA' | 'transA' | 'detA';

function MatricesLab() {
  const [size, setSize] = useState<2 | 3>(2);
  const [mA2, setMA2] = useState<Mat2>([...EMPTY2.map(r => [...r])] as Mat2);
  const [mB2, setMB2] = useState<Mat2>([[2,1],[1,3]]);
  const [mA3, setMA3] = useState<Mat3>(EMPTY3.map(r => [...r]) as Mat3);
  const [mB3, setMB3] = useState<Mat3>([[2,0,1],[1,1,0],[0,1,2]]);
  const [op, setOp] = useState<MatOp>('mul');

  const result = useMemo(() => {
    if (size === 2) {
      if (op === 'add') return add2(mA2, mB2);
      if (op === 'mul') return mul2(mA2, mB2);
      if (op === 'invA') return inv2(mA2);
      if (op === 'transA') return transpose2(mA2);
      if (op === 'detA') return null;
    } else {
      if (op === 'mul') return mul3(mA3, mB3);
      if (op === 'transA') return mA3.map((_, ci) => mA3.map(row => row[ci])) as Mat3;
      return null;
    }
    return null;
  }, [size, mA2, mB2, mA3, mB3, op]);

  const detA = size === 2 ? det2(mA2) : det3(mA3);
  const detB = size === 2 ? det2(mB2) : null;

  const OPS: { id: MatOp; label: string; needsB: boolean }[] = [
    { id: 'mul',    label: 'A × B',  needsB: true  },
    { id: 'add',    label: 'A + B',  needsB: true  },
    { id: 'invA',   label: 'A⁻¹',    needsB: false },
    { id: 'transA', label: 'Aᵀ',     needsB: false },
    { id: 'detA',   label: 'det(A)', needsB: false },
  ];

  const aVal = size === 2 ? mA2 : mA3;
  const bVal = size === 2 ? mB2 : mB3;
  const aChange = size === 2 ? (m: number[][]) => setMA2(m as Mat2) : (m: number[][]) => setMA3(m as Mat3);
  const bChange = size === 2 ? (m: number[][]) => setMB2(m as Mat2) : (m: number[][]) => setMB3(m as Mat3);
  const needsB = OPS.find(o => o.id === op)?.needsB ?? true;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          {([2,3] as const).map(s => (
            <button key={s} type="button" onClick={() => setSize(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition ${size === s ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
              {s}×{s}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {OPS.filter(o => size === 2 || o.id !== 'add').map(o => (
            <button key={o.id} type="button" onClick={() => setOp(o.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${op === o.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6 flex-wrap items-start">
        <MatrixInput value={aVal} onChange={aChange} size={size} label="Матрица A" color="indigo" />
        {needsB && <MatrixInput value={bVal} onChange={bChange} size={size} label="Матрица B" color="violet" />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <p className="text-xs font-bold text-gray-400">det(A)</p>
          <p className="text-xl font-extrabold text-indigo-700">{fmt(detA)}</p>
        </div>
        {size === 2 && needsB && (
          <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
            <p className="text-xs font-bold text-gray-400">det(B)</p>
            <p className="text-xl font-extrabold text-violet-700">{detB !== null ? fmt(detB) : '—'}</p>
          </div>
        )}
      </div>

      {op === 'detA' ? (
        <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-center">
          <p className="text-xs font-bold text-indigo-400 mb-1">Детерминанта det(A)</p>
          <p className="text-3xl font-extrabold text-indigo-700">{fmt(detA)}</p>
          <p className="text-xs text-indigo-500 mt-1">{Math.abs(detA) < 1e-10 ? 'Сингуларна матрица — инверз не постои' : 'Матрицата е инвертибилна'}</p>
        </div>
      ) : (
        <MatrixDisplay
          value={result as (number | null)[][] | null}
          label={OPS.find(o => o.id === op)?.label ?? 'Резултат'}
          color="emerald"
          highlight={true}
        />
      )}

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
        <strong>Клучни факти:</strong> det(A·B) = det(A)·det(B) &nbsp;|&nbsp;
        (A·B)⁻¹ = B⁻¹·A⁻¹ &nbsp;|&nbsp; (Aᵀ)ᵀ = A &nbsp;|&nbsp;
        A·A⁻¹ = I &nbsp;|&nbsp; det(A) = 0 ⟺ сингуларна
      </div>
    </div>
  );
}

// ─── Vectors sub-tab ──────────────────────────────────────────────────────────
const VW = 380, VH = 320;
const vCx = VW / 2, vCy = VH / 2;
const vScale = 55;

function vecToSVG(x: number, y: number) {
  return { sx: vCx + x * vScale, sy: vCy - y * vScale };
}

function VectorArrow({ vx, vy, color, label }: { vx: number; vy: number; color: string; label: string }) {
  const { sx, sy } = vecToSVG(vx, vy);
  const len = Math.sqrt(vx * vx + vy * vy) * vScale;
  if (len < 2) return null;
  return (
    <g>
      <defs>
        <marker id={`arrow-${label}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={color} />
        </marker>
      </defs>
      <line x1={vCx} y1={vCy} x2={sx} y2={sy} stroke={color} strokeWidth={2.5} markerEnd={`url(#arrow-${label})`} />
      <text x={sx + 6} y={sy - 4} fontSize={12} fill={color} fontWeight="bold">{label}</text>
    </g>
  );
}

function VectorsLab() {
  const [ux, setUx] = useState(2);
  const [uy, setUy] = useState(1);
  const [vx, setVx] = useState(-1);
  const [vy, setVy] = useState(2);

  const dot = ux * vx + uy * vy;
  const lenU = Math.sqrt(ux * ux + uy * uy);
  const lenV = Math.sqrt(vx * vx + vy * vy);
  const cosA = lenU > 0 && lenV > 0 ? dot / (lenU * lenV) : 0;
  const angle = Math.acos(Math.max(-1, Math.min(1, cosA))) * (180 / Math.PI);
  const gridLines = [-3, -2, -1, 0, 1, 2, 3];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'Вектор u', vals: [{ label: 'ux', v: ux, set: setUx }, { label: 'uy', v: uy, set: setUy }], color: 'indigo' },
          { label: 'Вектор v', vals: [{ label: 'vx', v: vx, set: setVx }, { label: 'vy', v: vy, set: setVy }], color: 'rose' },
        ].map(({ label, vals, color }) => (
          <div key={label}>
            <p className={`text-xs font-bold text-${color}-600 mb-2`}>{label}</p>
            {vals.map(({ label: lbl, v, set }) => (
              <div key={lbl} className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-semibold text-gray-500 w-5">{lbl}</span>
                <input type="range" min={-3} max={3} step={0.5} value={v}
                  onChange={e => set(parseFloat(e.target.value))}
                  className={`flex-1 accent-${color}-600`} aria-label={lbl} />
                <span className={`text-sm font-bold text-${color}-700 w-8 text-right`}>{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ maxHeight: 300 }}>
          {gridLines.map(g => {
            const { sx } = vecToSVG(g, 0);
            const { sy } = vecToSVG(0, g);
            return (
              <g key={g}>
                <line x1={sx} y1={0} x2={sx} y2={VH} stroke={g === 0 ? '#9ca3af' : '#f3f4f6'} strokeWidth={g === 0 ? 1.5 : 1} />
                <line x1={0} y1={sy} x2={VW} y2={sy} stroke={g === 0 ? '#9ca3af' : '#f3f4f6'} strokeWidth={g === 0 ? 1.5 : 1} />
                {g !== 0 && <text x={sx} y={vCy + 14} textAnchor="middle" fontSize={9} fill="#d1d5db">{g}</text>}
                {g !== 0 && <text x={vCx + 4} y={sy + 3} fontSize={9} fill="#d1d5db">{g}</text>}
              </g>
            );
          })}
          <VectorArrow vx={ux} vy={uy} color="#6366f1" label="u" />
          <VectorArrow vx={vx} vy={vy} color="#f43f5e" label="v" />
          <circle cx={vCx} cy={vCy} r={3} fill="#374151" />
        </svg>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'u = (ux, uy)', value: `(${ux}, ${uy})`, color: 'indigo' },
          { label: 'v = (vx, vy)', value: `(${vx}, ${vy})`, color: 'rose' },
          { label: 'u · v (скалар)', value: dot.toFixed(3), color: 'amber', highlight: true },
          { label: 'Агол θ', value: `${angle.toFixed(1)}°`, color: 'emerald', highlight: true },
        ].map(({ label, value, color, highlight }) => (
          <div key={label} className={`rounded-xl p-3 text-center border ${highlight ? `bg-${color}-50 border-${color}-200` : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-[11px] text-gray-400 font-semibold">{label}</p>
            <p className={`text-lg font-extrabold mt-0.5 ${highlight ? `text-${color}-700` : 'text-gray-700'}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <p className="text-xs font-bold text-gray-400">|u| (должина)</p>
          <p className="text-xl font-extrabold text-indigo-700">{lenU.toFixed(4)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <p className="text-xs font-bold text-gray-400">|v| (должина)</p>
          <p className="text-xl font-extrabold text-rose-700">{lenV.toFixed(4)}</p>
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700">
        <strong>u · v = |u|·|v|·cos(θ)</strong> &nbsp;|&nbsp;
        Ако u·v = 0 векторите се нормални (θ = 90°). &nbsp;|&nbsp;
        Скаларниот производ го мери проекциониот придонес.
      </div>
    </div>
  );
}

// ─── Transformations sub-tab ──────────────────────────────────────────────────
type TransformPreset = 'identity' | 'rotate45' | 'rotate90' | 'scale2' | 'shear' | 'reflectX' | 'reflectY' | 'custom';

const PRESETS: { id: TransformPreset; label: string; mat: Mat2 }[] = [
  { id: 'identity', label: 'I (Тождество)', mat: [[1,0],[0,1]] },
  { id: 'rotate45', label: 'Ротација 45°',  mat: [[Math.cos(Math.PI/4),-Math.sin(Math.PI/4)],[Math.sin(Math.PI/4),Math.cos(Math.PI/4)]] },
  { id: 'rotate90', label: 'Ротација 90°',  mat: [[0,-1],[1,0]] },
  { id: 'scale2',   label: 'Скалирање ×2',  mat: [[2,0],[0,2]] },
  { id: 'shear',    label: 'Смолкнување',    mat: [[1,0.5],[0,1]] },
  { id: 'reflectX', label: 'Рефлексија X',  mat: [[1,0],[0,-1]] },
  { id: 'reflectY', label: 'Рефлексија Y',  mat: [[-1,0],[0,1]] },
  { id: 'custom',   label: 'Прилагодено',    mat: [[1,1],[0,1]] },
];

const TW = 380, TH = 320, tCx = TW / 2, tCy = TH / 2, tScale = 55;

function tVec(x: number, y: number) { return { sx: tCx + x * tScale, sy: tCy - y * tScale }; }
function applyMat(m: Mat2, [x, y]: [number, number]): [number, number] {
  return [m[0][0]*x + m[0][1]*y, m[1][0]*x + m[1][1]*y];
}

function TransformationsLab() {
  const [preset, setPreset] = useState<TransformPreset>('rotate45');
  const [customMat, setCustomMat] = useState<Mat2>([[1,1],[0,1]]);
  const mat = preset === 'custom' ? customMat : PRESETS.find(p => p.id === preset)!.mat;

  const corners: [number, number][] = [[0,0],[1,0],[1,1],[0,1]];
  const transformed = corners.map(c => applyMat(mat, c));
  const gridLines = [-2,-1,0,1,2];

  const squarePath = (pts: [number,number][], fn: (x: number, y: number) => { sx: number; sy: number }) => {
    const [p0,...rest] = pts;
    const { sx: x0, sy: y0 } = fn(p0[0], p0[1]);
    return rest.reduce((acc, [px, py]) => {
      const { sx, sy } = fn(px, py);
      return acc + ` L${sx.toFixed(1)},${sy.toFixed(1)}`;
    }, `M${x0.toFixed(1)},${y0.toFixed(1)}`) + ' Z';
  };

  const basisI = applyMat(mat, [1, 0]);
  const basisJ = applyMat(mat, [0, 1]);
  const detVal = det2(mat);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {PRESETS.map(p => (
          <button key={p.id} type="button" onClick={() => setPreset(p.id)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border-2 transition ${preset === p.id ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="flex gap-4 items-center flex-wrap">
          <MatrixInput value={customMat} onChange={m => setCustomMat(m as Mat2)} size={2} label="Матрица на трансформација" color="teal" />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${TW} ${TH}`} className="w-full" style={{ maxHeight: 300 }}>
          {gridLines.map(g => {
            const { sx } = tVec(g, 0);
            const { sy } = tVec(0, g);
            return (
              <g key={g}>
                <line x1={sx} y1={0} x2={sx} y2={TH} stroke={g === 0 ? '#9ca3af' : '#f3f4f6'} strokeWidth={g === 0 ? 1.5 : 1} />
                <line x1={0} y1={sy} x2={TW} y2={sy} stroke={g === 0 ? '#9ca3af' : '#f3f4f6'} strokeWidth={g === 0 ? 1.5 : 1} />
              </g>
            );
          })}
          <path d={squarePath(corners, tVec)} fill="#6366f1" fillOpacity={0.15} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" />
          <path d={squarePath(transformed, tVec)} fill="#10b981" fillOpacity={0.25} stroke="#10b981" strokeWidth={2.5} />
          <defs>
            <marker id="arrow-i" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#f59e0b" />
            </marker>
            <marker id="arrow-j" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L0,6 L6,3 z" fill="#f43f5e" />
            </marker>
          </defs>
          <line x1={tCx} y1={tCy} x2={tVec(basisI[0], basisI[1]).sx} y2={tVec(basisI[0], basisI[1]).sy}
            stroke="#f59e0b" strokeWidth={2.5} markerEnd="url(#arrow-i)" />
          <line x1={tCx} y1={tCy} x2={tVec(basisJ[0], basisJ[1]).sx} y2={tVec(basisJ[0], basisJ[1]).sy}
            stroke="#f43f5e" strokeWidth={2.5} markerEnd="url(#arrow-j)" />
          <text x={tVec(basisI[0], basisI[1]).sx + 6} y={tVec(basisI[0], basisI[1]).sy - 4} fontSize={11} fill="#f59e0b" fontWeight="bold">e₁</text>
          <text x={tVec(basisJ[0], basisJ[1]).sx + 6} y={tVec(basisJ[0], basisJ[1]).sy - 4} fontSize={11} fill="#f43f5e" fontWeight="bold">e₂</text>
          <rect x={8} y={8} width={110} height={38} rx={6} fill="white" fillOpacity={0.9} stroke="#e5e7eb" />
          <line x1={14} y1={21} x2={28} y2={21} stroke="#6366f1" strokeWidth={2} strokeDasharray="4 2" />
          <text x={32} y={24} fontSize={10} fill="#6366f1">Оригинал</text>
          <line x1={14} y1={37} x2={28} y2={37} stroke="#10b981" strokeWidth={2.5} />
          <text x={32} y={40} fontSize={10} fill="#10b981">Трансформиран</text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <p className="text-[11px] text-gray-400 font-semibold">det(M)</p>
          <p className="text-xl font-extrabold text-teal-700">{fmt(detVal)}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">скалирање на плоштина</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
          <p className="text-[11px] text-gray-400 font-semibold">M·e₁</p>
          <p className="text-base font-extrabold text-amber-700">({fmt(basisI[0])}, {fmt(basisI[1])})</p>
        </div>
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-center">
          <p className="text-[11px] text-gray-400 font-semibold">M·e₂</p>
          <p className="text-base font-extrabold text-rose-700">({fmt(basisJ[0])}, {fmt(basisJ[1])})</p>
        </div>
      </div>

      <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-xs text-teal-700">
        <strong>Геометриска интерпретација:</strong> |det(M)| = факторот на скалирање на плоштина. &nbsp;
        det(M) &lt; 0 → ориентацијата е преврната. &nbsp;
        Колоните на M ги даваат трансформираните базни вектори.
      </div>
    </div>
  );
}

// ─── Linear Systems sub-tab ──────────────────────────────────────────────────
const SS_W = 380, SS_H = 300, SS_CX = 190, SS_CY = 150, SS_SC = 35;

function ssToSVG(mx: number, my: number) {
  return { x: SS_CX + mx * SS_SC, y: SS_CY - my * SS_SC };
}

function SystemsLab() {
  const [m1, setM1] = useState(1);
  const [b1, setB1] = useState(1);
  const [m2, setM2] = useState(-1);
  const [b2, setB2] = useState(3);

  const parallel = Math.abs(m1 - m2) < 1e-9;
  const coincident = parallel && Math.abs(b1 - b2) < 1e-9;
  const ix = parallel ? 0 : (b2 - b1) / (m1 - m2);
  const iy = parallel ? 0 : m1 * ix + b1;
  const ixPt = ssToSVG(ix, iy);
  const inView = !parallel && Math.abs(ix) < 4.8 && Math.abs(iy) < 3.8;

  function sLinePath(m: number, b: number) {
    const p0 = ssToSVG(-7, m * -7 + b);
    const p1 = ssToSVG(7, m * 7 + b);
    return `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} L${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-indigo-600 mb-2">Линија 1: y = m₁x + b₁</p>
          {[{ label: 'm₁', v: m1, set: setM1 }, { label: 'b₁', v: b1, set: setB1 }].map(({ label, v, set }) => (
            <div key={label} className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-400 w-6">{label}</span>
              <input type="range" min={-3} max={3} step={0.25} value={v}
                onChange={e => set(parseFloat(e.target.value))}
                className="flex-1 accent-indigo-600" aria-label={label} />
              <span className="text-sm font-bold text-indigo-700 w-8 text-right">{v}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-bold text-rose-600 mb-2">Линија 2: y = m₂x + b₂</p>
          {[{ label: 'm₂', v: m2, set: setM2 }, { label: 'b₂', v: b2, set: setB2 }].map(({ label, v, set }) => (
            <div key={label} className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-gray-400 w-6">{label}</span>
              <input type="range" min={-3} max={3} step={0.25} value={v}
                onChange={e => set(parseFloat(e.target.value))}
                className="flex-1 accent-rose-600" aria-label={label} />
              <span className="text-sm font-bold text-rose-700 w-8 text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2.5 bg-indigo-50 border border-indigo-200 text-center">
          <p className="text-[10px] text-gray-400 font-semibold">Равенка 1</p>
          <p className="text-sm font-extrabold text-indigo-700 font-mono">y = {m1}x {b1 >= 0 ? '+ ' : '− '}{Math.abs(b1)}</p>
        </div>
        <div className="rounded-xl p-2.5 bg-rose-50 border border-rose-200 text-center">
          <p className="text-[10px] text-gray-400 font-semibold">Равенка 2</p>
          <p className="text-sm font-extrabold text-rose-700 font-mono">y = {m2}x {b2 >= 0 ? '+ ' : '− '}{Math.abs(b2)}</p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-indigo-200 bg-white overflow-hidden">
        <svg viewBox={`0 0 ${SS_W} ${SS_H}`} className="w-full" style={{ maxHeight: 280 }}>
          <defs><clipPath id="sys-clip"><rect x={0} y={0} width={SS_W} height={SS_H} /></clipPath></defs>
          {[-3,-2,-1,0,1,2,3].map(g => {
            const gx = ssToSVG(g, 0).x;
            const gy = ssToSVG(0, g).y;
            return (
              <g key={g}>
                <line x1={gx} y1={0} x2={gx} y2={SS_H} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:1}/>
                <line x1={0} y1={gy} x2={SS_W} y2={gy} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:1}/>
                {g!==0 && <text x={SS_CX+4} y={gy+3} fontSize={9} fill="#cbd5e1">{g}</text>}
                {g!==0 && <text x={gx} y={SS_CY+14} textAnchor="middle" fontSize={9} fill="#cbd5e1">{g}</text>}
              </g>
            );
          })}
          <path d={sLinePath(m1, b1)} stroke="#6366f1" strokeWidth={2.5} fill="none" clipPath="url(#sys-clip)"/>
          <path d={sLinePath(m2, b2)} stroke="#f43f5e" strokeWidth={2.5} fill="none" clipPath="url(#sys-clip)"/>
          {inView && (
            <g clipPath="url(#sys-clip)">
              <circle cx={ixPt.x} cy={ixPt.y} r={7} fill="#10b981" stroke="white" strokeWidth={2}/>
              <text x={ixPt.x+10} y={ixPt.y-6} fontSize={11} fill="#10b981" fontWeight="bold">({fmt(ix)}, {fmt(iy)})</text>
            </g>
          )}
        </svg>
      </div>

      <div className={`rounded-xl p-3 border-2 text-center ${coincident?'border-amber-400 bg-amber-50':parallel?'border-red-300 bg-red-50':'border-emerald-400 bg-emerald-50'}`}>
        {coincident ? (
          <>
            <p className="text-sm font-bold text-amber-700">Совпаднати прави — Бесконечно многу решенија</p>
            <p className="text-xs text-amber-600 mt-0.5">Двете равенки ја опишуваат истата права</p>
          </>
        ) : parallel ? (
          <>
            <p className="text-sm font-bold text-red-700">Паралелни прави — Нема решение</p>
            <p className="text-xs text-red-600 mt-0.5">Системот е противречен (inconsistent)</p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-emerald-700">Единствено решение — Пресечна точка</p>
            <p className="text-xl font-extrabold text-emerald-800 mt-1 font-mono">x = {fmt(ix)},&nbsp; y = {fmt(iy)}</p>
          </>
        )}
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-700 space-y-1">
        <p><strong>Метод на замена:</strong> Постави m₁x + b₁ = m₂x + b₂, реши за x, нај y.</p>
        <p className="font-mono">x = (b₂ − b₁) / (m₁ − m₂)  [m₁ ≠ m₂]</p>
        <p><strong>Три случаи:</strong> m₁≠m₂ → 1 решение · m₁=m₂, b₁≠b₂ → 0 · m₁=m₂, b₁=b₂ → ∞</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-xl p-2.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
        <div className="flex flex-wrap gap-1 mt-1">
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН VIII одд.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН IX одд.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. I год.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">Стручно I год.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Exercises sub-tab ────────────────────────────────────────────────────────
function LinAlgExercisesTab() {
  const session = useLabSession('linear-algebra', 'Линеарна алгебра');
  const [difficulty, setDifficulty] = useLabDifficulty('linear-algebra');
  const { loadExercises } = session;
  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateLinearAlgebraSet(level));
  }, [difficulty, loadExercises]);
  return <LabExercisePanel session={session} onNewSet={loadSet} difficulty={difficulty} onDifficultyChange={setDifficulty} />;
}

// ─── Main export ──────────────────────────────────────────────────────────────
type LinAlgTab = 'matrices' | 'vectors' | 'transforms' | 'systems' | 'nxn' | 'eigen' | 'exercises';

export function LinearAlgebraLab() {
  const [tab, setTab] = useState<LinAlgTab>('matrices');

  const TABS: { id: LinAlgTab; label: string; color: string }[] = [
    { id: 'matrices',   label: '⊞ Матрици',       color: 'indigo'  },
    { id: 'vectors',    label: '→ Вектори',        color: 'rose'    },
    { id: 'transforms', label: '⊡ Трансформации', color: 'teal'    },
    { id: 'systems',    label: '⊕ Системи',        color: 'emerald' },
    { id: 'nxn',        label: '⊟ n×n Решавач',   color: 'sky'     },
    { id: 'eigen',      label: 'λ Сопствени',      color: 'fuchsia' },
    { id: 'exercises',  label: '✏️ Вежбај',        color: 'orange'  },
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

      {tab === 'matrices'   && <MatricesLab />}
      {tab === 'vectors'    && <VectorsLab />}
      {tab === 'transforms' && <TransformationsLab />}
      {tab === 'systems'    && <SystemsLab />}
      {tab === 'nxn'        && <NxNSolverLab />}
      {tab === 'eigen'      && <EigenLab />}
      {tab === 'exercises'  && <LinAlgExercisesTab />}
    </div>
  );
}
