import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Content } from "@google/genai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const { model, contents, config } = validated;

    // Normalize contents to SDK structure
    const normalizedContents: Content[] = (typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents as any[]).map(c => ({
        role: c.role || 'user',
        parts: c.parts.map((p: any) => {
          if (p.text) return { text: p.text };
          if (p.inlineData || p.inline_data) {
            const data = p.inlineData || p.inline_data;
            return {
              inlineData: {
                mimeType: data.mimeType || data.mime_type,
                data: data.data
              }
            };
          }
          return p;
        })
      }));

    // Map config to SDK v1 structure
    const { systemInstruction, safetySettings, ...generationConfig } = config || {};

    const result = await client.models.generateContent({
      model,
      contents: normalizedContents,
      systemInstruction,
      safetySettings,
      ...generationConfig,
    });

    if (!result) {
      throw new Error("No response from AI service.");
    }

    res.status(200).json({
      text: result.text,
      candidates: result.candidates,
    });
  } catch (error) {
    console.error('[/api/gemini] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('429') ? 429 :
                   message.includes('403') ? 403 :
                   message.includes('400') ? 400 : 500;
    res.status(status).json({ error: message });
  }
}
