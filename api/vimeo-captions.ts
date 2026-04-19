/**
 * /api/vimeo-captions
 *
 * Fetches text-track captions for a public Vimeo video.
 *
 * Strategy:
 *   1. GET https://api.vimeo.com/videos/{id}/texttracks  (Vimeo API v3.4)
 *      using VIMEO_ACCESS_TOKEN env var (Personal Access Token, scope: public)
 *   2. Pick best track: preferred lang → mk → en → any
 *   3. Fetch the WebVTT file; parse into transcript + segments
 *   4. If no captions → { available: false }
 *
 * Request:  GET /api/vimeo-captions?videoId=<numeric-id>&lang=<mk|en|...>
 * Response: same shape as /api/youtube-captions
 *
 * Security: Requires Firebase auth token, CORS restricted.
 * Rate limit: 20 requests per 60-second window per user.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const TRANSCRIPT_MAX_CHARS = 80_000;
const VIMEO_API_BASE = 'https://api.vimeo.com';

const requestBuckets = new Map<string, number[]>();

// ── Rate limiting ─────────────────────────────────────────────────────────────

export function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const bucket = (requestBuckets.get(identifier) ?? []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= MAX_REQUESTS_PER_WINDOW) {
    requestBuckets.set(identifier, bucket);
    return true;
  }
  bucket.push(now);
  requestBuckets.set(identifier, bucket);
  return false;
}

export function resetRateLimitState(identifier?: string): void {
  if (identifier) { requestBuckets.delete(identifier); return; }
  requestBuckets.clear();
}

// ── Firebase Auth ─────────────────────────────────────────────────────────────

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

// ── CORS ──────────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

interface VimeoTextTrack {
  uri: string;
  active: boolean;
  type: string;       // 'captions' | 'subtitles' | 'chapters' | 'descriptions'
  language: string;   // e.g. 'en', 'mk'
  link: string;       // URL to the WebVTT file
  link_expires_time?: string;
  name?: string;
}

interface VimeoTextTracksResponse {
  total: number;
  data: VimeoTextTrack[];
}

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
}

// ── WebVTT parser ─────────────────────────────────────────────────────────────

function vttTimestampToMs(ts: string): number {
  // Accepts both HH:MM:SS.mmm and MM:SS.mmm
  const parts = ts.trim().split(':');
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) {
    [h, m] = [Number(parts[0]), Number(parts[1])];
    s = Number(parts[2].replace(',', '.'));
  } else {
    m = Number(parts[0]);
    s = Number(parts[1].replace(',', '.'));
  }
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

export function parseWebVTT(vtt: string): { transcript: string; segments: TranscriptSegment[] } {
  const lines = vtt.replace(/\r\n/g, '\n').split('\n');
  const segments: TranscriptSegment[] = [];

  let i = 0;
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) i++;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes('-->')) {
      const [startStr, endStr] = line.split('-->').map(s => s.trim().split(' ')[0]);
      const startMs = vttTimestampToMs(startStr);
      const endMs = vttTimestampToMs(endStr);
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        // Strip VTT cue tags like <00:00:01.000>, <c>, </c>, etc.
        textLines.push(lines[i].trim().replace(/<[^>]+>/g, ''));
        i++;
      }
      const text = textLines.join(' ').replace(/\s{2,}/g, ' ').trim();
      if (text) segments.push({ startMs, endMs, text });
    }
    i++;
  }

  const transcript = segments.map(s => s.text).join(' ').replace(/\s{2,}/g, ' ').trim();
  return { transcript, segments };
}

// ── Track picker ──────────────────────────────────────────────────────────────

function pickBestTrack(tracks: VimeoTextTrack[], preferLang: string): VimeoTextTrack | null {
  const captionTracks = tracks.filter(t => t.type === 'captions' || t.type === 'subtitles');
  if (captionTracks.length === 0) return null;

  const norm = (l: string) => l.split('-')[0].toLowerCase();
  const pref = norm(preferLang);

  return (
    captionTracks.find(t => norm(t.language) === pref) ??
    captionTracks.find(t => norm(t.language) === 'mk') ??
    captionTracks.find(t => norm(t.language) === 'en') ??
    captionTracks[0]
  );
}

// ── Transcript limiter ────────────────────────────────────────────────────────

function applyTranscriptLimit(
  payload: { transcript: string; segments: TranscriptSegment[] },
  maxChars = TRANSCRIPT_MAX_CHARS,
): { transcript: string; segments: TranscriptSegment[]; truncated: boolean } {
  if (payload.transcript.length <= maxChars) return { ...payload, truncated: false };

  const segments: TranscriptSegment[] = [];
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

// ── Handler ───────────────────────────────────────────────────────────────────

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

  if (!videoId || !/^\d{5,12}$/.test(videoId)) {
    return res.status(400).json({ available: false, reason: 'Invalid Vimeo videoId — must be numeric' });
  }

  const accessToken = process.env.VIMEO_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ available: false, reason: 'Vimeo access token not configured on server' });
  }

  try {
    // 1. Fetch text tracks list
    const tracksRes = await fetch(`${VIMEO_API_BASE}/videos/${videoId}/texttracks`, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!tracksRes.ok) {
      const status = tracksRes.status;
      if (status === 404) return res.status(200).json({ available: false, reason: 'Video not found on Vimeo' });
      if (status === 403) return res.status(200).json({ available: false, reason: 'Video is private or access denied' });
      return res.status(200).json({ available: false, reason: `Vimeo API error: ${status}` });
    }

    const tracksData = await tracksRes.json() as VimeoTextTracksResponse;
    if (!tracksData.data?.length) {
      return res.status(200).json({ available: false, reason: 'No captions available for this Vimeo video', videoId });
    }

    const track = pickBestTrack(tracksData.data, lang);
    if (!track) {
      return res.status(200).json({
        available: false,
        reason: 'No suitable caption track found',
        availableLangs: tracksData.data.map(t => ({ lang: t.language, kind: t.type })),
        videoId,
      });
    }

    // 2. Fetch WebVTT content
    const vttRes = await fetch(track.link, { signal: AbortSignal.timeout(10000) });
    if (!vttRes.ok) {
      return res.status(200).json({ available: false, reason: 'Failed to fetch WebVTT file', videoId });
    }
    const vttText = await vttRes.text();
    if (!vttText.trim().startsWith('WEBVTT')) {
      return res.status(200).json({ available: false, reason: 'Invalid WebVTT format', videoId });
    }

    // 3. Parse and return
    const payload = parseWebVTT(vttText);
    if (!payload.transcript || payload.transcript.length < 10) {
      return res.status(200).json({ available: false, reason: 'Transcript is empty', videoId });
    }

    const limited = applyTranscriptLimit(payload);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      available: true,
      transcript: limited.transcript,
      segments: limited.segments,
      lang: track.language,
      source: 'manual',
      videoId,
      charCount: limited.transcript.length,
      truncated: limited.truncated,
      availableLangs: tracksData.data.map(t => ({ lang: t.language, kind: t.type })),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(200).json({ available: false, reason: msg, videoId });
  }
}

export const __testables = { isRateLimited, resetRateLimitState, parseWebVTT, pickBestTrack };
