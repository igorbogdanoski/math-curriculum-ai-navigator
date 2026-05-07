/**
 * ConicSectionExplorer (T4.3)
 *
 * Interactive: drag two sliders (cone half-angle α, plane tilt β). The right
 * panel shows the resulting conic section (circle / ellipse / parabola /
 * hyperbola), its eccentricity, and the canonical equation. The left panel
 * shows a stylised cone + cutting plane.
 */
import React, { useMemo, useState } from 'react';
import { Triangle, RotateCcw } from 'lucide-react';
import {
  describeConic, sampleConic,
} from './conicSectionHelpers';

const KIND_LABELS: Record<string, string> = {
  circle: 'Кружница',
  ellipse: 'Елипса',
  parabola: 'Парабола',
  hyperbola: 'Хипербола',
};

const KIND_COLORS: Record<string, string> = {
  circle: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  ellipse: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  parabola: 'text-amber-700 bg-amber-50 border-amber-200',
  hyperbola: 'text-rose-700 bg-rose-50 border-rose-200',
};

export interface ConicSectionExplorerProps {
  initialAlphaDeg?: number;
  initialBetaDeg?: number;
}

export const ConicSectionExplorer: React.FC<ConicSectionExplorerProps> = ({
  initialAlphaDeg = 30,
  initialBetaDeg = 70,
}) => {
  const [alphaDeg, setAlphaDeg] = useState(initialAlphaDeg);
  const [betaDeg, setBetaDeg] = useState(initialBetaDeg);

  const alpha = (alphaDeg * Math.PI) / 180;
  const beta = (betaDeg * Math.PI) / 180;
  const desc = useMemo(() => describeConic({ alpha, beta }), [alpha, beta]);
  const path = useMemo(() => sampleConic({ alpha, beta }, { samples: 220, range: 2 }), [alpha, beta]);

  const reset = () => {
    setAlphaDeg(initialAlphaDeg);
    setBetaDeg(initialBetaDeg);
  };

  // Conic SVG view-box.
  const W = 320;
  const H = 220;
  const cx = W / 2;
  const cy = H / 2;
  const scale = 50; // 1 math unit = 50 px

  const buildPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    return pts
      .map((p, i) => {
        const sx = cx + p.x * scale;
        const sy = cy - p.y * scale;
        return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
      })
      .join(' ');
  };

  // Cone illustration coords.
  const coneW = 240;
  const coneH = 220;
  const apex = { x: coneW / 2, y: 30 };
  const baseY = coneH - 30;
  const slantLen = baseY - apex.y;
  const baseHalf = slantLen * Math.tan(alpha);
  const baseLeft = { x: apex.x - baseHalf, y: baseY };
  const baseRight = { x: apex.x + baseHalf, y: baseY };
  // Cutting plane: line through the cone, tilt = beta (90° = horizontal).
  const planeY = apex.y + slantLen * 0.55;
  const tilt = (Math.PI / 2 - beta);
  const planeDx = 110;
  const planeDy = planeDx * Math.tan(tilt);
  const planeLeft = { x: apex.x - planeDx, y: planeY + planeDy };
  const planeRight = { x: apex.x + planeDx, y: planeY - planeDy };

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
      data-testid="conic-section-explorer"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-gray-800 inline-flex items-center gap-2">
          <Triangle className="w-4 h-4 text-indigo-600" />
          Конусни пресеци
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] font-bold px-2 py-1 rounded-full border ${KIND_COLORS[desc.kind]}`}
            data-testid="conic-kind"
          >
            {KIND_LABELS[desc.kind]}
          </span>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
            data-testid="conic-reset"
          >
            <RotateCcw className="w-3 h-3" /> Ресет
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Cone illustration */}
        <svg
          viewBox={`0 0 ${coneW} ${coneH}`}
          className="w-full h-auto bg-gray-50 rounded-xl border border-gray-100"
          role="img"
          aria-label="Конус и сечечка рамнина"
          data-testid="conic-cone-svg"
        >
          {/* Cone body */}
          <ellipse cx={apex.x} cy={baseY} rx={baseHalf} ry={baseHalf * 0.25} fill="#e0e7ff" stroke="#6366f1" strokeWidth={1.2} />
          <line x1={apex.x} y1={apex.y} x2={baseLeft.x} y2={baseLeft.y} stroke="#4f46e5" strokeWidth={1.4} />
          <line x1={apex.x} y1={apex.y} x2={baseRight.x} y2={baseRight.y} stroke="#4f46e5" strokeWidth={1.4} />
          {/* Axis */}
          <line x1={apex.x} y1={apex.y - 5} x2={apex.x} y2={baseY + 5} stroke="#6b7280" strokeWidth={1} strokeDasharray="3 3" />
          {/* Cutting plane */}
          <line
            x1={planeLeft.x}
            y1={planeLeft.y}
            x2={planeRight.x}
            y2={planeRight.y}
            stroke="#dc2626"
            strokeWidth={2}
          />
          <text x={planeRight.x + 4} y={planeRight.y + 4} fontSize={10} fill="#dc2626" fontWeight={700}>план</text>
          <text x={apex.x + 4} y={apex.y - 4} fontSize={10} fill="#4f46e5" fontWeight={700}>α={alphaDeg.toFixed(0)}°</text>
          <text x={planeLeft.x - 4} y={planeLeft.y + 14} fontSize={10} fill="#dc2626" fontWeight={700} textAnchor="end">β={betaDeg.toFixed(0)}°</text>
        </svg>

        {/* Resulting conic */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto bg-gray-50 rounded-xl border border-gray-100"
          role="img"
          aria-label={`Конусен пресек: ${KIND_LABELS[desc.kind]}`}
          data-testid="conic-result-svg"
        >
          {/* Axes */}
          <line x1={0} y1={cy} x2={W} y2={cy} stroke="#9ca3af" strokeWidth={1} />
          <line x1={cx} y1={0} x2={cx} y2={H} stroke="#9ca3af" strokeWidth={1} />
          {path.branches.map((br, i) => (
            <path
              key={i}
              d={buildPath(br)}
              fill="none"
              stroke="#dc2626"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <code
          className="px-2 py-1 font-mono bg-rose-50 text-rose-800 rounded-md border border-rose-100"
          data-testid="conic-equation"
        >
          {desc.equation}
        </code>
        <span className="font-semibold text-gray-700">
          Ексцентричност e =
          <span className="font-mono font-bold text-indigo-700 ml-1" data-testid="conic-eccentricity">
            {desc.e.toFixed(3)}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <label className="font-semibold text-gray-700 space-y-1">
          <span>α (полуагол на конус): <span className="font-mono font-bold text-indigo-700">{alphaDeg.toFixed(0)}°</span></span>
          <input
            type="range" min={5} max={85} step={1}
            value={alphaDeg}
            onChange={(e) => setAlphaDeg(Number(e.target.value))}
            className="w-full accent-indigo-600"
            data-testid="conic-alpha"
            aria-label="Полу-агол α"
          />
        </label>
        <label className="font-semibold text-gray-700 space-y-1">
          <span>β (наклон на план): <span className="font-mono font-bold text-rose-700">{betaDeg.toFixed(0)}°</span></span>
          <input
            type="range" min={1} max={90} step={1}
            value={betaDeg}
            onChange={(e) => setBetaDeg(Number(e.target.value))}
            className="w-full accent-rose-600"
            data-testid="conic-beta"
            aria-label="Наклон β"
          />
        </label>
      </div>

      <p className="text-[11px] text-gray-500">
        Промена на агол β го менува типот на конусен пресек:
        β = 90° → кружница; α &lt; β &lt; 90° → елипса; β = α → парабола; β &lt; α → хипербола.
      </p>
    </div>
  );
};
