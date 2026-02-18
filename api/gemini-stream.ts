import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return; // Response already sent

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

    // 1. УНИВЕРЗАЛНО ВМЕТНУВАЊЕ (Content Injection)
    const { systemInstruction, safetySettings, ...generationConfig } = config || {};

    // Normalize contents
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

    // Ако има инструкции, ги лепиме на почетокот на првата порака
    if (systemInstruction && typeof systemInstruction === 'string' && normalizedContents.length > 0) {
      const instructionText = `[SYSTEM INSTRUCTIONS]\n${systemInstruction}\n\n[USER REQUEST]\n`;
      normalizedContents[0].parts[0].text = instructionText + (normalizedContents[0].parts[0].text || '');
    }

    // 2. Иницијализација БЕЗ systemInstruction (за да избегнеме 400/404)
    const modelInstance = genAI.getGenerativeModel({ 
      model: model,
      safetySettings: safetySettings as any,
    });

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await modelInstance.generateContentStream({
      contents: normalizedContents,
      generationConfig: generationConfig as any,
    });

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('[/api/gemini-stream] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    if (!res.headersSent) {
      const status = message.includes('429') ? 429 :
                     message.includes('403') ? 403 : 500;
      return res.status(status).json({ error: message });
    }
    
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
}
