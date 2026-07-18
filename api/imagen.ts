import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, authenticateAndValidate, requireSufficientCredits, getRequestPrincipal } from './_lib/sharedUtils.js';
import { recordLatency } from './_lib/sloTracker.js';
import { recordTokens } from './_lib/costTracker.js';
import { reserveCredits, refundCredits } from './_lib/aiCredits.js';
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

interface ImageGenResult {
  mimeType: string;
  data: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

// Vercel Hobby plan: 10s max — use Gemini Flash image generation only (Imagen 3/4 require Vertex AI and are too slow)
async function tryGeminiImageGen(apiKey: string, prompt: string): Promise<ImageGenResult | null> {
  const candidates = [
    'gemini-3.1-flash-image',              // recommended migration target (replaces Imagen 4)
    'gemini-2.5-flash-image',              // Tier 1 fallback
    'gemini-3.1-flash-image-preview',      // preview fallback
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
      const usage = (result?.response as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } } | undefined)?.usageMetadata;
      if (imgPart?.inlineData) {
        return {
          mimeType: imgPart.inlineData.mimeType || 'image/png',
          data: imgPart.inlineData.data,
          model: modelName,
          tokensIn: usage?.promptTokenCount ?? 0,
          tokensOut: usage?.candidatesTokenCount ?? 0,
        };
      }
      console.warn(`[imagen] ${modelName}: no image parts in response`);
    } catch (err: any) {
      const msg: string = err?.message || String(err);
      const isExpired = msg.includes('API key expired') || msg.includes('API_KEY_INVALID');
      const is404 = msg.includes('404');
      console.error(`[imagen] ${modelName} error [expired=${isExpired} 404=${is404}]:`, msg.slice(0, 150));
      // If key is expired/invalid, no point trying other models with same key
      if (isExpired) throw err;
    }
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handlerStart = Date.now();
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) { recordLatency('imagen-proxy', Date.now() - handlerStart); return; }

  if (!(await requireSufficientCredits(req, res))) { recordLatency('imagen-proxy', Date.now() - handlerStart); return; }

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

  // Atomic check-and-deduct — see aiCredits.ts's reserveCredits() doc comment.
  // requireSufficientCredits() above was only a fast-path pre-check. This route only ever
  // generates images — default to ILLUSTRATION rather than aiCredits.ts's generic TEXT_BASIC
  // fallback if the caller didn't specify a costKey (matches the prior deductCreditsServerSide
  // call's own costKey default). No model-dependent floor here (no `model` arg passed), so no
  // need to wait for a model to be chosen first.
  const principal = getRequestPrincipal(req);
  const reservation = await reserveCredits(principal, validated.costKey ?? 'ILLUSTRATION');
  if (!reservation.ok) {
    recordLatency('imagen-proxy', Date.now() - handlerStart);
    return res.status(402).json({ error: 'Insufficient AI credits.', quotaType: 'credits' });
  }

  let lastError: Error | null = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    const keyHint = `key[${i}]=...${apiKey.slice(-6)}`;
    try {
      const s2result = await tryGeminiImageGen(apiKey, prompt);
      if (s2result) {
        const { mimeType, data, model, tokensIn, tokensOut } = s2result;
        try {
          recordTokens({ userId: principal, model, tokensIn, tokensOut });
        } catch {
          // best-effort — never break the response path
        }
        recordLatency('imagen-proxy', Date.now() - handlerStart);
        // Already reserved atomically above — nothing further to deduct on success.
        return res.status(200).json({ inlineData: { mimeType, data } });
      }

      lastError = new Error('AI did not return image data from any strategy (check Vercel logs for details)');
      if (i < apiKeys.length - 1) continue;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      const isQuota = msg.includes('429');
      const isInvalidKey = msg.includes('API_KEY_INVALID') || msg.includes('API key expired');

      console.error(`[imagen] ${keyHint} failed — quota=${isQuota} invalidKey=${isInvalidKey}: ${msg.slice(0, 120)}`);

      if ((isQuota || isInvalidKey) && i < apiKeys.length - 1) {
        continue;
      }
      break;
    }
  }

  // All keys/strategies exhausted — refund the reservation, no image was delivered.
  await refundCredits(principal, reservation.amount);
  recordLatency('imagen-proxy', Date.now() - handlerStart);
  console.error('[/api/imagen] Error:', lastError);
  // Never forward the raw upstream SDK error text to the client — same "never leak
  // internals" principle already applied to validation errors in sharedUtils.ts.
  res.status(500).json({ error: 'Серверска грешка при генерирање слика.' });
}
