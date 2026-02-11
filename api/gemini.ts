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
    const ai = new GoogleGenAI({ 
      apiKey,
      apiVersion: 'v1beta' // Switch to v1beta for better model availability and features
    });
    const { model, contents, config } = validated;

    const targetModel = model;

    const normalizedContents: Content[] = (typeof contents === 'string'
      ? [{ role: 'user', parts: [{ text: contents }] }]
      : contents as any[]).map(c => ({
        role: c.role || 'user',
        parts: c.parts.map((p: any) => {
          const part: any = {};
          if (p.text) part.text = p.text;
          if (p.inlineData || p.inline_data) {
            const data = p.inlineData || p.inline_data;
            part.inline_data = {
              mime_type: data.mimeType || data.mime_type,
              data: data.data
            };
          }
          return part;
        })
      }));

    // Extract systemInstruction from config if present (support both camelCase and snake_case)
    const { systemInstruction, system_instruction, ...restConfig } = (config || {}) as any;
    let finalSystemInstruction = systemInstruction || system_instruction;
    
    // Normalize system instruction to Content object if it's a string
    if (typeof finalSystemInstruction === 'string') {
        finalSystemInstruction = { role: 'system', parts: [{ text: finalSystemInstruction }] };
    }

    // Map camelCase to snake_case for new SDK v1
    const mappedConfig = {
      temperature: restConfig.temperature,
      top_p: restConfig.topP || restConfig.top_p,
      top_k: restConfig.topK || restConfig.top_k,
      candidate_count: restConfig.candidateCount || restConfig.candidate_count,
      max_output_tokens: restConfig.maxOutputTokens || restConfig.max_output_tokens,
      stop_sequences: restConfig.stopSequences || restConfig.stop_sequences,
      response_mime_type: restConfig.responseMimeType || restConfig.response_mime_type,
      response_schema: restConfig.responseSchema || restConfig.response_schema,
      presence_penalty: restConfig.presencePenalty || restConfig.presence_penalty,
      frequency_penalty: restConfig.frequencyPenalty || restConfig.frequency_penalty,
      thinking_config: restConfig.thinkingConfig ? {
        thinking_budget: restConfig.thinkingConfig.thinkingBudget || restConfig.thinkingConfig.thinking_budget,
        include_thoughts: restConfig.thinkingConfig.includeThoughts || restConfig.thinkingConfig.include_thoughts,
      } : undefined,
    };

    // Remove undefined fields
    Object.keys(mappedConfig).forEach(key => (mappedConfig as any)[key] === undefined && delete (mappedConfig as any)[key]);

    const response = await (ai.models as any).generateContent({
      model: targetModel,
      contents: normalizedContents,
      system_instruction: finalSystemInstruction,
      config: mappedConfig as any,
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
