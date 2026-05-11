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

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { Plus, Trash2, Download, RotateCcw, ZoomIn, ZoomOut, Info, Hash } from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  durandKerner, polyHorner, sortRoots, isRealRoot, cxFmt,
  type Cx,
} from '../../utils/polynomialRoots';

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

// CSP-safe recursive descent parser — used as fallback when new Function() is blocked.
function _evalFallback(expr: string, xVal: number): number {
  let pos = 0;
  const s = expr;
  const ws = () => { while (pos < s.length && (s[pos] === ' ' || s[pos] === '\t')) pos++; };

  const E = (): number => {
    let v = T();
    ws();
    while (pos < s.length) {
      if (s[pos] === '+') { pos++; v += T(); ws(); }
      else if (s[pos] === '-') { pos++; v -= T(); ws(); }
      else break;
    }
    return v;
  };
  const T = (): number => {
    let v = U();
    ws();
    while (pos < s.length) {
      if (s[pos] === '*') { pos++; v *= U(); ws(); }
      else if (s[pos] === '/') { pos++; const d = U(); v = d === 0 ? NaN : v / d; ws(); }
      else break;
    }
    return v;
  };
  const U = (): number => { ws(); if (pos < s.length && s[pos] === '-') { pos++; return -U(); } return P(); };
  const P = (): number => {
    ws();
    // Number literal
    if (pos < s.length && (s[pos] >= '0' && s[pos] <= '9' || s[pos] === '.')) {
      const start = pos;
      while (pos < s.length && (s[pos] >= '0' && s[pos] <= '9' || s[pos] === '.')) pos++;
      if (pos < s.length && (s[pos] === 'e' || s[pos] === 'E')) {
        pos++;
        if (pos < s.length && (s[pos] === '+' || s[pos] === '-')) pos++;
        while (pos < s.length && s[pos] >= '0' && s[pos] <= '9') pos++;
      }
      return parseFloat(s.slice(start, pos));
    }
    // Identifier: variable, constant or function call
    if (pos < s.length && (s[pos] >= 'a' && s[pos] <= 'z' || s[pos] >= 'A' && s[pos] <= 'Z' || s[pos] === '_')) {
      const start = pos;
      while (pos < s.length && (s[pos] >= 'a' && s[pos] <= 'z' || s[pos] >= 'A' && s[pos] <= 'Z' || s[pos] >= '0' && s[pos] <= '9' || s[pos] === '_')) pos++;
      const name = s.slice(start, pos);
      ws();
      if (pos < s.length && s[pos] === '(' && name in mathEnv && typeof (mathEnv as Record<string, unknown>)[name] === 'function') {
        pos++;
        const args = [E()];
        while (pos < s.length && s[pos] === ',') { pos++; args.push(E()); }
        if (pos < s.length && s[pos] === ')') pos++;
        const fn2 = (mathEnv as unknown as Record<string, (...a: number[]) => number>)[name];
        return fn2(...args);
      }
      if (name === 'x') return xVal;
      if (name === 'PI' || name === 'pi') return Math.PI;
      if (name === 'E') return Math.E;
      return NaN;
    }
    // Parenthesised sub-expression
    if (pos < s.length && s[pos] === '(') {
      pos++;
      const v = E();
      if (pos < s.length && s[pos] === ')') pos++;
      return v;
    }
    return NaN;
  };
  try { const r = E(); return isFinite(r) ? r : NaN; } catch { return NaN; }
}

// Converts common raw expressions to a nicer display string for the legend.
function prettyExpr(expr: string): string {
  return expr
    .replace(/pow\(x,\s*2\)/g, 'x²').replace(/pow\(x,\s*3\)/g, 'x³')
    .replace(/pow\(([^,]+),\s*2\)/g, '($1)²').replace(/pow\(([^,]+),\s*3\)/g, '($1)³')
    .replace(/\^2\b/g, '²').replace(/\^3\b/g, '³')
    .replace(/sqrt\(([^)]+)\)/g, '√($1)').replace(/abs\(([^)]+)\)/g, '|$1|')
    .replace(/\bPI\b/g, 'π').replace(/\bE\b/g, 'e')
    .replace(/\*/g, '·');
}

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
  // CSP in vercel.json omits 'unsafe-eval', so new Function() is blocked on production.
  // Always use the recursive-descent fallback parser which is CSP-safe.
  return _evalFallback(normalised, x);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type IneqOp = 'none' | '<' | '<=' | '>' | '>=';

export interface FunctionEntry {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
  label: string;
  ineqOp?: IneqOp;
}

interface ViewBox {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
}

const PALETTE = ['#6366f1', '#ef4444', '#22c55e', '#f59e0b', '#ec4899'];

const PALETTE_BG: Record<string, string> = {
  '#6366f1': 'bg-[#6366f1]',
  '#ef4444': 'bg-[#ef4444]',
  '#22c55e': 'bg-[#22c55e]',
  '#f59e0b': 'bg-[#f59e0b]',
  '#ec4899': 'bg-[#ec4899]',
};

const INEQ_OPS: { key: IneqOp; sym: string }[] = [
  { key: 'none', sym: '—' },
  { key: '<',  sym: '<' },
  { key: '<=', sym: '≤' },
  { key: '>',  sym: '>' },
  { key: '>=', sym: '≥' },
];

const DEFAULT_FUNCTIONS: FunctionEntry[] = [
  { id: '1', expr: 'x^2', color: PALETTE[0], visible: true, label: 'f(x) = x²', ineqOp: 'none' },
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

  // H3: Polynomial root finder state
  const [showRoots, setShowRoots] = useState(false);
  const [polyDeg, setPolyDeg] = useState(2);
  const [polyCoeffs, setPolyCoeffs] = useState<number[]>([1, 0, -4]); // x²-4
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

  // Path data for each function (curve + optional inequality fill polygons)
  const paths = useMemo(() => {
    const topY  = PAD.top;
    const botY  = PAD.top + plotH;

    return functions.map(fn => {
      if (!fn.visible || !fn.expr.trim()) return { id: fn.id, d: '', fills: [] };
      const steps = plotW * 2;

      // Collect continuous point segments (each a {px,py}[] array)
      const allSeg: Array<Array<{px: number; py: number}>> = [];
      let cur: Array<{px: number; py: number}> = [];
      let prevY: number | null = null;

      for (let i = 0; i <= steps; i++) {
        const wx = view.xMin + (i / steps) * (view.xMax - view.xMin);
        const wy = safeEval(fn.expr, wx);
        if (isNaN(wy) || !isFinite(wy)) {
          if (cur.length) { allSeg.push(cur); cur = []; }
          prevY = null;
          continue;
        }
        if (prevY !== null && Math.abs(wy - prevY) > (view.yMax - view.yMin) * 3) {
          if (cur.length) { allSeg.push(cur); cur = []; }
        }
        prevY = wy;
        cur.push({ px: toPixelX(wx), py: toPixelY(wy) });
      }
      if (cur.length) allSeg.push(cur);

      // Build curve path string
      const curveParts: string[] = [];
      for (const seg of allSeg) {
        curveParts.push(`M ${seg[0].px.toFixed(1)} ${seg[0].py.toFixed(1)}`);
        for (let k = 1; k < seg.length; k++) {
          curveParts.push(`L ${seg[k].px.toFixed(1)} ${seg[k].py.toFixed(1)}`);
        }
      }

      // Build inequality fill polygons (one per continuous segment)
      const fills: string[] = [];
      const op = fn.ineqOp ?? 'none';
      if (op !== 'none') {
        const edgeY = (op === '<' || op === '<=') ? botY : topY;
        for (const seg of allSeg) {
          if (seg.length < 2) continue;
          const first = seg[0], last = seg[seg.length - 1];
          const curveCmds = seg
            .map((p, k) => `${k === 0 ? 'M' : 'L'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`)
            .join(' ');
          fills.push(
            `${curveCmds} ` +
            `L ${last.px.toFixed(1)} ${edgeY.toFixed(1)} ` +
            `L ${first.px.toFixed(1)} ${edgeY.toFixed(1)} Z`
          );
        }
      }

      return { id: fn.id, d: curveParts.join(' '), fills };
    });
  }, [functions, view, plotW, plotH, toPixelX, toPixelY]);

  // H3: polynomial roots + SVG poly path
  const polyRoots = useMemo<Cx[]>(() => {
    if (!showRoots || polyCoeffs.length < 2 || polyCoeffs[0] === 0) return [];
    try { return sortRoots(durandKerner(polyCoeffs)); } catch { return []; }
  }, [showRoots, polyCoeffs]);

  const polyPath = useMemo<string>(() => {
    if (!showRoots || polyCoeffs.length < 2 || polyCoeffs[0] === 0) return '';
    const steps = plotW * 2;
    const parts: string[] = [];
    let pen = false;
    let prevY: number | null = null;
    for (let i = 0; i <= steps; i++) {
      const wx = view.xMin + (i / steps) * (view.xMax - view.xMin);
      const wy = polyHorner(polyCoeffs, wx);
      if (!isFinite(wy)) { pen = false; prevY = null; continue; }
      if (prevY !== null && Math.abs(wy - prevY) > (view.yMax - view.yMin) * 3) pen = false;
      prevY = wy;
      const px = toPixelX(wx), py = toPixelY(wy);
      parts.push(pen ? `L ${px.toFixed(1)} ${py.toFixed(1)}` : `M ${px.toFixed(1)} ${py.toFixed(1)}`);
      pen = true;
    }
    return parts.join(' ');
  }, [showRoots, polyCoeffs, view, plotW, toPixelX, toPixelY]);

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
    // Pick a default expression that varies so the user immediately sees a curve.
    const DEFAULT_EXPRS = ['x', 'x^2', 'x^3', 'sin(x)', 'cos(x)'];
    const usedExprs = new Set(functions.map(f => f.expr.trim()));
    const fallback = DEFAULT_EXPRS.find(e => !usedExprs.has(e)) ?? `${functions.length + 1}*x`;
    setFunctions(prev => [...prev, {
      id, expr: fallback, color: PALETTE[prev.length % PALETTE.length],
      visible: true, label: `f${prev.length + 1}(x)`, ineqOp: 'none',
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
    setFunctions([{ id: '1', expr: preset.expr, color: PALETTE[0], visible: true, label: `f(x) = ${preset.expr}`, ineqOp: 'none' }]);
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
                  className={`w-4 h-4 rounded-sm flex-shrink-0 border-2 border-white shadow transition-opacity ${PALETTE_BG[fn.color] ?? 'bg-gray-400'} ${fn.visible ? 'opacity-100' : 'opacity-[0.35]'}`}
                  title={fn.visible ? 'Сокриј' : 'Прикажи'}
                  aria-label={fn.visible ? `Сокриј функција ${idx + 1}` : `Прикажи функција ${idx + 1}`}
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
                    title={`Отстрани функција ${idx + 1}`}
                    aria-label={`Отстрани функција ${idx + 1}`}
                    className="text-gray-300 hover:text-red-400 transition flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {/* Inequality operator selector */}
              <div className="flex items-center gap-1 pl-10">
                <span className="text-[9px] text-gray-400 font-semibold mr-0.5">y</span>
                {INEQ_OPS.map(({ key, sym }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateFunction(fn.id, { ineqOp: key })}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition ${
                      (fn.ineqOp ?? 'none') === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={key === 'none' ? 'Без неравенка' : `y ${sym} f(x)`}
                  >
                    {sym}
                  </button>
                ))}
                <span className="text-[9px] text-gray-400 ml-0.5">f(x)</span>
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

        {/* H3: Polynomial roots panel */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <button type="button"
            onClick={() => setShowRoots(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50 transition">
            <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-purple-500"/> Нули на полином</span>
            <span className="text-gray-300">{showRoots ? '▲' : '▼'}</span>
          </button>
          {showRoots && (
            <div className="border-t border-gray-100 px-3 py-3 space-y-2">
              {/* Degree picker */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 font-semibold w-12">Степен</span>
                <div className="flex gap-1">
                  {[2,3,4,5,6,7,8].map(d => (
                    <button key={d} type="button"
                      onClick={() => {
                        setPolyDeg(d);
                        setPolyCoeffs(Array.from({ length: d + 1 }, (_, i) => i === 0 ? 1 : 0));
                      }}
                      className={`w-6 h-6 text-[10px] font-bold rounded border-2 transition ${polyDeg === d ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500 hover:border-purple-300'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {/* Coefficient inputs */}
              <div className="space-y-1">
                {polyCoeffs.map((c, i) => {
                  const power = polyDeg - i;
                  const lbl = power === 0 ? 'a₀' : power === 1 ? 'a₁' : `a${power}`;
                  const expr = power === 0 ? '' : power === 1 ? 'x' : `x${power}`;
                  return (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-[10px] text-gray-400 w-7 text-right font-mono">{lbl}</span>
                      <input
                        type="number"
                        value={c}
                        onChange={e => {
                          const next = [...polyCoeffs];
                          next[i] = parseFloat(e.target.value) || 0;
                          setPolyCoeffs(next);
                        }}
                        className="w-16 border border-purple-200 rounded-md px-1.5 py-0.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50"
                        aria-label={`коефициент ${lbl}`}
                      />
                      {expr && <span className="text-[10px] text-gray-400 font-mono">{expr}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
              className={`w-full touch-none ${dragging ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onWheel={onWheel}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
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

              {/* Clipped content — nested <svg> avoids url(#id) hash-routing issues */}
              <svg x={PAD.left} y={PAD.top} width={plotW} height={plotH} overflow="hidden">
                <g transform={`translate(${-PAD.left} ${-PAD.top})`}>
                  {/* Inequality fill regions (behind curves) */}
                  {paths.map(p => {
                    const fn = functions.find(f => f.id === p.id);
                    if (!fn || !fn.visible || !p.fills.length) return null;
                    return p.fills.map((fillD, fi) => (
                      <path key={`${p.id}-fill-${fi}`} d={fillD}
                        fill={fn.color} fillOpacity={0.12} stroke="none" />
                    ));
                  })}
                  {/* Function curves */}
                  {paths.map(p => {
                    const fn = functions.find(f => f.id === p.id);
                    if (!fn || !fn.visible || !p.d) return null;
                    const isStrict = fn.ineqOp === '<' || fn.ineqOp === '>';
                    return (
                      <path key={p.id} d={p.d} fill="none"
                        stroke={fn.color} strokeWidth="2.5"
                        strokeLinejoin="round" strokeLinecap="round"
                        strokeDasharray={isStrict ? '6 3' : undefined}
                        opacity={0.9}
                      />
                    );
                  })}
                  {/* H3: polynomial curve */}
                  {showRoots && polyPath && (
                    <path d={polyPath} fill="none" stroke="#9333ea" strokeWidth="2"
                      strokeDasharray="8 3" strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
                  )}
                  {/* H3: real root markers on x-axis */}
                  {showRoots && polyRoots.filter(r => isRealRoot(r)).map((r, i) => {
                    const px = toPixelX(r.re);
                    if (px < PAD.left || px > PAD.left + plotW) return null;
                    return (
                      <g key={`root-${i}`}>
                        <circle cx={px} cy={axisY} r={5} fill="#9333ea" stroke="white" strokeWidth={1.5} />
                        <text x={px} y={axisY - 9} fontSize={9} textAnchor="middle" fill="#9333ea" fontWeight="bold" fontFamily="monospace">
                          {fmt(r.re)}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

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
                  <span className={`inline-block w-6 h-0.5 rounded ${PALETTE_BG[fn.color] ?? 'bg-gray-400'} ${fn.visible ? 'opacity-100' : 'opacity-[0.35]'}`} />
                  f<sub>{i + 1}</sub>(x) = {prettyExpr(fn.expr)}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* H3: Root results + Argand diagram */}
        {showRoots && polyRoots.length > 0 && (
          <div className="bg-white rounded-2xl border border-purple-200 p-4 space-y-3">
            <p className="text-xs font-bold text-purple-600 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5" /> Нули на полином (степен {polyDeg})
            </p>
            <div className="grid grid-cols-2 gap-2">
              {polyRoots.map((r, i) => (
                <div key={i} className={`rounded-lg border px-2.5 py-1.5 text-xs font-mono text-center ${isRealRoot(r) ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  z{i+1} = {cxFmt(r, 3)}
                  {isRealRoot(r) && <span className="ml-1 text-[9px] text-purple-400">● реална</span>}
                </div>
              ))}
            </div>
            {/* Mini Argand diagram */}
            {(() => {
              const AW = 260, AH = 180, ACX = 130, ACY = 90;
              const maxAbs = Math.max(1, ...polyRoots.map(r => Math.sqrt(r.re*r.re + r.im*r.im)));
              const sc = Math.min(ACX - 16, ACY - 16) / maxAbs;
              const ax = (re: number) => ACX + re * sc;
              const ay = (im: number) => ACY - im * sc;
              return (
                <svg viewBox={`0 0 ${AW} ${AH}`} className="w-full max-h-[180px] border border-gray-100 rounded-xl bg-gray-50">
                  <line x1={0} y1={ACY} x2={AW} y2={ACY} stroke="#9ca3af" strokeWidth={1}/>
                  <line x1={ACX} y1={0} x2={ACX} y2={AH} stroke="#9ca3af" strokeWidth={1}/>
                  <text x={AW - 6} y={ACY - 4} fontSize={9} fill="#9ca3af" textAnchor="end">Re</text>
                  <text x={ACX + 4} y={12} fontSize={9} fill="#9ca3af">Im</text>
                  {polyRoots.map((r, i) => (
                    <g key={i}>
                      <circle cx={ax(r.re)} cy={ay(r.im)}
                        r={4} fill={isRealRoot(r) ? '#9333ea' : 'none'}
                        stroke="#9333ea" strokeWidth={isRealRoot(r) ? 0 : 2} />
                      <text x={ax(r.re)+6} y={ay(r.im)+3} fontSize={8} fill="#9333ea" fontFamily="monospace">
                        {i+1}
                      </text>
                    </g>
                  ))}
                </svg>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
