import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Content, GenerationConfig } from "@google/genai";
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
    const ai = new GoogleGenAI({ 
      apiKey,
      apiVersion: 'v1'
    });
    const { model, contents, config } = validated;

    const targetModel = model === 'gemini-1.5-flash' ? 'gemini-2.0-flash' : model;

    const normalizedContents: Content[] = typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents as Content[];

    // Extract systemInstruction from config if present
    const { systemInstruction, ...restConfig } = (config || {}) as any;

    // Map camelCase to snake_case for new SDK v1
    const mappedConfig = {
      temperature: restConfig.temperature,
      top_p: restConfig.topP,
      top_k: restConfig.topK,
      candidate_count: restConfig.candidateCount,
      max_output_tokens: restConfig.maxOutputTokens,
      stop_sequences: restConfig.stopSequences,
      response_mime_type: restConfig.responseMimeType,
      response_schema: restConfig.responseSchema,
      presence_penalty: restConfig.presencePenalty,
      frequency_penalty: restConfig.frequencyPenalty,
    };

    // Remove undefined fields
    Object.keys(mappedConfig).forEach(key => (mappedConfig as any)[key] === undefined && delete (mappedConfig as any)[key]);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const responseStream = await ai.models.generateContentStream({
      model: targetModel,
      contents: normalizedContents,
      systemInstruction: systemInstruction,
      config: mappedConfig as any,
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
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
