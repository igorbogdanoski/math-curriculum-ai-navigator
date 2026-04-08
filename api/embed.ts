import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

type GeminiPart = { text?: string };
type GeminiContent = { parts?: GeminiPart[] };

function extractEmbeddingText(contents: unknown): string {
  if (typeof contents === 'string') {
    return contents;
  }

  if (Array.isArray(contents)) {
    const firstItem = contents[0] as GeminiPart | GeminiContent | undefined;
    if (firstItem && typeof firstItem === 'object') {
      if ('text' in firstItem && typeof firstItem.text === 'string') {
        return firstItem.text;
      }
      if ('parts' in firstItem && Array.isArray(firstItem.parts)) {
        const firstPart = firstItem.parts[0];
        if (firstPart && typeof firstPart.text === 'string') {
          return firstPart.text;
        }
      }
    }
  }

  return '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return;

  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((k): k is string => !!k && k.trim().length > 10);

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server.' });
  }

  const { model, contents } = validated;
  const text = extractEmbeddingText(contents);
  const responseShape = req.query.responseShape === 'embeddings' ? 'embeddings' : 'embedding';

  if (!text) {
    return res.status(400).json({ error: 'Missing text for embedding' });
  }

  let lastError: Error | null = null;
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelInstance = genAI.getGenerativeModel({ model: model || "text-embedding-004" });
      
      const result = await modelInstance.embedContent(text);
      const embedding = result.embedding;

      if (responseShape === 'embeddings') {
        return res.status(200).json({ embeddings: embedding });
      }

      return res.status(200).json({ embedding });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      const isQuota = msg.includes('429');
      const isInvalidKey = msg.includes('API_KEY_INVALID') || msg.includes('API key expired');
      
      if ((isQuota || isInvalidKey) && i < apiKeys.length - 1) {
        continue;
      }
      break;
    }
  }

  console.error('[/api/embed] Error:', lastError);
  res.status(500).json({ error: lastError?.message || 'Internal server error' });
}
