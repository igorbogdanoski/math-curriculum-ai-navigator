import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

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
  const prompt = typeof contents === 'string' 
    ? contents 
    : (contents as any[])[0]?.parts[0]?.text || '';

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt for image generation' });
  }

  let lastError: Error | null = null;
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // Use the provided model or fallback to imagen-3.0-generate-001
      const modelName = model || 'imagen-3.0-generate-001';
      const modelInstance = genAI.getGenerativeModel({ model: modelName });
      
      const result = await modelInstance.generateContent(prompt);
      const response = await result.response;
      
      // Imagen returns image data in the parts
      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData) {
        return res.status(200).json({ 
          inlineData: {
            mimeType: part.inlineData.mimeType,
            data: part.inlineData.data
          }
        });
      }
      
      throw new Error("AI did not return image data");
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

  console.error('[/api/imagen] Error:', lastError);
  res.status(500).json({ error: lastError?.message || 'Internal server error' });
}
