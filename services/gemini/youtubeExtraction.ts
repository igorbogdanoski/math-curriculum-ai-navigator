/**
 * S48 — YouTube → Math Tasks
 * Standalone service: URL → transcript → chunkAndExtractTasks → enrichExtractedPedagogy
 * Can be called from any view, not just ExtractionHub.
 */

import { fetchYouTubeCaptions, fetchVideoPreview } from '../../utils/videoPreview';
import { applyTimeRange } from '../../views/extractionHubHelpers';
import { chunkAndExtractTasks, enrichExtractedPedagogy } from './visionContracts';
import type { EnrichedWebTask } from './visionContracts';
import { DEFAULT_MODEL } from './core';

export interface YouTubeExtractionOptions {
  lang?: string;
  timeRange?: string;
  model?: string;
  specificInstructions?: string;
  onProgress?: (label: string, pct: number) => void;
}

export interface YouTubeExtractionResult {
  tasks: EnrichedWebTask[];
  videoTitle: string;
  videoId: string;
  transcriptAvailable: boolean;
  chunksProcessed: number;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

export async function extractMathTasksFromUrl(
  url: string,
  options: YouTubeExtractionOptions = {},
): Promise<YouTubeExtractionResult> {
  const { lang = 'mk', timeRange = '', model = DEFAULT_MODEL, specificInstructions, onProgress } = options;

  onProgress?.('Вадење преглед на видеото...', 10);
  const preview = await fetchVideoPreview(url);
  const videoId = preview.videoId ?? extractVideoId(url) ?? '';

  let rawText = '';
  let transcriptAvailable = false;

  if (videoId) {
    onProgress?.('Вадење транскрипт...', 20);
    const caps = await fetchYouTubeCaptions(videoId, lang);
    if (caps.available && caps.transcript) {
      rawText = applyTimeRange(caps, timeRange);
      transcriptAvailable = true;
    }
  }

  // Fallback to video title/description if no transcript
  if (!rawText) {
    rawText = `Наслов: ${preview.title}\nАвтор: ${preview.authorName ?? 'unknown'}`;
  }

  onProgress?.('AI анализа на содржина...', 35);
  const chunkResult = await chunkAndExtractTasks({
    text: rawText,
    sourceType: 'youtube',
    sourceRef: url,
    specificInstructions: specificInstructions?.trim() || undefined,
    model,
    onChunkProgress: (current, total) => {
      onProgress?.(`Дел ${current}/${total} — обработка...`, 35 + Math.round((current / total) * 55));
    },
  });

  if (chunkResult.fallback || chunkResult.output.tasks.length === 0) {
    return {
      tasks: [],
      videoTitle: preview.title,
      videoId,
      transcriptAvailable,
      chunksProcessed: chunkResult.chunksProcessed,
    };
  }

  onProgress?.('Збогатување со педагогија...', 93);
  const enriched = await enrichExtractedPedagogy(chunkResult.output.tasks);

  onProgress?.('Завршено!', 100);
  return {
    tasks: enriched,
    videoTitle: preview.title,
    videoId,
    transcriptAvailable,
    chunksProcessed: chunkResult.chunksProcessed,
  };
}
