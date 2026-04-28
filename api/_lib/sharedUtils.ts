/**
 * Model whitelist — only these models can be called
 */
export const ALLOWED_MODELS = new Set([
  // Gemini 3.x family (paid tier — confirmed available)
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
  'gemini-3.1-flash-lite-preview',
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3-pro-image-preview',
  // Gemini 2.5 family
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-lite-preview-09-2025',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  // Gemini 2.0 family
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  // Gemma family
  'gemma-3-1b-it', 'gemma-3-4b-it', 'gemma-3-12b-it', 'gemma-3-27b-it',
  'gemma-3n-e4b-it', 'gemma-3n-e2b-it',
  'gemma-4-26b-a4b-it', 'gemma-4-31b-it',
  // Gemini 1.5 (legacy)
  'gemini-1.5-pro-002',
  'gemini-1.5-flash-002',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-pro',
  'gemini-flash',
  // Embedding models
  'text-embedding-004',
  'gemini-embedding-001',
  'gemini-embedding-2-preview',
  'gemini-embedding-2',
  // Imagen 4 family
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001',
  'imagen-4.0-fast-generate-001',
  // Imagen 3 (legacy fallback)
  'imagen-3.0-generate-001',
  'imagen-3',
  'imagen-3-fast',
]);

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Firebase Admin — singleton
// ---------------------------------------------------------------------------
let firebaseAuthAvailable = true;

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    if (serviceAccount) {
      try {
        // Handle both raw JSON and base64 encoded strings
        const decoded = serviceAccount.trim().startsWith('{') 
          ? serviceAccount 
          : Buffer.from(serviceAccount, 'base64').toString('utf8');
        
        initializeApp({ credential: cert(JSON.parse(decoded)) });
      } catch (err) {
        console.error('[auth] Failed to init Firebase Admin with service account:', err);
        firebaseAuthAvailable = false;
        return null;
      }
    } else {
      // No FIREBASE_SERVICE_ACCOUNT configured — auth verification disabled
      console.warn('[auth] FIREBASE_SERVICE_ACCOUNT not set. Token verification is DISABLED.');
      firebaseAuthAvailable = false;
      return null;
    }
  }
  if (!firebaseAuthAvailable) return null;
  return getAuth();
}

// ---------------------------------------------------------------------------
// Zod schemas for request body validation
// ---------------------------------------------------------------------------

// Content part — text or inline data
const PartSchema = z.object({
  text: z.string().optional(),
  inlineData: z.object({
    mimeType: z.string(),
    data: z.string(),
  }).optional(),
}).passthrough();

// A single content message
const ContentSchema = z.object({
  role: z.string().optional().default('user'),
  parts: z.array(PartSchema),
}).passthrough();

// Safety setting entry
const SafetySettingSchema = z.object({
  category: z.string(),
  threshold: z.string(),
});

// Generation config — validated subset that the client may send
const SafeConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(100).optional(),
  maxOutputTokens: z.number().int().min(1).max(65536).optional(),
  responseMimeType: z.enum(['text/plain', 'application/json']).optional(),
  responseSchema: z.any().optional(), // Zod passthrough for JSON schema
  thinkingConfig: z.object({
    thinkingBudget: z.number().int().min(0).max(24576).optional(),
  }).optional(),
  // System instruction — string or Content object
  systemInstruction: z.union([z.string(), ContentSchema]).optional(),
  // Safety settings array
  safetySettings: z.array(SafetySettingSchema).optional(),
  // Response modalities (e.g. ['TEXT'], ['IMAGE'])
  responseModalities: z.array(z.string()).optional(),
}).passthrough().optional();

// Full request body
export const GeminiRequestSchema = z.object({
  model: z.string().refine(
    (m) => ALLOWED_MODELS.has(m),
    { message: "Invalid or unauthorized Gemini model" }
  ),
  contents: z.union([
    z.array(ContentSchema),
    z.string(),
    z.array(z.any())
  ]),
  config: SafeConfigSchema,
  // Optional Gemini tools — used for Google Search grounding
  tools: z.array(z.any()).optional(),
});

export type GeminiRequest = z.infer<typeof GeminiRequestSchema>;

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------
export function setCorsHeaders(res: VercelResponse): void {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || process.env.VITE_APP_URL || 'https://mismath.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ---------------------------------------------------------------------------
// Rate Limiting — Upstash Redis (distributed, survives cold starts)
// Falls back to in-memory if env vars are not configured.
// ---------------------------------------------------------------------------
import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { checkSlidingWindow, extractClientIp } from './rateLimitInMemory.js';

let upstashRatelimit: Ratelimit | null = null;
let upstashIpRatelimit: Ratelimit | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try { return new Redis({ url, token }); } catch { return null; }
}

function getUpstashRatelimit(): Ratelimit | null {
  if (upstashRatelimit) return upstashRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  upstashRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'), // 20 req/min per UID
    prefix: 'rl:uid',
  });
  return upstashRatelimit;
}

// SEC-5: Separate IP-level limiter — looser, guards against multi-account abuse
function getUpstashIpRatelimit(): Ratelimit | null {
  if (upstashIpRatelimit) return upstashIpRatelimit;
  const redis = getRedis();
  if (!redis) return null;
  upstashIpRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 req/min per IP
    prefix: 'rl:ip',
  });
  return upstashIpRatelimit;
}

// In-memory fallback (best-effort, resets on cold start) — see ./rateLimitInMemory.ts
const rlMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 20;

async function checkRateLimit(identifier: string): Promise<boolean> {
  const limiter = getUpstashRatelimit();
  if (limiter) {
    const { success } = await limiter.limit(identifier);
    return success;
  }
  return checkSlidingWindow(rlMap, identifier, {
    windowMs: RATE_LIMIT_WINDOW_MS,
    maxRequests: MAX_REQUESTS_PER_WINDOW,
  });
}

// ---------------------------------------------------------------------------
// Auth + Validation middleware
// Returns the validated body or sends an error response and returns null.
// ---------------------------------------------------------------------------
export async function authenticateAndValidate(
  req: VercelRequest,
  res: VercelResponse
): Promise<GeminiRequest | null> {
  // 1. Check HTTP method
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return null;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }

  // Rate limit identifier (either Firebase UID or IP Address).
  // SEC-5 — extractClientIp handles x-forwarded-for proxy chain safely.
  const firstIp = extractClientIp(req.headers, req.socket?.remoteAddress);
  let rlIdentifier = firstIp ?? 'anonymous';
  let authenticatedUid: string | undefined;

  // 2. Verify Firebase ID token
  const auth = getFirebaseAdmin();
  if (auth) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      return null;
    }
    const idToken = authHeader.slice(7);
    try {
      const decodedToken = await auth.verifyIdToken(idToken);
      rlIdentifier = decodedToken.uid; // Limit by unique User ID
      authenticatedUid = decodedToken.uid;
    } catch (err) {
      console.error('[auth] Token verification failed:', err);
      res.status(401).json({ error: 'Invalid or expired authentication token' });
      return null;
    }
  } else {
    // If we're in production but Firebase Admin is NOT available, we MUST block the request
    if (process.env.NODE_ENV === 'production') {
        console.error('[auth] CRITICAL: FIREBASE_SERVICE_ACCOUNT missing in production!');
        res.status(500).json({ error: 'Server authentication configuration error' });
        return null;
    }
    console.warn('[auth] Skipping token verification — Firebase Admin not available (Development Mode)');
  }

  // 2.5 Apply Rate Limit — dual layer: per-UID (20/min) + per-IP (100/min)
  if (!(await checkRateLimit(rlIdentifier))) {
    console.warn(`[rate-limit] UID blocked: ${rlIdentifier}`);
    res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before requesting again.', quotaType: 'rate' });
    return null;
  }
  // IP check runs only when authenticated (UID limiter used different key)
  if (authenticatedUid && firstIp) {
    const ipLimiter = getUpstashIpRatelimit();
    if (ipLimiter) {
      const { success } = await ipLimiter.limit(firstIp);
      if (!success) {
        console.warn(`[rate-limit] IP blocked: ${firstIp}`);
        res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before requesting again.', quotaType: 'rate' });
        return null;
      }
    }
  }

  // 3. Validate request body with Zod
  const parsed = GeminiRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`
    ).join('; ');
    
    // П37 — Never log full request body or return it in response (may contain tokens/content)
    // Only log the field-level issues, not the actual values
    console.error('[validation] Request validation failed. Issues:', issues);
    if (process.env.NODE_ENV !== 'production') {
      console.error('[validation] Body (dev only):', JSON.stringify(req.body, null, 2));
    }

    res.status(400).json({
      error: `Invalid request: ${issues}`,
    });
    return null;
  }

  // Attach the resolved identifier on the request so downstream handlers
  // (cost tracker, audit logger) can correlate without re-decoding.
  (req as VercelRequest & { __rateLimitId?: string; __authUid?: string }).__rateLimitId = rlIdentifier;
  (req as VercelRequest & { __rateLimitId?: string; __authUid?: string }).__authUid = authenticatedUid;

  return parsed.data;
}

/** Returns the authenticated UID (or rate-limit identifier fallback) for a request that
 *  has already passed `authenticateAndValidate`. Returns `'anonymous'` if neither is set. */
export function getRequestPrincipal(req: VercelRequest): string {
  const r = req as VercelRequest & { __authUid?: string; __rateLimitId?: string };
  return r.__authUid || r.__rateLimitId || 'anonymous';
}
