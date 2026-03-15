import type { VercelRequest, VercelResponse } from '@vercel/node';
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

  // Normalize model — imagen-4 is not available on Gemini Developer API v1beta
  let modelName = model || 'imagen-3.0-generate-001';
  if (modelName.startsWith('imagen-4') || modelName === 'imagen-3' || modelName === 'imagen-3-fast') {
    modelName = 'imagen-3.0-generate-001';
  }

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
      // Imagen models use the generateImages endpoint, NOT generateContent
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateImages?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: { text: prompt },
          number_of_images: 1,
          aspect_ratio: '16:9',
          safety_filter_level: 'BLOCK_SOME',
          person_generation: 'DONT_ALLOW',
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`[${response.status}] ${errBody}`);
      }

      const data = await response.json();
      const prediction = data.predictions?.[0];
      if (prediction?.bytesBase64Encoded) {
        return res.status(200).json({
          inlineData: {
            mimeType: prediction.mimeType || 'image/png',
            data: prediction.bytesBase64Encoded,
          },
        });
      }

      throw new Error('AI did not return image data');
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
