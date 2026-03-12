import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

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

  const { model, contents, config } = validated;
  let modelName = model;
  if (modelName.includes('flash') || modelName === 'gemini-3.1-flash') modelName = 'gemini-2.0-flash';
  else if (modelName.includes('thinking') || modelName.includes('pro') || modelName === 'gemini-3.1-pro') modelName = 'gemini-1.5-pro';
  else modelName = 'gemini-2.0-flash'; // Global fallback for safety

  const { systemInstruction, safetySettings, ...generationConfig } = config || {};

  // Normalize contents once — reused across key rotation attempts
  const normalizedContents: Content[] = (typeof contents === 'string'
    ? [{ role: 'user', parts: [{ text: contents }] }]
    : contents as any[]).map(c => ({
      role: (c.role === 'assistant' || c.role === 'model') ? 'model' : 'user',
      parts: c.parts.map((p: any) => {
        if (p.text) return { text: p.text };
        if (p.inlineData || p.inline_data) {
          const data = p.inlineData || p.inline_data;
          return { inlineData: { mimeType: data.mimeType || data.mime_type, data: data.data } };
        }
        return p;
      })
    }));

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
      const modelInstance = genAI.getGenerativeModel({ model: modelName, safetySettings: safetySettings as any });
      const result = await modelInstance.generateContent({
        contents: normalizedContents,
        generationConfig: generationConfig as any,
      });
      const response = await result.response;
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error("No candidates returned. Likely safety block.");
      }
      return res.status(200).json({ text: response.text(), candidates: response.candidates });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      const isDailyQuota = msg.includes('429') && (
        msg.includes('PerDay') || msg.includes('per_day') ||
        msg.includes('free_tier') || msg.includes('quota')
      );
      if (isDailyQuota && i < apiKeys.length - 1) {
        console.warn(`[/api/gemini] Key ${i + 1}/${apiKeys.length} daily quota exhausted, trying next key...`);
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
  const isDailyQuota = status === 429 && (
    message.includes('PerDay') || message.includes('per_day') ||
    message.includes('free_tier') || message.includes('quota')
  );
  res.status(status).json({ error: message, quotaType: isDailyQuota ? 'daily' : 'rate' });
}
