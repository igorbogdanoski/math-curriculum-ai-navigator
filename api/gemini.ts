import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";
import { setCorsHeaders, authenticateAndValidate } from './sharedUtils.js';

/**
 * Vercel Serverless Function: Gemini API Proxy (non-streaming)
 * 
 * Security layers:
 * 1. CORS — only allowed origin
 * 2. Firebase ID token verification
 * 3. Zod request body validation (model whitelist, config sanitization)
 * 4. GEMINI_API_KEY server-side only
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return; // Response already sent

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { model, contents, config } = validated;

    const response = await ai.models.generateContent({ model, contents, config: config as unknown as import("@google/genai").GenerateContentConfig });

    res.status(200).json({
      text: response.text || '',
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
