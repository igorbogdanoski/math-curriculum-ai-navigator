/**
 * Pure helpers for FunctionTransformer (T4.1).
 *
 * Renders y = a · f(b·x + c) + d for a small dictionary of base functions
 * and exposes the sample/clamp helpers separately so they can be unit-tested
 * without spinning up React.
 */

export type BaseFunctionKey =
  | 'sin' | 'cos' | 'tan' | 'log' | 'sq' | 'sqrt' | 'abs' | 'cube'
  | 'logBase' | 'expBase' | 'recip' | 'polyN' | 'linear';

export interface ExtraParamDef {
  key: 'n' | 'base';
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** When true the slider snaps to integer values. */
  integer?: boolean;
}

export interface BaseFunctionDef {
  key: BaseFunctionKey;
  label: string;          // student-facing
  formula: string;        // f(x) = … (may contain {n} or {base} placeholders)
  /** Builds the actual numeric function given current extra-params (n, base). */
  build: (extra: ExtraParams) => (x: number) => number;
  /** Optional domain check given x and extra-params. */
  defined?: (x: number, extra: ExtraParams) => boolean;
  /** Optional extra parameters this function exposes (slider-driven). */
  extraParams?: ExtraParamDef[];
}

export interface ExtraParams {
  n?: number;
  base?: number;
}

export const BASE_FUNCTIONS: Record<BaseFunctionKey, BaseFunctionDef> = {
  sin:   { key: 'sin',   label: 'sin x',   formula: 'sin(x)',
           build: () => Math.sin },
  cos:   { key: 'cos',   label: 'cos x',   formula: 'cos(x)',
           build: () => Math.cos },
  tan:   { key: 'tan',   label: 'tan x',   formula: 'tan(x)',
           build: () => Math.tan,
           defined: (x) => Math.abs(Math.cos(x)) > 1e-3 },
  log:   { key: 'log',   label: 'ln x',    formula: 'ln(x)',
           build: () => Math.log,
           defined: (x) => x > 0 },
  sq:    { key: 'sq',    label: 'x²',       formula: 'x²',
           build: () => (x) => x * x },
  sqrt:  { key: 'sqrt',  label: '√x',       formula: '√x',
           build: () => Math.sqrt,
           defined: (x) => x >= 0 },
  abs:   { key: 'abs',   label: '|x|',      formula: '|x|',
           build: () => Math.abs },
  cube:  { key: 'cube',  label: 'x³',       formula: 'x³',
           build: () => (x) => x * x * x },
  linear:{ key: 'linear',label: 'x',        formula: 'x',
           build: () => (x) => x },

  // ─── S62-A1 — Universal extensions ─────────────────────────────────────
  logBase: {
    key: 'logBase',
    label: 'log_b x',
    formula: 'log_{base}(x)',
    build: (extra) => {
      const b = extra.base ?? 10;
      const lnB = Math.log(b);
      return (x) => Math.log(x) / lnB;
    },
    defined: (x, extra) => x > 0 && (extra.base ?? 10) > 0 && (extra.base ?? 10) !== 1,
    extraParams: [{ key: 'base', label: 'основа b', min: 2, max: 10, step: 0.1, default: 10 }],
  },
  expBase: {
    key: 'expBase',
    label: 'b^x',
    formula: '{base}^x',
    build: (extra) => {
      const b = extra.base ?? Math.E;
      return (x) => Math.pow(b, x);
    },
    defined: (_x, extra) => (extra.base ?? Math.E) > 0,
    extraParams: [{ key: 'base', label: 'основа b', min: 0.2, max: 5, step: 0.1, default: Math.E }],
  },
  recip: {
    key: 'recip',
    label: '1/x',
    formula: '1/x',
    build: () => (x) => 1 / x,
    defined: (x) => Math.abs(x) > 1e-6,
  },
  polyN: {
    key: 'polyN',
    label: 'x^n',
    formula: 'x^{n}',
    build: (extra) => {
      const n = Math.round(extra.n ?? 2);
      return (x) => Math.pow(x, n);
    },
    defined: (x, extra) => {
      const n = Math.round(extra.n ?? 2);
      return n >= 0 || x !== 0;
    },
    extraParams: [{ key: 'n', label: 'степен n', min: 2, max: 6, step: 1, default: 2, integer: true }],
  },
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
  extra: ExtraParams = {},
): number | null {
  const inner = p.b * x + p.c;
  if (fn.defined && !fn.defined(inner, extra)) return null;
  const f = fn.build(extra);
  const y = p.a * f(inner) + p.d;
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
  extra: ExtraParams = {},
): SamplePoint[] {
  const { xMin, xMax, samples } = args;
  if (samples < 2) return [];
  const dx = (xMax - xMin) / (samples - 1);
  const out: SamplePoint[] = new Array(samples);
  for (let i = 0; i < samples; i += 1) {
    const x = xMin + dx * i;
    out[i] = { x, y: applyTransform(fn, x, p, extra) };
  }
  return out;
}

/** Default extra-params seeded from a function's `extraParams` declaration. */
export function defaultExtraParams(fn: BaseFunctionDef): ExtraParams {
  const out: ExtraParams = {};
  fn.extraParams?.forEach(ep => { out[ep.key] = ep.default; });
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
export function formatFormula(
  fn: BaseFunctionDef,
  p: TransformParams,
  extra: ExtraParams = {},
): string {
  const aStr = p.a === 1 ? '' : p.a === -1 ? '−' : `${formatNum(p.a)}·`;
  const innerB = p.b === 1 ? 'x' : p.b === -1 ? '−x' : `${formatNum(p.b)}x`;
  const innerC = p.c === 0 ? '' : p.c > 0 ? ` + ${formatNum(p.c)}` : ` − ${formatNum(-p.c)}`;
  const inner = `${innerB}${innerC}`;
  // Compound inner (e.g. "0.2x − 0.5") must be wrapped in parens before substitution
  // so templates like "1/x", "x²", "√x" produce correct grouping.
  const needsParens = inner.includes(' ');
  const safeInner = needsParens ? `(${inner})` : inner;
  // First substitute extra placeholders ({base}, {n}), then `x` → safeInner.
  let template = fn.formula;
  if (extra.base != null) template = template.replace(/\{base\}/g, formatNum(extra.base));
  if (extra.n != null) template = template.replace(/\{n\}/g, formatNum(Math.round(extra.n)));
  let body = template.replace('x', safeInner);
  // Simplify redundant double-parens: sin((expr)) → sin(expr), |(expr)| → |expr|
  body = body
    .replace(/\(\(([^()]*)\)\)/g, '($1)')
    .replace(/\|\(([^()]*)\)\|/g, '|$1|');
  const dStr = p.d === 0 ? '' : p.d > 0 ? ` + ${formatNum(p.d)}` : ` − ${formatNum(-p.d)}`;
  return `${aStr}${body}${dStr}`;
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2).replace(/\.?0+$/, '');
}
