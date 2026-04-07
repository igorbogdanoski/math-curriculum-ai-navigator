export interface TimedTranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface PedagogicalVideoSegment {
  startSec: number;
  endSec: number;
  text: string;
  segmentType: 'theory' | 'task' | 'example' | 'illustration' | 'mixed';
  illustrationPrompt?: string;
}

function classifySegment(text: string): PedagogicalVideoSegment['segmentType'] {
  const t = text.toLowerCase();
  if (/(draw|diagram|graph|visual|скица|дијаграм|график|прикажи)/i.test(t)) return 'illustration';
  if (/(solve|calculate|find|problem|exercise|задача|реши|пресметај)/i.test(t)) return 'task';
  if (/(example|for instance|на пример|пример)/i.test(t)) return 'example';
  if (/(definition|theorem|rule|concept|дефиниц|теорема|правило|поим)/i.test(t)) return 'theory';
  return 'mixed';
}

function buildIllustrationPrompt(text: string, type: PedagogicalVideoSegment['segmentType']): string | undefined {
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
    const segmentType = classifySegment(seg.text);
    return {
      startSec: Math.floor(seg.startMs / 1000),
      endSec: Math.ceil(seg.endMs / 1000),
      text: seg.text,
      segmentType,
      illustrationPrompt: buildIllustrationPrompt(seg.text, segmentType),
    };
  });
}
