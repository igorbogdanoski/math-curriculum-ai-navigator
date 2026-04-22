export interface ExtractedContentBundle {
  formulas: string[];
  theories: string[];
  tasks: string[];
  rawSnippet: string;
}

export interface ExtractionQuality {
  score: number;
  label: 'poor' | 'fair' | 'good' | 'excellent';
  formulaCoverage: number;
  theoryCoverage: number;
  taskCoverage: number;
  textSignal: number;
}

// ─── S38-E1: World-class detection — LaTeX-aware + MK/EN lexicon expansion ──

const LATEX_MACROS = [
  'frac', 'sqrt', 'int', 'sum', 'prod', 'lim', 'log', 'ln', 'sin', 'cos', 'tan',
  'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'vec', 'overline', 'underline',
  'binom', 'cdot', 'times', 'div', 'pm', 'mp', 'leq', 'geq', 'neq', 'approx',
  'equiv', 'to', 'infty', 'partial', 'nabla', 'triangle', 'angle', 'perp',
  'parallel', 'cap', 'cup', 'subset', 'subseteq', 'supset', 'supseteq', 'in',
  'notin', 'emptyset', 'forall', 'exists', 'Rightarrow', 'Leftrightarrow',
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota',
  'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon',
  'phi', 'chi', 'psi', 'omega',
];

const LATEX_MACRO_RE = new RegExp(`\\\\(${LATEX_MACROS.join('|')})\\b`, 'i');
// Detect: `a^2`, `x_n`, `a_i`, exponents with digits/letters, subscripts
const POWER_INDEX_RE = /[A-Za-zА-Шаа-шШ]\s*[\^_]\s*\{?\s*[A-Za-z0-9+\-]/;
// Detect equations/inequalities: `... = ...`, `... < ...`, `... >= ...` with at least one digit or variable on each side
const RELATION_RE = /[A-Za-zА-Шаа-шШ0-9)\]]\s*[=≠≤≥<>]\s*[-+A-Za-zА-Шаа-шШ0-9(\\]/;
// Classic arithmetic form `d op d`, plus Greek letters π, θ etc., plus percent, degree, integral sign
const ARITHMETIC_RE = /\d\s*[+\-*/×÷·]\s*\d|\bπ\b|\d\s*°|∫|∑|∏|√|≤|≥|≠|≈|⇒|⇔|∈|∉/;

/** Any one of these signals that a line contains mathematical content. */
const FORMULA_RE = new RegExp(
  '(' +
    LATEX_MACRO_RE.source + ')|(' +
    POWER_INDEX_RE.source + ')|(' +
    RELATION_RE.source + ')|(' +
    ARITHMETIC_RE.source + ')',
  'i',
);

const THEORY_RE =
  /(теорија|теорем|теорема|дефиниц|правило|објаснув|објасни|аксиом|лема|својств|закон|постулат|concept|definition|theorem|axiom|lemma|principle|property|rule|identity|formula\s+for)/i;

const TASK_RE =
  /(задач|реши|пресметај|покажи|докаже|докажи|определи|скицирај|нацртај|конструирај|најди\b|означи|дали\b|пронајди|exercise|problem|task|question|prove|show\s+that|find\b|determine|calculate|evaluate|compute|construct|sketch|draw|solve|q\s*\d+|\?|^\s*\d+[.)]\s|^\s*[a-zа-ш][.)]\s)/i;

function compactLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

function uniqueLimited(values: string[], limit: number): string[] {
  return Array.from(new Set(values)).slice(0, limit);
}

export function buildExtractionBundle(rawText: string, maxItems = 12): ExtractedContentBundle {
  const lines = rawText
    .split(/\r?\n/)
    .map(compactLine)
    .filter(Boolean)
    .filter((line) => line.length >= 4);

  const formulas = uniqueLimited(lines.filter((line) => FORMULA_RE.test(line)), maxItems);
  const theories = uniqueLimited(lines.filter((line) => THEORY_RE.test(line)), maxItems);
  const tasks = uniqueLimited(lines.filter((line) => TASK_RE.test(line)), maxItems);

  return {
    formulas,
    theories,
    tasks,
    rawSnippet: compactLine(rawText).slice(0, 1600),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function labelFromScore(score: number): ExtractionQuality['label'] {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 45) return 'fair';
  return 'poor';
}

export function evaluateExtractionQuality(
  bundle: ExtractedContentBundle,
  options: {
    textLength?: number;
    truncated?: boolean;
    extractionMode?: 'html-static' | 'html-reader-fallback' | 'pdf-native' | 'pdf-ocr-fallback';
  } = {},
): ExtractionQuality {
  const formulaCoverage = clamp(bundle.formulas.length * 9, 0, 30);
  const theoryCoverage = clamp(bundle.theories.length * 7, 0, 25);
  const taskCoverage = clamp(bundle.tasks.length * 7, 0, 25);
  const textSourceLength = options.textLength ?? bundle.rawSnippet.length;
  const textSignal = clamp(Math.round(textSourceLength / 70), 0, 20);

  let score = formulaCoverage + theoryCoverage + taskCoverage + textSignal;
  if (options.truncated) score -= 8;
  if (options.extractionMode === 'html-reader-fallback' || options.extractionMode === 'pdf-ocr-fallback') score += 4;
  if (textSourceLength < 300) score -= 10;

  const bounded = clamp(Math.round(score), 0, 100);
  return {
    score: bounded,
    label: labelFromScore(bounded),
    formulaCoverage,
    theoryCoverage,
    taskCoverage,
    textSignal,
  };
}

// ─── S38-E1: Advanced helpers ───────────────────────────────────────────────

/**
 * Extract LaTeX-delimited expressions from text: `$...$`, `$$...$$`, `\(...\)`, `\[...\]`.
 * Returns a deduplicated list of the inner expressions (without delimiters).
 */
export function detectLatexFormulas(text: string, maxItems = 32): string[] {
  if (!text) return [];
  const out = new Set<string>();
  const patterns: RegExp[] = [
    /\$\$([\s\S]+?)\$\$/g,
    /(?<!\$)\$([^\n$]{1,400})\$(?!\$)/g,
    /\\\(([\s\S]+?)\\\)/g,
    /\\\[([\s\S]+?)\\\]/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const inner = m[1]?.trim();
      if (inner && inner.length > 0 && inner.length < 400) out.add(inner);
      if (out.size >= maxItems) break;
    }
    if (out.size >= maxItems) break;
  }
  return Array.from(out);
}

/**
 * Merge multiple extraction bundles (e.g. OCR + YouTube transcript + webpage)
 * into one normalized bundle — dedupes each channel while preserving order.
 */
export function mergeExtractionBundles(
  bundles: readonly ExtractedContentBundle[],
  maxItems = 24,
): ExtractedContentBundle {
  if (!bundles.length) {
    return { formulas: [], theories: [], tasks: [], rawSnippet: '' };
  }
  const merge = (key: 'formulas' | 'theories' | 'tasks') => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const b of bundles) {
      for (const item of b[key] ?? []) {
        const norm = item.replace(/\s+/g, ' ').trim().toLowerCase();
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        out.push(item.trim());
        if (out.length >= maxItems) return out;
      }
    }
    return out;
  };
  const rawSnippet = bundles
    .map((b) => b.rawSnippet)
    .filter(Boolean)
    .join(' · ')
    .slice(0, 1600);
  return {
    formulas: merge('formulas'),
    theories: merge('theories'),
    tasks: merge('tasks'),
    rawSnippet,
  };
}

/**
 * Infer a Depth-of-Knowledge level (1–4) for the overall bundle.
 *   1 — recall (short facts, simple formulas, single-step)
 *   2 — skills/concepts (straightforward tasks, substitution)
 *   3 — strategic thinking (multi-step, proof verbs, construct, derive)
 *   4 — extended thinking (research-level, generalize, investigate, design)
 */
export function inferDokForBundle(bundle: ExtractedContentBundle): 1 | 2 | 3 | 4 {
  const lowerTasks = bundle.tasks.map((t) => t.toLowerCase()).join(' ');
  if (!lowerTasks && bundle.formulas.length === 0 && bundle.theories.length === 0) return 1;

  const dok4 = /(истражи|генерализирај|обопшти|проектирај|дизајнирај|investigate|generalize|design|research|open[- ]ended)/i.test(lowerTasks);
  if (dok4) return 4;

  const dok3 =
    /(докажи|дедуцирај|изведи|конструирај|образложи|изведи\s+постапка|prove|derive|justify|construct|compare\s+strateg|multi[- ]step|strategic|reason)/i.test(lowerTasks) ||
    (bundle.tasks.length >= 5 && bundle.theories.length >= 3);
  if (dok3) return 3;

  const dok1 =
    bundle.tasks.length <= 1 &&
    bundle.formulas.length <= 2 &&
    !/(реши|пресметај|најди|определи|solve|compute|evaluate|find|determine)/i.test(lowerTasks);
  if (dok1) return 1;

  return 2;
}

/** Deterministic short signature of a bundle — useful as cache key / dedupe key. */
export function extractionSignature(bundle: ExtractedContentBundle): string {
  const part = (arr: string[]) =>
    arr.slice(0, 3).map((s) => s.replace(/\s+/g, '').slice(0, 24).toLowerCase()).join('|');
  return [part(bundle.formulas), part(bundle.theories), part(bundle.tasks)].join('::');
}

/**
 * Returns coarse summary counts for UI badges + telemetry.
 * Keeps all arithmetic pure & cheap so callers can recompute on every render.
 */
export function summarizeExtractionBundle(bundle: ExtractedContentBundle): {
  totalItems: number;
  hasMath: boolean;
  hasTasks: boolean;
  hasTheory: boolean;
  longestTaskChars: number;
} {
  const longestTaskChars = bundle.tasks.reduce((m, t) => Math.max(m, t.length), 0);
  return {
    totalItems: bundle.formulas.length + bundle.theories.length + bundle.tasks.length,
    hasMath: bundle.formulas.length > 0,
    hasTasks: bundle.tasks.length > 0,
    hasTheory: bundle.theories.length > 0,
    longestTaskChars,
  };
}
