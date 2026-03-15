import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Try Imagen 3 via the `:predict` REST endpoint (Vertex-compatible path on Gemini Developer API).
 * Returns { mimeType, data } on success, null on failure (logs the error).
 */
async function tryImagenPredict(apiKey: string, prompt: string): Promise<{ mimeType: string; data: string } | null> {
  // Try Imagen 4 first, fall back to Imagen 3
  const models = ['imagen-4.0-generate-001', 'imagen-3.0-generate-001'];
  for (const modelName of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '16:9',
            safetyFilterLevel: 'block_some',
            personGeneration: 'dont_allow',
          },
        }),
      });
    } catch (fetchErr) {
      console.error(`[imagen] ${modelName} fetch error:`, fetchErr);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '(unreadable)');
      console.error(`[imagen] ${modelName} failed [${res.status}]:`, body);
      continue;
    }

    const data = await res.json();
    const prediction = data.predictions?.[0];
    if (prediction?.bytesBase64Encoded) {
      return { mimeType: prediction.mimeType || 'image/png', data: prediction.bytesBase64Encoded };
    }
    console.warn(`[imagen] ${modelName}: response ok but no predictions:`, JSON.stringify(data).slice(0, 300));
  }
  return null;
}

/**
 * Fallback: use Gemini Flash image generation via generateContent + responseModalities: ["IMAGE"].
 * Tries multiple model aliases in order.
 * Returns { mimeType, data } on success, null on failure.
 */
async function tryGeminiImageGen(apiKey: string, prompt: string): Promise<{ mimeType: string; data: string } | null> {
  const candidates = [
    'gemini-2.0-flash-preview-image-generation',
    'gemini-2.0-flash-exp',
  ];

  for (const modelName of candidates) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel(
        { model: modelName },
        { apiVersion: 'v1beta' },
      );

      const result = await (model as any).generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      });

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
    : (contents as any[])[0]?.parts[0]?.text || '';

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt for image generation' });
  }

  let lastError: Error | null = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      // Strategy 1: Imagen 3/4 via :predict endpoint
      const s1result = await tryImagenPredict(apiKey, prompt);
      if (s1result) {
        console.log('[imagen] Strategy 1 (Imagen :predict) succeeded');
        return res.status(200).json({ inlineData: s1result });
      }

      // Strategy 2: Gemini Flash image generation fallback
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
