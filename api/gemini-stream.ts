import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return; // Response already sent

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
  // Upgrade logic: intelligent mapping to latest stable/available models
  if (modelName === 'gemini-1.5-flash' || modelName === 'gemini-1.5-flash-latest') modelName = 'gemini-2.0-flash';
  else if (modelName.includes('thinking')) modelName = 'gemini-2.0-flash-thinking-exp-01-21';
  else if (modelName.includes('pro') && !modelName.includes('1.5')) modelName = 'gemini-2.0-pro-exp-02-05';
  else if (modelName === 'gemini-1.5-pro-latest') modelName = 'gemini-1.5-pro';
  // Allow gemini-2.5 and gemini-3.x models to pass through if they are in the whitelist

  const { systemInstruction, safetySettings, ...generationConfig } = config || {};

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

  // Try each API key; on daily quota 429, rotate to next key
  let lastError: Error | null = null;
  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const genAI = new GoogleGenerativeAI(apiKeys[i]);
      const modelInstance = genAI.getGenerativeModel({ model: modelName, safetySettings: safetySettings as any });

      // Set SSE headers before streaming starts
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      const result = await modelInstance.generateContentStream({
        contents: normalizedContents,
        generationConfig: generationConfig as any,
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
      res.end();
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const msg = lastError.message;
      const isDailyQuota = msg.includes('429') && (
        msg.includes('PerDay') || msg.includes('per_day') ||
        msg.includes('free_tier') || msg.includes('quota')
      );
      if (isDailyQuota && i < apiKeys.length - 1 && !res.headersSent) {
        console.warn(`[/api/gemini-stream] Key ${i + 1}/${apiKeys.length} daily quota exhausted, trying next...`);
        continue;
      }
      break;
    }
  }

  console.error('[/api/gemini-stream] Error:', lastError);
  const message = lastError?.message ?? 'Internal server error';
  if (!res.headersSent) {
    const status = message.includes('429') ? 429 : message.includes('403') ? 403 : 500;
    const isDailyQuota = status === 429 && (
      message.includes('PerDay') || message.includes('per_day') ||
      message.includes('free_tier') || message.includes('quota')
    );
    return res.status(status).json({ error: message, quotaType: isDailyQuota ? 'daily' : 'rate' });
  }
  res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  res.end();
}
