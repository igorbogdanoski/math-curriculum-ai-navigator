import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return;

  const { model, contents } = validated;
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelInstance = genAI.getGenerativeModel({ 
      model: model || 'text-embedding-004' 
    });
    
    // Google AI Studio SDK: embedContent accepts the parts directly
    const result = await modelInstance.embedContent({
      content: { role: 'user', parts: contents as any[] }
    });
    
    return res.status(200).json({ embeddings: result.embedding });
  } catch (error: any) {
    console.error('[/api/gemini-embed] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
