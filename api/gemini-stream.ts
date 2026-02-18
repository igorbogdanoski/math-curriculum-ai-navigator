import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content } from "@google/generative-ai";
import { setCorsHeaders, authenticateAndValidate } from './_lib/sharedUtils.js';

/**
 * Vercel Serverless Function: Gemini Streaming API Proxy
 * 
 * Security layers:
 * 1. CORS — only allowed origin
 * 2. Firebase ID token verification
 * 3. Zod request body validation (model whitelist, config sanitization)
 * 4. GEMINI_API_KEY server-side only
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  const validated = await authenticateAndValidate(req, res);
  if (!validated) return; // Response already sent

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const { model, contents, config } = validated;

    // Map config to SDK structure
    const { systemInstruction, safetySettings, ...generationConfig } = config || {};

    // Dynamic API version selection
    const isExperimental = model.includes('thinking') || model.includes('2.0') || model.includes('exp');
    const apiVersion = isExperimental ? 'v1beta' : 'v1';

    const modelInstance = genAI.getGenerativeModel(
      { 
        model,
        systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction as string }] } : undefined,
        safetySettings: safetySettings as any,
      }, 
      { apiVersion }
    );

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
    
    // If headers haven't been sent yet, send error as JSON
    if (!res.headersSent) {
      const status = message.includes('429') ? 429 :
                     message.includes('403') ? 403 : 500;
      return res.status(status).json({ error: message });
    }
    
    // If streaming already started, send error as SSE event
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
}
