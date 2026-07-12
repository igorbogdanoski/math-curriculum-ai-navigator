/**
 * services/scenarioSplitter.ts — S106-В
 *
 * Detects multiple lesson scenario boundaries in a single document text
 * (e.g. a Word file containing 5 lesson plans), and splits them into
 * individually importable segments.
 */

export interface ScenarioSegment {
  title: string;
  text: string;
  startChar: number;
  endChar: number;
  index: number;
}

const HEADING_RE = new RegExp(
  '(?:^|\\n)(' +
    '(?:Час|Наставна единица|Подготовка бр\\.?|Подготовка за час|Lesson|Тема)\\s*[:\\-–—]?\\s*(?:\\d+|[IVXLC]+)' +
    '|' +
    '\\d+[.)]\\s+\\S' + // "1. SomeTitle"
  ')',
  'gim',
);

function extractTitleFromText(raw: string): string {
  // First non-empty line as title (up to 80 chars)
  const line = raw.split('\n').find(l => l.trim().length > 3) ?? '';
  return line.trim().slice(0, 80) || 'Сценарио';
}

/**
 * Tries to split `text` into multiple lesson scenario segments.
 * Returns an empty array if only one logical section is found
 * (caller should skip the selection modal in that case).
 */
export function splitScenarios(text: string): ScenarioSegment[] {
  const matches: Array<{ index: number }> = [];
  let m: RegExpExecArray | null;

  HEADING_RE.lastIndex = 0;
  while ((m = HEADING_RE.exec(text)) !== null) {
    matches.push({ index: m.index });
  }

  if (matches.length < 2) return [];

  const segments: ScenarioSegment[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, end).trim();
    if (chunk.length < 50) continue; // skip trivial chunks

    segments.push({
      title: extractTitleFromText(chunk),
      text: chunk,
      startChar: start,
      endChar: end,
      index: segments.length,
    });
  }

  // Only return if we found at least 2 real segments
  return segments.length >= 2 ? segments : [];
}
