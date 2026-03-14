/**
 * Model whitelist — only these models can be called
 */
export const ALLOWED_MODELS = new Set([
  'gemini-3.1-pro-preview',
  'gemini-3.1-pro-preview-customtools',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-1.5-pro-002',
  'gemini-1.5-flash-002',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-pro',
  'gemini-flash',
  'text-embedding-004',
  'imagen-3',
  'imagen-3-fast'
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
});

export type GeminiRequest = z.infer<typeof GeminiRequestSchema>;

// ---------------------------------------------------------------------------
// CORS helper
// ---------------------------------------------------------------------------
export function setCorsHeaders(res: VercelResponse): void {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://math-curriculum-ai-navigator.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ---------------------------------------------------------------------------
// Rate Limiting (In-memory — best-effort in serverless)
// KNOWN LIMITATION: Vercel serverless functions are stateless. rlMap resets on
// every cold start, so this only protects within a single warm function instance.
// For production-grade rate limiting, replace with Vercel KV or Upstash Redis.
// ---------------------------------------------------------------------------
const rlMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // 20 requests per minute per user/ip

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  let timestamps = rlMap.get(identifier) || [];
  timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rlMap.set(identifier, timestamps);
    return false; // rate limited
  }
  
  timestamps.push(now);
  rlMap.set(identifier, timestamps);
  return true;
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

  // Rate limit identifier (either Firebase UID or IP Address)
  let rlIdentifier = req.headers['x-forwarded-for'] as string || 'anonymous';

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

  // 2.5 Apply Rate Limit
  if (!checkRateLimit(rlIdentifier)) {
    console.warn(`[rate-limit] Blocked request from ${rlIdentifier}. Too many requests.`);
    res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before requesting again.', quotaType: 'rate' });
    return null;
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

  return parsed.data;
}
