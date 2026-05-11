import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  gaussElim, cramer, determinantCofactor, inverseAdjugate, luDecompose,
  choleskyDecompose, svdDecompose, matrixExp, jordanDecompose,
  identity, matFromFlat, fmtNum,
  type Mat,
} from '../../utils/matrixOps';

// ─── Matrix helpers ───────────────────────────────────────────────────────────
type Mat2 = [[number, number], [number, number]];
type Mat3 = [[number,number,number],[number,number,number],[number,number,number]];

const COLS_2_3: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3' };
const COLS_N: Record<number, string> = {
  1:'grid-cols-1', 2:'grid-cols-2', 3:'grid-cols-3',
  4:'grid-cols-4', 5:'grid-cols-5', 6:'grid-cols-6',
};

function det2(m: Mat2) { return m[0][0]*m[1][1] - m[0][1]*m[1][0]; }
function det3(m: Mat3) {
  return (
    m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
   -m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
   +m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
  );
}

function inv2(m: Mat2): Mat2 | null {
  const d = det2(m);
  if (Math.abs(d) < 1e-10) return null;
  return [[m[1][1]/d, -m[0][1]/d], [-m[1][0]/d, m[0][0]/d]];
}

function mul2(a: Mat2, b: Mat2): Mat2 {
  return [
    [a[0][0]*b[0][0]+a[0][1]*b[1][0], a[0][0]*b[0][1]+a[0][1]*b[1][1]],
    [a[1][0]*b[0][0]+a[1][1]*b[1][0], a[1][0]*b[0][1]+a[1][1]*b[1][1]],
  ];
}

function add2(a: Mat2, b: Mat2): Mat2 {
  return [[a[0][0]+b[0][0], a[0][1]+b[0][1]], [a[1][0]+b[1][0], a[1][1]+b[1][1]]];
}

function transpose2(m: Mat2): Mat2 { return [[m[0][0],m[1][0]],[m[0][1],m[1][1]]]; }

function mul3(a: Mat3, b: Mat3): Mat3 {
  const r = (ri: number, ci: number) =>
    a[ri][0]*b[0][ci] + a[ri][1]*b[1][ci] + a[ri][2]*b[2][ci];
  return [[r(0,0),r(0,1),r(0,2)],[r(1,0),r(1,1),r(1,2)],[r(2,0),r(2,1),r(2,2)]];
}

function fmt(v: number): string {
  if (!isFinite(v)) return '—';
  const r = Math.round(v * 1000) / 1000;
  return r.toString();
}

const EMPTY2: Mat2 = [[1,0],[0,1]];
const EMPTY3: Mat3 = [[1,0,0],[0,1,0],[0,0,1]];

// ─── Matrix input component ───────────────────────────────────────────────────
function MatrixInput({ value, onChange, size, label, color = 'indigo' }: {
  value: number[][];
  onChange: (m: number[][]) => void;
  size: 2 | 3;
  label: string;
  color?: string;
}) {
  const update = (r: number, c: number, v: string) => {
    const next = value.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? parseFloat(v) || 0 : cell)));
    onChange(next);
  };
  return (
    <div>
      <p className={`text-xs font-bold text-${color}-600 mb-1.5`}>{label}</p>
      <div className={`inline-grid gap-1 ${size === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {value.map((row, ri) => row.map((cell, ci) => (
          <input
            key={`${ri}-${ci}`}
            type="number"
            value={cell}
            onChange={e => update(ri, ci, e.target.value)}
            className={`w-12 h-10 text-center text-sm font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-${color}-300 border-${color}-200 bg-${color}-50 text-${color}-800`}
            aria-label={`${label} ред ${ri+1} колона ${ci+1}`}
          />
        )))}
      </div>
    </div>
  );
}

function MatrixDisplay({ value, label, color = 'gray', highlight = false }: {
  value: (number | null)[][] | null;
  label: string;
  color?: string;
  highlight?: boolean;
}) {
  if (!value) return (
    <div className="text-center p-4 rounded-xl border border-red-200 bg-red-50">
      <p className="text-xs font-bold text-red-500">{label}</p>
      <p className="text-sm text-red-600 mt-1">Не постои (сингуларна матрица)</p>
    </div>
  );
  return (
    <div className={`rounded-xl border p-3 ${highlight ? `bg-${color}-50 border-${color}-200` : 'bg-gray-50 border-gray-200'}`}>
      <p className={`text-xs font-bold mb-2 ${highlight ? `text-${color}-600` : 'text-gray-500'}`}>{label}</p>
      <div className={`inline-grid gap-1 ${value[0].length === 2 ? 'grid-cols-2' : value[0].length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {value.map((row, ri) => row.map((cell, ci) => (
          <div key={`${ri}-${ci}`}
            className={`w-[52px] h-9 flex items-center justify-center text-sm font-bold rounded-lg border ${highlight ? `bg-white border-${color}-200 text-${color}-700` : 'bg-white border-gray-200 text-gray-700'}`}>
            {cell !== null ? fmt(cell) : '—'}
          </div>
        )))}
      </div>
    </div>
  );
}

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
    { id: 'mul',    label: 'A × B',   needsB: true  },
    { id: 'add',    label: 'A + B',   needsB: true  },
    { id: 'invA',   label: 'A⁻¹',     needsB: false },
    { id: 'transA', label: 'Aᵀ',      needsB: false },
    { id: 'detA',   label: 'det(A)',  needsB: false },
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
  const angle = Math.atan2(-vy, vx) * (180 / Math.PI);
  const len = Math.sqrt(vx * vx + vy * vy) * vScale;
  if (len < 2) return null;
  return (
    <g>
      <defs>
        <marker id={`arrow-${label}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={color} />
        </marker>
      </defs>
      <line
        x1={vCx} y1={vCy} x2={sx} y2={sy}
        stroke={color} strokeWidth={2.5}
        markerEnd={`url(#arrow-${label})`}
      />
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

  const gridLines: number[] = [-3, -2, -1, 0, 1, 2, 3];

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
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full max-h-[300px]">
          {/* grid */}
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
          {/* vectors */}
          <VectorArrow vx={ux} vy={uy} color="#6366f1" label="u" />
          <VectorArrow vx={vx} vy={vy} color="#f43f5e" label="v" />
          {/* origin */}
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
  { id: 'rotate45', label: 'Ротација 45°',   mat: [[Math.cos(Math.PI/4),-Math.sin(Math.PI/4)],[Math.sin(Math.PI/4),Math.cos(Math.PI/4)]] },
  { id: 'rotate90', label: 'Ротација 90°',   mat: [[0,-1],[1,0]] },
  { id: 'scale2',   label: 'Скалирање ×2',   mat: [[2,0],[0,2]] },
  { id: 'shear',    label: 'Смолкнување',     mat: [[1,0.5],[0,1]] },
  { id: 'reflectX', label: 'Рефлексија X',   mat: [[1,0],[0,-1]] },
  { id: 'reflectY', label: 'Рефлексија Y',   mat: [[-1,0],[0,1]] },
  { id: 'custom',   label: 'Прилагодено',     mat: [[1,1],[0,1]] },
];

const TW = 380, TH = 320;
const tCx = TW / 2, tCy = TH / 2;
const tScale = 55;

function tVec(x: number, y: number) {
  return { sx: tCx + x * tScale, sy: tCy - y * tScale };
}

function applyMat(m: Mat2, [x, y]: [number, number]): [number, number] {
  return [m[0][0]*x + m[0][1]*y, m[1][0]*x + m[1][1]*y];
}

function TransformationsLab() {
  const [preset, setPreset] = useState<TransformPreset>('rotate45');
  const [customMat, setCustomMat] = useState<Mat2>([[1,1],[0,1]]);
  const mat = preset === 'custom' ? customMat : PRESETS.find(p => p.id === preset)!.mat;

  const corners: [number, number][] = [[0,0],[1,0],[1,1],[0,1]];
  const transformed = corners.map(c => applyMat(mat, c));

  const gridLines: number[] = [-2,-1,0,1,2];

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
        <svg viewBox={`0 0 ${TW} ${TH}`} className="w-full max-h-[300px]">
          {/* grid */}
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
          {/* original square */}
          <path d={squarePath(corners, tVec)} fill="#6366f1" fillOpacity={0.15} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 3" />
          {/* transformed square */}
          <path d={squarePath(transformed, tVec)} fill="#10b981" fillOpacity={0.25} stroke="#10b981" strokeWidth={2.5} />
          {/* basis vectors (transformed) */}
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
          {/* legend */}
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
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-gray-400 w-6">m₁</span>
            <input type="range" min={-3} max={3} step={0.25} value={m1}
              onChange={e => setM1(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-600" aria-label="наклон 1" />
            <span className="text-sm font-bold text-indigo-700 w-8 text-right">{m1}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 w-6">b₁</span>
            <input type="range" min={-3} max={3} step={0.25} value={b1}
              onChange={e => setB1(parseFloat(e.target.value))}
              className="flex-1 accent-indigo-600" aria-label="исечок 1" />
            <span className="text-sm font-bold text-indigo-700 w-8 text-right">{b1}</span>
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-rose-600 mb-2">Линија 2: y = m₂x + b₂</p>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-gray-400 w-6">m₂</span>
            <input type="range" min={-3} max={3} step={0.25} value={m2}
              onChange={e => setM2(parseFloat(e.target.value))}
              className="flex-1 accent-rose-600" aria-label="наклон 2" />
            <span className="text-sm font-bold text-rose-700 w-8 text-right">{m2}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 w-6">b₂</span>
            <input type="range" min={-3} max={3} step={0.25} value={b2}
              onChange={e => setB2(parseFloat(e.target.value))}
              className="flex-1 accent-rose-600" aria-label="исечок 2" />
            <span className="text-sm font-bold text-rose-700 w-8 text-right">{b2}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-2.5 bg-indigo-50 border border-indigo-200 text-center">
          <p className="text-[10px] text-gray-400 font-semibold">Равенка 1</p>
          <p className="text-sm font-extrabold text-indigo-700 font-mono">
            y = {m1}x {b1 >= 0 ? '+ ' : '− '}{Math.abs(b1)}
          </p>
        </div>
        <div className="rounded-xl p-2.5 bg-rose-50 border border-rose-200 text-center">
          <p className="text-[10px] text-gray-400 font-semibold">Равенка 2</p>
          <p className="text-sm font-extrabold text-rose-700 font-mono">
            y = {m2}x {b2 >= 0 ? '+ ' : '− '}{Math.abs(b2)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-indigo-200 bg-white overflow-hidden">
        <svg viewBox={`0 0 ${SS_W} ${SS_H}`} className="w-full max-h-[280px]">
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
              <text x={ixPt.x+10} y={ixPt.y-6} fontSize={11} fill="#10b981" fontWeight="bold">
                ({fmt(ix)}, {fmt(iy)})
              </text>
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
            <p className="text-xl font-extrabold text-emerald-800 mt-1 font-mono">
              x = {fmt(ix)},&nbsp; y = {fmt(iy)}
            </p>
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

// ─── S62-C5/C6: n×n Solver Lab ───────────────────────────────────────────────
const GRID_COLS: Record<number, string> = { 2:'grid-cols-2', 3:'grid-cols-3', 4:'grid-cols-4', 5:'grid-cols-5', 6:'grid-cols-6' };
type NxNMode   = 'matrix' | 'system';
type NxNMethod = 'gauss' | 'cramer' | 'cofactor' | 'lu' | 'adj' | 'chol' | 'svd' | 'exp' | 'jordan';

const DIMS = [2, 3, 4, 5, 6] as const;
type Dim = typeof DIMS[number];

function makeFlat(n: number): number[] {
  const id = identity(n);
  return id.flat();
}

function MatGrid({ flat, n, onChange, color = 'indigo', label }: {
  flat: number[]; n: Dim; onChange: (f: number[]) => void; color?: string; label: string;
}) {
  const update = (idx: number, v: string) => {
    const next = [...flat];
    next[idx] = parseFloat(v) || 0;
    onChange(next);
  };
  const cellSize = n <= 3 ? 'w-12 h-10' : n <= 4 ? 'w-10 h-9' : 'w-9 h-8';
  return (
    <div>
      <p className={`text-xs font-bold text-${color}-600 mb-1.5`}>{label}</p>
      <div className={`inline-grid gap-0.5 ${GRID_COLS[n]}`}>
        {flat.map((val, idx) => (
          <input
            key={idx}
            type="number"
            value={val}
            onChange={e => update(idx, e.target.value)}
            className={`${cellSize} text-center text-xs font-bold border-2 rounded-md focus:outline-none focus:ring-1 focus:ring-${color}-400 border-${color}-200 bg-${color}-50 text-${color}-800`}
            aria-label={`${label} [${Math.floor(idx/n)+1},${idx%n+1}]`}
          />
        ))}
      </div>
    </div>
  );
}

function VecInput({ vals, onChange, color = 'violet', label }: {
  vals: number[]; onChange: (v: number[]) => void; color?: string; label: string;
}) {
  const update = (i: number, v: string) => {
    const next = [...vals];
    next[i] = parseFloat(v) || 0;
    onChange(next);
  };
  return (
    <div>
      <p className={`text-xs font-bold text-${color}-600 mb-1.5`}>{label}</p>
      <div className="flex flex-col gap-0.5">
        {vals.map((v, i) => (
          <input
            key={i}
            type="number"
            value={v}
            onChange={e => update(i, e.target.value)}
            className={`w-12 h-8 text-center text-xs font-bold border-2 rounded-md focus:outline-none border-${color}-200 bg-${color}-50 text-${color}-800`}
            aria-label={`b[${i+1}]`}
          />
        ))}
      </div>
    </div>
  );
}

function MatResult({ m, label, color = 'emerald' }: { m: Mat | null; label: string; color?: string }) {
  if (!m) return (
    <div className="text-center p-3 rounded-xl border border-red-200 bg-red-50">
      <p className="text-xs font-bold text-red-500">{label}</p>
      <p className="text-sm text-red-600 mt-1">Не постои (сингуларна)</p>
    </div>
  );
  const n = m.length;
  return (
    <div className={`rounded-xl border p-3 bg-${color}-50 border-${color}-200`}>
      <p className={`text-xs font-bold text-${color}-600 mb-2`}>{label}</p>
      <div className={`inline-grid gap-0.5 ${GRID_COLS[n]}`}>
        {m.flat().map((v, i) => (
          <div key={i} className={`w-14 h-8 flex items-center justify-center text-xs font-bold rounded border bg-white border-${color}-200 text-${color}-700`}>
            {fmtNum(v, 3)}
          </div>
        ))}
      </div>
    </div>
  );
}

function NxNSolverLab() {
  const [n, setN]           = useState<Dim>(3);
  const [mode, setMode]     = useState<NxNMode>('system');
  const [method, setMethod] = useState<NxNMethod>('gauss');
  const [flatA, setFlatA]   = useState<number[]>(() => makeFlat(3));
  const [bVec, setBVec]     = useState<number[]>([1, 0, 0]);

  const A: Mat = useMemo(() => matFromFlat(flatA, n), [flatA, n]);

  const changeN = (newN: Dim) => {
    setN(newN);
    setFlatA(makeFlat(newN));
    setBVec(new Array(newN).fill(0));
    // SVD and Jordan now work for all n (S64-F1/F2)
  };

  const changeMode = (newMode: NxNMode) => {
    setMode(newMode);
    // Reset to a safe method when switching modes
    if (newMode === 'system' && !['gauss', 'cramer'].includes(method)) setMethod('gauss');
  };

  const MATRIX_METHODS: { id: NxNMethod; label: string; mode: NxNMode[] }[] = [
    { id: 'gauss',    label: 'Гаусова елиминација', mode: ['system', 'matrix'] },
    { id: 'cramer',   label: 'Крамерово правило',   mode: ['system'] },
    { id: 'cofactor', label: 'Кофактори (det)',      mode: ['matrix'] },
    { id: 'lu',       label: 'LU декомпозиција',     mode: ['matrix'] },
    { id: 'adj',      label: 'Adj/det (инверз)',     mode: ['matrix'] },
    { id: 'chol',     label: 'Чолески A=LLᵀ',       mode: ['matrix'] },
    { id: 'svd',      label: 'SVD (A=UΣVᵀ)',        mode: ['matrix'] },
    { id: 'exp',      label: 'Матрична exp (eᴬ)',   mode: ['matrix'] },
    { id: 'jordan',   label: 'Жорданова форма',      mode: ['matrix'] },
  ];

  const availMethods = MATRIX_METHODS.filter(m =>
    m.mode.includes(mode) && (m.id === 'jordan' ? n <= 3 : true)
  );

  const result = useMemo(() => {
    try {
      if (mode === 'system') {
        if (method === 'gauss') return { type: 'gauss' as const, data: gaussElim(A, bVec) };
        if (method === 'cramer') return { type: 'cramer' as const, data: cramer(A, bVec) };
      } else {
        if (method === 'gauss')    return { type: 'gaussMat' as const, data: gaussElim(A) };
        if (method === 'cofactor') return { type: 'det' as const, data: { det: determinantCofactor(A) } };
        if (method === 'lu')       return { type: 'lu' as const, data: luDecompose(A) };
        if (method === 'adj')      return { type: 'inv' as const, data: inverseAdjugate(A) };
        if (method === 'chol')     return { type: 'chol' as const, data: choleskyDecompose(A) };
        if (method === 'svd')      return { type: 'svd' as const, data: svdDecompose(A) };
        if (method === 'exp')      return { type: 'exp' as const, data: matrixExp(A) };
        if (method === 'jordan')   return { type: 'jordan' as const, data: jordanDecompose(A) };
      }
    } catch { return null; }
    return null;
  }, [A, bVec, mode, method]);

  return (
    <div className="space-y-4">
      {/* Dimension + mode pickers */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {DIMS.map(d => (
            <button key={d} type="button" onClick={() => changeN(d)}
              className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition ${n === d ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500 hover:border-sky-300'}`}>
              {d}×{d}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          {(['system', 'matrix'] as NxNMode[]).map(m => (
            <button key={m} type="button" onClick={() => changeMode(m)}
              className={`px-3 py-1.5 transition-colors ${mode === m ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'} ${m === 'matrix' ? 'border-l border-gray-200' : ''}`}>
              {m === 'system' ? 'Систем Ax=b' : 'Матрица A'}
            </button>
          ))}
        </div>
      </div>

      {/* Method picker */}
      <div className="flex gap-2 flex-wrap">
        {availMethods.map(me => (
          <button key={me.id} type="button" onClick={() => setMethod(me.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${method === me.id ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500 hover:border-sky-300'}`}>
            {me.label}
          </button>
        ))}
      </div>

      {/* Matrix + b input */}
      <div className="flex gap-4 flex-wrap items-start">
        <MatGrid flat={flatA} n={n} onChange={setFlatA} color="sky" label={`Матрица A (${n}×${n})`} />
        {mode === 'system' && (
          <VecInput vals={bVec} onChange={setBVec} color="violet" label="вектор b" />
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {result.type === 'gauss' && result.data.solution && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-600 mb-2">Решение x</p>
                <div className="flex gap-2 flex-wrap">
                  {result.data.solution.map((xi, i) => (
                    <div key={i} className="px-3 py-2 bg-white border border-emerald-200 rounded-lg text-center">
                      <p className="text-[10px] text-gray-400">x{i+1}</p>
                      <p className="text-sm font-extrabold text-emerald-700 font-mono">{fmtNum(xi, 4)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-emerald-500 mt-2">det(A) = {fmtNum(result.data.det, 6)} · ранг = {result.data.rank}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-bold text-gray-500 mb-1.5">Чекори:</p>
                {result.data.steps.map((s, i) => (
                  <p key={i} className="text-xs font-mono text-gray-600 leading-5">
                    <span className="text-gray-400">{i+1}.</span> {s.desc}
                  </p>
                ))}
              </div>
            </>
          )}

          {result.type === 'gauss' && !result.data.solution && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              Системот нема единствено решение. det(A) ≈ {fmtNum(result.data.det, 6)}, ранг = {result.data.rank}.
            </div>
          )}

          {result.type === 'cramer' && result.data && (
            <div className="space-y-2">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                <p className="text-xs font-bold text-violet-600 mb-2">
                  Крамер — det(A) = {fmtNum(result.data.det, 6)}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {result.data.solution.map((xi, i) => (
                    <div key={i} className="px-3 py-2 bg-white border border-violet-200 rounded-lg text-center">
                      <p className="text-[10px] text-gray-400">x{i+1} = D{i+1}/D</p>
                      <p className="text-xs text-violet-500 font-mono">{fmtNum(result.data!.columns[i].detDi,3)} / {fmtNum(result.data!.det,3)}</p>
                      <p className="text-sm font-extrabold text-violet-700 font-mono">{fmtNum(xi, 4)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {result.type === 'cramer' && !result.data && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              Крамерово правило не важи — матрицата е сингуларна (det = 0).
            </div>
          )}

          {result.type === 'det' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-xs font-bold text-amber-600 mb-1">det(A) — Лапласова експанзија</p>
              <p className="text-3xl font-extrabold text-amber-700 font-mono">{fmtNum(result.data.det, 8)}</p>
              <p className="text-xs text-amber-500 mt-1">
                {Math.abs(result.data.det) < 1e-10 ? 'Сингуларна — инверз не постои' : 'Инвертибилна матрица'}
              </p>
            </div>
          )}

          {result.type === 'lu' && (
            <div className="grid md:grid-cols-2 gap-3">
              <MatResult m={result.data.L} label="L (долна триаголна)" color="sky" />
              <MatResult m={result.data.U} label="U (горна триаголна)" color="amber" />
            </div>
          )}

          {result.type === 'inv' && (
            <MatResult m={result.data} label="A⁻¹ = adj(A) / det(A)" color="emerald" />
          )}

          {result.type === 'chol' && (
            result.data.isValid ? (
              <div className="space-y-3">
                <MatResult m={result.data.L} label="L (долна триаголна, A = L·Lᵀ)" color="teal" />
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-700">
                  <strong>Чолески-Банахевич:</strong> A = L·Lᵀ &nbsp;|&nbsp;
                  Lᵢᵢ = √(Aᵢᵢ − Σₖ Lᵢₖ²) &nbsp;|&nbsp;
                  Lᵢⱼ = (Aᵢⱼ − Σₖ LᵢₖLⱼₖ) / Lⱼⱼ &nbsp;(за i &gt; j)
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                Чолески декомпозиција не е можна: {result.data.reason}
              </div>
            )
          )}

          {result.type === 'svd' && (
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-xs font-bold text-purple-600 mb-2">Сингуларни вредности σ</p>
                <div className="flex gap-2 flex-wrap">
                  {result.data.S.map((s, i) => (
                    <div key={i} className="px-3 py-2 bg-white border border-purple-200 rounded-lg text-center">
                      <p className="text-[10px] text-gray-400">σ{i+1}</p>
                      <p className="text-sm font-extrabold text-purple-700 font-mono">{fmtNum(s, 4)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <MatResult m={result.data.U} label="U (леви сингуларни вектори)" color="indigo" />
                <MatResult m={result.data.Vt} label="Vᵀ (десни сингуларни вектори)" color="rose" />
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-700">
                <strong>A = U · Σ · Vᵀ</strong> &nbsp;|&nbsp; σᵢ = √λᵢ(AᵀA) &nbsp;|&nbsp;
                Rang(A) = број на ненулти σ &nbsp;|&nbsp; ||A||₂ = σ₁
              </div>
            </div>
          )}

          {result.type === 'exp' && (
            <div className="space-y-3">
              <MatResult m={result.data} label="eᴬ (матрична експоненцијала)" color="emerald" />
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
                <strong>eᴬ = Σₖ Aᵏ/k!</strong> &nbsp;|&nbsp; пресметано со Taylor серија (ред 20) + rescale-and-square &nbsp;|&nbsp;
                За дијагонализабилна A = PDP⁻¹: eᴬ = P·diag(eλᵢ)·P⁻¹
              </div>
            </div>
          )}

          {result.type === 'jordan' && (
            result.data.isValid ? (
              <div className="space-y-3">
                <MatResult m={result.data.J} label="J (Жорданова нормална форма)" color="amber" />
                <MatResult m={result.data.P} label="P (матрица на премин)" color="sky" />
                {result.data.Pinv && <MatResult m={result.data.Pinv} label="P⁻¹" color="slate" />}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                  <strong>A = P J P⁻¹</strong> &nbsp;|&nbsp;
                  {result.data.blocks.map((b, i) => (
                    <span key={i}> Блок{i+1}: λ={fmtNum(b.eigenvalue,3)}{b.isComplex ? `±${fmtNum(b.complexIm??0,3)}i` : ''} ({b.size}×{b.size})</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                {result.data.reason}
              </div>
            )
          )}
        </div>
      )}

      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-700">
        <strong>Методи:</strong> Gauss · Cramer · Cofactor · LU · Adj/det · Чолески (pos-def) ·
        SVD (A=UΣVᵀ) · eᴬ (матрична exp) · Jordan (нормална форма)
      </div>
    </div>
  );
}

// ─── S62-H2: Eigenvalue / Eigenvector Lab ────────────────────────────────────

function normV2(v: [number, number]): [number, number] {
  const n = Math.sqrt(v[0]*v[0] + v[1]*v[1]);
  return n > 1e-12 ? [v[0]/n, v[1]/n] as [number,number] : [1, 0] as [number,number];
}
function cross3(a: number[], b: number[]): [number,number,number] {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function normV3(v: [number,number,number]): [number,number,number] {
  const n = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
  return n > 1e-12 ? [v[0]/n,v[1]/n,v[2]/n] as [number,number,number] : [1,0,0] as [number,number,number];
}

type Eigen2R =
  | { kind: 'real'; l: [number,number]; v: [[number,number],[number,number]] }
  | { kind: 'complex'; re: number; im: number };

function computeEigen2(m: Mat2): Eigen2R {
  const tr = m[0][0]+m[1][1], dt = det2(m);
  const disc = tr*tr - 4*dt;
  if (disc < -1e-8) return { kind: 'complex', re: tr/2, im: Math.sqrt(-disc)/2 };
  const sq = Math.sqrt(Math.max(0, disc));
  const l1 = (tr+sq)/2, l2 = (tr-sq)/2;
  const evec = (lam: number): [number,number] => {
    const b = m[0][1], c = m[1][0];
    let vx: number, vy: number;
    if (Math.abs(b) > 1e-9)      { vx = b; vy = lam - m[0][0]; }
    else if (Math.abs(c) > 1e-9) { vx = lam - m[1][1]; vy = c; }
    else                          { vx = 1; vy = 0; }
    return normV2([vx, vy]);
  };
  return {
    kind: 'real',
    l: [l1, l2] as [number,number],
    v: [evec(l1), evec(l2)] as [[number,number],[number,number]],
  };
}

function qrStep3(A: Mat3): Mat3 {
  const col = (j: number) => [A[0][j], A[1][j], A[2][j]];
  const qs: number[][] = [];
  const R: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
  for (let j = 0; j < 3; j++) {
    let v = col(j);
    for (let i = 0; i < j; i++) {
      const rij = v[0]*qs[i][0]+v[1]*qs[i][1]+v[2]*qs[i][2];
      R[i][j] = rij;
      v = v.map((x, k) => x - rij*qs[i][k]);
    }
    const nrm = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    R[j][j] = nrm;
    qs.push(nrm > 1e-12 ? v.map(x => x/nrm) : [+(j===0),+(j===1),+(j===2)]);
  }
  const Q: Mat3 = [
    [qs[0][0],qs[1][0],qs[2][0]],
    [qs[0][1],qs[1][1],qs[2][1]],
    [qs[0][2],qs[1][2],qs[2][2]],
  ];
  return mul3(R as Mat3, Q);
}

function eigenvalues3(m: Mat3): [number,number,number] {
  let Ak: Mat3 = m.map(r => [...r]) as Mat3;
  for (let i = 0; i < 80; i++) Ak = qrStep3(Ak);
  return [Ak[0][0], Ak[1][1], Ak[2][2]];
}

function eigenvec3(m: Mat3, lam: number): [number,number,number] {
  const B = m.map((row, i) => row.map((v, j) => v - (i===j ? lam : 0)));
  let best: [number,number,number] = [1,0,0];
  let bestN = 0;
  for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) {
    const cp = cross3(B[i], B[j]);
    const n = Math.sqrt(cp[0]*cp[0]+cp[1]*cp[1]+cp[2]*cp[2]);
    if (n > bestN) { best = cp; bestN = n; }
  }
  return normV3(best);
}

const ELW = 380, ELH = 290, ELCX = 190, ELCY = 145, ELSC = 45;
function elVec(x: number, y: number) { return { sx: ELCX+x*ELSC, sy: ELCY-y*ELSC }; }

function EigenArrow({ vx, vy, color, label, dashed = false }: {
  vx: number; vy: number; color: string; label: string; dashed?: boolean;
}) {
  const { sx, sy } = elVec(vx, vy);
  const len = Math.sqrt(vx*vx+vy*vy)*ELSC;
  if (len < 3) return null;
  const mid = `em${color.slice(1)}${label.replace(/[^a-z0-9]/gi, '_')}`;
  return (
    <g>
      <defs>
        <marker id={mid} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={color} />
        </marker>
      </defs>
      <line x1={ELCX} y1={ELCY} x2={sx} y2={sy}
        stroke={color} strokeWidth={dashed ? 1.5 : 2.5}
        strokeDasharray={dashed ? '5 3' : undefined}
        markerEnd={`url(#${mid})`}
      />
      <text x={sx+5} y={sy-4} fontSize={11} fill={color} fontWeight="bold">{label}</text>
    </g>
  );
}

const E2_PRESETS: { label: string; mat: Mat2 }[] = [
  { label: 'Скалирање 2,3',  mat: [[2,0],[0,3]] },
  { label: 'Симетрична',      mat: [[3,1],[1,3]] },
  { label: 'Смолкнување',     mat: [[1,1],[0,1]] },
  { label: 'Ротација 45°',   mat: [[Math.cos(Math.PI/4),-Math.sin(Math.PI/4)],[Math.sin(Math.PI/4),Math.cos(Math.PI/4)]] },
  { label: 'Рефлексија',      mat: [[-1,0],[0,1]] },
];

const E3_PRESETS: { label: string; mat: Mat3 }[] = [
  { label: 'Дијагонална',    mat: [[1,0,0],[0,2,0],[0,0,3]] },
  { label: 'Симетрична',     mat: [[4,1,2],[1,3,0],[2,0,2]] },
  { label: 'Горна триаголна', mat: [[2,1,0],[0,3,1],[0,0,4]] },
];

const MORPH_PERIOD = 2800;

function EigenLab() {
  const [sz, setSz] = useState<2|3>(2);
  const [m2, setM2] = useState<Mat2>([[3,1],[1,3]]);
  const [m3, setM3] = useState<Mat3>([[4,1,2],[1,3,0],[2,0,2]]);
  const [p2, setP2] = useState(1);
  const [p3, setP3] = useState(1);

  // Animation state: t ∈ [0,1] morphs unit circle → A·circle
  const [playing, setPlaying] = useState(false);
  const [animT, setAnimT] = useState(1);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const step = (ts: number) => {
      if (t0Ref.current === null) t0Ref.current = ts - animT * MORPH_PERIOD;
      const elapsed = (ts - t0Ref.current) % (MORPH_PERIOD * 2);
      const t = elapsed <= MORPH_PERIOD ? elapsed / MORPH_PERIOD : 2 - elapsed / MORPH_PERIOD;
      setAnimT(t);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Morphed image points: M(t) = (1-t)·I + t·A  applied to unit circle
  const morphPts = useMemo(() => {
    const pts: {sx: number; sy: number}[] = [];
    for (let k = 0; k <= 64; k++) {
      const th = (k / 64) * 2 * Math.PI;
      const cx = Math.cos(th), cy = Math.sin(th);
      const ax = m2[0][0] * cx + m2[0][1] * cy;
      const ay = m2[1][0] * cx + m2[1][1] * cy;
      const px = (1 - animT) * cx + animT * ax;
      const py = (1 - animT) * cy + animT * ay;
      const { sx, sy } = elVec(px, py);
      pts.push({ sx, sy });
    }
    return pts;
  }, [m2, animT]);

  const e2 = useMemo(() => computeEigen2(m2), [m2]);
  const tr2 = m2[0][0]+m2[1][1], dt2 = det2(m2);

  const e3 = useMemo(() => {
    try {
      const lams = eigenvalues3(m3);
      return { lams, vecs: lams.map(l => eigenvec3(m3, l)) };
    } catch { return null; }
  }, [m3]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([2,3] as const).map(s => (
          <button key={s} type="button" onClick={() => setSz(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition ${sz===s?'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700':'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}>
            {s}×{s} матрица
          </button>
        ))}
      </div>

      {sz === 2 && (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {E2_PRESETS.map((p, i) => (
              <button key={i} type="button" onClick={() => { setM2(p.mat); setP2(i); }}
                className={`text-xs px-2.5 py-1 rounded-lg border-2 font-semibold transition ${p2===i?'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700':'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-6 flex-wrap items-start">
            <MatrixInput value={m2} onChange={m => setM2(m as Mat2)} size={2} label="Матрица A" color="fuchsia" />
            <div className="space-y-2 min-w-[180px]">
              <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-3 text-xs">
                <p className="font-bold text-fuchsia-600 mb-1">Карактеристичен полином</p>
                <p className="font-mono">λ² − {fmt(tr2)}λ + {fmt(dt2)} = 0</p>
                <p className="text-gray-400 mt-0.5">Δ = {fmt(tr2*tr2 - 4*dt2)}</p>
              </div>
              {e2.kind === 'real' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {e2.l.map((lam, i) => (
                    <div key={i} className={`rounded-xl border p-2 text-xs text-center ${i===0?'bg-indigo-50 border-indigo-200':'bg-rose-50 border-rose-200'}`}>
                      <p className={`font-bold ${i===0?'text-indigo-600':'text-rose-600'}`}>
                        {i===0?'λ₁':'λ₂'} = {fmt(lam)}
                      </p>
                      <p className="font-mono text-gray-500 text-[10px] mt-0.5">
                        ({fmt(e2.v[i][0])}, {fmt(e2.v[i][1])})
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs">
                  <p className="font-bold text-amber-600">Комплексни λ</p>
                  <p className="font-mono mt-0.5">{fmt(e2.re)} ± {fmt(e2.im)}i</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Animation toolbar */}
            <div className="flex items-center gap-3 px-3 pt-2.5 pb-1">
              <button
                type="button"
                onClick={() => { setPlaying(p => !p); t0Ref.current = null; }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border-2 transition ${playing ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}
              >
                {playing ? '⏸ Паузирај' : '▶ Анимирај трансформација'}
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={animT}
                aria-label="Морф параметар t (0 = единична кружница, 1 = трансформирана)"
                onChange={e => { setPlaying(false); setAnimT(parseFloat(e.target.value)); }}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="text-[10px] font-mono text-gray-400 w-10 text-right">t={animT.toFixed(2)}</span>
            </div>
            <svg viewBox={`0 0 ${ELW} ${ELH}`} className="w-full max-h-[270px]">
              {[-3,-2,-1,0,1,2,3].map(g => {
                const { sx } = elVec(g,0); const { sy } = elVec(0,g);
                return (
                  <g key={g}>
                    <line x1={sx} y1={0} x2={sx} y2={ELH} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:0.8}/>
                    <line x1={0} y1={sy} x2={ELW} y2={sy} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:0.8}/>
                    {g!==0&&<text x={ELCX+4} y={sy+3} fontSize={9} fill="#d1d5db">{g}</text>}
                    {g!==0&&<text x={sx} y={ELCY+14} textAnchor="middle" fontSize={9} fill="#d1d5db">{g}</text>}
                  </g>
                );
              })}
              {/* Ghost unit circle */}
              <circle cx={ELCX} cy={ELCY} r={ELSC} fill="none" stroke="#e2e8f0" strokeWidth={animT > 0.05 ? 1 : 1.5} strokeDasharray="4 2"/>
              {/* Morphed circle/ellipse */}
              {morphPts.length > 1 && (
                <path
                  d={morphPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(' ') + ' Z'}
                  fill="#14b8a6" fillOpacity={0.12} stroke="#14b8a6" strokeWidth={2}
                />
              )}
              {/* Eigenvectors: solid = unit vᵢ, dashed = interpolated to λᵢvᵢ */}
              {e2.kind === 'real' && (
                <>
                  <EigenArrow vx={e2.v[0][0]} vy={e2.v[0][1]} color="#6366f1" label="v₁"/>
                  <EigenArrow vx={e2.v[1][0]} vy={e2.v[1][1]} color="#f43f5e" label="v₂"/>
                  <EigenArrow
                    vx={((1 - animT) + animT * e2.l[0]) * e2.v[0][0]}
                    vy={((1 - animT) + animT * e2.l[0]) * e2.v[0][1]}
                    color="#6366f1" label="λ₁v₁" dashed
                  />
                  <EigenArrow
                    vx={((1 - animT) + animT * e2.l[1]) * e2.v[1][0]}
                    vy={((1 - animT) + animT * e2.l[1]) * e2.v[1][1]}
                    color="#f43f5e" label="λ₂v₂" dashed
                  />
                </>
              )}
              <circle cx={ELCX} cy={ELCY} r={3} fill="#374151"/>
            </svg>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-gray-400">
              <span className="inline-block w-5 border-b border-dashed border-gray-300"/>единична кружница (t=0)
            </span>
            <span className="flex items-center gap-1 text-teal-600">
              <span className="inline-block w-5 border-b-2 border-teal-500"/>M(t)·кружница → A·кружница (t=1)
            </span>
            <span className="flex items-center gap-1 text-indigo-600">
              <span className="inline-block w-5 border-b-2 border-indigo-500"/>v₁ → λ₁v₁
            </span>
            <span className="flex items-center gap-1 text-rose-600">
              <span className="inline-block w-5 border-b-2 border-rose-500"/>v₂ → λ₂v₂
            </span>
          </div>
        </div>
      )}

      {sz === 3 && (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {E3_PRESETS.map((p, i) => (
              <button key={i} type="button" onClick={() => { setM3(p.mat); setP3(i); }}
                className={`text-xs px-2.5 py-1 rounded-lg border-2 font-semibold transition ${p3===i?'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700':'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <MatrixInput value={m3} onChange={m => setM3(m as Mat3)} size={3} label="Матрица A" color="fuchsia" />
          {e3 && (
            <div className="space-y-2">
              <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-3">
                <p className="text-xs font-bold text-fuchsia-600 mb-2">Сопствени вредности (QR-итерација, 80 чекори)</p>
                <div className="grid grid-cols-3 gap-2">
                  {e3.lams.map((lam, i) => (
                    <div key={i} className="bg-white border border-fuchsia-200 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-400">{['λ₁','λ₂','λ₃'][i]}</p>
                      <p className="text-base font-extrabold text-fuchsia-700 font-mono">{fmt(lam)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-500 mb-2">Сопствени вектори (нормализирани)</p>
                <table className="text-xs w-full">
                  <thead><tr>
                    <th className="text-left text-gray-400 pr-4 pb-1 font-semibold">λ</th>
                    <th className="text-left text-gray-400 pb-1 font-semibold">v</th>
                  </tr></thead>
                  <tbody>
                    {e3.lams.map((lam, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="text-fuchsia-700 font-bold font-mono pr-4 py-1">{fmt(lam)}</td>
                        <td className="text-gray-700 font-mono py-1">
                          ({e3.vecs[i].map(v => fmt(v)).join(', ')})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600">
                <strong>Проверка:</strong>&nbsp;
                tr(A) = {fmt(m3[0][0]+m3[1][1]+m3[2][2])} ≈ Σλ = {fmt(e3.lams.reduce((s,l)=>s+l,0))}&nbsp;|&nbsp;
                det(A) = {fmt(det3(m3))} ≈ ∏λ = {fmt(e3.lams.reduce((s,l)=>s*l,1))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-xl p-3 text-xs text-fuchsia-700">
        <strong>Сопствена вредност λ, вектор v:</strong> A·v = λ·v — трансформацијата само го скалира v.
        Тралот на кружницата е слика на единичната кружница под A.
        Пресечните насоки со сопствените вектори се скалирани со |λ|.
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type LinAlgTab = 'matrices' | 'vectors' | 'transforms' | 'systems' | 'nxn' | 'eigen';

export function LinearAlgebraLab() {
  const [tab, setTab] = useState<LinAlgTab>('matrices');

  const TABS: { id: LinAlgTab; label: string; color: string }[] = [
    { id: 'matrices',   label: '⊞ Матрици',         color: 'indigo'  },
    { id: 'vectors',    label: '→ Вектори',          color: 'rose'    },
    { id: 'transforms', label: '⊡ Трансформации',   color: 'teal'    },
    { id: 'systems',    label: '⊕ Системи',          color: 'emerald' },
    { id: 'nxn',        label: '⊟ n×n Решавач',     color: 'sky'     },
    { id: 'eigen',      label: 'λ Сопствени',        color: 'fuchsia' },
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
    </div>
  );
}
