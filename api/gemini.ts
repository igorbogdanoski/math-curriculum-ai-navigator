import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Content, GenerationConfig } from "@google/genai";
// --- SharedUtils.ts code inlined below ---
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';

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
      console.warn('[auth] FIREBASE_SERVICE_ACCOUNT not set. Token verification is DISABLED.');
      firebaseAuthAvailable = false;
      return null;
    }
  }
  if (!firebaseAuthAvailable) return null;
  return getAuth();
}

const ALLOWED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-lite',
]);

const PartSchema = z.object({
  text: z.string().optional(),
  inlineData: z.object({
    mimeType: z.string(),
    data: z.string(),
  }).optional(),
});

const ContentSchema = z.object({
  role: z.string().optional(),
  parts: z.array(PartSchema),
});

const SafetySettingSchema = z.object({
  category: z.string(),
  threshold: z.string(),
});

const SafeConfigSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(100).optional(),
  maxOutputTokens: z.number().int().min(1).max(65536).optional(),
  responseMimeType: z.enum(['text/plain', 'application/json']).optional(),
  responseSchema: z.any().optional(),
  thinkingConfig: z.object({
    thinkingBudget: z.number().int().min(0).max(24576).optional(),
  }).optional(),
  systemInstruction: z.union([z.string(), ContentSchema]).optional(),
  safetySettings: z.array(SafetySettingSchema).optional(),
  responseModalities: z.array(z.string()).optional(),
}).passthrough().optional();

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

function setCorsHeaders(res: VercelResponse) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://math-curriculum-ai-navigator.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function authenticateAndValidate(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return null;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return null;
  }
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
    if (process.env.NODE_ENV === 'production') {
        console.error('[auth] CRITICAL: FIREBASE_SERVICE_ACCOUNT missing in production!');
        res.status(500).json({ error: 'Server authentication configuration error' });
        return null;
    }
    console.warn('[auth] Skipping token verification — Firebase Admin not available (Development Mode)');
  }
  const parsed = GeminiRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`
    ).join('; ');
    
    // Log the failing body for debugging
    console.error('[validation] Invalid Gemini request body:', JSON.stringify(req.body, null, 2));
    console.error('[validation] Issues:', issues);
    
    res.status(400).json({ error: `Invalid request: ${issues}` });
    return null;
  }
  return parsed.data;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      apiVersion: 'v1' // Use stable v1 API
    });
    const { model, contents, config } = validated;

    // Use gemini-2.0-flash by default if 1.5-flash fails in this SDK
    const targetModel = model === 'gemini-1.5-flash' ? 'gemini-2.0-flash' : model;

    const normalizedContents: Content[] = typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents as Content[];

    // Extract systemInstruction from config if present
    const { systemInstruction, ...restConfig } = (config || {}) as any;

    // Map camelCase to snake_case for new SDK v1
    const mappedConfig = {
      temperature: restConfig.temperature,
      top_p: restConfig.topP,
      top_k: restConfig.topK,
      candidate_count: restConfig.candidateCount,
      max_output_tokens: restConfig.maxOutputTokens,
      stop_sequences: restConfig.stopSequences,
      response_mime_type: restConfig.responseMimeType,
      response_schema: restConfig.responseSchema,
      presence_penalty: restConfig.presencePenalty,
      frequency_penalty: restConfig.frequencyPenalty,
    };

    // Remove undefined fields
    Object.keys(mappedConfig).forEach(key => (mappedConfig as any)[key] === undefined && delete (mappedConfig as any)[key]);

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: normalizedContents,
      systemInstruction: systemInstruction,
      config: mappedConfig as any,
    });

    res.status(200).json({
      text: response.text,
      candidates: response.candidates,
    });
  } catch (error) {
    console.error('[/api/gemini] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('429') ? 429 :
                   message.includes('403') ? 403 :
                   message.includes('400') ? 400 : 500;
    res.status(status).json({ error: message });
  }
}
