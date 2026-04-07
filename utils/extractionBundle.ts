export interface ExtractedContentBundle {
  formulas: string[];
  theories: string[];
  tasks: string[];
  rawSnippet: string;
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
