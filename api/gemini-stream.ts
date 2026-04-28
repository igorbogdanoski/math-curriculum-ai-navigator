import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content, SafetySetting, GenerationConfig } from "@google/generative-ai";
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
  
  // Upgrade logic: route to best available models on paid tier
  if (modelName.includes('pro')) modelName = 'gemini-2.5-pro';
  else if (modelName.includes('flash')) modelName = 'gemini-2.5-flash';
  else modelName = 'gemini-2.5-flash';

  const { systemInstruction, safetySettings, ...generationConfig } = config || {};

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

  // Try each API key; on daily quota 429, rotate to next key.
  // IMPORTANT: SSE headers are set only after the first successful chunk to allow
  // proper key rotation on failure (once headers are sent the response is committed).
  let lastError: Error | null = null;
  for (let i = 0; i < apiKeys.length; i++) {
    try {
      const genAI = new GoogleGenerativeAI(apiKeys[i]);
      const modelInstance = genAI.getGenerativeModel({ model: modelName, safetySettings: safetySettings as SafetySetting[] });

      const result = await modelInstance.generateContentStream({
        contents: normalizedContents,
        generationConfig: generationConfig as GenerationConfig,
      });

      // Stream started successfully — now commit SSE headers
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
      }

      for await (const chunk of result.stream) {
        const parts = (chunk.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[];
        if (parts.length > 0) {
          for (const part of parts) {
            if (!part.text) continue;
            if (part.thought) {
              res.write(`data: ${JSON.stringify({ thinking: part.text })}\n\n`);
            } else {
              res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
            }
          }
        } else {
          // Fallback for models that don't expose parts
          const chunkText = chunk.text();
          if (chunkText) res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
        }
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
      const isInvalidKey = msg.includes('API_KEY_INVALID') || msg.includes('API key expired') || msg.includes('API key not valid');
      // Only rotate if headers haven't been committed yet (streaming hasn't started)
      if ((isDailyQuota || isInvalidKey) && i < apiKeys.length - 1 && !res.headersSent) {
        console.warn(`[/api/gemini-stream] Key ${i + 1}/${apiKeys.length} ${isInvalidKey ? 'invalid/expired' : 'daily quota exhausted'}, trying next...`);
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
