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

type OEmbedData = { title?: string; author_name?: string; thumbnail_url?: string };

async function fetchOEmbedJson(url: string): Promise<OEmbedData | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    return (await res.json()) as OEmbedData;
  } catch {
    return null;
  }
}

export async function fetchVideoPreview(rawUrl: string): Promise<VideoPreviewData> {
  const normalized = normalizeSupportedVideoUrl(rawUrl);
  if (!normalized) {
    throw new Error('Поддржани се само YouTube или Vimeo URL линкови.');
  }

  // 1) Native oEmbed (Vimeo sends CORS; YouTube sometimes does not).
  const nativeEndpoint = normalized.provider === 'youtube'
    ? `https://www.youtube.com/oembed?url=${encodeURIComponent(normalized.normalizedUrl)}&format=json`
    : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(normalized.normalizedUrl)}`;

  let data = await fetchOEmbedJson(nativeEndpoint);

  // 2) CORS-friendly fallback (noembed.com is allowlisted in CSP).
  if (!data) {
    const fallback = `https://noembed.com/embed?url=${encodeURIComponent(normalized.normalizedUrl)}`;
    data = await fetchOEmbedJson(fallback);
  }

  // 3) If both fail, degrade gracefully instead of breaking the whole pipeline.
  //    Downstream we can still fetch captions + run extraction; only preview UI
  //    loses the nice title/thumbnail.
  if (!data) {
    return {
      provider: normalized.provider,
      title: 'Видео лекција',
      embedUrl: normalized.embedUrl,
      normalizedUrl: normalized.normalizedUrl,
      videoId: 'videoId' in normalized ? (normalized as { videoId?: string }).videoId : undefined,
    };
  }

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
 * Fetches captions for a Vimeo video via /api/vimeo-captions.
 * Returns { available: false } gracefully on any failure.
 */
export async function fetchVimeoCaptions(
  videoId: string,
  lang = 'mk',
): Promise<VideoCaptionsResult> {
  try {
    const currentUser = getAuth(app).currentUser;
    const token = currentUser ? await currentUser.getIdToken() : null;
    const res = await fetch(
      `/api/vimeo-captions?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(lang)}`,
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
