import { logger } from '../../utils/logger';
import { getAuth } from 'firebase/auth';
import { isVertexShadowEnabled, runVertexShadow } from './vertexShadow';
import { ApiError, RateLimitError, AuthError, ServerError } from '../apiErrors';
import { PermissionError, AIServiceError, AppError, ErrorCode } from '../../utils/errors';
import {
    DEFAULT_MODEL, PRO_MODEL, ULTIMATE_MODEL, IMAGEN_MODEL, EMBEDDING_MODEL,
    GENERATION_TIMEOUT_MS, Part, Content, ImagenProxyResponse, StreamChunk,
} from './core.constants';
import { checkDailyQuotaGuard, markDailyQuotaExhausted } from './core.quota';

let lastRequest: Promise<any> = Promise.resolve();

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

export function normalizeContents(contents: any): any[] {
  if (!contents) return [];
  if (typeof contents === 'string') return [{ role: 'user', parts: [{ text: contents }] }];
  if (!Array.isArray(contents)) return [{ role: 'user', parts: [{ text: String(contents) }] }];
  if (contents.length > 0 && contents[0].parts) return contents;
  const isPartsArray = contents.every((c: any) => c.text || c.inlineData || c.inline_data);
  if (isPartsArray) {
    return [{
      role: 'user',
      parts: contents.map((c: any) => {
        if (c.text) return { text: c.text };
        const data = c.inlineData || c.inline_data;
        if (data) return { inlineData: { mimeType: data.mimeType || data.mime_type, data: data.data } };
        return c;
      })
    }];
  }
  return contents.map((c: any) => {
    if (typeof c === 'string') return { role: 'user', parts: [{ text: c }] };
    if (c.role && c.parts) return c;
    if (c.parts) return { role: 'user', parts: c.parts };
    if (c.text) return { role: 'user', parts: [{ text: c.text }] };
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

export async function callGeminiProxy(params: {
  model: string;
  contents: any;
  generationConfig?: any;
  systemInstruction?: string;
  safetySettings?: any;
  userTier?: string;
  skipTierOverride?: boolean;
  tools?: unknown[];
}, signal?: AbortSignal): Promise<{ text: string; candidates: any[]; groundingMetadata?: unknown }> {
  return queueRequest(async () => {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(new Error('Request timed out after 60s')), GENERATION_TIMEOUT_MS);
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
      if (isVertexShadowEnabled()) {
        runVertexShadow(modelToUse, normalizeContents(params.contents), geminiLatencyMs, token)
          .catch(() => {});
      }
      return result;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      if (err instanceof ApiError) throw err;
      logger.error("Gemini Proxy Error:", err.message || err);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  });
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
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      logger.error("Imagen Proxy Error:", err.message || err);
      throw err;
    }
  });
}

export async function callEmbeddingProxy(text: string, signal?: AbortSignal): Promise<number[]> {
  return queueRequest(async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ model: EMBEDDING_MODEL, contents: text }),
        signal
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
      }
      const data = await response.json();
      return data.embedding.values;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      logger.error("Embedding Proxy Error:", err.message || err);
      throw err;
    }
  });
}

export async function callGeminiEmbed(params: { model?: string; contents: any }): Promise<{ embeddings: { values: number[] } }> {
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
    } catch (err: any) {
      logger.error("Gemini Embedding Error:", err.message || err);
      throw err;
    }
  });
}

export async function* streamGeminiProxy(params: {
  model: string; contents: any; generationConfig?: any; systemInstruction?: string; safetySettings?: any; userTier?: string;
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
      body: JSON.stringify({ model: modelToUse, contents: normalizeContents(params.contents), config: { systemInstruction: params.systemInstruction, safetySettings: params.safetySettings, ...params.generationConfig } }),
      signal: effectiveSignal,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new AIServiceError('No response body');
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
            if (data.text) yield data.text;
            if (data.error) throw new AIServiceError(data.error);
          } catch (e) { logger.error("Error parsing stream chunk:", e); }
        }
      }
      if (buffer.startsWith('data: ')) {
        const dataStr = buffer.slice(6).trim();
        if (dataStr !== '[DONE]') {
          try { const data = JSON.parse(dataStr); if (data.text) yield data.text; } catch { /* partial */ }
        }
      }
    } finally { reader.releaseLock(); }
  } finally { clearTimeout(timeoutId); }
}

export async function* streamGeminiProxyRich(params: {
  model: string; contents: any; generationConfig?: any; systemInstruction?: string; safetySettings?: any; userTier?: string;
}): AsyncGenerator<StreamChunk, void, unknown> {
  const token = await getAuthToken();
  let modelToUse = params.model;
  if (params.userTier === 'Pro' || params.userTier === 'Unlimited') modelToUse = ULTIMATE_MODEL;
  else if (params.userTier === 'Standard') modelToUse = PRO_MODEL;
  else modelToUse = DEFAULT_MODEL;
  const response = await fetch('/api/gemini-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ model: modelToUse, contents: normalizeContents(params.contents), config: { systemInstruction: params.systemInstruction, safetySettings: params.safetySettings, ...params.generationConfig } }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new AppError(errorData.error || `Server error: ${response.status}`, ErrorCode.AI_UNAVAILABLE, 'AI сервисот моментално не е достапен. Обидете се повторно.', true);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new AIServiceError('No response body');
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
        } catch (e) { logger.error("Error parsing rich stream chunk:", e); }
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
