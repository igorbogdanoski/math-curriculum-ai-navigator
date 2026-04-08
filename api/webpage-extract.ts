/**
 * /api/webpage-extract
 *
 * Extracts readable text content from any public web page.
 *
 * Strategy:
 *   1. Fetch the URL server-side (bypasses browser CORS)
 *   2. Strip HTML tags, scripts, styles, navigation boilerplate
 *   3. Clean whitespace and normalise line breaks
 *   4. Truncate to MAX_CHARS and return to client
 *   5. Client sends the text to Gemini for lesson material generation
 *
 * Request:  GET /api/webpage-extract?url=<encoded-url>
 * Response: {
 *   available: true;
 *   text: string;
 *   title: string;
 *   charCount: number;
 *   truncated: boolean;
 *   sourceType: 'webpage' | 'pdf';
 *   extractionMode: 'html-static' | 'html-reader-fallback' | 'pdf-native' | 'pdf-ocr-fallback';
 * }
 *         | { available: false; reason: string }
 *
 * Security: CORS restricted to known origins. URL is validated (must be http/https).
 *           Internal/private hosts are blocked to reduce SSRF risk.
 * Cache:    1 hour (s-maxage=3600) — most educational pages are static.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const MAX_CHARS = 12000;
const MIN_HTML_TEXT_CHARS = 350;
const MIN_PDF_TEXT_CHARS = 180;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const requestBuckets = new Map<string, number[]>();

function isRateLimited(identifier: string): boolean {
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

function resetRateLimitState(identifier?: string): void {
  if (identifier) {
    requestBuckets.delete(identifier);
    return;
  }
  requestBuckets.clear();
}

function getFirebaseAdminAuth() {
  if (getApps().length === 0) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    if (!sa) return null;
    try {
      const decoded = sa.trim().startsWith('{') ? sa : Buffer.from(sa, 'base64').toString('utf8');
      initializeApp({ credential: cert(JSON.parse(decoded)) });
    } catch {
      return null;
    }
  }

  return getAuth();
}

async function authorizeAnyUser(req: VercelRequest): Promise<{ ok: true; uid: string } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing Authorization header' };
  }

  const adminAuth = getFirebaseAdminAuth();
  if (!adminAuth) {
    return { ok: false, status: 500, error: 'Server authentication configuration error' };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7), false);
    return { ok: true, uid: decoded.uid };
  } catch {
    return { ok: false, status: 401, error: 'Invalid authentication token' };
  }
}

function isPrivateOrUnsafeHost(host: string): boolean {
  const lowered = host.toLowerCase();
  if (
    lowered === 'localhost' ||
    lowered === '127.0.0.1' ||
    lowered === '::1' ||
    lowered === '0.0.0.0' ||
    lowered.endsWith('.internal') ||
    lowered.endsWith('.local') ||
    lowered === 'metadata.google.internal' ||
    lowered === '169.254.169.254'
  ) {
    return true;
  }

  if (/^10\./.test(lowered) || /^192\.168\./.test(lowered) || /^169\.254\./.test(lowered)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lowered)) {
    return true;
  }

  return false;
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── HTML → text ──────────────────────────────────────────────────────────────

/** Remove entire tag blocks (script, style, nav, header, footer, aside) */
function removeBlockTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
}

/** Convert block-level tags to newlines before stripping */
function blockTagsToNewlines(html: string): string {
  return html.replace(/<\/?(p|br|div|li|h[1-6]|tr|td|th|blockquote)[^>]*>/gi, '\n');
}

/** Strip remaining HTML tags */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ');
}

/** Decode common HTML entities */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

/** Collapse excessive whitespace and blank lines */
function cleanWhitespace(text: string): string {
  return text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line.length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extract <title> text */
function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(stripTags(m[1])).trim().slice(0, 200) : '';
}

function getGeminiApiKeys(): string[] {
  return [
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((key): key is string => !!key && key.trim().length > 10);
}

function htmlToText(html: string): string {
  let text = removeBlockTags(html);
  text = blockTagsToNewlines(text);
  text = stripTags(text);
  text = decodeEntities(text);
  return cleanWhitespace(text);
}

function truncate(text: string): { text: string; truncated: boolean } {
  const truncated = text.length > MAX_CHARS;
  return {
    text: truncated ? text.slice(0, MAX_CHARS) : text,
    truncated,
  };
}

async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<{ text: string; title: string }> {
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as { default?: (buffer: Buffer) => Promise<{ text?: string; info?: { Title?: string } }> }).default
    ?? (pdfParseModule as unknown as (buffer: Buffer) => Promise<{ text?: string; info?: { Title?: string } }>);

  const parsed = await pdfParse(Buffer.from(arrayBuffer));
  const text = cleanWhitespace(parsed.text ?? '');
  const title = (parsed.info?.Title ?? '').trim().slice(0, 200);
  return { text, title };
}

async function fetchReaderFallback(url: string): Promise<string> {
  const readerUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, '')}`;
  const response = await fetch(readerUrl, {
    headers: {
      'User-Agent': 'MathNavigatorBot/1.0 (reader-fallback)',
      'Accept': 'text/plain;q=0.9,*/*;q=0.5',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return '';
  return cleanWhitespace(await response.text());
}

async function extractPdfWithGeminiOcr(arrayBuffer: ArrayBuffer): Promise<string> {
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) return '';

  const pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
  const prompt = [
    'Извлечи ја математичката содржина од PDF документот.',
    'Врати чист текст со редови за формули, теорија, задачи и примери.',
    'Задржи математичка нотација и не додавај измислена содржина.',
  ].join('\n');

  for (const key of apiKeys) {
    try {
      const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-2.5-flash' });
      const response = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
          ],
        }],
      });
      const text = cleanWhitespace(response.response.text() ?? '');
      if (text.length >= MIN_PDF_TEXT_CHARS) return text;
    } catch {
      // try next key
    }
  }

  return '';
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ available: false, reason: 'Method not allowed' }); return; }

  const authz = await authorizeAnyUser(req);
  if (authz.ok === false) {
    res.status(authz.status).json({ available: false, reason: authz.error });
    return;
  }

  if (isRateLimited(authz.uid)) {
    res.status(429).json({ available: false, reason: 'Rate limit exceeded. Please retry in one minute.' });
    return;
  }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    res.status(400).json({ available: false, reason: 'Missing url parameter' });
    return;
  }
  if (rawUrl.length > 2048) {
    res.status(400).json({ available: false, reason: 'URL is too long' });
    return;
  }

  // Validate — must be http or https, no localhost/internal IPs
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    res.status(400).json({ available: false, reason: 'Invalid URL format' });
    return;
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    res.status(400).json({ available: false, reason: 'Only http/https URLs are supported' });
    return;
  }
  if (parsedUrl.username || parsedUrl.password) {
    res.status(400).json({ available: false, reason: 'URLs with embedded credentials are not allowed' });
    return;
  }
  // Block SSRF targets
  const host = parsedUrl.hostname.toLowerCase();
  if (isPrivateOrUnsafeHost(host)) {
    res.status(400).json({ available: false, reason: 'Internal URLs are not allowed' });
    return;
  }

  try {
    const response = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MathNavigatorBot/1.0; educational content extraction)',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'mk,en;q=0.5',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(200).json({ available: false, reason: `HTTP ${response.status} — страницата не е достапна` });
      return;
    }

    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    const isPdf = contentType.includes('application/pdf') || parsedUrl.pathname.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const pdfBytes = await response.arrayBuffer();
      const extracted = await extractPdfText(pdfBytes);

      let textCandidate = extracted.text;
      let extractionMode: 'pdf-native' | 'pdf-ocr-fallback' = 'pdf-native';

      if (textCandidate.length < MIN_PDF_TEXT_CHARS) {
        const ocrText = await extractPdfWithGeminiOcr(pdfBytes);
        if (ocrText.length > textCandidate.length) {
          textCandidate = ocrText;
          extractionMode = 'pdf-ocr-fallback';
        }
      }

      if (!textCandidate) {
        res.status(200).json({ available: false, reason: 'PDF е достапен, но не може да се извлече читлив текст (OCR fallback не успеа).' });
        return;
      }

      const truncatedPdf = truncate(textCandidate);
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
      res.status(200).json({
        available: true,
        text: truncatedPdf.text,
        title: extracted.title || parsedUrl.pathname.split('/').pop() || 'PDF документ',
        charCount: truncatedPdf.text.length,
        truncated: truncatedPdf.truncated,
        sourceUrl: rawUrl,
        sourceType: 'pdf',
        extractionMode,
      });
      return;
    }

    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('xml')) {
      res.status(200).json({ available: false, reason: 'URL не е поддржан текстуален формат (HTML/TXT/XML/PDF).' });
      return;
    }

    const html = await response.text();
    const title = extractTitle(html);
    let fullText = htmlToText(html);
    let extractionMode: 'html-static' | 'html-reader-fallback' = 'html-static';

    // JS-rendered pages often return low-text shells; try a reader fallback when content is too short.
    if (fullText.length < MIN_HTML_TEXT_CHARS) {
      const readerText = await fetchReaderFallback(rawUrl);
      if (readerText.length > fullText.length + 120) {
        fullText = readerText;
        extractionMode = 'html-reader-fallback';
      }
    }

    if (!fullText) {
      res.status(200).json({ available: false, reason: 'Не е пронајдена читлива текстуална содржина на страницата.' });
      return;
    }

    const truncatedResult = truncate(fullText);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      available: true,
      text: truncatedResult.text,
      title,
      charCount: truncatedResult.text.length,
      truncated: truncatedResult.truncated,
      sourceUrl: rawUrl,
      sourceType: 'webpage',
      extractionMode,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const reason = msg.includes('abort') || msg.includes('timeout')
      ? 'Страницата не одговори на барањето (timeout)'
      : 'Не може да се пристапи до страницата';
    res.status(200).json({ available: false, reason });
  }
}

export const __testables = {
  isRateLimited,
  isPrivateOrUnsafeHost,
  resetRateLimitState,
};
