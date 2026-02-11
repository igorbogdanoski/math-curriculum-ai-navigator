import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Content, GenerationConfig } from "@google/genai";
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
    // Force stable v1 API version
    const ai = new GoogleGenAI({ 
      apiKey,
      apiVersion: 'v1' 
    });
    const { model, contents, config } = validated;

    // Normalize contents
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

    // Pass parameters directly to the model
    const response = await ai.models.generateContent({
      model: model.replace('models/', ''), // Ensure no double prefix
      contents: normalizedContents,
      ...config,
    });

    res.status(200).json({
      text: response.text,
      candidates: response.candidates,
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
