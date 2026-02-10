/**
 * Shared utilities for Vercel Serverless Functions:
 * - Firebase Admin initialization (singleton)
 * - ID token verification
 * - Zod request body validation
 * - CORS helpers
 * - Model whitelist
 */
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
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccount) {
      try {
        initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
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
// Model whitelist — only these models can be called
// ---------------------------------------------------------------------------
const ALLOWED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-lite',
]);

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
});

// A single content message
const ContentSchema = z.object({
  role: z.string().optional(),
  parts: z.array(PartSchema),
});

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
    { message: `Model not allowed. Allowed: ${[...ALLOWED_MODELS].join(', ')}` }
  ),
  contents: z.union([
    z.array(ContentSchema),
    z.string(),
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
      await auth.verifyIdToken(idToken);
    } catch (err) {
      console.error('[auth] Token verification failed:', err);
      res.status(401).json({ error: 'Invalid or expired authentication token' });
      return null;
    }
  } else {
    // If we're in production but Firebase Admin is NOT available, we MUST block the request
    // as it means GEMINI_API_KEY could be exploited without authentication.
    if (process.env.NODE_ENV === 'production') {
        console.error('[auth] CRITICAL: FIREBASE_SERVICE_ACCOUNT missing in production!');
        res.status(500).json({ error: 'Server authentication configuration error' });
        return null;
    }
    console.warn('[auth] Skipping token verification — Firebase Admin not available (Development Mode)');
  }

  // 3. Validate request body with Zod
  const parsed = GeminiRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`
    ).join('; ');
    res.status(400).json({ error: `Invalid request: ${issues}` });
    return null;
  }

  return parsed.data;
}
