import { logger } from '../../utils/logger';
import { getAuth } from 'firebase/auth';
import { shouldRunVertexShadow, runVertexShadow } from './vertexShadow';
import { ApiError, RateLimitError, AuthError, ServerError } from '../apiErrors';
import { PermissionError, AIServiceError, AppError, ErrorCode } from '../../utils/errors';
import { retryWithBackoff, circuitBreakerCall } from '../../utils/retryWithBackoff';
import {
    DEFAULT_MODEL, PRO_MODEL, ULTIMATE_MODEL, IMAGEN_MODEL, EMBEDDING_MODEL,
    GENERATION_TIMEOUT_MS, Part, Content, SafetySetting, ImagenProxyResponse, StreamChunk,
} from './core.constants';

/** Extracts a safe display message from an unknown caught error. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** True when the caught error is a DOM AbortError (fetch/timeout cancellation). */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}
import { checkDailyQuotaGuard, markDailyQuotaExhausted } from './core.quota';

let lastRequest: Promise<unknown> = Promise.resolve();

export async function queueRequest<T>(fn: () => Promise<T>): Promise<T> {
  checkDailyQuotaGuard();
  const result = lastRequest.then(fn);
  lastRequest = result.catch(() => {});
  return result;
}

export async function getAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new PermissionError('getAuthToken', 'Не сте најавени. Ве молиме најавете се повторно.');
  return user.getIdToken();
}

/**
 * `contents` is accepted in whatever flexible legacy shape a caller has on hand — a
 * plain string, an already-normalized Content[], a flat array of Part-like objects, or
 * a mix — and this function's entire job is duck-typing that into canonical Content[].
 * `LooseItem` names that "arbitrary object, probe its fields at runtime" contract
 * instead of disabling type checking outright; the conditional logic below is
 * unchanged from before this file's `any` cleanup (2026-07-04).
 */
type LooseItem = Record<string, unknown>;

export function normalizeContents(contents: unknown): Content[] {
  if (!contents) return [];
  if (typeof contents === 'string') return [{ role: 'user', parts: [{ text: contents }] }];
  if (!Array.isArray(contents)) return [{ role: 'user', parts: [{ text: String(contents) }] }];
  if (contents.length > 0 && (contents[0] as LooseItem).parts) return contents as Content[];
  const isPartsArray = (contents as LooseItem[]).every((c) => c.text || c.inlineData || c.inline_data);
  if (isPartsArray) {
    return [{
      role: 'user',
      parts: (contents as LooseItem[]).map((c): Part => {
        if (c.text) return { text: c.text as string };
        const data = (c.inlineData || c.inline_data) as LooseItem | undefined;
        if (data) return { inlineData: { mimeType: (data.mimeType || data.mime_type) as string, data: data.data as string } };
        return c as Part;
      })
    }];
  }
  return (contents as (string | LooseItem)[]).map((c): Content => {
    if (typeof c === 'string') return { role: 'user', parts: [{ text: c }] };
    if (c.role && c.parts) return c as unknown as Content;
    if (c.parts) return { role: 'user', parts: c.parts as Part[] };
    if (c.text) return { role: 'user', parts: [{ text: c.text as string }] };
    return { role: 'user', parts: [{ text: String(JSON.stringify(c)) }] };
  });
}

function anySignalAborted(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { controller.abort(sig.reason); break; }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

async function callGeminiOnce(params: {
  model: string;
  contents: unknown;
  generationConfig?: Record<string, unknown>;
  systemInstruction?: string;
  safetySettings?: SafetySetting[];
  userTier?: string;
  skipTierOverride?: boolean;
  tools?: unknown[];
  /** AI_COSTS bucket name for server-side credit deduction. Omit to default to TEXT_BASIC. */
  costKey?: string;
  /** Overrides the default 60s per-attempt timeout — for callers whose prompt/output is large
   *  enough that 60s is routinely too tight (e.g. generateAnnualPlan's full curriculum grounding). */
  timeoutMs?: number;
}, signal?: AbortSignal): Promise<{ text: string; candidates: unknown[]; groundingMetadata?: unknown }> {
  const effectiveTimeoutMs = params.timeoutMs ?? GENERATION_TIMEOUT_MS;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error(`Request timed out after ${effectiveTimeoutMs / 1000}s`)), effectiveTimeoutMs);
  const effectiveSignal = signal ? anySignalAborted([signal, timeoutController.signal]) : timeoutController.signal;
  try {
    const token = await getAuthToken();
    let modelToUse = params.model;
    if (params.skipTierOverride) {
      modelToUse = params.model;
    } else if (params.userTier === 'Pro' || params.userTier === 'Unlimited') {
      modelToUse = ULTIMATE_MODEL;
    } else if (params.userTier === 'Standard') {
      modelToUse = PRO_MODEL;
    } else {
      modelToUse = DEFAULT_MODEL;
    }
    const geminiCallStart = performance.now();
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        model: modelToUse,
        contents: normalizeContents(params.contents),
        config: { systemInstruction: params.systemInstruction, safetySettings: params.safetySettings, ...params.generationConfig },
        ...(params.tools && params.tools.length > 0 ? { tools: params.tools } : {}),
        ...(params.costKey ? { costKey: params.costKey } : {}),
      }),
      signal: effectiveSignal
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const quotaType: string = errorData.quotaType ?? 'daily';
        if (quotaType === 'rate_limit') throw new RateLimitError('AI привремено е преоптоварен. Обидете се повторно за 60 секунди.');
        markDailyQuotaExhausted();
        throw new RateLimitError('Дневната AI квота е исцрпена. Обидете се повторно утре или надградете го планот.');
      }
      if (response.status === 401 || response.status === 403) throw new AuthError(errorData.error || 'Проблем со автентикација.');
      if (response.status >= 500) throw new ServerError(errorData.error || `Серверска грешка (${response.status}).`);
      throw new ApiError(errorData.error || `Грешка: ${response.status}`);
    }
    const geminiLatencyMs = Math.round(performance.now() - geminiCallStart);
    const result = await response.json();
    if (shouldRunVertexShadow()) {
      runVertexShadow(modelToUse, normalizeContents(params.contents), geminiLatencyMs, token)
        .catch(() => {});
    }
    return result;
  } catch (err: unknown) {
    if (isAbortError(err)) throw err;
    if (err instanceof ApiError) throw err;
    logger.error("Gemini Proxy Error:", errMessage(err));
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callGeminiProxy(params: {
  model: string;
  contents: unknown;
  generationConfig?: Record<string, unknown>;
  systemInstruction?: string;
  safetySettings?: SafetySetting[];
  userTier?: string;
  skipTierOverride?: boolean;
  tools?: unknown[];
  /** AI_COSTS bucket name for server-side credit deduction. Omit to default to TEXT_BASIC. */
  costKey?: string;
  /** Overrides the default 60s per-attempt timeout — see callGeminiOnce's matching field. */
  timeoutMs?: number;
}, signal?: AbortSignal): Promise<{ text: string; candidates: unknown[]; groundingMetadata?: unknown }> {
  return queueRequest(() =>
    circuitBreakerCall('gemini', () =>
      retryWithBackoff(
        () => callGeminiOnce(params, signal),
        {
          maxRetries: 2,
          baseDelayMs: 2000,
          maxDelayMs: 12_000,
          onRetry: (attempt, delayMs) => {
            logger.warn(`[GeminiProxy] Retry attempt ${attempt} after ${delayMs}ms`);
          },
        },
      ),
    ),
  );
}

export async function callImagenProxy(params: { model?: string; prompt: string }, signal?: AbortSignal): Promise<ImagenProxyResponse> {
  return queueRequest(async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/imagen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ model: params.model || IMAGEN_MODEL, contents: params.prompt }),
        signal
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
      }
      return await response.json();
    } catch (err: unknown) {
      if (isAbortError(err)) throw err;
      logger.error("Imagen Proxy Error:", errMessage(err));
      throw err;
    }
  });
}

export type EmbeddingTaskType =
  | 'RETRIEVAL_QUERY'
  | 'RETRIEVAL_DOCUMENT'
  | 'SEMANTIC_SIMILARITY'
  | 'CLASSIFICATION'
  | 'CLUSTERING';

export async function callEmbeddingProxy(
  text: string,
  signal?: AbortSignal,
  taskType?: EmbeddingTaskType,
  outputDimensionality?: number,
): Promise<number[]> {
  return queueRequest(async () => {
    try {
      const token = await getAuthToken();
      const body: Record<string, unknown> = { model: EMBEDDING_MODEL, contents: text };
      if (taskType) body.taskType = taskType;
      if (outputDimensionality) body.outputDimensionality = outputDimensionality;
      const response = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
        signal
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
      }
      const data = await response.json();
      return data.embedding.values;
    } catch (err: unknown) {
      if (isAbortError(err)) throw err;
      logger.error("Embedding Proxy Error:", errMessage(err));
      throw err;
    }
  });
}

export async function callGeminiEmbed(params: { model?: string; contents: unknown }): Promise<{ embeddings: { values: number[] } }> {
  return queueRequest(async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/embed?responseShape=embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ model: params.model || 'text-embedding-004', contents: normalizeContents(params.contents)[0]?.parts || [] }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
      }
      return await response.json();
    } catch (err: unknown) {
      logger.error("Gemini Embedding Error:", errMessage(err));
      throw err;
    }
  });
}

/**
 * Shared SSE chunk parser for both `/api/gemini-stream` consumers below. Always yields the
 * richer `StreamChunk` shape (kind: 'text' | 'thinking'); `streamGeminiProxy` filters this
 * down to plain text. Matches the two call sites' identical buffer/line-splitting logic that
 * previously existed as two ~50-line copies.
 */
async function* parseSSEStream(reader: ReadableStreamDefaultReader<Uint8Array>, logLabel: string): AsyncGenerator<StreamChunk, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (dataStr === '[DONE]') return;
        try {
          const data = JSON.parse(dataStr);
          if (data.thinking) yield { kind: 'thinking', text: data.thinking };
          else if (data.text) yield { kind: 'text', text: data.text };
          if (data.error) throw new AIServiceError(data.error);
        } catch (e) { logger.error(logLabel, e); }
      }
    }
    if (buffer.startsWith('data: ')) {
      const dataStr = buffer.slice(6).trim();
      if (dataStr !== '[DONE]') {
        try {
          const data = JSON.parse(dataStr);
          if (data.thinking) yield { kind: 'thinking', text: data.thinking };
          else if (data.text) yield { kind: 'text', text: data.text };
        } catch { /* partial */ }
      }
    }
  } finally { reader.releaseLock(); }
}

export async function* streamGeminiProxy(params: {
  model: string; contents: unknown; generationConfig?: Record<string, unknown>; systemInstruction?: string; safetySettings?: SafetySetting[]; userTier?: string;
  /** AI_COSTS bucket name for server-side credit deduction. Omit to default to TEXT_BASIC. */
  costKey?: string;
}, signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
  const STREAM_TIMEOUT_MS = 120_000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error('Stream timed out after 120s')), STREAM_TIMEOUT_MS);
  const effectiveSignal = signal ? anySignalAborted([signal, timeoutController.signal]) : timeoutController.signal;
  try {
    const token = await getAuthToken();
    let modelToUse = params.model;
    if (params.userTier === 'Pro' || params.userTier === 'Unlimited') modelToUse = ULTIMATE_MODEL;
    else if (params.userTier === 'Standard') modelToUse = PRO_MODEL;
    else modelToUse = DEFAULT_MODEL;
    const response = await fetch('/api/gemini-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ model: modelToUse, contents: normalizeContents(params.contents), config: { systemInstruction: params.systemInstruction, safetySettings: params.safetySettings, ...params.generationConfig }, ...(params.costKey ? { costKey: params.costKey } : {}) }),
      signal: effectiveSignal,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new AIServiceError('No response body');
    for await (const chunk of parseSSEStream(reader, 'Error parsing stream chunk:')) {
      if (chunk.kind === 'text') yield chunk.text;
    }
  } finally { clearTimeout(timeoutId); }
}

export async function* streamGeminiProxyRich(params: {
  model: string; contents: unknown; generationConfig?: Record<string, unknown>; systemInstruction?: string; safetySettings?: SafetySetting[]; userTier?: string;
  /** AI_COSTS bucket name for server-side credit deduction. Omit to default to TEXT_BASIC. */
  costKey?: string;
}): AsyncGenerator<StreamChunk, void, unknown> {
  const token = await getAuthToken();
  let modelToUse = params.model;
  if (params.userTier === 'Pro' || params.userTier === 'Unlimited') modelToUse = ULTIMATE_MODEL;
  else if (params.userTier === 'Standard') modelToUse = PRO_MODEL;
  else modelToUse = DEFAULT_MODEL;
  const response = await fetch('/api/gemini-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ model: modelToUse, contents: normalizeContents(params.contents), config: { systemInstruction: params.systemInstruction, safetySettings: params.safetySettings, ...params.generationConfig }, ...(params.costKey ? { costKey: params.costKey } : {}) }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new AIServiceError('No response body');
  yield* parseSSEStream(reader, 'Error parsing rich stream chunk:');
}
