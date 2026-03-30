/**
 * Shape3DViewer — zero-dependency isometric 3D geometry visualizer.
 *
 * Renders standard math shapes as animated SVG with:
 *  - Orbit (drag to rotate), zoom (wheel/pinch)
 *  - Parametric dimensions (radius, width, height, …)
 *  - Formula panel: volume + surface area, live-updated
 *  - Shapes: cube, cuboid, sphere, cylinder, cone, pyramid (square base), triangular prism
 *
 * Technique: project 3D vertices to 2D using basic isometric + yaw rotation.
 * No canvas, no WebGL, no external deps — pure SVG + React.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MathRenderer } from '../common/MathRenderer';
import { RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

// ─── 3D math helpers ──────────────────────────────────────────────────────────
type Vec3 = [number, number, number];

/** Rotate point around Y axis by angle θ (radians) */
const rotY = ([x, y, z]: Vec3, θ: number): Vec3 => [
  x * Math.cos(θ) + z * Math.sin(θ),
  y,
  -x * Math.sin(θ) + z * Math.cos(θ),
];

/** Rotate point around X axis by angle φ (radians) */
const rotX = ([x, y, z]: Vec3, φ: number): Vec3 => [
  x,
  y * Math.cos(φ) - z * Math.sin(φ),
  y * Math.sin(φ) + z * Math.cos(φ),
];

const project = (p: Vec3, scale: number, cx: number, cy: number): [number, number] => [
  cx + p[0] * scale,
  cy - p[1] * scale,
];

const pts2svg = (pts: [number, number][]) => pts.map(p => p.join(',')).join(' ');

// ─── Shape types ──────────────────────────────────────────────────────────────
export type Shape3DType = 'cube' | 'cuboid' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'prism';

export interface ShapeDimensions {
  a?: number;  // side / radius
  b?: number;  // width
  c?: number;  // depth
  h?: number;  // height
  r?: number;  // radius
}

interface ShapeMeta {
  label: string;
  mk: string;
  dims: { key: keyof ShapeDimensions; label: string; min: number; max: number; step: number }[];
  volume: (d: ShapeDimensions) => number;
  surface: (d: ShapeDimensions) => number;
  volumeLatex: (d: ShapeDimensions) => string;
  surfaceLatex: (d: ShapeDimensions) => string;
}

const π = Math.PI;
const fmt = (n: number) => parseFloat(n.toFixed(2));

export const SHAPE_META: Record<Shape3DType, ShapeMeta> = {
  cube: {
    label: 'Cube', mk: 'Коцка',
    dims: [{ key: 'a', label: 'Страна (a)', min: 0.5, max: 5, step: 0.1 }],
    volume: ({ a = 2 }) => fmt(a ** 3),
    surface: ({ a = 2 }) => fmt(6 * a ** 2),
    volumeLatex: ({ a = 2 }) => `V = a^3 = ${a}^3 = ${fmt(a ** 3)}`,
    surfaceLatex: ({ a = 2 }) => `S = 6a^2 = 6 \\cdot ${a}^2 = ${fmt(6 * a ** 2)}`,
  },
  cuboid: {
    label: 'Cuboid', mk: 'Правоаголна призма',
    dims: [
      { key: 'a', label: 'Должина (a)', min: 0.5, max: 5, step: 0.1 },
      { key: 'b', label: 'Широчина (b)', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Висина (h)', min: 0.5, max: 5, step: 0.1 },
    ],
    volume: ({ a = 3, b = 2, h = 2 }) => fmt(a * b * h),
    surface: ({ a = 3, b = 2, h = 2 }) => fmt(2 * (a * b + b * h + a * h)),
    volumeLatex: ({ a = 3, b = 2, h = 2 }) => `V = a \\cdot b \\cdot h = ${a} \\cdot ${b} \\cdot ${h} = ${fmt(a * b * h)}`,
    surfaceLatex: ({ a = 3, b = 2, h = 2 }) => `S = 2(ab+bh+ah) = ${fmt(2 * (a * b + b * h + a * h))}`,
  },
  sphere: {
    label: 'Sphere', mk: 'Сфера',
    dims: [{ key: 'r', label: 'Радиус (r)', min: 0.3, max: 4, step: 0.1 }],
    volume: ({ r = 2 }) => fmt((4 / 3) * π * r ** 3),
    surface: ({ r = 2 }) => fmt(4 * π * r ** 2),
    volumeLatex: ({ r = 2 }) => `V = \\frac{4}{3}\\pi r^3 = \\frac{4}{3}\\pi \\cdot ${r}^3 \\approx ${fmt((4 / 3) * π * r ** 3)}`,
    surfaceLatex: ({ r = 2 }) => `S = 4\\pi r^2 = 4\\pi \\cdot ${r}^2 \\approx ${fmt(4 * π * r ** 2)}`,
  },
  cylinder: {
    label: 'Cylinder', mk: 'Цилиндар',
    dims: [
      { key: 'r', label: 'Радиус (r)', min: 0.3, max: 4, step: 0.1 },
      { key: 'h', label: 'Висина (h)', min: 0.3, max: 5, step: 0.1 },
    ],
    volume: ({ r = 1.5, h = 3 }) => fmt(π * r ** 2 * h),
    surface: ({ r = 1.5, h = 3 }) => fmt(2 * π * r * (r + h)),
    volumeLatex: ({ r = 1.5, h = 3 }) => `V = \\pi r^2 h = \\pi \\cdot ${r}^2 \\cdot ${h} \\approx ${fmt(π * r ** 2 * h)}`,
    surfaceLatex: ({ r = 1.5, h = 3 }) => `S = 2\\pi r(r+h) = 2\\pi \\cdot ${r}(${r}+${h}) \\approx ${fmt(2 * π * r * (r + h))}`,
  },
  cone: {
    label: 'Cone', mk: 'Конус',
    dims: [
      { key: 'r', label: 'Радиус (r)', min: 0.3, max: 4, step: 0.1 },
      { key: 'h', label: 'Висина (h)', min: 0.3, max: 5, step: 0.1 },
    ],
    volume: ({ r = 1.5, h = 3 }) => fmt((1 / 3) * π * r ** 2 * h),
    surface: ({ r = 1.5, h = 3 }) => {
      const l = Math.sqrt(r ** 2 + h ** 2);
      return fmt(π * r * (r + l));
    },
    volumeLatex: ({ r = 1.5, h = 3 }) => `V = \\frac{1}{3}\\pi r^2 h \\approx ${fmt((1 / 3) * π * r ** 2 * h)}`,
    surfaceLatex: ({ r = 1.5, h = 3 }) => {
      const l = fmt(Math.sqrt(r ** 2 + h ** 2));
      return `S = \\pi r(r+l),\\; l=${l} \\approx ${fmt(π * r * (r + Math.sqrt(r ** 2 + h ** 2)))}`;
    },
  },
  pyramid: {
    label: 'Pyramid', mk: 'Пирамида (квадратна основа)',
    dims: [
      { key: 'a', label: 'Основа (a)', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Висина (h)', min: 0.5, max: 5, step: 0.1 },
    ],
    volume: ({ a = 2, h = 3 }) => fmt((1 / 3) * a ** 2 * h),
    surface: ({ a = 2, h = 3 }) => {
      const sl = Math.sqrt((a / 2) ** 2 + h ** 2);
      return fmt(a ** 2 + 2 * a * sl);
    },
    volumeLatex: ({ a = 2, h = 3 }) => `V = \\frac{1}{3}a^2 h = \\frac{1}{3} \\cdot ${a}^2 \\cdot ${h} = ${fmt((1 / 3) * a ** 2 * h)}`,
    surfaceLatex: ({ a = 2, h = 3 }) => {
      const sl = fmt(Math.sqrt((a / 2) ** 2 + h ** 2));
      return `S = a^2 + 2al,\\; l=${sl} \\approx ${fmt(a ** 2 + 2 * a * Math.sqrt((a / 2) ** 2 + h ** 2))}`;
    },
  },
  prism: {
    label: 'Triangular prism', mk: 'Триаголна призма',
    dims: [
      { key: 'a', label: 'Основа (a)', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Висина на триаголник (h)', min: 0.5, max: 5, step: 0.1 },
      { key: 'c', label: 'Должина (l)', min: 0.5, max: 5, step: 0.1 },
    ],
    volume: ({ a = 2, h = 1.5, c = 3 }) => fmt(0.5 * a * h * c),
    surface: ({ a = 2, h = 1.5, c = 3 }) => fmt(a * h + c * (a + 2 * Math.sqrt((a / 2) ** 2 + h ** 2))),
    volumeLatex: ({ a = 2, h = 1.5, c = 3 }) => `V = \\frac{1}{2}ah \\cdot l = \\frac{1}{2} \\cdot ${a} \\cdot ${h} \\cdot ${c} = ${fmt(0.5 * a * h * c)}`,
    surfaceLatex: ({ a = 2, h = 1.5, c = 3 }) => `S \\approx ${fmt(a * h + c * (a + 2 * Math.sqrt((a / 2) ** 2 + h ** 2)))}`,
  },
};

// ─── Geometry builders ────────────────────────────────────────────────────────
interface Face { pts: Vec3[]; color: string; opacity: number; zOrder: number }

const buildCuboid = (a: number, b: number, h: number): Face[] => {
  const [w, d, ht] = [a / 2, b / 2, h];
  const v: Vec3[] = [
    [-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d],
    [-w, ht, -d], [w, ht, -d], [w, ht, d], [-w, ht, d],
  ];
  return [
    { pts: [v[4], v[5], v[6], v[7]], color: '#93c5fd', opacity: 0.9, zOrder: 3 }, // top
    { pts: [v[0], v[1], v[5], v[4]], color: '#bfdbfe', opacity: 0.85, zOrder: 2 }, // front
    { pts: [v[1], v[2], v[6], v[5]], color: '#dbeafe', opacity: 0.8, zOrder: 1 }, // right
    { pts: [v[3], v[2], v[6], v[7]], color: '#60a5fa', opacity: 0.75, zOrder: 0 }, // back
    { pts: [v[0], v[3], v[7], v[4]], color: '#3b82f6', opacity: 0.75, zOrder: 0 }, // left
    { pts: [v[0], v[1], v[2], v[3]], color: '#1d4ed8', opacity: 0.7, zOrder: -1 }, // bottom
  ];
};

const buildPyramid = (a: number, h: number): Face[] => {
  const [w] = [a / 2];
  const apex: Vec3 = [0, h, 0];
  const base: Vec3[] = [[-w, 0, -w], [w, 0, -w], [w, 0, w], [-w, 0, w]];
  return [
    { pts: [base[0], base[1], base[2], base[3]], color: '#1d4ed8', opacity: 0.7, zOrder: -1 },
    { pts: [base[0], base[1], apex], color: '#93c5fd', opacity: 0.85, zOrder: 2 },
    { pts: [base[1], base[2], apex], color: '#bfdbfe', opacity: 0.8, zOrder: 1 },
    { pts: [base[2], base[3], apex], color: '#60a5fa', opacity: 0.75, zOrder: 0 },
    { pts: [base[3], base[0], apex], color: '#3b82f6', opacity: 0.75, zOrder: 0 },
  ];
};

const buildPrism = (a: number, h: number, l: number): Face[] => {
  const hw = a / 2, hh = h, hl = l / 2;
  const tri = (z: number): Vec3[] => [[-hw, 0, z], [hw, 0, z], [0, hh, z]];
  const f = tri(-hl), b = tri(hl);
  return [
    { pts: f, color: '#93c5fd', opacity: 0.9, zOrder: 3 },
    { pts: b, color: '#60a5fa', opacity: 0.75, zOrder: 0 },
    { pts: [f[0], f[1], b[1], b[0]], color: '#bfdbfe', opacity: 0.8, zOrder: 1 },
    { pts: [f[1], f[2], b[2], b[1]], color: '#dbeafe', opacity: 0.85, zOrder: 2 },
    { pts: [f[0], f[2], b[2], b[0]], color: '#3b82f6', opacity: 0.75, zOrder: 0 },
  ];
};

// For sphere/cylinder/cone we use SVG ellipses + lines (no polygon mesh needed)

// ─── Face renderer ────────────────────────────────────────────────────────────
const renderPolyFaces = (
  faces: Face[], yaw: number, pitch: number, scale: number, cx: number, cy: number
): React.ReactNode => {
  const transformed = faces.map(f => {
    const proj = f.pts
      .map(p => rotY(rotX(p, pitch), yaw))
      .map(p => project(p, scale, cx, cy));
    const avgZ = f.pts.reduce((s, p) => s + rotY(rotX(p, pitch), yaw)[2], 0) / f.pts.length;
    return { ...f, proj, avgZ };
  }).sort((a, b) => a.avgZ - b.avgZ);

  return transformed.map((f, i) => (
    <polygon
      key={i}
      points={pts2svg(f.proj)}
      fill={f.color}
      fillOpacity={f.opacity}
      stroke="#1e3a8a"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  ));
};

// ─── Main component ───────────────────────────────────────────────────────────
interface Shape3DViewerProps {
  initialShape?: Shape3DType;
  compact?: boolean; // hide formula panel
}

const DEFAULT_DIMS: Record<Shape3DType, ShapeDimensions> = {
  cube:    { a: 2 },
  cuboid:  { a: 3, b: 2, h: 2 },
  sphere:  { r: 1.5 },
  cylinder:{ r: 1.5, h: 3 },
  cone:    { r: 1.5, h: 3 },
  pyramid: { a: 2.5, h: 3 },
  prism:   { a: 2.5, h: 1.8, c: 3 },
};

const SHAPE_ORDER: Shape3DType[] = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid', 'prism'];

export const Shape3DViewer: React.FC<Shape3DViewerProps> = ({ initialShape = 'cube', compact = false }) => {
  const [shape, setShape] = useState<Shape3DType>(initialShape);
  const [dims, setDims] = useState<ShapeDimensions>(DEFAULT_DIMS[initialShape]);
  const [yaw, setYaw] = useState(0.6);
  const [pitch, setPitch] = useState(-0.4);
  const [scale, setScale] = useState(55);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 320, H = 260, cx = W / 2, cy = H / 2 + 20;

  // Reset dims when shape changes
  useEffect(() => {
    setDims(DEFAULT_DIMS[shape]);
  }, [shape]);

  // Drag to orbit
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setYaw(y => y + dx * 0.01);
    setPitch(p => Math.max(-1.2, Math.min(0.3, p + dy * 0.008)));
    dragging.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = null; }, []);

  // Wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(20, Math.min(100, s - e.deltaY * 0.05)));
  }, []);

  const meta = SHAPE_META[shape];
  const d = dims;

  // Build SVG content
  const renderShape = (): React.ReactNode => {
    if (shape === 'cube' || shape === 'cuboid') {
      const a = d.a ?? 2, b = d.b ?? d.a ?? 2, h = d.h ?? d.a ?? 2;
      return renderPolyFaces(buildCuboid(a, b, h), yaw, pitch, scale, cx, cy);
    }
    if (shape === 'pyramid') {
      return renderPolyFaces(buildPyramid(d.a ?? 2, d.h ?? 3), yaw, pitch, scale, cx, cy);
    }
    if (shape === 'prism') {
      return renderPolyFaces(buildPrism(d.a ?? 2.5, d.h ?? 1.8, d.c ?? 3), yaw, pitch, scale, cx, cy);
    }
    // Sphere, cylinder, cone — use SVG ellipses
    const r = (d.r ?? 1.5) * scale;
    const h = (d.h ?? 3) * scale;
    const ry = r * Math.abs(Math.sin(pitch)) * 0.4 + 8;
    if (shape === 'sphere') {
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={r} ry={r} fill="#93c5fd" fillOpacity={0.6} stroke="#1e3a8a" strokeWidth="1.5" />
          <ellipse cx={cx} cy={cy} rx={r} ry={ry} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5,4" />
          <ellipse cx={cx} cy={cy} rx={ry} ry={r} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5,4" />
        </g>
      );
    }
    if (shape === 'cylinder') {
      return (
        <g>
          <ellipse cx={cx} cy={cy + h / 2} rx={r} ry={ry} fill="#1d4ed8" fillOpacity={0.5} stroke="#1e3a8a" strokeWidth="1.2" />
          <rect x={cx - r} y={cy - h / 2} width={r * 2} height={h} fill="#bfdbfe" fillOpacity={0.7} stroke="none" />
          <line x1={cx - r} y1={cy - h / 2} x2={cx - r} y2={cy + h / 2} stroke="#1e3a8a" strokeWidth="1.2" />
          <line x1={cx + r} y1={cy - h / 2} x2={cx + r} y2={cy + h / 2} stroke="#1e3a8a" strokeWidth="1.2" />
          <ellipse cx={cx} cy={cy - h / 2} rx={r} ry={ry} fill="#93c5fd" fillOpacity={0.9} stroke="#1e3a8a" strokeWidth="1.2" />
          <ellipse cx={cx} cy={cy + h / 2} rx={r} ry={ry} fill="none" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="4,3" />
        </g>
      );
    }
    // cone
    return (
      <g>
        <line x1={cx - r} y1={cy + h / 2} x2={cx} y2={cy - h / 2} stroke="#1e3a8a" strokeWidth="1.5" />
        <line x1={cx + r} y1={cy + h / 2} x2={cx} y2={cy - h / 2} stroke="#1e3a8a" strokeWidth="1.5" />
        <ellipse cx={cx} cy={cy + h / 2} rx={r} ry={ry} fill="#93c5fd" fillOpacity={0.6} stroke="#1e3a8a" strokeWidth="1.2" />
        <ellipse cx={cx} cy={cy + h / 2} rx={r} ry={ry} fill="none" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="4,3" />
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Shape selector */}
      <div className="flex flex-wrap gap-1.5">
        {SHAPE_ORDER.map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setShape(s)}
            className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all ${
              shape === s
                ? 'bg-blue-600 text-white border-blue-700'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {SHAPE_META[s].mk}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* SVG Viewport */}
        <div className="flex flex-col gap-2">
          <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 overflow-hidden border border-blue-900">
            <svg
              ref={svgRef}
              width={W} height={H}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onWheel={onWheel}
            >
              {/* Grid lines */}
              <line x1={0} y1={cy + 2} x2={W} y2={cy + 2} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4" />
              <line x1={cx} y1={0} x2={cx} y2={H} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4" />
              {renderShape()}
              {/* Label */}
              <text x={8} y={18} fill="#94a3b8" fontSize={11} fontWeight="bold" fontFamily="monospace">
                {meta.mk}
              </text>
              <text x={W - 8} y={H - 6} fill="#475569" fontSize={9} textAnchor="end" fontFamily="monospace">
                влечи за ротирање · scroll за зум
              </text>
            </svg>
          </div>
          {/* Zoom + Reset controls */}
          <div className="flex items-center gap-2 justify-center">
            <button type="button" onClick={() => setScale(s => Math.min(100, s + 8))}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button type="button" onClick={() => setScale(s => Math.max(20, s - 8))}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button type="button" onClick={() => { setYaw(0.6); setPitch(-0.4); setScale(55); setDims(DEFAULT_DIMS[shape]); }}
              title="Ресетирај поглед"
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Dimension sliders + formulas */}
        {!compact && (
          <div className="flex-1 flex flex-col gap-3 min-w-[200px]">
            {/* Sliders */}
            <div className="flex flex-col gap-2">
              {meta.dims.map(dim => (
                <div key={dim.key}>
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-0.5">
                    <span>{dim.label}</span>
                    <span className="text-blue-600">{dims[dim.key] ?? dim.min}</span>
                  </div>
                  <input
                    type="range"
                    min={dim.min} max={dim.max} step={dim.step}
                    value={dims[dim.key] ?? DEFAULT_DIMS[shape][dim.key] ?? dim.min}
                    onChange={e => setDims(prev => ({ ...prev, [dim.key]: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 rounded-full accent-blue-600"
                  />
                </div>
              ))}
            </div>

            {/* Formulas */}
            <div className="flex flex-col gap-2 mt-auto">
              <div className="p-3 bg-blue-950 rounded-xl">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Волумен</p>
                <div className="text-blue-100 text-sm">
                  <MathRenderer text={`$${meta.volumeLatex(dims)}$`} />
                </div>
              </div>
              <div className="p-3 bg-indigo-950 rounded-xl">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Површина</p>
                <div className="text-indigo-100 text-sm">
                  <MathRenderer text={`$${meta.surfaceLatex(dims)}$`} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
