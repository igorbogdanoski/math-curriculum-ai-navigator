import { GoogleGenAI } from "@google/genai";

/**
 * Vercel Serverless Function: Gemini API Proxy
 * 
 * Handles non-streaming generateContent calls.
 * The GEMINI_API_KEY is only available server-side (never sent to the browser).
 */
export default async function handler(req, res) {
  // CORS headers
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://math-curriculum-ai-navigator.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    const response = await ai.models.generateContent({ model, contents, config });

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
