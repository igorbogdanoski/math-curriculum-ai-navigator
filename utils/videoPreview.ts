import { getAuth } from 'firebase/auth';
import { app } from '../firebaseConfig';

export interface VideoPreviewData {
  provider: 'youtube' | 'vimeo';
  title: string;
  authorName?: string;
  thumbnailUrl?: string;
  embedUrl: string;
  normalizedUrl: string;
  videoId?: string;
}

export interface VideoCaptionsResult {
  available: boolean;
  transcript?: string;
  segments?: Array<{ startMs: number; endMs: number; text: string }>;
  lang?: string;
  source?: 'auto' | 'manual';
  charCount?: number;
  truncated?: boolean;
  availableLangs?: Array<{ lang: string; kind: string }>;
  reason?: string;
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

function extractYouTubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0] ?? '';
    return id || null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      return v || null;
    }
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2] ?? '';
      return id || null;
    }
    if (url.pathname.startsWith('/embed/')) {
      const id = url.pathname.split('/')[2] ?? '';
      return id || null;
    }
  }
  return null;
}

function extractVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length === 0) return null;
  const id = parts[parts.length - 1];
  return /^\d+$/.test(id) ? id : null;
}

export function normalizeSupportedVideoUrl(rawUrl: string): { provider: 'youtube' | 'vimeo'; normalizedUrl: string; embedUrl: string; videoId?: string } | null {
  const parsed = parseUrl(rawUrl);
  if (!parsed) return null;

  const ytId = extractYouTubeId(parsed);
  if (ytId) {
    return {
      provider: 'youtube',
      normalizedUrl: `https://www.youtube.com/watch?v=${ytId}`,
      embedUrl: `https://www.youtube.com/embed/${ytId}`,
      videoId: ytId,
    };
  }

  const vimeoId = extractVimeoId(parsed);
  if (vimeoId) {
    return {
      provider: 'vimeo',
      normalizedUrl: `https://vimeo.com/${vimeoId}`,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
    };
  }

  return null;
}

export async function fetchVideoPreview(rawUrl: string): Promise<VideoPreviewData> {
  const normalized = normalizeSupportedVideoUrl(rawUrl);
  if (!normalized) {
    throw new Error('Поддржани се само YouTube или Vimeo URL линкови.');
  }

  const endpoint = normalized.provider === 'youtube'
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(normalized.normalizedUrl)}&format=json`
    : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(normalized.normalizedUrl)}`;

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error('Не можам да вчитам preview за овој видео URL.');
  }

  const data = await response.json() as { title?: string; author_name?: string; thumbnail_url?: string };
  return {
    provider: normalized.provider,
    title: data.title?.trim() || 'Видео лекција',
    authorName: data.author_name,
    thumbnailUrl: data.thumbnail_url,
    embedUrl: normalized.embedUrl,
    normalizedUrl: normalized.normalizedUrl,
    videoId: 'videoId' in normalized ? (normalized as { videoId?: string }).videoId : undefined,
  };
}

/**
 * Fetches the real transcript/captions for a YouTube video via our server
 * endpoint /api/youtube-captions (no API key required on the client).
 * Gracefully returns { available: false } on any failure.
 */
export async function fetchYouTubeCaptions(
  videoId: string,
  lang = 'mk',
): Promise<VideoCaptionsResult> {
  try {
    const currentUser = getAuth(app).currentUser;
    const token = currentUser ? await currentUser.getIdToken() : null;
    const res = await fetch(
      `/api/youtube-captions?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    if (!res.ok) return { available: false, reason: `HTTP ${res.status}` };
    return (await res.json()) as VideoCaptionsResult;
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : 'Network error' };
  }
}
