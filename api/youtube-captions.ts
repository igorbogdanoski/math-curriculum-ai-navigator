/**
 * /api/youtube-captions
 *
 * Extracts real transcript text from a YouTube video.
 *
 * Strategy (in order of preference):
 *   1. Direct YouTube Timedtext API — fastest, no page scraping required.
 *      Tries /api/timedtext?v=…&lang=…&fmt=json3 for manual then auto captions
 *      across preferred language → mk → en.
 *   2. YouTube page scrape — parses ytInitialPlayerResponse from the watch page
 *      to discover available caption tracks, then fetches the best one.
 *   3. youtube-transcript npm package — maintained third-party scraper used as
 *      last resort when both strategies above fail (e.g. obfuscated pages).
 *   4. If all fail, returns { available: false } — client shows manual transcript
 *      textarea so teacher can paste the text manually.
 *
 * Request:  GET /api/youtube-captions?videoId=<id>&lang=<mk|en|...>
 * Response: {
 *   available: true;
 *   transcript: string;
 *   segments: Array<{ startMs: number; endMs: number; text: string }>;
 *   lang: string;
 *   source: 'auto'|'manual';
 *   charCount: number;
 *   truncated: boolean;
 *   availableLangs?: Array<{ lang: string; kind: 'auto'|'manual' }>;
 * }
 *         | { available: false; reason: string }
 *
 * Security: Requires Firebase auth token, CORS restricted.
 * Rate limit: 20 requests per 60-second window per user.
 * Transcript limit: 80 000 chars (~50–60 min video at normal speech rate).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { YoutubeTranscript } from 'youtube-transcript';

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const TRANSCRIPT_MAX_CHARS = 80_000;
const requestBuckets = new Map<string, number[]>();

// ─── Rate limiting ────────────────────────────────────────────────────────────

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const bucket = (requestBuckets.get(identifier) ?? []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= MAX_REQUESTS_PER_WINDOW) {
    requestBuckets.set(identifier, bucket);
    return true;
  }
  bucket.push(now);
  requestBuckets.set(identifier, bucket);
  // Opportunistic GC: 1% chance per call, sweep idle buckets so long-running
  // warm containers don't leak memory across thousands of unique users.
  if (Math.random() < 0.01) gcIdleBuckets(now);
  return false;
}

function gcIdleBuckets(now = Date.now()): number {
  let removed = 0;
  for (const [key, bucket] of requestBuckets.entries()) {
    const fresh = bucket.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
    if (fresh.length === 0) {
      requestBuckets.delete(key);
      removed++;
    } else if (fresh.length !== bucket.length) {
      requestBuckets.set(key, fresh);
    }
  }
  return removed;
}

function resetRateLimitState(identifier?: string): void {
  if (identifier) { requestBuckets.delete(identifier); return; }
  requestBuckets.clear();
}

// ─── Firebase Auth ────────────────────────────────────────────────────────────

function getFirebaseAdminAuth() {
  if (getApps().length === 0) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    if (!sa) return null;
    try {
      const decoded = sa.trim().startsWith('{') ? sa : Buffer.from(sa, 'base64').toString('utf8');
      initializeApp({ credential: cert(JSON.parse(decoded)) });
    } catch { return null; }
  }
  return getAuth();
}

async function authorizeAnyUser(req: VercelRequest): Promise<{ ok: true; uid: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Missing Authorization header' };
  const adminAuth = getFirebaseAdminAuth();
  if (!adminAuth) return { ok: false, status: 500, error: 'Server authentication configuration error' };
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7), false);
    return { ok: true, uid: decoded.uid };
  } catch { return { ok: false, status: 401, error: 'Invalid authentication token' }; }
}

// ─── CORS ────────────────────────────────────────────────────────────────────

function getAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGIN ?? '').split(',').map(o => o.trim()).filter(Boolean);
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind: string; // 'asr' = auto-generated, '' = manual
  name?: string;
}

interface TranscriptPayload {
  transcript: string;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
}

// ─── JSON3 segment parser (shared) ───────────────────────────────────────────

type Json3Event = { tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> };

function parseJson3Events(events: Json3Event[]): TranscriptPayload {
  const segments = events
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
}

// ─── Strategy 1: Direct YouTube Timedtext API ─────────────────────────────────
// Faster and more robust than page scraping. No regex, no HTML parsing.
// Tries manual then auto captions for preferred lang → mk → en.

const TIMEDTEXT_BASE = 'https://www.youtube.com/api/timedtext';
const BOT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchDirectTimedtext(videoId: string, lang: string, kind: 'asr' | ''): Promise<TranscriptPayload | null> {
  const params = new URLSearchParams({ v: videoId, lang, fmt: 'json3' });
  if (kind === 'asr') params.set('kind', 'asr');
  const url = `${TIMEDTEXT_BASE}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BOT_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;

    const json = await res.json() as { events?: Json3Event[] };
    if (!json.events?.length) return null;

    const payload = parseJson3Events(json.events);
    return payload.transcript.length >= 20 ? payload : null;
  } catch { return null; }
}

async function tryDirectTimedtext(
  videoId: string,
  preferLang: string,
): Promise<{ track: CaptionTrack; payload: TranscriptPayload } | null> {
  // Priority: manual preferred → auto preferred → manual mk → auto mk → manual en → auto en
  const baseLang = preferLang.split('-')[0].toLowerCase();
  const langs = [...new Set([baseLang, 'mk', 'en'])];
  const kinds: Array<'asr' | ''> = ['', 'asr'];

  for (const lang of langs) {
    for (const kind of kinds) {
      const payload = await fetchDirectTimedtext(videoId, lang, kind);
      if (payload) {
        const params = new URLSearchParams({ v: videoId, lang, fmt: 'json3' });
        if (kind) params.set('kind', kind);
        return {
          track: {
            baseUrl: `${TIMEDTEXT_BASE}?${params.toString()}`,
            languageCode: lang,
            kind,
          },
          payload,
        };
      }
    }
  }
  return null;
}

// ─── Strategy 2: Page scrape ──────────────────────────────────────────────────
// Fallback: parse ytInitialPlayerResponse from the watch page HTML.
// Uses multiple regex patterns to handle YouTube's varying page formats.

async function fetchCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const pageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const res = await fetch(pageUrl, {
    headers: {
      'User-Agent': BOT_UA,
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`YouTube page fetch failed: ${res.status}`);

  const html = await res.text();

  // Multiple patterns for ytInitialPlayerResponse (YouTube changes structure over time)
  const patterns = [
    /ytInitialPlayerResponse\s*=\s*(\{.+?\});(?:\s*(?:var|const|let)\s|<\/script>)/s,
    /ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*(?:\/\/|var |const |let |<\/)/,
    /"ytInitialPlayerResponse"\s*:\s*(\{[\s\S]+?\})(?=\s*,\s*"(?:INNERTUBE|WEB_PLAYER_CONTEXT|page))/,
    /ytInitialPlayerResponse['"]\s*[,:]\s*(\{[\s\S]+?\})\s*(?:[,;]|\))/,
  ];

  type YtData = {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: Array<{ baseUrl: string; languageCode: string; kind?: string; name?: { simpleText?: string } }>;
      };
    };
  };

  const parseTracks = (data: YtData): CaptionTrack[] =>
    (data.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []).map(t => ({
      baseUrl: t.baseUrl,
      languageCode: t.languageCode,
      kind: t.kind ?? '',
      name: t.name?.simpleText,
    }));

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    try {
      const data = JSON.parse(match[1]) as YtData;
      const tracks = parseTracks(data);
      if (tracks.length > 0) return tracks;
    } catch { continue; }
  }

  throw new Error('ytInitialPlayerResponse not found — YouTube may have changed page structure');
}

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
    auto.find(t => norm(t.languageCode) === 'mk') ??
    auto.find(t => norm(t.languageCode) === 'en') ??
    manual[0] ??
    auto[0] ??
    null
  );
}

async function fetchTranscriptText(track: CaptionTrack): Promise<TranscriptPayload> {
  const url = track.baseUrl.includes('?')
    ? `${track.baseUrl}&fmt=json3`
    : `${track.baseUrl}?fmt=json3`;

  const res = await fetch(url, {
    headers: { 'User-Agent': BOT_UA },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`Caption fetch failed: ${res.status}`);

  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('json') || url.includes('json3')) {
    try {
      const json = await res.json() as { events?: Json3Event[] };
      if (json.events?.length) return parseJson3Events(json.events);
    } catch { /* fall through to XML */ }
  }

  // XML fallback
  const xml = await res.text();
  const transcript = xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ')
    .trim();
  return { transcript, segments: [] };
}

// ─── Transcript limiter ───────────────────────────────────────────────────────

function applyTranscriptLimit(
  payload: TranscriptPayload,
  maxChars = TRANSCRIPT_MAX_CHARS,
): TranscriptPayload & { truncated: boolean } {
  if (payload.transcript.length <= maxChars) return { ...payload, truncated: false };

  const segments: TranscriptPayload['segments'] = [];
  let transcript = '';
  for (const seg of payload.segments) {
    const next = `${transcript} ${seg.text}`.trim();
    if (next.length > maxChars) break;
    transcript = next;
    segments.push(seg);
  }
  if (!transcript) transcript = payload.transcript.slice(0, maxChars);

  return { transcript: `${transcript}…[truncated]`, segments, truncated: true };
}

// ─── Strategy 2 wrapper ───────────────────────────────────────────────────────
// Returns the full response object on success, null if any step fails or
// yields no usable transcript. Never throws — caller falls through to S3.

async function tryPageScrape(videoId: string, lang: string): Promise<Record<string, unknown> | null> {
  try {
    const tracks = await fetchCaptionTracks(videoId);
    if (tracks.length === 0) return null;
    const track = pickTrack(tracks, lang);
    if (!track) return null;
    const payload = await fetchTranscriptText(track);
    if (!payload.transcript || payload.transcript.length < 20) return null;
    const limited = applyTranscriptLimit(payload);
    return {
      available: true,
      transcript: limited.transcript,
      segments: limited.segments,
      lang: track.languageCode,
      source: track.kind === 'asr' ? 'auto' : 'manual',
      videoId,
      charCount: limited.transcript.length,
      truncated: limited.truncated,
      availableLangs: tracks.map(t => ({ lang: t.languageCode, kind: t.kind === 'asr' ? 'auto' : 'manual' })),
    };
  } catch { return null; }
}

// ─── Strategy 3: youtube-transcript npm package ───────────────────────────────
// Maintained third-party scraper — last resort when the two native strategies
// above fail (e.g. when YouTube changes page structure between package updates).

async function tryYoutubeTranscriptPkg(
  videoId: string,
  preferLang: string,
): Promise<TranscriptPayload | null> {
  try {
    const baseLang = preferLang.split('-')[0].toLowerCase();
    const langsToTry = [...new Set([baseLang, 'mk', 'en'])];

    for (const lang of langsToTry) {
      try {
        const items = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (!items?.length) continue;

        const segments = items.map(item => ({
          startMs: Math.round((item.offset ?? 0) * 1000),
          endMs: Math.round(((item.offset ?? 0) + (item.duration ?? 0)) * 1000),
          text: (item.text ?? '').replace(/\n/g, ' ').trim(),
        })).filter(s => s.text.length > 0);

        const transcript = segments.map(s => s.text).join(' ').replace(/\s{2,}/g, ' ').trim();
        if (transcript.length >= 20) return { transcript, segments };
      } catch { continue; }
    }
    return null;
  } catch { return null; }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authz = await authorizeAnyUser(req);
  if (!authz.ok) return res.status(authz.status).json({ available: false, reason: authz.error });

  if (isRateLimited(authz.uid)) {
    return res.status(429).json({ available: false, reason: 'Rate limit exceeded. Please retry in one minute.' });
  }

  const videoId = typeof req.query.videoId === 'string' ? req.query.videoId.trim() : '';
  const lang    = typeof req.query.lang    === 'string' ? req.query.lang.trim()    : 'mk';

  if (!videoId || !/^[a-zA-Z0-9_-]{8,15}$/.test(videoId)) {
    return res.status(400).json({ available: false, reason: 'Invalid videoId' });
  }

  try {
    // ── Strategy 1: Direct Timedtext API ─────────────────────────────────────
    const directResult = await tryDirectTimedtext(videoId, lang);
    if (directResult) {
      const { track, payload } = directResult;
      const limited = applyTranscriptLimit(payload);
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
        strategy: 'direct',
      });
    }

    // ── Strategy 2: Page scrape fallback ─────────────────────────────────────
    const s2 = await tryPageScrape(videoId, lang);
    if (s2) {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ ...s2, strategy: 'page-scrape' });
    }

    // ── Strategy 3: youtube-transcript npm package ────────────────────────────
    const pkg3 = await tryYoutubeTranscriptPkg(videoId, lang);
    if (pkg3) {
      const limited = applyTranscriptLimit(pkg3);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({
        available: true,
        transcript: limited.transcript,
        segments: limited.segments,
        lang,
        source: 'auto',
        videoId,
        charCount: limited.transcript.length,
        truncated: limited.truncated,
        strategy: 'npm-package',
      });
    }

    // All strategies exhausted — client will show manual transcript textarea
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json({ available: false, reason: 'No captions available for this video', videoId });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(200).json({ available: false, reason: msg, videoId });
  }
}

export const __testables = {
  isRateLimited,
  resetRateLimitState,
  gcIdleBuckets,
  parseJson3Events,
  pickTrack,
  applyTranscriptLimit,
};
