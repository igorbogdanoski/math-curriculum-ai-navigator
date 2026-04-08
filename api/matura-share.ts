import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

function setCors(req: VercelRequest, res: VercelResponse, methods: string) {
  const origin = req.headers.origin;
  if (origin && getAllowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

async function authorizeAnyUser(req: VercelRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing Authorization header' };
  }

  const adminAuth = getFirebaseAdminAuth();
  if (!adminAuth) {
    return { ok: false, status: 500, error: 'Server authentication configuration error' };
  }

  try {
    await adminAuth.verifyIdToken(authHeader.slice(7), false);
    return { ok: true };
  } catch {
    return { ok: false, status: 401, error: 'Invalid authentication token' };
  }
}

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function safeSigEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

async function handleSign(req: VercelRequest, res: VercelResponse, secret: string) {
  setCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authz = await authorizeAnyUser(req);
  if (authz.ok === false) {
    return res.status(authz.status).json({ error: authz.error });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const payload = body?.payload;
  const requestedTtlDays = Number(body?.ttlDays ?? 30);

  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const ttlDays = Number.isFinite(requestedTtlDays)
    ? Math.max(1, Math.min(90, Math.floor(requestedTtlDays)))
    : 30;

  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  const signedPayload = {
    v: 1,
    exp,
    payload,
  };

  const payloadB64 = toBase64Url(JSON.stringify(signedPayload));
  const sig = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const token = `v1.${payloadB64}.${sig}`;

  return res.status(200).json({
    token,
    expiresAt: new Date(exp).toISOString(),
  });
}

function handleVerify(req: VercelRequest, res: VercelResponse, secret: string) {
  setCors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.SHARE_SIGNING_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'SHARE_SIGNING_SECRET is not configured' });
  }

  const action = req.query.action;

  if (action === 'sign') {
    return handleSign(req, res, secret);
  }

  if (action === 'verify') {
    return handleVerify(req, res, secret);
  }

  return res.status(400).json({ error: 'Unknown action' });
}