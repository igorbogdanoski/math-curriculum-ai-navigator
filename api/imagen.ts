import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Try Imagen 3 via the `:predict` REST endpoint (Vertex-compatible path on Gemini Developer API).
 * Returns { mimeType, data } on success, null on failure.
 */
async function tryImagenPredict(apiKey: string, prompt: string): Promise<{ mimeType: string; data: string } | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;
  const res = await fetch(url, {
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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${res.status}] ${body}`);
  }

  const data = await res.json();
  const prediction = data.predictions?.[0];
  if (prediction?.bytesBase64Encoded) {
    return { mimeType: prediction.mimeType || 'image/png', data: prediction.bytesBase64Encoded };
  }
  return null;
}

/**
 * Fallback: use gemini-2.0-flash-preview-image-generation via standard generateContent
 * with responseModalities: ["IMAGE"].
 * Returns { mimeType, data } on success, null on failure.
 */
async function tryGeminiImageGen(apiKey: string, prompt: string): Promise<{ mimeType: string; data: string } | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    { model: 'gemini-2.0-flash-preview-image-generation' },
    { apiVersion: 'v1beta' },
  );

  const result = await (model as any).generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ['IMAGE'] },
  });

  const parts: any[] = result?.response?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p: any) => p.inlineData?.data);
  if (imgPart?.inlineData) {
    return { mimeType: imgPart.inlineData.mimeType || 'image/png', data: imgPart.inlineData.data };
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
      // Strategy 1: Imagen 3 via :predict endpoint
      let result = await tryImagenPredict(apiKey, prompt).catch(() => null);

      // Strategy 2: Gemini Flash image generation (free-tier compatible fallback)
      if (!result) {
        result = await tryGeminiImageGen(apiKey, prompt);
      }

      if (result) {
        return res.status(200).json({ inlineData: result });
      }

      throw new Error('AI did not return image data from any strategy');
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
