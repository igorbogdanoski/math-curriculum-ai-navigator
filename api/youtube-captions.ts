/**
 * /api/youtube-captions
 *
 * Extracts real transcript text from a YouTube video.
 *
 * Strategy (in order of preference):
 *   1. YouTube timedtext API — fetches auto-generated or manual captions
 *      without requiring a YouTube Data API key (uses the same endpoint
 *      the YouTube player uses internally).
 *   2. If that fails, returns { available: false } — client falls back
 *      to title-only mode (existing MVP behaviour).
 *
 * Request:  GET /api/youtube-captions?videoId=<id>&lang=<mk|en|...>
 * Response: {
 *   available: true;
 *   transcript: string;
 *   segments: Array<{ startMs: number; endMs: number; text: string }>;
 *   lang: string;
 *   source: 'auto'|'manual';
 * }
 *         | { available: false; reason: string }
 *
 * Security: No auth required (public YouTube data), CORS restricted.
 * Rate limit: inherits Vercel function limits; YouTube timedtext is ~1 req/video.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

function getAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',').map(o => o.trim()).filter(Boolean);
  return Array.from(new Set([
    'https://ai.mismath.net',
    'https://math-curriculum-ai-navigator.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
    ...configured,
  ]));
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && getAllowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ─── Caption track fetcher ────────────────────────────────────────────────────

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind: string; // 'asr' = auto, '' = manual
  name?: string;
}

interface TranscriptPayload {
  transcript: string;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
}

/**
 * Parses the YouTube video page to extract the caption track list URL.
 * YouTube embeds `"captions":{"playerCaptionsTracklistRenderer":...}` in the
 * initial player data JSON (ytInitialPlayerResponse).
 */
async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const pageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; MathNavigatorBot/1.0)',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) throw new Error(`YouTube page fetch failed: ${res.status}`);

  const html = await res.text();

  // Extract ytInitialPlayerResponse JSON
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*(?:var|const|let)\s|<\/script>)/s);
  if (!match) {
    // Try alternate pattern
    const match2 = html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*(?:\/\/|var |const |let |<\/)/);
    if (!match2) throw new Error('ytInitialPlayerResponse not found in page');
    try {
      const data = JSON.parse(match2[1]) as {
        captions?: {
          playerCaptionsTracklistRenderer?: {
            captionTracks?: Array<{ baseUrl: string; languageCode: string; kind?: string; name?: { simpleText?: string } }>;
          };
        };
      };
      return (data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).map(t => ({
        baseUrl: t.baseUrl,
        languageCode: t.languageCode,
        kind: t.kind ?? '',
        name: t.name?.simpleText,
      }));
    } catch { throw new Error('Failed to parse player response'); }
  }

  try {
    const data = JSON.parse(match[1]) as {
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: Array<{ baseUrl: string; languageCode: string; kind?: string; name?: { simpleText?: string } }>;
        };
      };
    };
    return (data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).map(t => ({
      baseUrl: t.baseUrl,
      languageCode: t.languageCode,
      kind: t.kind ?? '',
      name: t.name?.simpleText,
    }));
  } catch {
    throw new Error('Failed to parse ytInitialPlayerResponse JSON');
  }
}

/**
 * Picks the best caption track for the given language preference.
 * Priority: manual (exact lang) > auto (exact lang) > manual (any) > auto (any)
 */
function pickTrack(tracks: CaptionTrack[], preferLang: string): CaptionTrack | null {
  if (tracks.length === 0) return null;

  const norm = (l: string) => l.split('-')[0].toLowerCase();
  const pref = norm(preferLang);

  const manual = tracks.filter(t => t.kind !== 'asr');
  const auto   = tracks.filter(t => t.kind === 'asr');

  return (
    manual.find(t => norm(t.languageCode) === pref) ??
    auto.find(t => norm(t.languageCode) === pref) ??
    manual.find(t => norm(t.languageCode) === 'mk') ??
    manual.find(t => norm(t.languageCode) === 'en') ??
    auto.find(t => norm(t.languageCode) === 'en') ??
    manual[0] ??
    auto[0] ??
    null
  );
}

/**
 * Fetches and parses YouTube's timedtext XML into plain text.
 * Handles both XML caption format and JSON3 format.
 */
async function fetchTranscriptText(track: CaptionTrack): Promise<TranscriptPayload> {
  // Request JSON3 format (cleaner than XML for our use)
  const url = track.baseUrl.includes('?')
    ? `${track.baseUrl}&fmt=json3`
    : `${track.baseUrl}?fmt=json3`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MathNavigatorBot/1.0)' },
  });

  if (!res.ok) throw new Error(`Caption fetch failed: ${res.status}`);

  const contentType = res.headers.get('content-type') ?? '';

  if (contentType.includes('json') || url.includes('json3')) {
    try {
      const json = await res.json() as {
        events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>;
      };
      const segments = (json.events ?? [])
        .map((e) => {
          const text = (e.segs ?? [])
            .map((s) => s.utf8 ?? '')
            .join('')
            .replace(/\n+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
          const startMs = Math.max(0, Number(e.tStartMs ?? 0));
          const durationMs = Math.max(0, Number(e.dDurationMs ?? 0));
          const endMs = durationMs > 0 ? startMs + durationMs : startMs + 2500;
          return { startMs, endMs, text };
        })
        .filter((s) => s.text.length > 0);

      const transcript = segments.map((s) => s.text).join(' ').replace(/\s{2,}/g, ' ').trim();
      return { transcript, segments };
    } catch { /* fall through to XML */ }
  }

  // XML fallback
  const xml = await res.text();
  const transcript = xml
    .replace(/<[^>]+>/g, ' ')        // strip XML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    transcript,
    segments: [],
  };
}

function applyTranscriptLimit(payload: TranscriptPayload, maxChars = 12000): TranscriptPayload & { truncated: boolean } {
  if (payload.transcript.length <= maxChars) return { ...payload, truncated: false };

  const segments: TranscriptPayload['segments'] = [];
  let transcript = '';
  for (const seg of payload.segments) {
    const next = `${transcript} ${seg.text}`.trim();
    if (next.length > maxChars) break;
    transcript = next;
    segments.push(seg);
  }

  if (!transcript) {
    transcript = payload.transcript.slice(0, maxChars);
  }

  return {
    transcript: `${transcript}…[truncated]`,
    segments,
    truncated: true,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const videoId = typeof req.query.videoId === 'string' ? req.query.videoId.trim() : '';
  const lang    = typeof req.query.lang    === 'string' ? req.query.lang.trim()    : 'mk';

  if (!videoId || !/^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) {
    return res.status(400).json({ available: false, reason: 'Invalid videoId' });
  }

  try {
    const tracks = await fetchCaptionTracks(videoId);

    if (tracks.length === 0) {
      return res.status(200).json({
        available: false,
        reason: 'No captions available for this video',
        videoId,
      });
    }

    const track = pickTrack(tracks, lang);
    if (!track) {
      return res.status(200).json({
        available: false,
        reason: 'No suitable caption track found',
        availableLangs: tracks.map(t => t.languageCode),
        videoId,
      });
    }

    const payload = await fetchTranscriptText(track);

    if (!payload.transcript || payload.transcript.length < 20) {
      return res.status(200).json({
        available: false,
        reason: 'Transcript is empty or too short',
        videoId,
      });
    }

    const limited = applyTranscriptLimit(payload, 12000);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      available: true,
      transcript: limited.transcript,
      segments: limited.segments,
      lang: track.languageCode,
      source: track.kind === 'asr' ? 'auto' : 'manual',
      videoId,
      charCount: limited.transcript.length,
      truncated: limited.truncated,
      availableLangs: tracks.map(t => ({ lang: t.languageCode, kind: t.kind === 'asr' ? 'auto' : 'manual' })),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    // Graceful degradation — not a hard error
    return res.status(200).json({
      available: false,
      reason: msg,
      videoId,
    });
  }
}
