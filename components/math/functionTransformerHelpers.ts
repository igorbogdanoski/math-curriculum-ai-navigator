/**
 * Pure helpers for FunctionTransformer (T4.1).
 *
 * Renders y = a · f(b·x + c) + d for a small dictionary of base functions
 * and exposes the sample/clamp helpers separately so they can be unit-tested
 * without spinning up React.
 */

export type BaseFunctionKey = 'sin' | 'cos' | 'tan' | 'log' | 'sq' | 'sqrt' | 'abs' | 'cube';

export interface BaseFunctionDef {
  key: BaseFunctionKey;
  label: string;          // student-facing
  formula: string;        // f(x) = …
  fn: (x: number) => number;
  /** Optional domain check; returns null when undefined at x. */
  defined?: (x: number) => boolean;
}

export const BASE_FUNCTIONS: Record<BaseFunctionKey, BaseFunctionDef> = {
  sin:   { key: 'sin',   label: 'sin x',   formula: 'sin(x)',   fn: Math.sin },
  cos:   { key: 'cos',   label: 'cos x',   formula: 'cos(x)',   fn: Math.cos },
  tan:   { key: 'tan',   label: 'tan x',   formula: 'tan(x)',   fn: Math.tan,
           defined: (x) => Math.abs(Math.cos(x)) > 1e-3 },
  log:   { key: 'log',   label: 'ln x',    formula: 'ln(x)',    fn: Math.log,
           defined: (x) => x > 0 },
  sq:    { key: 'sq',    label: 'x²',       formula: 'x²',       fn: (x) => x * x },
  sqrt:  { key: 'sqrt',  label: '√x',       formula: '√x',       fn: Math.sqrt,
           defined: (x) => x >= 0 },
  abs:   { key: 'abs',   label: '|x|',      formula: '|x|',      fn: Math.abs },
  cube:  { key: 'cube',  label: 'x³',       formula: 'x³',       fn: (x) => x * x * x },
};

export interface TransformParams {
  a: number;  // vertical scale
  b: number;  // horizontal scale
  c: number;  // horizontal shift inside the inner argument: f(b·x + c)
  d: number;  // vertical shift
}

export const IDENTITY_PARAMS: TransformParams = { a: 1, b: 1, c: 0, d: 0 };

export function applyTransform(
  fn: BaseFunctionDef,
  x: number,
  p: TransformParams,
): number | null {
  const inner = p.b * x + p.c;
  if (fn.defined && !fn.defined(inner)) return null;
  const y = p.a * fn.fn(inner) + p.d;
  if (!Number.isFinite(y)) return null;
  return y;
}

export interface SamplePoint {
  x: number;
  y: number | null;
}

export function sampleCurve(
  fn: BaseFunctionDef,
  p: TransformParams,
  args: { xMin: number; xMax: number; samples: number },
): SamplePoint[] {
  const { xMin, xMax, samples } = args;
  if (samples < 2) return [];
  const dx = (xMax - xMin) / (samples - 1);
  const out: SamplePoint[] = new Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = xMin + dx * i;
    out[i] = { x, y: applyTransform(fn, x, p) };
  }
  return out;
}

/** Clamp a number into [lo, hi]; returns lo/hi for NaN. */
export function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  if (value < lo) return lo;
  if (value > hi) return hi;
  return value;
}

/**
 * Builds an SVG `path` `d` attribute from sampled points, breaking the path
 * whenever the function is undefined (so vertical asymptotes don't connect).
 */
export function buildPathD(
  points: SamplePoint[],
  toScreen: (x: number, y: number) => { sx: number; sy: number },
  yClamp: { yMin: number; yMax: number },
): string {
  let d = '';
  let pen = false;
  for (const pt of points) {
    if (pt.y == null || pt.y < yClamp.yMin || pt.y > yClamp.yMax) {
      pen = false;
      continue;
    }
    const { sx, sy } = toScreen(pt.x, pt.y);
    d += `${pen ? 'L' : 'M'}${sx.toFixed(2)},${sy.toFixed(2)} `;
    pen = true;
  }
  return d.trim();
}

/** Human-readable formatted formula like `2·sin(3x + 1) − 4`. */
export function formatFormula(fn: BaseFunctionDef, p: TransformParams): string {
  const aStr = p.a === 1 ? '' : p.a === -1 ? '−' : `${formatNum(p.a)}·`;
  const innerB = p.b === 1 ? 'x' : p.b === -1 ? '−x' : `${formatNum(p.b)}x`;
  const innerC = p.c === 0 ? '' : p.c > 0 ? ` + ${formatNum(p.c)}` : ` − ${formatNum(-p.c)}`;
  const inner = `${innerB}${innerC}`;
  const body = `${fn.formula.replace('x', inner)}`;
  const dStr = p.d === 0 ? '' : p.d > 0 ? ` + ${formatNum(p.d)}` : ` − ${formatNum(-p.d)}`;
  return `${aStr}${body}${dStr}`;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '');
}
