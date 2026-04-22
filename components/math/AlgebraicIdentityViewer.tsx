/**
 * AlgebraicIdentityViewer — visual proof of a^3 - b^3 = (a-b)(a^2 + ab + b^2)
 * via three colored rectangular slabs in zero-dependency isometric SVG.
 *
 * S37 — pedagogical visualisation feature (Macedonian UI).
 */
import React, { useMemo, useState } from 'react';
import { MathRenderer } from '../common/MathRenderer';
import { decomposeAMinusBCubed, type SlabDims } from './algebraicIdentityHelpers';

// ─── Isometric projection ────────────────────────────────────────────────────
type Vec3 = [number, number, number];
const ISO_X: Vec3 = [Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0];
const ISO_Y: Vec3 = [-Math.cos(Math.PI / 6), Math.sin(Math.PI / 6), 0];
const ISO_Z: Vec3 = [0, -1, 0];

function projectIso(p: Vec3, scale: number, cx: number, cy: number): [number, number] {
  const x = p[0] * ISO_X[0] + p[1] * ISO_Y[0] + p[2] * ISO_Z[0];
  const y = p[0] * ISO_X[1] + p[1] * ISO_Y[1] + p[2] * ISO_Z[1];
  return [cx + x * scale, cy + y * scale];
}

interface SlabProps {
  origin: Vec3;
  dims: SlabDims;
  color: string;
  scale: number;
  cx: number; cy: number;
  label?: string;
}

function Slab({ origin, dims, color, scale, cx, cy, label }: SlabProps) {
  const [ox, oy, oz] = origin;
  const { w, d, h } = dims;
  // 8 cube corners
  const v: Vec3[] = [
    [ox,     oy,     oz],
    [ox + w, oy,     oz],
    [ox + w, oy + d, oz],
    [ox,     oy + d, oz],
    [ox,     oy,     oz + h],
    [ox + w, oy,     oz + h],
    [ox + w, oy + d, oz + h],
    [ox,     oy + d, oz + h],
  ];
  const p = v.map(pt => projectIso(pt, scale, cx, cy));
  const poly = (idxs: number[]) => idxs.map(i => p[i].join(',')).join(' ');
  // Faces (top, right, front) — back faces hidden by orientation
  return (
    <g>
      <polygon points={poly([4,5,6,7])} fill={color} stroke="#1f2937" strokeWidth="1.5" opacity="0.95" />
      <polygon points={poly([1,2,6,5])} fill={color} stroke="#1f2937" strokeWidth="1.5" opacity="0.78" />
      <polygon points={poly([0,1,5,4])} fill={color} stroke="#1f2937" strokeWidth="1.5" opacity="0.65" />
      {label && (
        <text x={p[6][0] + 6} y={p[6][1] - 6} fontSize="11" fill="#111827" fontWeight="600">{label}</text>
      )}
    </g>
  );
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b'] as const;
const SLAB_LABELS = ['(a-b)·a·a', '(a-b)·b·a', '(a-b)·b·b'] as const;

export const AlgebraicIdentityViewer: React.FC = () => {
  const [a, setA] = useState(4);
  const [b, setB] = useState(2);
  const [exploded, setExploded] = useState(true);

  const decomp = useMemo(() => {
    try { return decomposeAMinusBCubed(a, b); }
    catch { return null; }
  }, [a, b]);

  const W = 520, H = 360, cx = W / 2, cy = H * 0.65;
  const scale = Math.min(W, H) / (a * 3.5);

  // Slab origins — when "exploded" we space them apart, otherwise they sit
  // in the corner of the big a^3 cube (showing the proof in place).
  const gap = exploded ? 0.6 : 0;
  const origins: Vec3[] = [
    [0,             0,             b],          // top slab, sits above b
    [0,             b + gap * b,   0],          // side slab
    [b + gap * b,   0,             0],          // corner slab
  ];

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900 mb-2">
        Визуелен доказ: <code>a³ − b³ = (a − b)(a² + ab + b²)</code>
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        Поголемата коцка <code>a³</code> минус помалата <code>b³</code> се разложува на три плочки —
        нивниот вкупен волумен е точно <code>(a − b)(a² + ab + b²)</code>.
      </p>

      {/* Controls */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <label className="text-sm">
          <span className="font-semibold text-gray-700">a = {a}</span>
          <input type="range" min="2" max="8" step="0.5" value={a}
            onChange={e => setA(parseFloat(e.target.value))}
            className="w-full mt-1" aria-label="a value" />
        </label>
        <label className="text-sm">
          <span className="font-semibold text-gray-700">b = {b}</span>
          <input type="range" min="0.5" max={Math.max(0.5, a - 0.5)} step="0.5" value={b}
            onChange={e => setB(parseFloat(e.target.value))}
            className="w-full mt-1" aria-label="b value" />
        </label>
      </div>
      <button type="button"
        onClick={() => setExploded(v => !v)}
        className="mb-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
        {exploded ? '⏸ Сложи во коцка' : '⏵ Разложи плочки'}
      </button>

      {/* SVG */}
      <div className="bg-gray-50 rounded-xl p-2 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="3D визуелен доказ">
          {/* Outline of original a^3 cube (only when not exploded) */}
          {!exploded && decomp && (
            <Slab origin={[0,0,0]} dims={{ w: a, d: a, h: a }} color="#e5e7eb" scale={scale} cx={cx} cy={cy} />
          )}
          {decomp && origins.map((o, i) => (
            <Slab key={i} origin={o} dims={decomp.slabs[i]}
                  color={COLORS[i]} scale={scale} cx={cx} cy={cy}
                  label={SLAB_LABELS[i]} />
          ))}
        </svg>
      </div>

      {/* Numeric proof */}
      {decomp ? (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="bg-indigo-50 rounded-lg p-2">
            <div className="text-[11px] uppercase font-semibold text-indigo-700">a³ − b³</div>
            <div className="font-mono text-lg">{decomp.expectedVolume.toFixed(2)}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2">
            <div className="text-[11px] uppercase font-semibold text-emerald-700">∑ плочки</div>
            <div className="font-mono text-lg">{decomp.totalVolume.toFixed(2)}</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2">
            <div className="text-[11px] uppercase font-semibold text-amber-700">(a−b)(a²+ab+b²)</div>
            <div className="font-mono text-lg">{decomp.factorisedVolume.toFixed(2)}</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-rose-600">Невалидни вредности: a мора да е поголемо од b.</p>
      )}

      <div className="mt-3 text-center">
        <MathRenderer text={`$$a^3 - b^3 = (a-b)(a^2 + ab + b^2)$$`} />
      </div>
    </div>
  );
};

export default AlgebraicIdentityViewer;
