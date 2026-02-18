import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return;

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    const envKeys = Object.keys(process.env).filter(k => k.includes('GEMINI'));
    return res.status(500).json({ 
      error: 'GEMINI_API_KEY not configured on server.',
      diagnostics: {
        foundKeys: envKeys,
        nodeEnv: process.env.NODE_ENV,
        message: 'Please rename VITE_GEMINI_API_KEY to GEMINI_API_KEY in Vercel settings if missing.'
      }
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const { model, contents, config } = validated;

    // Map config to generationConfig
    const { systemInstruction, safetySettings, ...generationConfig } = config || {};

    // Use the latest flash model name which is more robust against 404s
    const targetModel = model === 'gemini-1.5-flash' ? 'gemini-1.5-flash-latest' : model;

    const modelInstance = genAI.getGenerativeModel({ 
      model: targetModel,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction as string }] } : undefined,
      safetySettings: safetySettings as any,
    });

    // Normalize contents to content objects
    const normalizedContents: Content[] = (typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents as any[]).map(c => ({
        role: (c.role === 'assistant' || c.role === 'model') ? 'model' : 'user',
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

    const result = await modelInstance.generateContent({
      contents: normalizedContents,
      generationConfig: generationConfig as any,
    });

    const response = await result.response;
    
    // Safety check for candidates
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No candidates returned. Likely safety block.");
    }

    const text = response.text();

    res.status(200).json({
      text: text,
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
