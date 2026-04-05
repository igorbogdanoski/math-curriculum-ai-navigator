import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';

function getAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

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

function safeSigEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.SHARE_SIGNING_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'SHARE_SIGNING_SECRET is not configured' });
  }

  const token = String(req.query.token ?? '');
  const m = /^v1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!m) {
    return res.status(400).json({ error: 'invalid' });
  }

  const payloadB64 = m[1];
  const signature = m[2];

  const expectedSig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  if (!safeSigEquals(signature, expectedSig)) {
    return res.status(401).json({ error: 'invalid' });
  }

  try {
    const raw = Buffer.from(payloadB64, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as { v?: number; exp?: number; payload?: unknown };

    if (parsed.v !== 1 || typeof parsed.exp !== 'number' || !parsed.payload || typeof parsed.payload !== 'object') {
      return res.status(400).json({ error: 'invalid' });
    }

    if (parsed.exp < Date.now()) {
      return res.status(410).json({ error: 'expired' });
    }

    return res.status(200).json({
      ok: true,
      payload: parsed.payload,
      expiresAt: new Date(parsed.exp).toISOString(),
    });
  } catch {
    return res.status(400).json({ error: 'invalid' });
  }
}
