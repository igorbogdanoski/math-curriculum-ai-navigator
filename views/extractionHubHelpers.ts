/**
 * Pure helpers extracted from ExtractionHubView.tsx for unit testability.
 */
import type { VideoCaptionsResult } from '../utils/videoPreview';

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
