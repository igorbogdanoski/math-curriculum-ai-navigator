export interface TimedTranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export type PedagogicalSegmentType = 'theory' | 'task' | 'example' | 'illustration' | 'mixed';
export type PedagogicalDokLevel = 1 | 2 | 3 | 4;
export type PedagogicalTopicMk =
  | 'Алгебра' | 'Геометрија' | 'Тригонометрија' | 'Анализа'
  | 'Статистика' | 'Комбинаторика' | 'Броеви' | 'Матрици и вектори' | 'Логика' | 'Општо';

export interface PedagogicalVideoSegment {
  startSec: number;
  endSec: number;
  text: string;
  segmentType: PedagogicalSegmentType;
  illustrationPrompt?: string;
  /** S38-V1: inferred DoK level (1–4) from segment verbs/keywords. */
  dokLevel?: PedagogicalDokLevel;
  /** S38-V1: inferred math topic (MK) — best-effort. */
  topicMk?: PedagogicalTopicMk;
  /** S38-V1: 0..1 confidence that `segmentType` is correct. */
  classificationConfidence?: number;
  /** S38-V1: keywords that matched during classification. */
  matchedKeywords?: string[];
}

// ─── Classification lexicon (EN + MK) ───────────────────────────────────────

const KW_ILLUSTRATION =
  /\b(draw|drawing|diagram|graph|plot|visual|sketch|figure|chart)\b|(скица|дијаграм|график|цртеж|прикажи|нацртај|илустрација)/i;
const KW_TASK =
  /\b(solve|calculate|evaluate|compute|find|determine|problem|exercise|assignment)\b|(задача|задачи|реши|пресметај|најди|определи|покажи|вежба)/i;
const KW_EXAMPLE =
  /\b(example|for\s+instance|instance|consider)\b|(пример|на\s+пример|разгледај)/i;
const KW_THEORY =
  /\b(definition|theorem|rule|concept|property|axiom|lemma|identity|postulate)\b|(дефиниц|теорем|правило|поим|својств|аксиом|лема|идентитет)/i;
const KW_PROOF =
  /\b(prove|derive|justify|show\s+that|deduce)\b|(докажи|дедуцирај|изведи|образложи)/i;
const KW_RESEARCH =
  /\b(investigate|generalize|design|research|open[- ]ended)\b|(истражи|генерализирај|обопшти|проектирај|дизајнирај)/i;

// ─── Topic lexicon — each regex triggers a PedagogicalTopicMk label ─────────

const TOPIC_PATTERNS: Array<[PedagogicalTopicMk, RegExp]> = [
  ['Тригонометрија', /\b(sin|cos|tan|cot|sec|csc|radian|triangle\s+ratio)\b|(синус|косинус|тангенс|котангенс|радијан|аголна\s+мерка)/i],
  ['Анализа', /\b(derivative|integral|limit|differentiat|continuity|series|sequence)\b|(извод|интеграл|граница|низа|непрекинат|диференциј)/i],
  ['Геометрија', /\b(triangle|circle|angle|polygon|parallel|perpendicular|congruen|similar|area|perimeter|volume)\b|(триаголник|кружница|агол|полигон|паралел|нормал|плоштина|периметар|зафатнин)/i],
  ['Статистика', /\b(mean|median|mode|variance|standard\s+deviation|probability|histogram)\b|(средна\s+вредност|медијан|мода|варијанс|стандардна\s+девијација|хистограм|веројатност)/i],
  ['Комбинаторика', /\b(permutation|combination|factorial|arrangement)\b|(пермутаци|комбинаци|факториел|распоред)/i],
  ['Матрици и вектори', /\b(matrix|matrices|vector|determinant|eigen|transpose)\b|(матрица|матрици|вектор|детерминант|својствен)/i],
  ['Логика', /\b(proposition|logical|implication|quantifier|truth\s+table)\b|(исказ|логичк|импликац|квантификатор|таблица\s+на\s+вистинитост)/i],
  ['Броеви', /\b(integer|rational|irrational|prime|fraction|decimal|percent)\b|(цел\s+број|рационал|ирационал|прост\s+број|дропка|децимал|процент)/i],
  ['Алгебра', /\b(equation|inequality|polynomial|quadratic|linear|exponent|logarithm|system)\b|(равенка|неравенка|полином|квадратн|линеар|степен|логаритам|систем)/i],
];

function inferTopicMk(text: string): PedagogicalTopicMk | undefined {
  for (const [topic, re] of TOPIC_PATTERNS) {
    if (re.test(text)) return topic;
  }
  return undefined;
}

interface ClassificationResult {
  type: PedagogicalSegmentType;
  confidence: number;
  matched: string[];
}

function classifySegmentRich(text: string): ClassificationResult {
  const matched: string[] = [];
  const hit = (re: RegExp, tag: string): boolean => {
    if (re.test(text)) { matched.push(tag); return true; }
    return false;
  };
  const isIllu = hit(KW_ILLUSTRATION, 'illustration');
  const isTask = hit(KW_TASK, 'task');
  const isExample = hit(KW_EXAMPLE, 'example');
  const isTheory = hit(KW_THEORY, 'theory');

  // Priority: illustration > task > example > theory > mixed
  const confidenceBase = (b: boolean) => (b ? 0.82 : 0.4);
  if (isIllu) return { type: 'illustration', confidence: confidenceBase(true), matched };
  if (isTask) return { type: 'task', confidence: confidenceBase(true), matched };
  if (isExample) return { type: 'example', confidence: confidenceBase(true), matched };
  if (isTheory) return { type: 'theory', confidence: confidenceBase(true), matched };
  return { type: 'mixed', confidence: 0.35, matched };
}

/** Back-compat wrapper preserving the original API. */
function classifySegment(text: string): PedagogicalSegmentType {
  return classifySegmentRich(text).type;
}

function inferDokForText(text: string, type: PedagogicalSegmentType): PedagogicalDokLevel {
  if (KW_RESEARCH.test(text)) return 4;
  if (KW_PROOF.test(text) || /\b(multi[- ]step|strategic|compare\s+methods)\b/i.test(text)) return 3;
  if (type === 'task' || type === 'example') return 2;
  if (type === 'theory') return 1;
  return 2;
}

function buildIllustrationPrompt(text: string, type: PedagogicalSegmentType): string | undefined {
  if (type !== 'illustration' && type !== 'example' && type !== 'theory') return undefined;
  const compact = text.replace(/\s+/g, ' ').trim().slice(0, 220);
  if (!compact) return undefined;
  return `Create a clean educational math visual that represents: ${compact}`;
}

export function buildPedagogicalVideoSegments(
  timedSegments: TimedTranscriptSegment[],
  maxSegments = 24,
): PedagogicalVideoSegment[] {
  const normalized = timedSegments
    .filter((s) => (s.text ?? '').trim().length > 0)
    .map((s) => ({
      ...s,
      text: s.text.replace(/\s+/g, ' ').trim(),
      startMs: Math.max(0, s.startMs),
      endMs: Math.max(s.startMs, s.endMs),
    }));

  if (normalized.length === 0) return [];

  // Merge tiny adjacent caption chunks into pedagogically meaningful windows.
  const merged: TimedTranscriptSegment[] = [];
  for (const seg of normalized) {
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push({ ...seg });
      continue;
    }

    const prevDuration = prev.endMs - prev.startMs;
    const gap = seg.startMs - prev.endMs;
    const shouldMerge = prev.text.length < 80 || prevDuration < 2500 || gap <= 1200;

    if (shouldMerge) {
      prev.endMs = Math.max(prev.endMs, seg.endMs);
      prev.text = `${prev.text} ${seg.text}`.replace(/\s+/g, ' ').trim();
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.slice(0, maxSegments).map((seg) => {
    const cls = classifySegmentRich(seg.text);
    const dokLevel = inferDokForText(seg.text, cls.type);
    const topicMk = inferTopicMk(seg.text);
    return {
      startSec: Math.floor(seg.startMs / 1000),
      endSec: Math.ceil(seg.endMs / 1000),
      text: seg.text,
      segmentType: cls.type,
      illustrationPrompt: buildIllustrationPrompt(seg.text, cls.type),
      dokLevel,
      topicMk,
      classificationConfidence: cls.confidence,
      matchedKeywords: cls.matched,
    };
  });
}

// ─── S38-V1: Aggregation helpers exported for UI/telemetry ──────────────────

export interface VideoSegmentStats {
  totalSegments: number;
  totalDurationSec: number;
  byType: Record<PedagogicalSegmentType, number>;
  dominantTopic?: PedagogicalTopicMk;
  averageDokLevel: number;
}

export function summarizeVideoSegments(segments: readonly PedagogicalVideoSegment[]): VideoSegmentStats {
  const byType: Record<PedagogicalSegmentType, number> = {
    theory: 0, task: 0, example: 0, illustration: 0, mixed: 0,
  };
  let dokSum = 0, dokCount = 0;
  const topicCounts = new Map<PedagogicalTopicMk, number>();
  let totalDurationSec = 0;

  for (const s of segments) {
    byType[s.segmentType]++;
    totalDurationSec += Math.max(0, s.endSec - s.startSec);
    if (s.dokLevel) { dokSum += s.dokLevel; dokCount++; }
    if (s.topicMk) topicCounts.set(s.topicMk, (topicCounts.get(s.topicMk) ?? 0) + 1);
  }

  let dominantTopic: PedagogicalTopicMk | undefined;
  let best = 0;
  for (const [t, c] of topicCounts) {
    if (c > best) { best = c; dominantTopic = t; }
  }

  return {
    totalSegments: segments.length,
    totalDurationSec,
    byType,
    dominantTopic,
    averageDokLevel: dokCount > 0 ? dokSum / dokCount : 0,
  };
}

// Re-export classifier for completeness (some consumers may want just the tag).
export { classifySegment };
