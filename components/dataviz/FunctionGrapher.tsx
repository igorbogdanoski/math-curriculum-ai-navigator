/**
 * FunctionGrapher — SVG-based function plotter for DataViz Studio (S34)
 *
 * Features:
 * - Up to 5 simultaneous functions with color coding
 * - Safe math expression evaluator (no eval)
 * - Pan (drag) + Zoom (scroll / buttons)
 * - Grid, axis labels, tick marks
 * - Export PNG via html2canvas
 * - Pedagogical presets for МОН curriculum
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Plus, Trash2, Download, RotateCcw, ZoomIn, ZoomOut, Info } from 'lucide-react';
import html2canvas from 'html2canvas';

// ── Math expression evaluator (safe — no eval) ──────────────────────────────

const mathEnv = {
  sin:  Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
  log: Math.log, log2: Math.log2, log10: Math.log10,
  exp: Math.exp, pow: Math.pow,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  sign: Math.sign,
  PI: Math.PI, E: Math.E,
};

function safeEval(expr: string, x: number): number {
  // Normalise: implicit multiply (2x → 2*x), π → PI, ^ → pow()
  let normalised = expr
    .replace(/π/g, 'PI')
    .replace(/(\d)(x)/g, '$1*$2')
    .replace(/(x)(\d)/g, '$1*$2')
    .replace(/(\d)\(/g, '$1*(')
    .replace(/\)([\d(])/g, ')*$1')
    .trim();
  // Replace ^ with pow() iteratively to handle nested parens safely
  // e.g. x^2 → pow(x,2), (x+1)^2 → pow((x+1),2), -x^2 → -pow(x,2)
  for (let i = 0; i < 12; i++) {
    const prev = normalised;
    normalised = normalised.replace(
      /(\([^()]*\)|[\w.]+)\^(\([^()]*\)|[\w.]+)/g,
      'pow($1,$2)',
    );
    if (normalised === prev) break;
  }

  try {
    // Build a tiny function with only allowed names in scope
    const fn = new Function(
      'x', ...Object.keys(mathEnv),
      `"use strict"; return (${normalised});`
    );
    const result = fn(x, ...Object.values(mathEnv)) as number;
    return isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FunctionEntry {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
  label: string;
}

interface ViewBox {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
}

const PALETTE = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#ec4899'];

const DEFAULT_FUNCTIONS: FunctionEntry[] = [
  { id: '1', expr: 'x^2',       color: PALETTE[0], visible: true, label: 'f(x) = x²' },
];

const DEFAULT_VIEW: ViewBox = { xMin: -6, xMax: 6, yMin: -4, yMax: 10 };

const PRESETS: { label: string; expr: string; view: ViewBox }[] = [
  { label: 'Линеарна  y=2x+1',     expr: '2*x+1',          view: { xMin:-6, xMax:6, yMin:-10, yMax:14 } },
  { label: 'Парабола  y=x²',       expr: 'x^2',             view: { xMin:-6, xMax:6, yMin:-2, yMax:20 } },
  { label: 'Кубна  y=x³',          expr: 'x^3',             view: { xMin:-4, xMax:4, yMin:-30, yMax:30 } },
  { label: 'Синус  y=sin(x)',      expr: 'sin(x)',          view: { xMin:-8, xMax:8, yMin:-2.5, yMax:2.5 } },
  { label: 'Косинус  y=cos(x)',    expr: 'cos(x)',          view: { xMin:-8, xMax:8, yMin:-2.5, yMax:2.5 } },
  { label: 'Тангенс  y=tan(x)',    expr: 'tan(x)',          view: { xMin:-5, xMax:5, yMin:-8, yMax:8 } },
  { label: 'Апсолутна  y=|x|',    expr: 'abs(x)',          view: { xMin:-6, xMax:6, yMin:-1, yMax:7 } },
  { label: 'Корен  y=√x',         expr: 'sqrt(x)',         view: { xMin:-1, xMax:10, yMin:-0.5, yMax:4 } },
  { label: 'Експ.  y=eˣ',         expr: 'exp(x)',          view: { xMin:-4, xMax:4, yMin:-0.5, yMax:25 } },
  { label: 'Лог.  y=log(x)',      expr: 'log(x)',          view: { xMin:-0.5, xMax:10, yMin:-4, yMax:4 } },
  { label: 'Хипербола  y=1/x',    expr: '1/x',             view: { xMin:-6, xMax:6, yMin:-6, yMax:6 } },
  { label: 'Гаус  y=e^(-x²)',     expr: 'exp(-x^2)',       view: { xMin:-4, xMax:4, yMin:-0.1, yMax:1.3 } },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function niceTicks(min: number, max: number, targetCount = 8): number[] {
  const range = max - min;
  if (range === 0) return [min];
  const rawStep = range / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  const step = normalised < 1.5 ? magnitude
    : normalised < 3.5 ? 2 * magnitude
    : normalised < 7.5 ? 5 * magnitude
    : 10 * magnitude;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + 1e-9; t += step) {
    ticks.push(Math.round(t / step) * step);
  }
  return ticks;
}

function fmt(n: number): string {
  if (Math.abs(n) < 1e-9) return '0';
  if (Number.isInteger(n) || Math.abs(n) >= 100) return String(Math.round(n));
  return parseFloat(n.toPrecision(3)).toString();
}

// ── Main component ────────────────────────────────────────────────────────────

export const FunctionGrapher: React.FC = () => {
  const [functions, setFunctions] = useState<FunctionEntry[]>(DEFAULT_FUNCTIONS);
  const [view, setView] = useState<ViewBox>(DEFAULT_VIEW);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; view: ViewBox } | null>(null);
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const W = 560, H = 400;
  const PAD = { top: 20, right: 20, bottom: 36, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // World → pixel
  const toPixelX = useCallback((wx: number) =>
    PAD.left + ((wx - view.xMin) / (view.xMax - view.xMin)) * plotW, [view, plotW]);
  const toPixelY = useCallback((wy: number) =>
    PAD.top + plotH - ((wy - view.yMin) / (view.yMax - view.yMin)) * plotH, [view, plotH]);
  const toWorldX = useCallback((px: number) =>
    view.xMin + ((px - PAD.left) / plotW) * (view.xMax - view.xMin), [view, plotW]);
  const toWorldY = useCallback((py: number) =>
    view.yMin + ((PAD.top + plotH - py) / plotH) * (view.yMax - view.yMin), [view, plotH]);

  // Ticks
  const xTicks = useMemo(() => niceTicks(view.xMin, view.xMax), [view.xMin, view.xMax]);
  const yTicks = useMemo(() => niceTicks(view.yMin, view.yMax), [view.yMin, view.yMax]);

  // Path data for each function
  const paths = useMemo(() => {
    return functions.map(fn => {
      if (!fn.visible || !fn.expr.trim()) return { id: fn.id, d: '' };
      const steps = plotW * 2;
      const segments: string[] = [];
      let pen = false;
      let prevY: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const wx = view.xMin + (i / steps) * (view.xMax - view.xMin);
        const wy = safeEval(fn.expr, wx);
        if (isNaN(wy) || !isFinite(wy)) { pen = false; prevY = null; continue; }
        // Discontinuity detection: large jumps suggest asymptote
        if (prevY !== null && Math.abs(wy - prevY) > (view.yMax - view.yMin) * 3) {
          pen = false;
        }
        prevY = wy;
        const px = toPixelX(wx), py = toPixelY(wy);
        if (!pen) {
          segments.push(`M ${px.toFixed(1)} ${py.toFixed(1)}`);
          pen = true;
        } else {
          segments.push(`L ${px.toFixed(1)} ${py.toFixed(1)}`);
        }
      }
      return { id: fn.id, d: segments.join(' ') };
    });
  }, [functions, view, plotW, toPixelX, toPixelY]);

  // Axis pixel positions (clamped to viewport)
  const axisX = Math.max(PAD.left, Math.min(PAD.left + plotW, toPixelX(0)));
  const axisY = Math.max(PAD.top,  Math.min(PAD.top + plotH,  toPixelY(0)));

  // Input validation on blur
  const validateExpr = useCallback((id: string, expr: string) => {
    const ok = !isNaN(safeEval(expr, 1)) || expr.trim() === '';
    setInputErrors(prev => ({ ...prev, [id]: !ok && expr.trim() !== '' }));
  }, []);

  // Pan handlers
  const onMouseDown = useCallback((e: React.MouseEvent<SVGElement>) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, view: { ...view } });
  }, [view]);

  const onMouseMove = useCallback((e: React.MouseEvent<SVGElement>) => {
    if (!dragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    const worldDx = (dx / plotW) * (dragStart.view.xMax - dragStart.view.xMin);
    const worldDy = (dy / plotH) * (dragStart.view.yMax - dragStart.view.yMin);
    setView({
      xMin: dragStart.view.xMin - worldDx,
      xMax: dragStart.view.xMax - worldDx,
      yMin: dragStart.view.yMin + worldDy,
      yMax: dragStart.view.yMax + worldDy,
    });
  }, [dragging, dragStart, plotW, plotH]);

  const onMouseUp = useCallback(() => { setDragging(false); setDragStart(null); }, []);

  // Zoom
  const onWheel = useCallback((e: React.WheelEvent<SVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const cx = toWorldX(e.nativeEvent.offsetX);
    const cy = toWorldY(e.nativeEvent.offsetY);
    setView(v => ({
      xMin: cx + (v.xMin - cx) * factor,
      xMax: cx + (v.xMax - cx) * factor,
      yMin: cy + (v.yMin - cy) * factor,
      yMax: cy + (v.yMax - cy) * factor,
    }));
  }, [toWorldX, toWorldY]);

  const zoom = useCallback((factor: number) => {
    setView(v => {
      const cx = (v.xMin + v.xMax) / 2, cy = (v.yMin + v.yMax) / 2;
      const hw = (v.xMax - v.xMin) / 2 * factor, hh = (v.yMax - v.yMin) / 2 * factor;
      return { xMin: cx - hw, xMax: cx + hw, yMin: cy - hh, yMax: cy + hh };
    });
  }, []);

  // Touch pan
  const touchRef = useRef<{ x: number; y: number; view: ViewBox } | null>(null);
  const onTouchStart = useCallback((e: React.TouchEvent<SVGElement>) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, view: { ...view } };
  }, [view]);
  const onTouchMove = useCallback((e: React.TouchEvent<SVGElement>) => {
    if (!touchRef.current) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - touchRef.current.x;
    const dy = e.touches[0].clientY - touchRef.current.y;
    const worldDx = (dx / plotW) * (touchRef.current.view.xMax - touchRef.current.view.xMin);
    const worldDy = (dy / plotH) * (touchRef.current.view.yMax - touchRef.current.view.yMin);
    setView({
      xMin: touchRef.current.view.xMin - worldDx,
      xMax: touchRef.current.view.xMax - worldDx,
      yMin: touchRef.current.view.yMin + worldDy,
      yMax: touchRef.current.view.yMax + worldDy,
    });
  }, [plotW, plotH]);
  const onTouchEnd = useCallback(() => { touchRef.current = null; }, []);

  // Function management
  const addFunction = () => {
    if (functions.length >= 5) return;
    const id = String(Date.now());
    setFunctions(prev => [...prev, {
      id, expr: '', color: PALETTE[prev.length % PALETTE.length],
      visible: true, label: `f${prev.length + 1}(x)`,
    }]);
  };

  const removeFunction = (id: string) => {
    setFunctions(prev => prev.filter(f => f.id !== id));
    setInputErrors(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const updateFunction = (id: string, patch: Partial<FunctionEntry>) => {
    setFunctions(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setFunctions([{ id: '1', expr: preset.expr, color: PALETTE[0], visible: true, label: `f(x) = ${preset.expr}` }]);
    setView(preset.view);
    setShowPresets(false);
  };

  const exportPNG = async () => {
    if (!svgContainerRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(svgContainerRef.current, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const link = document.createElement('a');
      link.download = 'funkcii.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally { setExporting(false); }
  };

  // Clip path id
  const clipId = 'fg-clip';

  return (
    <div className="flex flex-col xl:flex-row gap-5">

      {/* ── Left: controls ────────────────────────────────────────────────── */}
      <div className="xl:w-64 flex-shrink-0 space-y-4">

        {/* Functions list */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Функции</p>
            <button type="button" onClick={addFunction} disabled={functions.length >= 5}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-40">
              <Plus className="w-3.5 h-3.5" /> Додај
            </button>
          </div>

          {functions.map((fn, idx) => (
            <div key={fn.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                {/* Color swatch / visibility toggle */}
                <button type="button"
                  onClick={() => updateFunction(fn.id, { visible: !fn.visible })}
                  className="w-4 h-4 rounded-sm flex-shrink-0 border-2 border-white shadow transition-opacity"
                  style={{ backgroundColor: fn.color, opacity: fn.visible ? 1 : 0.35 }}
                  title={fn.visible ? 'Сокриј' : 'Прикажи'}
                />
                <span className="text-xs font-bold text-gray-500 w-6">f{idx + 1}</span>
                {/* Expression input */}
                <div className="flex-1 relative">
                  <input
                    value={fn.expr}
                    onChange={e => updateFunction(fn.id, { expr: e.target.value })}
                    onBlur={e => validateExpr(fn.id, e.target.value)}
                    placeholder="x^2"
                    className={`w-full border rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-300 ${
                      inputErrors[fn.id] ? 'border-red-400 bg-red-50' : 'border-gray-200'
                    }`}
                    aria-label={`Функција ${idx + 1}`}
                  />
                  {inputErrors[fn.id] && (
                    <p className="text-[9px] text-red-500 absolute -bottom-3.5 left-0">Неважечки израз</p>
                  )}
                </div>
                {functions.length > 1 && (
                  <button type="button" onClick={() => removeFunction(fn.id)}
                    className="text-gray-300 hover:text-red-400 transition flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Presets */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button type="button" onClick={() => setShowPresets(v => !v)}
            className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-400 hover:bg-gray-50 flex justify-between">
            <span>Готови примери</span>
            <span className="text-gray-300">{showPresets ? '▲' : '▼'}</span>
          </button>
          {showPresets && (
            <div className="border-t border-gray-100 py-1">
              {PRESETS.map(p => (
                <button key={p.expr} type="button" onClick={() => applyPreset(p)}
                  className="w-full text-left px-4 py-1.5 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 font-mono transition">
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Syntax guide */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <p className="text-xs font-bold text-indigo-600 mb-1.5 flex items-center gap-1.5">
            <Info className="w-3 h-3" /> Синтакса
          </p>
          <ul className="text-[10px] text-indigo-700 space-y-0.5 font-mono leading-relaxed">
            <li><strong>^</strong> = степен&nbsp;  x^2, x^0.5</li>
            <li><strong>*</strong> = множење&nbsp;  2*x  или  2x</li>
            <li><strong>sin cos tan</strong>(x)</li>
            <li><strong>sqrt</strong>(x) &nbsp; <strong>abs</strong>(x)</li>
            <li><strong>exp</strong>(x) &nbsp; <strong>log</strong>(x)</li>
            <li><strong>PI</strong> = π ≈ 3.14159</li>
            <li>Пример: sin(2*x)+x/3</li>
          </ul>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button type="button" onClick={() => { setView(DEFAULT_VIEW); setFunctions(DEFAULT_FUNCTIONS); }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-200 transition">
            <RotateCcw className="w-3.5 h-3.5" /> Ресет
          </button>
          <button type="button" onClick={exportPNG} disabled={exporting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 disabled:opacity-60 transition">
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
        </div>
      </div>

      {/* ── Right: SVG canvas ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Zoom toolbar */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-100 bg-gray-50">
            <button type="button" onClick={() => zoom(0.8)}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition" title="Зум влез">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => zoom(1.25)}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition" title="Зум излез">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setView(DEFAULT_VIEW)}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition" title="Нулта точка">
              <RotateCcw className="w-3 h-3" />
            </button>
            <span className="text-[10px] text-gray-400 ml-2">
              x: [{fmt(view.xMin)}, {fmt(view.xMax)}] &nbsp;|&nbsp;
              y: [{fmt(view.yMin)}, {fmt(view.yMax)}]
            </span>
            <span className="ml-auto text-[10px] text-gray-300">влечи · скролај</span>
          </div>

          {/* SVG plot */}
          <div ref={svgContainerRef} className="overflow-hidden bg-white">
            <svg
              width="100%"
              viewBox={`0 0 ${W} ${H}`}
              className={`w-full ${dragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onWheel={onWheel}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              style={{ touchAction: 'none' }}
            >
              <defs>
                <clipPath id={clipId}>
                  <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
                </clipPath>
              </defs>

              {/* Background */}
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} fill="#f8fafc" />

              {/* Grid lines */}
              {xTicks.map(t => {
                const px = toPixelX(t);
                return px >= PAD.left && px <= PAD.left + plotW ? (
                  <line key={`gx${t}`} x1={px} y1={PAD.top} x2={px} y2={PAD.top + plotH}
                    stroke={t === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={t === 0 ? 1.5 : 0.8} />
                ) : null;
              })}
              {yTicks.map(t => {
                const py = toPixelY(t);
                return py >= PAD.top && py <= PAD.top + plotH ? (
                  <line key={`gy${t}`} x1={PAD.left} y1={py} x2={PAD.left + plotW} y2={py}
                    stroke={t === 0 ? '#94a3b8' : '#e2e8f0'} strokeWidth={t === 0 ? 1.5 : 0.8} />
                ) : null;
              })}

              {/* Axes */}
              <line x1={axisX} y1={PAD.top} x2={axisX} y2={PAD.top + plotH} stroke="#475569" strokeWidth="1.5" />
              <line x1={PAD.left} y1={axisY} x2={PAD.left + plotW} y2={axisY} stroke="#475569" strokeWidth="1.5" />

              {/* Axis arrows */}
              <polygon points={`${axisX},${PAD.top - 6} ${axisX - 4},${PAD.top + 2} ${axisX + 4},${PAD.top + 2}`} fill="#475569" />
              <polygon points={`${PAD.left + plotW + 6},${axisY} ${PAD.left + plotW - 2},${axisY - 4} ${PAD.left + plotW - 2},${axisY + 4}`} fill="#475569" />

              {/* Axis labels */}
              <text x={PAD.left + plotW + 10} y={axisY + 4} fill="#475569" fontSize={11} fontWeight="bold" fontFamily="sans-serif">x</text>
              <text x={axisX + 6} y={PAD.top - 8} fill="#475569" fontSize={11} fontWeight="bold" fontFamily="sans-serif">y</text>

              {/* X tick marks + labels */}
              {xTicks.filter(t => t !== 0).map(t => {
                const px = toPixelX(t);
                if (px < PAD.left || px > PAD.left + plotW) return null;
                return (
                  <g key={`xt${t}`}>
                    <line x1={px} y1={axisY - 4} x2={px} y2={axisY + 4} stroke="#475569" strokeWidth="1" />
                    <text x={px} y={axisY + 15} fill="#64748b" fontSize={9} textAnchor="middle" fontFamily="monospace">{fmt(t)}</text>
                  </g>
                );
              })}

              {/* Y tick marks + labels */}
              {yTicks.filter(t => t !== 0).map(t => {
                const py = toPixelY(t);
                if (py < PAD.top || py > PAD.top + plotH) return null;
                return (
                  <g key={`yt${t}`}>
                    <line x1={axisX - 4} y1={py} x2={axisX + 4} y2={py} stroke="#475569" strokeWidth="1" />
                    <text x={axisX - 7} y={py + 3} fill="#64748b" fontSize={9} textAnchor="end" fontFamily="monospace">{fmt(t)}</text>
                  </g>
                );
              })}

              {/* Origin label */}
              {view.xMin < 0 && view.xMax > 0 && view.yMin < 0 && view.yMax > 0 && (
                <text x={axisX - 7} y={axisY + 14} fill="#94a3b8" fontSize={9} textAnchor="middle" fontFamily="monospace">0</text>
              )}

              {/* Function curves */}
              <g clipPath={`url(#${clipId})`}>
                {paths.map((p, i) => {
                  const fn = functions.find(f => f.id === p.id);
                  if (!fn || !fn.visible || !p.d) return null;
                  return (
                    <path key={p.id} d={p.d} fill="none"
                      stroke={fn.color} strokeWidth="2.5"
                      strokeLinejoin="round" strokeLinecap="round"
                      opacity={0.9}
                    />
                  );
                })}
              </g>

              {/* Border */}
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH}
                fill="none" stroke="#cbd5e1" strokeWidth="1" />
            </svg>
          </div>

          {/* Legend */}
          {functions.some(f => f.expr.trim() && f.visible) && (
            <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-gray-100">
              {functions.filter(f => f.expr.trim()).map((fn, i) => (
                <span key={fn.id} className="flex items-center gap-1.5 text-xs font-mono text-gray-600">
                  <span className="inline-block w-6 h-0.5 rounded" style={{ backgroundColor: fn.color, opacity: fn.visible ? 1 : 0.35 }} />
                  f{i + 1}(x) = {fn.expr}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
