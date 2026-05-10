/**
 * ConicSectionsLab — S62-G1/G2/G3
 *
 * Interactive conic sections with live sliders:
 *   G1: Ellipse, hyperbola, parabola — foci, directrix, asymptotes in real time
 *   G2: Rotation by angle θ via requestAnimationFrame Play/Pause animation
 *
 * Equation forms:
 *   Ellipse:   (x-h)²/a² + (y-k)²/b² = 1  [a≥b>0]
 *   Hyperbola: (x-h)²/a² - (y-k)²/b² = 1  [a,b>0]
 *   Parabola:  y = a(x-h)² + k             [a≠0]
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const W = 460, H = 360;
const PAD = { top: 20, right: 20, bottom: 28, left: 36 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top  - PAD.bottom;

type ConicType = 'ellipse' | 'hyperbola' | 'parabola';

function toSVG(x: number, y: number, xMin: number, xMax: number, yMin: number, yMax: number) {
  return {
    sx: PAD.left + ((x - xMin) / (xMax - xMin)) * PLOT_W,
    sy: PAD.top  + PLOT_H - ((y - yMin) / (yMax - yMin)) * PLOT_H,
  };
}

function buildPath(
  f: (x: number) => number,
  xMin: number, xMax: number, yMin: number, yMax: number, steps = 400,
): string {
  let d = ''; let pen = false;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + (i / steps) * (xMax - xMin);
    const y = f(x);
    if (!isFinite(y) || y < yMin - 1 || y > yMax + 1) { pen = false; continue; }
    const { sx, sy } = toSVG(x, y, xMin, xMax, yMin, yMax);
    d += `${pen ? 'L' : 'M'}${sx.toFixed(1)},${sy.toFixed(1)} `;
    pen = true;
  }
  return d.trim();
}

function buildPathFromPoints(
  pts: [number, number][],
  xMin: number, xMax: number, yMin: number, yMax: number,
): string {
  let d = ''; let pen = false;
  for (const [x, y] of pts) {
    if (!isFinite(y) || y < yMin - 1 || y > yMax + 1) { pen = false; continue; }
    const { sx, sy } = toSVG(x, y, xMin, xMax, yMin, yMax);
    d += `${pen ? 'L' : 'M'}${sx.toFixed(1)},${sy.toFixed(1)} `;
    pen = true;
  }
  return d.trim();
}

/** Rotate point (x,y) by angle θ (radians) around origin. */
function rotate(x: number, y: number, theta: number): [number, number] {
  const c = Math.cos(theta), s = Math.sin(theta);
  return [c * x - s * y, s * x + c * y];
}

function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  return parseFloat(n.toFixed(3)).toString();
}

// ─── Grid + Axes ──────────────────────────────────────────────────────────────
function Grid({ xMin, xMax, yMin, yMax }: { xMin: number; xMax: number; yMin: number; yMax: number }) {
  const ticks = Array.from({ length: 11 }, (_, i) => Math.round(xMin) + i);
  const o = toSVG(0, 0, xMin, xMax, yMin, yMax);
  return (
    <>
      {ticks.map(v => {
        const { sx } = toSVG(v, 0, xMin, xMax, yMin, yMax);
        const { sy } = toSVG(0, v, xMin, xMax, yMin, yMax);
        return (
          <g key={v}>
            {sx >= PAD.left && sx <= W - PAD.right && (
              <>
                <line x1={sx} y1={PAD.top} x2={sx} y2={H - PAD.bottom} stroke="#f1f5f9" strokeWidth={1} />
                {v !== 0 && <text x={sx} y={H - PAD.bottom + 11} textAnchor="middle" fontSize={8} fill="#94a3b8">{v}</text>}
              </>
            )}
            {sy >= PAD.top && sy <= H - PAD.bottom && (
              <>
                <line x1={PAD.left} y1={sy} x2={W - PAD.right} y2={sy} stroke="#f1f5f9" strokeWidth={1} />
                {v !== 0 && <text x={PAD.left - 3} y={sy + 3} textAnchor="end" fontSize={8} fill="#94a3b8">{v}</text>}
              </>
            )}
          </g>
        );
      })}
      <line x1={PAD.left} y1={o.sy} x2={W - PAD.right} y2={o.sy} stroke="#cbd5e1" strokeWidth={1} />
      <line x1={o.sx} y1={PAD.top} x2={o.sx} y2={H - PAD.bottom} stroke="#cbd5e1" strokeWidth={1} />
    </>
  );
}

// ─── Slider row ───────────────────────────────────────────────────────────────
function Slider({ label, value, min, max, step, onChange, color = 'indigo' }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
      <span className="w-16 text-right">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className={`flex-1 accent-${color}-500`} aria-label={label} />
      <span className={`w-10 font-bold font-mono text-${color}-700`}>{fmt(value)}</span>
    </label>
  );
}

// ─── Ellipse ──────────────────────────────────────────────────────────────────
function EllipseLab() {
  const [a, setA] = useState(3); const [b, setB] = useState(2);
  const [h, setH] = useState(0); const [k, setK] = useState(0);
  const [theta, setTheta] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const thetaRef = useRef(theta);

  useEffect(() => { thetaRef.current = theta; }, [theta]);

  const animate = useCallback(() => {
    thetaRef.current = (thetaRef.current + 0.01) % (2 * Math.PI);
    setTheta(parseFloat(thetaRef.current.toFixed(4)));
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (playing) rafRef.current = requestAnimationFrame(animate);
    else if (rafRef.current) cancelAnimationFrame(rafRef.current);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, animate]);

  const c = Math.sqrt(Math.max(0, a * a - b * b)); // focal distance
  const ecc = a > 0 ? c / a : 0;

  const xRange = a + Math.abs(h) + 1;
  const yRange = b + Math.abs(k) + 1;
  const bound = Math.max(xRange, yRange, 3);
  const xMin = -bound - 0.5, xMax = bound + 0.5, yMin = -bound - 0.5, yMax = bound + 0.5;

  // Parametric ellipse points rotated by theta around (h,k)
  const pts: [number, number][] = useMemo(() => {
    return Array.from({ length: 361 }, (_, i) => {
      const t = (i / 360) * 2 * Math.PI;
      const px = a * Math.cos(t), py = b * Math.sin(t);
      const [rx, ry] = rotate(px, py, theta);
      return [h + rx, k + ry] as [number, number];
    });
  }, [a, b, h, k, theta]);

  // Foci (rotated)
  const [f1x, f1y] = rotate(c, 0, theta);
  const [f2x, f2y] = rotate(-c, 0, theta);

  const curvePath = buildPathFromPoints(pts, xMin, xMax, yMin, yMax);
  const f1svg = toSVG(h + f1x, k + f1y, xMin, xMax, yMin, yMax);
  const f2svg = toSVG(h + f2x, k + f2y, xMin, xMax, yMin, yMax);
  const ctrSvg = toSVG(h, k, xMin, xMax, yMin, yMax);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 bg-white rounded-xl border border-gray-200 p-3">
        <Slider label="a (semi-a)" value={a} min={0.5} max={5} step={0.1} onChange={v => setA(Math.max(v, b))} color="violet" />
        <Slider label="b (semi-b)" value={b} min={0.1} max={5} step={0.1} onChange={v => setB(Math.min(v, a))} color="violet" />
        <Slider label="h (x-shift)" value={h} min={-3} max={3} step={0.1} onChange={setH} color="sky" />
        <Slider label="k (y-shift)" value={k} min={-3} max={3} step={0.1} onChange={setK} color="sky" />
        <div className="flex items-center gap-2">
          <Slider label="θ (rot)" value={theta} min={0} max={2 * Math.PI} step={0.05} onChange={setTheta} color="amber" />
          <button type="button" onClick={() => setPlaying(v => !v)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${playing ? 'border-red-400 bg-red-50 text-red-600' : 'border-amber-400 bg-amber-50 text-amber-700'}`}>
            {playing ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {[
          { l: 'c (focal dist)', v: fmt(c), cl: 'violet' },
          { l: 'Eccentricity e', v: fmt(ecc), cl: 'violet' },
          { l: 'Periмeter ≈', v: `${fmt(Math.PI * (3*(a+b) - Math.sqrt((3*a+b)*(a+3*b))))}`  , cl: 'gray' },
        ].map(({ l, v, cl }) => (
          <div key={l} className={`rounded-lg border border-${cl}-200 bg-${cl}-50 p-2`}>
            <p className="text-[9px] text-gray-400">{l}</p>
            <p className={`font-extrabold text-${cl}-700 font-mono`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[280px]">
          <Grid xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} />
          <path d={curvePath} fill="none" stroke="#7c3aed" strokeWidth={2.5} />
          <circle cx={f1svg.sx} cy={f1svg.sy} r={4} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
          <circle cx={f2svg.sx} cy={f2svg.sy} r={4} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
          <circle cx={ctrSvg.sx} cy={ctrSvg.sy} r={3} fill="#6b7280" />
          <text x={f1svg.sx + 6} y={f1svg.sy - 4} fontSize={9} fill="#f59e0b" fontWeight="bold">F₁</text>
          <text x={f2svg.sx + 6} y={f2svg.sy - 4} fontSize={9} fill="#f59e0b" fontWeight="bold">F₂</text>
        </svg>
      </div>
      <p className="text-[10px] text-gray-500 bg-violet-50 rounded-lg p-2 border border-violet-100">
        <strong>Елипса:</strong> (x−{h})²/{a}² + (y−{k})²/{b}² = 1 &nbsp;|&nbsp;
        PF₁ + PF₂ = 2a = {fmt(2*a)} за секоја точка P
      </p>
    </div>
  );
}

// ─── Hyperbola ────────────────────────────────────────────────────────────────
function HyperbolaLab() {
  const [a, setA] = useState(2); const [b, setB] = useState(1.5);
  const [h, setH] = useState(0); const [k, setK] = useState(0);
  const [theta, setTheta] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const thetaRef = useRef(theta);

  useEffect(() => { thetaRef.current = theta; }, [theta]);

  const animate = useCallback(() => {
    thetaRef.current = (thetaRef.current + 0.008) % (2 * Math.PI);
    setTheta(parseFloat(thetaRef.current.toFixed(4)));
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (playing) rafRef.current = requestAnimationFrame(animate);
    else if (rafRef.current) cancelAnimationFrame(rafRef.current);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, animate]);

  const c = Math.sqrt(a * a + b * b);
  const slope = b / a;
  const bound = Math.max(a + Math.abs(h), b + Math.abs(k), 4) + 1;
  const xMin = -bound, xMax = bound, yMin = -bound, yMax = bound;

  // Parametric hyperbola (two branches)
  const branch1: [number, number][] = Array.from({ length: 200 }, (_, i) => {
    const t = -Math.PI / 2 + (i / 199) * Math.PI;
    const px = a / Math.cos(t), py = b * Math.tan(t);
    const [rx, ry] = rotate(px, py, theta);
    return [h + rx, k + ry] as [number, number];
  });
  const branch2: [number, number][] = branch1.map(([x, y]) => {
    const [rx, ry] = rotate(x - h, y - k, Math.PI);
    return [h + rx, k + ry] as [number, number];
  });

  // Asymptotes
  const asym1Path = (() => {
    const [ax1, ay1] = rotate(-bound, -slope * bound, theta);
    const [ax2, ay2] = rotate(bound, slope * bound, theta);
    const p1 = toSVG(h + ax1, k + ay1, xMin, xMax, yMin, yMax);
    const p2 = toSVG(h + ax2, k + ay2, xMin, xMax, yMin, yMax);
    return `M${p1.sx.toFixed(1)},${p1.sy.toFixed(1)} L${p2.sx.toFixed(1)},${p2.sy.toFixed(1)}`;
  })();
  const asym2Path = (() => {
    const [ax1, ay1] = rotate(-bound, slope * bound, theta);
    const [ax2, ay2] = rotate(bound, -slope * bound, theta);
    const p1 = toSVG(h + ax1, k + ay1, xMin, xMax, yMin, yMax);
    const p2 = toSVG(h + ax2, k + ay2, xMin, xMax, yMin, yMax);
    return `M${p1.sx.toFixed(1)},${p1.sy.toFixed(1)} L${p2.sx.toFixed(1)},${p2.sy.toFixed(1)}`;
  })();

  const [f1x, f1y] = rotate(c, 0, theta);
  const [f2x, f2y] = rotate(-c, 0, theta);
  const f1svg = toSVG(h + f1x, k + f1y, xMin, xMax, yMin, yMax);
  const f2svg = toSVG(h + f2x, k + f2y, xMin, xMax, yMin, yMax);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 bg-white rounded-xl border border-gray-200 p-3">
        <Slider label="a" value={a} min={0.5} max={4} step={0.1} onChange={setA} color="rose" />
        <Slider label="b" value={b} min={0.1} max={4} step={0.1} onChange={setB} color="rose" />
        <Slider label="h" value={h} min={-3} max={3} step={0.1} onChange={setH} color="sky" />
        <Slider label="k" value={k} min={-3} max={3} step={0.1} onChange={setK} color="sky" />
        <div className="flex items-center gap-2">
          <Slider label="θ" value={theta} min={0} max={2 * Math.PI} step={0.05} onChange={setTheta} color="amber" />
          <button type="button" onClick={() => setPlaying(v => !v)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${playing ? 'border-red-400 bg-red-50 text-red-600' : 'border-amber-400 bg-amber-50 text-amber-700'}`}>
            {playing ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[280px]">
          <Grid xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} />
          <path d={asym1Path} stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 3" fill="none" />
          <path d={asym2Path} stroke="#94a3b8" strokeWidth={1} strokeDasharray="5 3" fill="none" />
          <path d={buildPathFromPoints(branch1, xMin, xMax, yMin, yMax)} fill="none" stroke="#e11d48" strokeWidth={2.5} />
          <path d={buildPathFromPoints(branch2, xMin, xMax, yMin, yMax)} fill="none" stroke="#e11d48" strokeWidth={2.5} />
          <circle cx={f1svg.sx} cy={f1svg.sy} r={4} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
          <circle cx={f2svg.sx} cy={f2svg.sy} r={4} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
          <text x={f1svg.sx + 6} y={f1svg.sy - 4} fontSize={9} fill="#f59e0b" fontWeight="bold">F₁</text>
          <text x={f2svg.sx + 6} y={f2svg.sy - 4} fontSize={9} fill="#f59e0b" fontWeight="bold">F₂</text>
        </svg>
      </div>
      <p className="text-[10px] text-gray-500 bg-rose-50 rounded-lg p-2 border border-rose-100">
        <strong>Хипербола:</strong> (x−{h})²/{a}² − (y−{k})²/{b}² = 1 &nbsp;|&nbsp;
        Асимптоти: y = ±{fmt(slope)}(x−{h}) + {k} &nbsp;|&nbsp; c = {fmt(c)}, e = {fmt(c/a)}
      </p>
    </div>
  );
}

// ─── Parabola ─────────────────────────────────────────────────────────────────
function ParabolaLab() {
  const [a, setA] = useState(0.5);
  const [h, setH] = useState(0); const [k, setK] = useState(0);
  const [theta, setTheta] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const thetaRef = useRef(theta);

  useEffect(() => { thetaRef.current = theta; }, [theta]);

  const animate = useCallback(() => {
    thetaRef.current = (thetaRef.current + 0.008) % (2 * Math.PI);
    setTheta(parseFloat(thetaRef.current.toFixed(4)));
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (playing) rafRef.current = requestAnimationFrame(animate);
    else if (rafRef.current) cancelAnimationFrame(rafRef.current);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, animate]);

  const p = 1 / (4 * Math.abs(a)); // focal length
  const focusY = a > 0 ? k + p : k - p;
  const directrixY = a > 0 ? k - p : k + p;

  const bound = Math.max(5, Math.abs(h) + 4, Math.abs(k) + 4);
  const xMin = -bound, xMax = bound, yMin = -bound, yMax = bound;

  // Build rotated parabola points
  const pts: [number, number][] = Array.from({ length: 300 }, (_, i) => {
    const x = xMin + (i / 299) * (xMax - xMin);
    const y = a * (x - h) * (x - h) + k;
    const [rx, ry] = rotate(x - h, y - k, theta);
    return [h + rx, k + ry] as [number, number];
  });

  const focusSvg = (() => {
    const [rx, ry] = rotate(0, focusY - k, theta);
    return toSVG(h + rx, k + ry, xMin, xMax, yMin, yMax);
  })();

  // Directrix line (rotated)
  const dirPath = (() => {
    const dy = directrixY - k;
    const [ax, ay] = rotate(-bound, dy, theta);
    const [bx, by] = rotate(bound, dy, theta);
    const p1 = toSVG(h + ax, k + ay, xMin, xMax, yMin, yMax);
    const p2 = toSVG(h + bx, k + by, xMin, xMax, yMin, yMax);
    return `M${p1.sx.toFixed(1)},${p1.sy.toFixed(1)} L${p2.sx.toFixed(1)},${p2.sy.toFixed(1)}`;
  })();

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 bg-white rounded-xl border border-gray-200 p-3">
        <Slider label="a" value={a} min={-2} max={2} step={0.05} onChange={v => setA(Math.abs(v) < 0.05 ? 0.05 : v)} color="emerald" />
        <Slider label="h" value={h} min={-3} max={3} step={0.1} onChange={setH} color="sky" />
        <Slider label="k" value={k} min={-3} max={3} step={0.1} onChange={setK} color="sky" />
        <div className="flex items-center gap-2">
          <Slider label="θ" value={theta} min={0} max={2 * Math.PI} step={0.05} onChange={setTheta} color="amber" />
          <button type="button" onClick={() => setPlaying(v => !v)}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${playing ? 'border-red-400 bg-red-50 text-red-600' : 'border-amber-400 bg-amber-50 text-amber-700'}`}>
            {playing ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-h-[280px]">
          <Grid xMin={xMin} xMax={xMax} yMin={yMin} yMax={yMax} />
          <path d={dirPath} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" fill="none" />
          <path d={buildPathFromPoints(pts, xMin, xMax, yMin, yMax)} fill="none" stroke="#059669" strokeWidth={2.5} />
          <circle cx={focusSvg.sx} cy={focusSvg.sy} r={4.5} fill="#f59e0b" stroke="white" strokeWidth={1.5} />
          <text x={focusSvg.sx + 6} y={focusSvg.sy - 4} fontSize={9} fill="#f59e0b" fontWeight="bold">F</text>
        </svg>
      </div>
      <p className="text-[10px] text-gray-500 bg-emerald-50 rounded-lg p-2 border border-emerald-100">
        <strong>Парабола:</strong> y = {a}(x−{h})² + {k} &nbsp;|&nbsp;
        Фокус: ({h}, {fmt(focusY)}) &nbsp;|&nbsp; Директриса: y = {fmt(directrixY)} &nbsp;|&nbsp; p = {fmt(p)}
      </p>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
const CONIC_TABS: { id: ConicType; label: string; color: string }[] = [
  { id: 'ellipse',   label: 'Елипса',   color: 'violet' },
  { id: 'hyperbola', label: 'Хипербола', color: 'rose'   },
  { id: 'parabola',  label: 'Парабола', color: 'emerald' },
];

export function ConicSectionsLab() {
  const [tab, setTab] = useState<ConicType>('ellipse');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {CONIC_TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === t.id ? `border-${t.color}-500 bg-${t.color}-50 text-${t.color}-700` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'ellipse'   && <EllipseLab />}
      {tab === 'hyperbola' && <HyperbolaLab />}
      {tab === 'parabola'  && <ParabolaLab />}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
        <strong>Конусни пресеци</strong> — секции на конус со рамнина под различен агол. &nbsp;
        Употреба: орбити на планети (елипса), хиперболични патеки на комети, параболични антени. &nbsp;
        <strong>θ = </strong> агол на ротација — притисни ▶ за анимација.
      </div>
    </div>
  );
}
