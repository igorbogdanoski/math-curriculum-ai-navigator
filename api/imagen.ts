import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

// Vercel Hobby plan: 10s max — use Gemini Flash image generation only (Imagen 3/4 require Vertex AI and are too slow)
async function tryGeminiImageGen(apiKey: string, prompt: string): Promise<{ mimeType: string; data: string } | null> {
  const candidates = [
    'gemini-2.0-flash',                          // stable — supports image gen as of 2026
    'gemini-2.0-flash-exp',                       // exp alias fallback
    'gemini-2.0-flash-preview-image-generation',  // legacy name fallback
  ];

  for (const modelName of candidates) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel(
        { model: modelName },
        { apiVersion: 'v1beta' },
      );

      type ImageGenRequest = Parameters<GenerativeModel['generateContent']>[0] & { generationConfig?: { responseModalities?: string[] } };
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      } as ImageGenRequest);

      const parts: any[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
      const imgPart = parts.find((p: any) => p.inlineData?.data);
      if (imgPart?.inlineData) {
        console.log(`[imagen] Strategy 2 succeeded with model: ${modelName}`);
        return { mimeType: imgPart.inlineData.mimeType || 'image/png', data: imgPart.inlineData.data };
      }
      console.warn(`[imagen] Strategy 2 model ${modelName}: no image parts in response`);
    } catch (err: any) {
      console.error(`[imagen] Strategy 2 model ${modelName} error:`, err?.message || err);
    }
  }
  return null;
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

  const { contents } = validated;
  const prompt = typeof contents === 'string'
    ? contents
    : (contents as Array<{ parts: Array<{ text?: string }> }>)[0]?.parts[0]?.text || '';

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt for image generation' });
  }

  let lastError: Error | null = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      const s2result = await tryGeminiImageGen(apiKey, prompt);
      if (s2result) {
        return res.status(200).json({ inlineData: s2result });
      }

      // Both strategies returned null for this key — try next key if available
      lastError = new Error('AI did not return image data from any strategy (check Vercel logs for details)');
      if (i < apiKeys.length - 1) continue;
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
