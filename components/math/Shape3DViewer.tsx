/**
 * Shape3DViewer — world-class zero-dependency isometric 3D geometry visualizer.
 *
 * Features:
 *  - Drag (mouse + touch) to orbit, scroll/pinch to zoom
 *  - 3 preset view angles: Isometric / Front / Top
 *  - Dimensional labels drawn on the shape (a, h, r lines + text)
 *  - Parametric sliders — live update shape + formulas
 *  - Cross-section slider for Cylinder, Cube, Cuboid (horizontal cut)
 *  - Volume + Surface area formulas with KaTeX via MathRenderer
 *  - 7 shapes: Cube, Cuboid, Sphere, Cylinder, Cone, Pyramid, Triangular Prism
 *  - compact mode: SVG + shape selector only, no formula panel
 *  - Macedonian UI
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MathRenderer } from '../common/MathRenderer';
import { RefreshCw, ZoomIn, ZoomOut, Link2, CheckCheck } from 'lucide-react';
import { buildShapeShareUrl } from '../../utils/visualShareUrl';

// ─── 3D helpers ───────────────────────────────────────────────────────────────
type Vec3 = [number, number, number];

const rotY = ([x, y, z]: Vec3, θ: number): Vec3 => [
  x * Math.cos(θ) + z * Math.sin(θ), y, -x * Math.sin(θ) + z * Math.cos(θ),
];
const rotX = ([x, y, z]: Vec3, φ: number): Vec3 => [
  x, y * Math.cos(φ) - z * Math.sin(φ), y * Math.sin(φ) + z * Math.cos(φ),
];
const project = (p: Vec3, scale: number, cx: number, cy: number): [number, number] => [
  cx + p[0] * scale, cy - p[1] * scale,
];
const transform = (p: Vec3, yaw: number, pitch: number): Vec3 => rotY(rotX(p, pitch), yaw);
const pts2svg = (pts: [number, number][]) => pts.map(p => p.join(',')).join(' ');

// ─── Shape types ──────────────────────────────────────────────────────────────
export type Shape3DType = 'cube' | 'cuboid' | 'sphere' | 'cylinder' | 'cone' | 'pyramid' | 'prism';

export interface ShapeDimensions {
  a?: number; b?: number; c?: number; h?: number; r?: number;
}

interface ShapeMeta {
  label: string; mk: string;
  dims: { key: keyof ShapeDimensions; label: string; min: number; max: number; step: number }[];
  volume:       (d: ShapeDimensions) => number;
  surface:      (d: ShapeDimensions) => number;
  volumeLatex:  (d: ShapeDimensions) => string;
  surfaceLatex: (d: ShapeDimensions) => string;
  /** Does this shape support cross-section view? */
  hasCrossSection?: boolean;
}

const π = Math.PI;
const fmt = (n: number) => parseFloat(n.toFixed(2));

export const SHAPE_META: Record<Shape3DType, ShapeMeta> = {
  cube: {
    label: 'Cube', mk: 'Коцка', hasCrossSection: true,
    dims: [{ key: 'a', label: 'Страна (a)', min: 0.5, max: 5, step: 0.1 }],
    volume:  ({ a = 2 }) => fmt(a ** 3),
    surface: ({ a = 2 }) => fmt(6 * a ** 2),
    volumeLatex:  ({ a = 2 }) => `V = a^3 = ${a}^3 = ${fmt(a ** 3)}`,
    surfaceLatex: ({ a = 2 }) => `S = 6a^2 = 6 \\cdot ${a}^2 = ${fmt(6 * a ** 2)}`,
  },
  cuboid: {
    label: 'Cuboid', mk: 'Правоаголна призма', hasCrossSection: true,
    dims: [
      { key: 'a', label: 'Должина (a)', min: 0.5, max: 5, step: 0.1 },
      { key: 'b', label: 'Широчина (b)', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Висина (h)',   min: 0.5, max: 5, step: 0.1 },
    ],
    volume:  ({ a = 3, b = 2, h = 2 }) => fmt(a * b * h),
    surface: ({ a = 3, b = 2, h = 2 }) => fmt(2 * (a * b + b * h + a * h)),
    volumeLatex:  ({ a = 3, b = 2, h = 2 }) => `V = a \\cdot b \\cdot h = ${a} \\cdot ${b} \\cdot ${h} = ${fmt(a*b*h)}`,
    surfaceLatex: ({ a = 3, b = 2, h = 2 }) => `S = 2(ab+bh+ah) = ${fmt(2*(a*b+b*h+a*h))}`,
  },
  sphere: {
    label: 'Sphere', mk: 'Сфера',
    dims: [{ key: 'r', label: 'Радиус (r)', min: 0.3, max: 4, step: 0.1 }],
    volume:  ({ r = 2 }) => fmt((4/3) * π * r ** 3),
    surface: ({ r = 2 }) => fmt(4 * π * r ** 2),
    volumeLatex:  ({ r = 2 }) => `V = \\tfrac{4}{3}\\pi r^3 \\approx ${fmt((4/3)*π*r**3)}`,
    surfaceLatex: ({ r = 2 }) => `S = 4\\pi r^2 \\approx ${fmt(4*π*r**2)}`,
  },
  cylinder: {
    label: 'Cylinder', mk: 'Цилиндар', hasCrossSection: true,
    dims: [
      { key: 'r', label: 'Радиус (r)', min: 0.3, max: 4, step: 0.1 },
      { key: 'h', label: 'Висина (h)', min: 0.3, max: 5, step: 0.1 },
    ],
    volume:  ({ r = 1.5, h = 3 }) => fmt(π * r ** 2 * h),
    surface: ({ r = 1.5, h = 3 }) => fmt(2 * π * r * (r + h)),
    volumeLatex:  ({ r = 1.5, h = 3 }) => `V = \\pi r^2 h \\approx ${fmt(π*r**2*h)}`,
    surfaceLatex: ({ r = 1.5, h = 3 }) => `S = 2\\pi r(r+h) \\approx ${fmt(2*π*r*(r+h))}`,
  },
  cone: {
    label: 'Cone', mk: 'Конус',
    dims: [
      { key: 'r', label: 'Радиус (r)', min: 0.3, max: 4, step: 0.1 },
      { key: 'h', label: 'Висина (h)', min: 0.3, max: 5, step: 0.1 },
    ],
    volume:  ({ r = 1.5, h = 3 }) => fmt((1/3) * π * r ** 2 * h),
    surface: ({ r = 1.5, h = 3 }) => { const l = Math.sqrt(r**2+h**2); return fmt(π*r*(r+l)); },
    volumeLatex:  ({ r = 1.5, h = 3 }) => `V = \\tfrac{1}{3}\\pi r^2 h \\approx ${fmt((1/3)*π*r**2*h)}`,
    surfaceLatex: ({ r = 1.5, h = 3 }) => { const l = fmt(Math.sqrt(r**2+h**2)); return `S = \\pi r(r+l),\\;l=${l} \\approx ${fmt(π*r*(r+Math.sqrt(r**2+h**2)))}`; },
  },
  pyramid: {
    label: 'Pyramid', mk: 'Пирамида',
    dims: [
      { key: 'a', label: 'Основа (a)', min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Висина (h)', min: 0.5, max: 5, step: 0.1 },
    ],
    volume:  ({ a = 2, h = 3 }) => fmt((1/3) * a**2 * h),
    surface: ({ a = 2, h = 3 }) => { const sl=Math.sqrt((a/2)**2+h**2); return fmt(a**2+2*a*sl); },
    volumeLatex:  ({ a = 2, h = 3 }) => `V = \\tfrac{1}{3}a^2 h = ${fmt((1/3)*a**2*h)}`,
    surfaceLatex: ({ a = 2, h = 3 }) => { const sl=fmt(Math.sqrt((a/2)**2+h**2)); return `S = a^2+2al,\\;l=${sl} \\approx ${fmt(a**2+2*a*Math.sqrt((a/2)**2+h**2))}`; },
  },
  prism: {
    label: 'Triangular prism', mk: 'Триаголна призма',
    dims: [
      { key: 'a', label: 'Основа (a)',  min: 0.5, max: 5, step: 0.1 },
      { key: 'h', label: 'Висина (h)',  min: 0.5, max: 5, step: 0.1 },
      { key: 'c', label: 'Должина (l)', min: 0.5, max: 5, step: 0.1 },
    ],
    volume:  ({ a = 2, h = 1.5, c = 3 }) => fmt(0.5 * a * h * c),
    surface: ({ a = 2, h = 1.5, c = 3 }) => fmt(a*h + c*(a+2*Math.sqrt((a/2)**2+h**2))),
    volumeLatex:  ({ a = 2, h = 1.5, c = 3 }) => `V = \\tfrac{1}{2}ah \\cdot l = ${fmt(0.5*a*h*c)}`,
    surfaceLatex: ({ a = 2, h = 1.5, c = 3 }) => `S \\approx ${fmt(a*h+c*(a+2*Math.sqrt((a/2)**2+h**2)))}`,
  },
};

// ─── Face builder ─────────────────────────────────────────────────────────────
interface Face { pts: Vec3[]; color: string; opacity: number }

const buildCuboid = (a: number, b: number, h: number, crossAt?: number): Face[] => {
  const [w, d, ht] = [a/2, b/2, h];
  const cutH = crossAt !== undefined ? ht * crossAt : null;
  const v: Vec3[] = [
    [-w,0,-d],[w,0,-d],[w,0,d],[-w,0,d],
    [-w,ht,-d],[w,ht,-d],[w,ht,d],[-w,ht,d],
  ];
  const faces: Face[] = [
    { pts:[v[4],v[5],v[6],v[7]], color:'#93c5fd', opacity:0.9 },
    { pts:[v[0],v[1],v[5],v[4]], color:'#bfdbfe', opacity:0.85 },
    { pts:[v[1],v[2],v[6],v[5]], color:'#dbeafe', opacity:0.8  },
    { pts:[v[3],v[2],v[6],v[7]], color:'#60a5fa', opacity:0.75 },
    { pts:[v[0],v[3],v[7],v[4]], color:'#3b82f6', opacity:0.75 },
    { pts:[v[0],v[1],v[2],v[3]], color:'#1d4ed8', opacity:0.7  },
  ];
  if (cutH !== null) {
    const cY = cutH;
    const cv: Vec3[] = [[-w,cY,-d],[w,cY,-d],[w,cY,d],[-w,cY,d]];
    faces.push({ pts: cv, color: '#fbbf24', opacity: 0.85 });
  }
  return faces;
};

const buildPyramid = (a: number, h: number): Face[] => {
  const w = a/2;
  const apex: Vec3 = [0,h,0];
  const base: Vec3[] = [[-w,0,-w],[w,0,-w],[w,0,w],[-w,0,w]];
  return [
    { pts:[base[0],base[1],base[2],base[3]], color:'#1d4ed8', opacity:0.7  },
    { pts:[base[0],base[1],apex],            color:'#93c5fd', opacity:0.85 },
    { pts:[base[1],base[2],apex],            color:'#bfdbfe', opacity:0.8  },
    { pts:[base[2],base[3],apex],            color:'#60a5fa', opacity:0.75 },
    { pts:[base[3],base[0],apex],            color:'#3b82f6', opacity:0.75 },
  ];
};

const buildPrism = (a: number, h: number, l: number): Face[] => {
  const hw=a/2, hl=l/2;
  const tri = (z: number): Vec3[] => [[-hw,0,z],[hw,0,z],[0,h,z]];
  const f=tri(-hl), b=tri(hl);
  return [
    { pts:f,                         color:'#93c5fd', opacity:0.9  },
    { pts:b,                         color:'#60a5fa', opacity:0.75 },
    { pts:[f[0],f[1],b[1],b[0]],    color:'#bfdbfe', opacity:0.8  },
    { pts:[f[1],f[2],b[2],b[1]],    color:'#dbeafe', opacity:0.85 },
    { pts:[f[0],f[2],b[2],b[0]],    color:'#3b82f6', opacity:0.75 },
  ];
};

const renderPolyFaces = (
  faces: Face[], yaw: number, pitch: number, scale: number, cx: number, cy: number
): React.ReactNode => {
  return faces
    .map(f => {
      const proj = f.pts.map(p => project(transform(p, yaw, pitch), scale, cx, cy));
      const avgZ = f.pts.reduce((s,p) => s + transform(p,yaw,pitch)[2], 0) / f.pts.length;
      return { ...f, proj, avgZ };
    })
    .sort((a,b) => a.avgZ - b.avgZ)
    .map((f,i) => (
      <polygon key={i} points={pts2svg(f.proj)}
        fill={f.color} fillOpacity={f.opacity}
        stroke="#1e3a8a" strokeWidth="1.2" strokeLinejoin="round" />
    ));
};

// ─── Dimension labels ─────────────────────────────────────────────────────────
const renderDimLabel = (
  p1: Vec3, p2: Vec3, label: string,
  yaw: number, pitch: number, scale: number, cx: number, cy: number,
  color = '#fbbf24'
): React.ReactNode => {
  const [x1,y1] = project(transform(p1,yaw,pitch), scale, cx, cy);
  const [x2,y2] = project(transform(p2,yaw,pitch), scale, cx, cy);
  const mx = (x1+x2)/2, my = (y1+y2)/2;
  return (
    <g key={label}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.5" strokeDasharray="3,2" />
      <circle cx={x1} cy={y1} r="2" fill={color} />
      <circle cx={x2} cy={y2} r="2" fill={color} />
      <text x={mx} y={my-4} fill={color} fontSize={11} fontWeight="bold"
        textAnchor="middle" fontFamily="monospace">{label}</text>
    </g>
  );
};

// ─── Preset views ─────────────────────────────────────────────────────────────
const PRESET_VIEWS = {
  iso:   { yaw: 0.6,          pitch: -0.4, label: '↗ Изо'    },
  front: { yaw: 0,            pitch: 0,    label: '→ Напред' },
  top:   { yaw: 0,            pitch: -1.3, label: '⊤ Одгоре' },
};

// ─── Default dims + shape order ───────────────────────────────────────────────
export const SHAPE_DEFAULT_DIMS: Record<Shape3DType, ShapeDimensions> = {
  cube:     { a: 3 },
  cuboid:   { a: 3, b: 2, h: 2 },
  sphere:   { r: 1.5 },
  cylinder: { r: 1.5, h: 3 },
  cone:     { r: 1.5, h: 3 },
  pyramid:  { a: 2.5, h: 3 },
  prism:    { a: 2.5, h: 1.8, c: 3 },
};

export const SHAPE_ORDER: Shape3DType[] = ['cube','cuboid','sphere','cylinder','cone','pyramid','prism'];

// ─── Component ────────────────────────────────────────────────────────────────
interface Shape3DViewerProps {
  initialShape?: Shape3DType;
  /** Override default dimensions on mount (used for URL share, C3.4) */
  initialDims?: ShapeDimensions;
  compact?: boolean;
  /** If true, shape selector is hidden (used when parent controls shape) */
  hideSelector?: boolean;
}

export const Shape3DViewer: React.FC<Shape3DViewerProps> = ({
  initialShape = 'cube', initialDims, compact = false, hideSelector = false,
}) => {
  const [shape, setShape] = useState<Shape3DType>(initialShape);
  const [dims,  setDims]  = useState<ShapeDimensions>(
    initialDims ? { ...SHAPE_DEFAULT_DIMS[initialShape], ...initialDims } : SHAPE_DEFAULT_DIMS[initialShape]
  );
  const [urlCopied, setUrlCopied] = useState(false);
  const [yaw,   setYaw]   = useState(PRESET_VIEWS.iso.yaw);
  const [pitch, setPitch] = useState(PRESET_VIEWS.iso.pitch);
  const [scale, setScale] = useState(55);
  const [showLabels,     setShowLabels]     = useState(true);
  const [crossSection,   setCrossSection]   = useState(0); // 0=none, 0.1–0.9 = cut height fraction
  const [showCrossSlider, setShowCrossSlider] = useState(false);
  const [viewMode, setViewMode] = useState<'3d' | 'net'>('3d');

  const dragging = useRef<{ x: number; y: number } | null>(null);
  const svgRef   = useRef<SVGSVGElement>(null);

  const W=320, H=260, cx=W/2, cy=H/2+20;

  useEffect(() => { setDims(SHAPE_DEFAULT_DIMS[shape]); setCrossSection(0); setViewMode('3d'); }, [shape]);

  // ── Orbit: mouse ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragging.current.x;
    const dy = e.clientY - dragging.current.y;
    setYaw(y  => y + dx * 0.012);
    setPitch(p => Math.max(-1.35, Math.min(0.3, p + dy * 0.009)));
    dragging.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = null; }, []);

  // ── Orbit: touch ─────────────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragging.current || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - dragging.current.x;
    const dy = e.touches[0].clientY - dragging.current.y;
    setYaw(y  => y + dx * 0.012);
    setPitch(p => Math.max(-1.35, Math.min(0.3, p + dy * 0.009)));
    dragging.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const onTouchEnd = useCallback(() => { dragging.current = null; }, []);

  // ── Zoom: wheel ──────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.max(20, Math.min(100, s - e.deltaY * 0.06)));
  }, []);

  const meta = SHAPE_META[shape];
  const d    = dims;

  // ── Shape render ─────────────────────────────────────────────────────────────
  const renderShape = (): React.ReactNode => {
    const cut = crossSection > 0 ? crossSection : undefined;

    if (shape === 'cube') {
      const a = d.a ?? 2;
      return (
        <>
          {renderPolyFaces(buildCuboid(a, a, a, cut), yaw, pitch, scale, cx, cy)}
          {showLabels && (<>
            {renderDimLabel([-(a/2),a/2,-(a/2)],  [(a/2),a/2,-(a/2)], `a=${a}`, yaw, pitch, scale, cx, cy)}
            {renderDimLabel([(a/2),0,-(a/2)],      [(a/2),a,-(a/2)],   `h=${a}`, yaw, pitch, scale, cx, cy, '#34d399')}
          </>)}
        </>
      );
    }
    if (shape === 'cuboid') {
      const a=d.a??3, b=d.b??2, h=d.h??2;
      return (
        <>
          {renderPolyFaces(buildCuboid(a, b, h, cut), yaw, pitch, scale, cx, cy)}
          {showLabels && (<>
            {renderDimLabel([-(a/2),0,-(b/2)],  [(a/2),0,-(b/2)],  `a=${a}`, yaw, pitch, scale, cx, cy)}
            {renderDimLabel([(a/2),0,-(b/2)],   [(a/2),0,(b/2)],   `b=${b}`, yaw, pitch, scale, cx, cy, '#f472b6')}
            {renderDimLabel([(a/2),0,-(b/2)],   [(a/2),h,-(b/2)],  `h=${h}`, yaw, pitch, scale, cx, cy, '#34d399')}
          </>)}
        </>
      );
    }
    if (shape === 'pyramid') {
      const a=d.a??2.5, h=d.h??3;
      return (
        <>
          {renderPolyFaces(buildPyramid(a,h), yaw, pitch, scale, cx, cy)}
          {showLabels && (<>
            {renderDimLabel([-(a/2),0,-(a/2)], [(a/2),0,-(a/2)], `a=${a}`, yaw, pitch, scale, cx, cy)}
            {renderDimLabel([0,0,0],            [0,h,0],           `h=${h}`, yaw, pitch, scale, cx, cy, '#34d399')}
          </>)}
        </>
      );
    }
    if (shape === 'prism') {
      const a=d.a??2.5, h=d.h??1.8, c=d.c??3;
      return (
        <>
          {renderPolyFaces(buildPrism(a,h,c), yaw, pitch, scale, cx, cy)}
          {showLabels && (<>
            {renderDimLabel([-(a/2),0,-(c/2)], [(a/2),0,-(c/2)], `a=${a}`, yaw, pitch, scale, cx, cy)}
            {renderDimLabel([0,0,-(c/2)],       [0,0,(c/2)],      `l=${c}`, yaw, pitch, scale, cx, cy, '#f472b6')}
          </>)}
        </>
      );
    }

    // Curved shapes — SVG ellipses
    const r = (d.r ?? 1.5) * scale;
    const hPx = (d.h ?? 3) * scale;
    const ry = r * Math.abs(Math.sin(pitch)) * 0.4 + 8;

    if (shape === 'sphere') {
      const rv = d.r ?? 1.5;
      return (
        <>
          <ellipse cx={cx} cy={cy} rx={r} ry={r} fill="#93c5fd" fillOpacity={0.6} stroke="#1e3a8a" strokeWidth="1.5" />
          <ellipse cx={cx} cy={cy} rx={r} ry={ry} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5,4" />
          <ellipse cx={cx} cy={cy} rx={ry} ry={r} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5,4" />
          {showLabels && (
            <g>
              <line x1={cx} y1={cy} x2={cx+r} y2={cy} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3,2" />
              <text x={cx+r/2} y={cy-6} fill="#fbbf24" fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">r={rv}</text>
            </g>
          )}
        </>
      );
    }
    if (shape === 'cylinder') {
      const rv=d.r??1.5, hv=d.h??3;
      const cutY = cut !== undefined ? cy + hPx/2 - hPx * cut : null;
      return (
        <>
          <ellipse cx={cx} cy={cy+hPx/2} rx={r} ry={ry} fill="#1d4ed8" fillOpacity={0.5} stroke="#1e3a8a" strokeWidth="1.2" />
          <rect x={cx-r} y={cy-hPx/2} width={r*2} height={hPx} fill="#bfdbfe" fillOpacity={0.7} stroke="none" />
          <line x1={cx-r} y1={cy-hPx/2} x2={cx-r} y2={cy+hPx/2} stroke="#1e3a8a" strokeWidth="1.2" />
          <line x1={cx+r} y1={cy-hPx/2} x2={cx+r} y2={cy+hPx/2} stroke="#1e3a8a" strokeWidth="1.2" />
          <ellipse cx={cx} cy={cy-hPx/2} rx={r} ry={ry} fill="#93c5fd" fillOpacity={0.9} stroke="#1e3a8a" strokeWidth="1.2" />
          <ellipse cx={cx} cy={cy+hPx/2} rx={r} ry={ry} fill="none" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="4,3" />
          {cutY !== null && (
            <ellipse cx={cx} cy={cutY} rx={r} ry={ry} fill="#fbbf24" fillOpacity={0.7} stroke="#f59e0b" strokeWidth="1.5" />
          )}
          {showLabels && (<>
            <line x1={cx} y1={cy-hPx/2} x2={cx+r+10} y2={cy-hPx/2} stroke="#fbbf24" strokeWidth="1" strokeDasharray="2,2"/>
            <line x1={cx} y1={cy+hPx/2} x2={cx+r+10} y2={cy+hPx/2} stroke="#fbbf24" strokeWidth="1" strokeDasharray="2,2"/>
            <line x1={cx+r+8} y1={cy-hPx/2} x2={cx+r+8} y2={cy+hPx/2} stroke="#34d399" strokeWidth="1.5"/>
            <text x={cx+r+14} y={cy} fill="#34d399" fontSize={10} fontWeight="bold" fontFamily="monospace" dominantBaseline="middle">h={hv}</text>
            <line x1={cx} y1={cy} x2={cx+r} y2={cy} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3,2"/>
            <text x={cx+r/2} y={cy-6} fill="#fbbf24" fontSize={10} fontWeight="bold" textAnchor="middle" fontFamily="monospace">r={rv}</text>
          </>)}
        </>
      );
    }
    // cone
    const rv=d.r??1.5, hv=d.h??3;
    return (
      <>
        <line x1={cx-r} y1={cy+hPx/2} x2={cx} y2={cy-hPx/2} stroke="#1e3a8a" strokeWidth="1.5"/>
        <line x1={cx+r} y1={cy+hPx/2} x2={cx} y2={cy-hPx/2} stroke="#1e3a8a" strokeWidth="1.5"/>
        <ellipse cx={cx} cy={cy+hPx/2} rx={r} ry={ry} fill="#93c5fd" fillOpacity={0.6} stroke="#1e3a8a" strokeWidth="1.2"/>
        <ellipse cx={cx} cy={cy+hPx/2} rx={r} ry={ry} fill="none" stroke="#1e3a8a" strokeWidth="1" strokeDasharray="4,3"/>
        {showLabels && (<>
          <line x1={cx} y1={cy+hPx/2} x2={cx+r} y2={cy+hPx/2} stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3,2"/>
          <text x={cx+r/2} y={cy+hPx/2-6} fill="#fbbf24" fontSize={10} fontWeight="bold" textAnchor="middle" fontFamily="monospace">r={rv}</text>
          <line x1={cx+r+8} y1={cy-hPx/2} x2={cx+r+8} y2={cy+hPx/2} stroke="#34d399" strokeWidth="1.5"/>
          <text x={cx+r+14} y={cy} fill="#34d399" fontSize={10} fontWeight="bold" fontFamily="monospace" dominantBaseline="middle">h={hv}</text>
        </>)}
      </>
    );
  };

  // ── Net (unfolding) render ────────────────────────────────────────────────────
  const renderNet = (): React.ReactNode => {
    const FILL  = '#e0e7ff';
    const FILL2 = '#c7d2fe';
    const STR   = '#4338ca';
    const FOLD  = '#818cf8';
    const TXT   = '#1e1b4b';

    if (shape === 'sphere') {
      return (<>
        <ellipse cx={cx} cy={cy - 20} rx={65} ry={65} fill={FILL} fillOpacity={0.25} stroke={STR} strokeWidth="1.5"/>
        {[12, 26, 40, 54, 65].map((ry2, i) => (
          <ellipse key={i} cx={cx} cy={cy - 20} rx={65} ry={ry2}
            fill="none" stroke={FOLD} strokeWidth="1" strokeDasharray="5,4" opacity={0.6}/>
        ))}
        <text x={cx} y={cy + 58} fill={TXT} fontSize={12} fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">Сферата нема точна мрежа</text>
        <text x={cx} y={cy + 72} fill={FOLD} fontSize={9} textAnchor="middle" fontFamily="sans-serif">(не може да се развие рамно)</text>
        <text x={cx} y={14} fill={TXT} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">Развивка — Сфера</text>
      </>);
    }

    if (shape === 'cube') {
      const a = d.a ?? 3;
      const sc2 = Math.min(220 / (4 * a), 160 / (3 * a));
      const u = a * sc2;
      const ox = cx - 2 * u, oy = cy - 1.5 * u + 5;
      const rects = [
        { x: ox,       y: oy + u,   w: u, h: u },
        { x: ox + u,   y: oy + u,   w: u, h: u, hi: true },
        { x: ox + 2*u, y: oy + u,   w: u, h: u },
        { x: ox + 3*u, y: oy + u,   w: u, h: u },
        { x: ox + u,   y: oy,       w: u, h: u },
        { x: ox + u,   y: oy + 2*u, w: u, h: u },
      ];
      return (<>
        {rects.map((r2, i) => <rect key={i} x={r2.x} y={r2.y} width={r2.w} height={r2.h} fill={r2.hi ? FILL2 : FILL} stroke={STR} strokeWidth="1.5"/>)}
        {[1,2,3].map(i => <line key={`v${i}`} x1={ox+i*u} y1={oy+u} x2={ox+i*u} y2={oy+2*u} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>)}
        <line x1={ox+u}   y1={oy}   x2={ox+u}   y2={oy+u}   stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={ox+2*u} y1={oy}   x2={ox+2*u} y2={oy+u}   stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={ox+u}   y1={oy+2*u} x2={ox+u}   y2={oy+3*u} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={ox+2*u} y1={oy+2*u} x2={ox+2*u} y2={oy+3*u} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x={cx} y={H - 6} fill={STR} fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`a = ${a}  →  мрежа: 4a × 3a`}</text>
        <text x={cx} y={14} fill={TXT} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">Развивка — Коцка</text>
      </>);
    }

    if (shape === 'cuboid') {
      const a = d.a??3, b = d.b??2, hv = d.h??2;
      const sc2 = Math.min(220 / (2*(a+b)), 160 / (2*b+hv));
      const A = a*sc2, B = b*sc2, HH = hv*sc2;
      const ox = cx - A/2 - B, oy = cy - B - HH/2 + 5;
      return (<>
        <rect x={ox}       y={oy} width={B}  height={HH} fill={FILL}  stroke={STR} strokeWidth="1.5"/>
        <rect x={ox+B}     y={oy} width={A}  height={HH} fill={FILL2} stroke={STR} strokeWidth="1.5"/>
        <rect x={ox+B+A}   y={oy} width={B}  height={HH} fill={FILL}  stroke={STR} strokeWidth="1.5"/>
        <rect x={ox+2*B+A} y={oy} width={A}  height={HH} fill={FILL}  stroke={STR} strokeWidth="1.5"/>
        <rect x={ox+B}     y={oy-B}  width={A} height={B} fill={FILL2} stroke={STR} strokeWidth="1.5"/>
        <rect x={ox+B}     y={oy+HH} width={A} height={B} fill={FILL2} stroke={STR} strokeWidth="1.5"/>
        <line x1={ox+B}     y1={oy-B}    x2={ox+B}     y2={oy+HH+B}  stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={ox+B+A}   y1={oy-B}    x2={ox+B+A}   y2={oy+HH+B}  stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={ox+2*B+A} y1={oy}      x2={ox+2*B+A} y2={oy+HH}    stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={ox}       y1={oy}      x2={ox}       y2={oy+HH}    stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x={cx} y={H - 6} fill={STR} fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`a=${a}  b=${b}  h=${hv}`}</text>
        <text x={cx} y={14} fill={TXT} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">Развивка — Правоаголна призма</text>
      </>);
    }

    if (shape === 'cylinder') {
      const rv = d.r??1.5, hv = d.h??3;
      const circum = 2 * π * rv;
      const sc2 = Math.min(220 / Math.max(circum, 2*rv), 145 / (hv + 4*rv));
      const R2 = rv * sc2, rectW = circum * sc2, rectH = hv * sc2;
      const rx0 = cx - rectW/2, ry0 = cy - rectH/2 + 5;
      return (<>
        <rect x={rx0} y={ry0} width={rectW} height={rectH} fill={FILL2} stroke={STR} strokeWidth="1.5"/>
        <circle cx={cx} cy={ry0 - R2} r={R2} fill={FILL} stroke={STR} strokeWidth="1.5"/>
        <circle cx={cx} cy={ry0 + rectH + R2} r={R2} fill={FILL} stroke={STR} strokeWidth="1.5"/>
        <line x1={rx0} y1={ry0}       x2={rx0+rectW} y2={ry0}       stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={rx0} y1={ry0+rectH} x2={rx0+rectW} y2={ry0+rectH} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x={cx} y={ry0 + rectH/2 + 4} fill={TXT} fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`2πr ≈ ${circum.toFixed(1)}`}</text>
        <text x={rx0 - 5} y={ry0 + rectH/2} fill={STR} fontSize={9} textAnchor="end" fontFamily="monospace" fontWeight="bold">{`h=${hv}`}</text>
        <text x={cx} y={H - 6} fill={STR} fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`r=${rv}  h=${hv}  обем=2πr≈${circum.toFixed(2)}`}</text>
        <text x={cx} y={14} fill={TXT} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">Развивка — Цилиндар</text>
      </>);
    }

    if (shape === 'cone') {
      const rv = d.r??1.5, hv = d.h??3;
      const l = Math.sqrt(rv*rv + hv*hv);
      const sectorAngle = Math.min((2 * π * rv) / l, 2 * π * 0.999);
      const sc2 = Math.min(200 / (2*l), 145 / (l + 2*rv));
      const L2 = l * sc2, R2 = rv * sc2;
      const apexX = cx, apexY = cy - L2/2 - 5;
      const half = sectorAngle / 2;
      const x1s = apexX - L2 * Math.sin(half), y1s = apexY + L2 * Math.cos(half);
      const x2s = apexX + L2 * Math.sin(half), y2s = y1s;
      const largeArc = sectorAngle > π ? 1 : 0;
      const circleCy = y1s + R2 + 8;
      return (<>
        <path d={`M ${apexX} ${apexY} L ${x1s} ${y1s} A ${L2} ${L2} 0 ${largeArc} 1 ${x2s} ${y2s} Z`}
          fill={FILL2} stroke={STR} strokeWidth="1.5"/>
        <path d={`M ${x1s} ${y1s} A ${L2} ${L2} 0 ${largeArc} 1 ${x2s} ${y2s}`}
          fill="none" stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <circle cx={apexX} cy={circleCy} r={R2} fill={FILL} stroke={STR} strokeWidth="1.5"/>
        <line x1={apexX} y1={apexY} x2={x2s} y2={y2s} stroke={FOLD} strokeWidth="1" strokeDasharray="3,2"/>
        <text x={(apexX+x2s)/2 + 6} y={(apexY+y2s)/2 - 3} fill={STR} fontSize={9} fontFamily="monospace" fontWeight="bold">{`l≈${fmt(l)}`}</text>
        <text x={cx} y={H - 6} fill={STR} fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`r=${rv}  h=${hv}  l=√(r²+h²)≈${fmt(l)}`}</text>
        <text x={cx} y={14} fill={TXT} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">Развивка — Конус</text>
      </>);
    }

    if (shape === 'pyramid') {
      const a = d.a??2.5, hv = d.h??3;
      const sl = Math.sqrt((a/2)**2 + hv**2);
      const sc2 = Math.min(180, 160) / (a + 2*sl);
      const A = a*sc2, SL = sl*sc2;
      const bx = cx - A/2, by = cy - A/2;
      return (<>
        <rect x={bx} y={by} width={A} height={A} fill={FILL2} stroke={STR} strokeWidth="1.5"/>
        <polygon points={`${cx},${by-SL} ${bx},${by} ${bx+A},${by}`}        fill={FILL} stroke={STR} strokeWidth="1.5"/>
        <polygon points={`${cx},${by+A+SL} ${bx},${by+A} ${bx+A},${by+A}`} fill={FILL} stroke={STR} strokeWidth="1.5"/>
        <polygon points={`${bx-SL},${cy} ${bx},${by} ${bx},${by+A}`}       fill={FILL} stroke={STR} strokeWidth="1.5"/>
        <polygon points={`${bx+A+SL},${cy} ${bx+A},${by} ${bx+A},${by+A}`} fill={FILL} stroke={STR} strokeWidth="1.5"/>
        <line x1={bx}   y1={by}   x2={bx+A} y2={by}   stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={bx}   y1={by+A} x2={bx+A} y2={by+A} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={bx}   y1={by}   x2={bx}   y2={by+A} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <line x1={bx+A} y1={by}   x2={bx+A} y2={by+A} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x={cx} y={H - 6} fill={STR} fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`a=${a}  h=${hv}  l≈${fmt(sl)}`}</text>
        <text x={cx} y={14} fill={TXT} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">Развивка — Пирамида</text>
      </>);
    }

    // prism
    const a = d.a??2.5, hv = d.h??1.8, c = d.c??3;
    const leg = Math.sqrt((a/2)**2 + hv**2);
    const sc2 = Math.min(220 / (a + 2*leg), 155 / (c + 2*hv));
    const A = a*sc2, HH = hv*sc2, C = c*sc2, LEG = leg*sc2;
    const stripX = cx - A/2 - LEG, stripY = cy - C/2 + 5;
    const triX = cx - A/2;
    return (<>
      <rect x={stripX}       y={stripY} width={LEG} height={C} fill={FILL}  stroke={STR} strokeWidth="1.5"/>
      <rect x={stripX+LEG}   y={stripY} width={A}   height={C} fill={FILL2} stroke={STR} strokeWidth="1.5"/>
      <rect x={stripX+LEG+A} y={stripY} width={LEG} height={C} fill={FILL}  stroke={STR} strokeWidth="1.5"/>
      <polygon points={`${cx},${stripY-HH} ${triX},${stripY} ${triX+A},${stripY}`}       fill={FILL} stroke={STR} strokeWidth="1.5"/>
      <polygon points={`${cx},${stripY+C+HH} ${triX},${stripY+C} ${triX+A},${stripY+C}`} fill={FILL} stroke={STR} strokeWidth="1.5"/>
      <line x1={stripX+LEG}   y1={stripY} x2={stripX+LEG}   y2={stripY+C} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
      <line x1={stripX+LEG+A} y1={stripY} x2={stripX+LEG+A} y2={stripY+C} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
      <line x1={triX}   y1={stripY}   x2={triX+A} y2={stripY}   stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
      <line x1={triX}   y1={stripY+C} x2={triX+A} y2={stripY+C} stroke={FOLD} strokeWidth="1.5" strokeDasharray="4,3"/>
      <text x={cx} y={H - 6} fill={STR} fontSize={9} textAnchor="middle" fontFamily="monospace" fontWeight="bold">{`a=${a}  h=${hv}  l=${c}  страна≈${fmt(leg)}`}</text>
      <text x={cx} y={14} fill={TXT} fontSize={11} fontWeight="bold" textAnchor="middle" fontFamily="monospace">Развивка — Триаголна призма</text>
    </>);
  };

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* Shape selector */}
      {!hideSelector && (
        <div className="flex flex-wrap gap-1.5">
          {SHAPE_ORDER.map(s => (
            <button key={s} type="button" onClick={() => setShape(s)}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all ${
                shape === s ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
              }`}>
              {SHAPE_META[s].mk}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* ── SVG viewport ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          <div className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 overflow-hidden border border-blue-900">
            <svg ref={svgRef} width={W} height={H}
              className={`touch-none ${viewMode === '3d' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
              onMouseDown={viewMode === '3d' ? onMouseDown : undefined}
              onMouseMove={viewMode === '3d' ? onMouseMove : undefined}
              onMouseUp={viewMode === '3d' ? onMouseUp : undefined}
              onMouseLeave={viewMode === '3d' ? onMouseUp : undefined}
              onWheel={viewMode === '3d' ? onWheel : undefined}
              onTouchStart={viewMode === '3d' ? onTouchStart : undefined}
              onTouchMove={viewMode === '3d' ? onTouchMove : undefined}
              onTouchEnd={viewMode === '3d' ? onTouchEnd : undefined}
              onTouchCancel={viewMode === '3d' ? onTouchEnd : undefined}
            >
              {viewMode === '3d' && (<>
                <line x1={0} y1={cy+2} x2={W} y2={cy+2} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4"/>
                <line x1={cx} y1={0} x2={cx} y2={H} stroke="#334155" strokeWidth="0.5" strokeDasharray="4,4"/>
                {renderShape()}
                <text x={8} y={18} fill="#94a3b8" fontSize={11} fontWeight="bold" fontFamily="monospace">{meta.mk}</text>
                <text x={W-8} y={H-6} fill="#475569" fontSize={9} textAnchor="end" fontFamily="monospace">влечи · scroll</text>
              </>)}
              {viewMode === 'net' && renderNet()}
            </svg>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Preset views */}
            {Object.entries(PRESET_VIEWS).map(([key, v]) => (
              <button key={key} type="button"
                onClick={() => { setYaw(v.yaw); setPitch(v.pitch); }}
                className="px-2 py-1 rounded-lg bg-slate-700 text-slate-200 text-[10px] font-bold hover:bg-slate-600 transition-colors">
                {v.label}
              </button>
            ))}
            <div className="flex-1" />
            {/* Zoom */}
            <button type="button" title="Зголеми" onClick={() => setScale(s => Math.min(100, s+8))} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"><ZoomIn className="w-3.5 h-3.5 text-gray-600"/></button>
            <button type="button" title="Намали" onClick={() => setScale(s => Math.max(20, s-8))}  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"><ZoomOut className="w-3.5 h-3.5 text-gray-600"/></button>
            {/* Labels toggle */}
            <button type="button" onClick={() => setShowLabels(v => !v)}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${showLabels ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
              Ознаки
            </button>
            {/* Cross-section toggle */}
            {meta.hasCrossSection && (
              <button type="button" onClick={() => { setShowCrossSlider(v => !v); if (showCrossSlider) setCrossSection(0); }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${showCrossSlider ? 'bg-yellow-100 text-yellow-700 border-yellow-300' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                Пресек
              </button>
            )}
            {/* Unfolding net toggle */}
            <button type="button"
              onClick={() => setViewMode(v => v === 'net' ? '3d' : 'net')}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${viewMode === 'net' ? 'bg-indigo-100 text-indigo-700 border-indigo-300' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
              Развивка
            </button>
            {/* Reset */}
            <button type="button" title="Ресетирај поглед" onClick={() => { setYaw(PRESET_VIEWS.iso.yaw); setPitch(PRESET_VIEWS.iso.pitch); setScale(55); setDims(SHAPE_DEFAULT_DIMS[shape]); setCrossSection(0); setShowCrossSlider(false); setViewMode('3d'); }}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"><RefreshCw className="w-3.5 h-3.5 text-gray-600"/></button>
            {/* Share URL */}
            <button type="button"
              title="Копирај линк за споделување"
              onClick={() => {
                const url = buildShapeShareUrl(shape, dims);
                void navigator.clipboard.writeText(url).then(() => {
                  setUrlCopied(true);
                  setTimeout(() => setUrlCopied(false), 2500);
                });
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${urlCopied ? 'bg-green-100 text-green-700 border-green-300' : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'}`}>
              {urlCopied ? <CheckCheck className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
              {urlCopied ? 'Копирано!' : 'URL'}
            </button>
          </div>

          {/* Cross-section slider */}
          {showCrossSlider && meta.hasCrossSection && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-bold text-yellow-700 flex-shrink-0">Пресек:</span>
              <input type="range" min={0} max={0.95} step={0.05}
                title="Пресек на телото"
                value={crossSection}
                onChange={e => setCrossSection(parseFloat(e.target.value))}
                className="flex-1 h-1.5 accent-yellow-500" />
              <span className="text-[10px] text-yellow-600 w-8 text-right">{Math.round(crossSection*100)}%</span>
            </div>
          )}
        </div>

        {/* ── Sliders + formulas ─────────────────────────────────────────────── */}
        {!compact && (
          <div className="flex-1 flex flex-col gap-3 min-w-[200px]">
            <div className="flex flex-col gap-2">
              {meta.dims.map(dim => (
                <div key={dim.key}>
                  <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-0.5">
                    <span>{dim.label}</span>
                    <span className="text-blue-600">{dims[dim.key] ?? SHAPE_DEFAULT_DIMS[shape][dim.key] ?? dim.min}</span>
                  </div>
                  <input type="range" min={dim.min} max={dim.max} step={dim.step}
                    title={dim.label}
                    value={dims[dim.key] ?? SHAPE_DEFAULT_DIMS[shape][dim.key] ?? dim.min}
                    onChange={e => setDims(prev => ({ ...prev, [dim.key]: parseFloat(e.target.value) }))}
                    className="w-full h-1.5 rounded-full accent-blue-600" />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-auto">
              <div className="p-3 bg-blue-950 rounded-xl">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Волумен</p>
                <div className="text-blue-100 text-sm"><MathRenderer text={`$${meta.volumeLatex(dims)}$`}/></div>
              </div>
              <div className="p-3 bg-indigo-950 rounded-xl">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Површина</p>
                <div className="text-indigo-100 text-sm"><MathRenderer text={`$${meta.surfaceLatex(dims)}$`}/></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
