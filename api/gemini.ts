import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content, SafetySetting, GenerationConfig, type Tool } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

// Increase body size limit to 10 MB to support PDF inline data uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return;

  // Collect all configured API keys (supports up to 6 keys for rotation)
  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
  ].filter((k): k is string => !!k && k.trim().length > 10);

  if (apiKeys.length === 0) {
    const envKeys = Object.keys(process.env).filter(k => k.includes('GEMINI'));
    return res.status(500).json({
      error: 'GEMINI_API_KEY not configured on server.',
      diagnostics: { foundKeys: envKeys, nodeEnv: process.env.NODE_ENV }
    });
  }

  const { model, contents, config, tools } = validated;
  let modelName = model;
  
  // Upgrade logic: route to best available models on paid tier
  if (modelName.includes('3.1') || modelName.includes('3-pro') || modelName.includes('ultra')) modelName = 'gemini-3.1-pro-preview';
  else if (modelName.includes('pro')) modelName = 'gemini-2.5-pro';
  else if (modelName.includes('flash')) modelName = 'gemini-2.5-flash';
  else modelName = 'gemini-2.5-flash';

  const { systemInstruction, safetySettings, ...generationConfig } = config || {};

  // Normalize contents once — reused across key rotation attempts
  type RawPart = { text?: string; inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } };
  type RawContent = { role?: string; parts: RawPart[] };
  const rawContents: RawContent[] = typeof contents === 'string'
    ? [{ role: 'user', parts: [{ text: contents }] }]
    : (contents as RawContent[]);
  const normalizedContents: Content[] = rawContents.map(c => ({
      role: (c.role === 'assistant' || c.role === 'model') ? 'model' : 'user',
      parts: c.parts.map((p): { text: string } | { inlineData: { mimeType: string; data: string } } => {
        if (p.inlineData || p.inline_data) {
          const d = p.inlineData ?? p.inline_data!;
          const mimeType = (d as { mimeType?: string }).mimeType ?? (d as { mime_type?: string }).mime_type ?? '';
          return { inlineData: { mimeType, data: d.data ?? '' } };
        }
        return { text: p.text ?? '' };
      }),
    })) as Content[];

  if (systemInstruction && typeof systemInstruction === 'string' && normalizedContents.length > 0) {
    const instructionText = `[SYSTEM INSTRUCTIONS]\n${systemInstruction}\n\n[USER REQUEST]\n`;
    normalizedContents[0].parts[0].text = instructionText + (normalizedContents[0].parts[0].text || '');
  }

  // Try each API key in order; skip to next on daily quota exhaustion (429)
  let lastError: Error | null = null;
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const modelInstance = genAI.getGenerativeModel({ model: modelName, safetySettings: safetySettings as SafetySetting[] });
      const result = await modelInstance.generateContent({
        contents: normalizedContents,
        generationConfig: generationConfig as GenerationConfig,
        ...(tools && tools.length > 0 ? { tools: tools as Tool[] } : {}),
      });
      const response = await result.response;
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned. Likely safety block.");
      }
      const groundingMetadata = response.candidates[0]?.groundingMetadata ?? null;
      return res.status(200).json({ text: response.text(), candidates: response.candidates, groundingMetadata });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      const isDailyQuota = msg.includes('429') && (
        msg.includes('PerDay') || msg.includes('per_day') ||
        msg.includes('free_tier') || msg.includes('quota')
      );
      const isInvalidKey = msg.includes('API_KEY_INVALID') || msg.includes('API key expired') || msg.includes('API key not valid');
      if ((isDailyQuota || isInvalidKey) && i < apiKeys.length - 1) {
        console.warn(`[/api/gemini] Key ${i + 1}/${apiKeys.length} ${isInvalidKey ? 'invalid/expired' : 'daily quota exhausted'}, trying next key...`);
        continue; // try next key
      }
      break; // non-quota error or last key — stop
    }
  }

  // All keys exhausted or non-recoverable error
  console.error('[/api/gemini] Error:', lastError);
  const message = lastError?.message ?? 'Internal server error';
  const status = message.includes('429') ? 429 :
                 message.includes('403') ? 403 :
                 message.includes('400') ? 400 : 500;

  // Distinguish quota types so client can handle correctly:
  // - 'daily'      → free-tier daily limit hit, all keys exhausted. Block for 24h.
  // - 'rate_limit' → transient rate limit (paid tier or per-minute cap). Retry after 60s.
  // - 'rate'       → generic / unknown 429
  const isDailyQuota = status === 429 && (
    message.includes('PerDay') || message.includes('per_day') ||
    message.includes('free_tier') || message.includes('quota')
  );
  const isRateLimit = status === 429 && !isDailyQuota;
  const quotaType = isDailyQuota ? 'daily' : isRateLimit ? 'rate_limit' : 'rate';

  res.status(status).json({
    error: message,
    quotaType,
    keysExhausted: apiKeys.length,
    retryAfterMs: isRateLimit ? 60_000 : undefined,
  });
}
