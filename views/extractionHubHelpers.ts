/**
 * Pure helpers extracted from ExtractionHubView.tsx for unit testability.
 */
import type { VideoCaptionsResult } from '../utils/videoPreview';
import { OCR_SUPPORTED_LANGUAGES, type OcrLanguage } from '../services/gemini/visionContracts';

// ─── S42-E2a: Image MIME detection ────────────────────────────────────────────

const SUPPORTED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const IMAGE_EXT_TO_MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** Returns a normalized image MIME (image/png, image/jpeg, image/webp) or null. */
export function detectImageMime(name: string, mimeType: string): string | null {
  const lower = (mimeType || '').toLowerCase();
  if (SUPPORTED_IMAGE_MIMES.has(lower)) {
    return lower === 'image/jpg' ? 'image/jpeg' : lower;
  }
  const lowerName = name.toLowerCase();
  for (const ext of Object.keys(IMAGE_EXT_TO_MIME)) {
    if (lowerName.endsWith(ext)) return IMAGE_EXT_TO_MIME[ext];
  }
  return null;
}

// ─── S42-E2b: Clipboard paste classification ──────────────────────────────────

export type PasteClassification =
  | { kind: 'image'; mimeType: string; file: File }
  | { kind: 'text'; text: string }
  | { kind: 'ignored' };

const MIN_PASTED_TEXT_LEN = 200;

/** Classify a clipboard paste event into image / long-text / ignored. */
export function classifyClipboard(items: DataTransferItemList | null, text: string | null): PasteClassification {
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) return { kind: 'image', mimeType: f.type || 'image/png', file: f };
      }
    }
  }
  if (text && text.trim().length >= MIN_PASTED_TEXT_LEN) {
    return { kind: 'text', text: text.trim() };
  }
  return { kind: 'ignored' };
}

// ─── S42-E3: OCR language hint ────────────────────────────────────────────────

/** Type-guard for the OCR language enum (for safe parsing of select values). */
export function isOcrLanguage(value: unknown): value is OcrLanguage {
  return typeof value === 'string' && (OCR_SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}


export function isYouTubeUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h === 'youtube.com' || h === 'youtu.be' || h === 'm.youtube.com';
  } catch { return false; }
}

export function isVimeoUrl(url: string): boolean {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h === 'vimeo.com' || h === 'player.vimeo.com';
  } catch { return false; }
}

export function isVideoUrl(url: string): boolean {
  return isYouTubeUrl(url) || isVimeoUrl(url);
}

export function parseTimestamp(s: string): number | null {
  const parts = s.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

export function applyTimeRange(caps: VideoCaptionsResult, timeRange: string): string {
  if (!timeRange.trim() || !caps.segments?.length) return caps.transcript ?? '';
  const [startStr, endStr] = timeRange.split(/\s*[-–]\s*/);
  const startMs = startStr ? parseTimestamp(startStr) : null;
  const endMs = endStr ? parseTimestamp(endStr) : null;
  if (startMs === null && endMs === null) return caps.transcript ?? '';
  const filtered = caps.segments.filter((seg) => {
    const after = startMs === null || seg.startMs >= startMs;
    const before = endMs === null || seg.endMs <= endMs;
    return after && before;
  });
  return filtered.length ? filtered.map((s) => s.text).join(' ') : (caps.transcript ?? '');
}

export function toBase64(ab: ArrayBuffer): string {
  const bytes = new Uint8Array(ab);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
