import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI, Content, GenerationConfig } from "@google/genai";
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
    const genAI = new GoogleGenerativeAI(apiKey);
    const { model, contents, config } = validated;

    // Use v1beta for better compatibility with all models including flash 2.0 and thinking
    const modelInstance = genAI.getGenerativeModel(
      { model }, 
      { apiVersion: 'v1beta' }
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

    // Map config to the structure expected by the SDK
    const { systemInstruction, safetySettings, ...generationConfig } = config || {};

    // Generate content
    const result = await modelInstance.generateContent({
      contents: normalizedContents,
      systemInstruction,
      safetySettings,
      generationConfig,
    });

    const response = result.response;
    
    // Check for candidates
    if (!response.candidates || response.candidates.length === 0) {
      const blockReason = response.promptFeedback?.blockReason;
      throw new Error(blockReason ? `Content blocked: ${blockReason}` : "No candidates returned from AI.");
    }

    // Safely extract text (can throw if blocked)
    let text = "";
    try {
      text = response.text();
    } catch (e) {
      console.error('[/api/gemini] Text extraction failed:', e);
      // If we have a candidate but text() fails, it's often a safety finishReason
      const finishReason = response.candidates[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        throw new Error(`AI generation stopped early: ${finishReason}`);
      }
      throw e;
    }

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
