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

const FORMULA_RE = /(\\[a-zA-Z]+|[=^]|\d\s*[+\-*/]\s*\d)/;
const THEORY_RE = /(теорија|дефиниц|теорема|правило|објаснување|concept|definition|theorem)/i;
const TASK_RE = /(задач|реши|пресметај|докаже|exercise|problem|task|q\s*\d+|\?)/i;

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
