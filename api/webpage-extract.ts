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
 * Response: { available: true; text: string; title: string; charCount: number; truncated: boolean }
 *         | { available: false; reason: string }
 *
 * Security: CORS restricted to known origins. URL is validated (must be http/https).
 *           JavaScript-rendered pages are NOT supported (no headless browser).
 * Cache:    1 hour (s-maxage=3600) — most educational pages are static.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

const MAX_CHARS = 12000;

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

function htmlToText(html: string): string {
  let text = removeBlockTags(html);
  text = blockTagsToNewlines(text);
  text = stripTags(text);
  text = decodeEntities(text);
  return cleanWhitespace(text);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ available: false, reason: 'Method not allowed' }); return; }

  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
  if (!rawUrl) {
    res.status(400).json({ available: false, reason: 'Missing url parameter' });
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
  // Block SSRF targets
  const host = parsedUrl.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.internal')) {
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

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('xml')) {
      res.status(200).json({ available: false, reason: 'URL не е HTML страница (можеби PDF или медиа)' });
      return;
    }

    const html = await response.text();
    const title = extractTitle(html);
    const fullText = htmlToText(html);

    const truncated = fullText.length > MAX_CHARS;
    const text = truncated ? fullText.slice(0, MAX_CHARS) : fullText;

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.status(200).json({
      available: true,
      text,
      title,
      charCount: text.length,
      truncated,
      sourceUrl: rawUrl,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    const reason = msg.includes('abort') || msg.includes('timeout')
      ? 'Страницата не одговори на барањето (timeout)'
      : 'Не може да се пристапи до страницата';
    res.status(200).json({ available: false, reason });
  }
}
