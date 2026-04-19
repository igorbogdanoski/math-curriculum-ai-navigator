import { logger } from '../../utils/logger';
import { z } from 'zod';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAICache, saveAICache } from '../indexedDBService';
import { RateLimitError } from '../apiErrors';
import { OfflineError, AIServiceError, AppError, ErrorCode } from '../../utils/errors';
import { SafetySetting, Part, DEFAULT_MODEL, MAX_RETRIES, GENERATION_TIMEOUT_MS, CACHE_COLLECTION } from './core.constants';
import { markDailyQuotaExhausted } from './core.quota';
import { callGeminiProxy } from './core.proxy';
import { cleanJsonString, handleGeminiError } from './core.utils';
import { JSON_SYSTEM_INSTRUCTION } from './core.instructions';

export const SAFETY_SETTINGS: SafetySetting[] = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_ONLY_HIGH' },
];

function recoverTruncatedJson(raw: string): unknown | null {
  let s = raw.trim();
  s = s.replace(/"[^"]*$/, '');
  s = s.replace(/,\s*$/, '').replace(/:\s*$/, '');
  const opens: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') opens.push('}');
    else if (ch === '[') opens.push(']');
    else if (ch === '}' || ch === ']') opens.pop();
  }
  const closing = opens.reverse().join('');
  try { return JSON.parse(s + closing); } catch { return null; }
}

export async function generateAndParseJSON<T>(
  contents: Part[],
  schema: any,
  model: string = DEFAULT_MODEL,
  zodSchema?: z.ZodTypeAny,
  retries = MAX_RETRIES,
  useThinking = false,
  customSystemInstruction?: string,
  userTier?: string,
  generationOverrides?: { temperature?: number; topP?: number; maxOutputTokens?: number }
): Promise<T> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new OfflineError('AI generation requires network connection');
    }
    const activeModel = useThinking ? 'gemini-3.1-pro' : model;
    const _controller = new AbortController();
    const _timeoutId = setTimeout(() => _controller.abort(), GENERATION_TIMEOUT_MS);
    try {
      const generationConfig: any = {
        temperature: generationOverrides?.temperature ?? 0.7,
        topP: generationOverrides?.topP ?? 0.95,
        maxOutputTokens: generationOverrides?.maxOutputTokens ?? 32768,
      };
      if (useThinking) {
        generationConfig.thinkingConfig = { thinkingBudget: 16000 };
      } else {
        generationConfig.responseMimeType = 'application/json';
      }
      const schemaHint = "\n\nFollow this JSON schema exactly: " + JSON.stringify(schema);
      const enrichedContents = [...contents];
      if (enrichedContents.length > 0 && enrichedContents[0].text) {
          enrichedContents[0].text += schemaHint;
      } else {
          enrichedContents.push({ text: schemaHint });
      }
      const response = await callGeminiProxy({
        model: activeModel,
        contents: enrichedContents,
        generationConfig,
        systemInstruction: customSystemInstruction || JSON_SYSTEM_INSTRUCTION,
        safetySettings: SAFETY_SETTINGS,
        userTier
      }, _controller.signal);

      const rawText = response.text || "";
      const jsonString = useThinking ? cleanJsonString(rawText) : rawText.trim();
      if (!jsonString) throw new AIServiceError("AI returned empty response");

      let parsedJson: unknown;
      let isPartialResponse = false;
      try {
        parsedJson = JSON.parse(jsonString);
      } catch {
        const recovered = recoverTruncatedJson(jsonString);
        if (recovered !== null) {
          logger.warn('[AI] JSON truncated — recovered partial response');
          parsedJson = recovered;
          isPartialResponse = true;
        } else {
          throw new Error('JSON parse failed');
        }
      }

      if (zodSchema) {
          const validation = zodSchema.safeParse(parsedJson);
          if (!validation.success) throw new AIServiceError(`Validation failed: ${validation.error.message}`);
          const data = validation.data as T & { _isPartial?: boolean };
          if (isPartialResponse) data._isPartial = true;
          return data;
      }
      const result = parsedJson as T & { _isPartial?: boolean };
      if (isPartialResponse) result._isPartial = true;
      return result;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new AppError('Generation timed out', ErrorCode.TIMEOUT, 'Генерирањето траеше предолго. Обидете се повторно.', true);
    }
    const errorMessage = error.message?.toLowerCase() || "";
    const isDailyQuotaExhausted =
      error instanceof RateLimitError ||
      (errorMessage.includes("429") && (
        errorMessage.includes("perday") ||
        errorMessage.includes("per_day") ||
        errorMessage.includes("requests_per_day") ||
        errorMessage.includes("free_tier_requests")
      ));
    const isNonRetryable =
      isDailyQuotaExhausted ||
      errorMessage.includes("400") ||
      errorMessage.includes("404") ||
      errorMessage.includes("not found") ||
      errorMessage.includes("invalid") ||
      errorMessage.includes("403") ||
      errorMessage.includes("api key") ||
      errorMessage.includes("permission");

    if (isNonRetryable) {
      if (isDailyQuotaExhausted) {
        if (!(error instanceof RateLimitError)) markDailyQuotaExhausted();
        throw new RateLimitError("Дневната AI квота е исцрпена. Обидете се повторно утре или контактирајте го администраторот за надградба на планот.");
      }
      logger.error("Non-retryable AI error:", error);
      throw error;
    }
    if (retries > 0) {
      const match = errorMessage.match(/retry in (\d+(\.\d+)?)s/i);
      const delay = match ? (parseFloat(match[1]) + 1) * 1000 : 2000 * Math.pow(2, MAX_RETRIES - retries);
      logger.warn(`[AI] Retry in ${delay}ms, ${retries} attempt(s) left.`);
      await new Promise(r => setTimeout(r, delay));
      return generateAndParseJSON<T>(contents, schema, model, zodSchema, retries - 1, useThinking);
    }
    handleGeminiError(error);
  } finally {
    clearTimeout(_timeoutId);
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, key));
        if (cachedDoc.exists()) return cachedDoc.data().content as T;
    } catch { /* offline — fall through */ }
    try {
        const idbContent = await getAICache(key);
        if (idbContent !== null) return idbContent as T;
    } catch { /* non-fatal */ }
    return null;
}

export async function setCached(key: string, content: any, metadata: any = {}) {
    try {
        await setDoc(doc(db, CACHE_COLLECTION, key), { content, ...metadata, createdAt: serverTimestamp() });
    } catch (e) {
        logger.error('Cache write error (Firestore):', e);
    }
    try { await saveAICache(key, content); } catch { /* non-fatal */ }
}
