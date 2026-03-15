import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAuth } from 'firebase/auth';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import { GenerationContext } from '../../types';
import { ragService } from '../ragService';
import { 
    AIGeneratedIdeasSchema,
    AIGeneratedAssessmentSchema,
    AIGeneratedPracticeMaterialSchema,
    AIGeneratedThematicPlanSchema,
    AIGeneratedRubricSchema,
    AIGeneratedLearningPathsSchema,
    CoverageAnalysisSchema,
    AIRecommendationSchema,
    AIPedagogicalAnalysisSchema,
    AnnualPlanSchema,
    GeneratedTestSchema
} from '../../utils/schemas';
import { ApiError, RateLimitError, AuthError, ServerError } from '../apiErrors';

// --- CONSTANTS ---
export const CACHE_COLLECTION = 'cached_ai_materials';
export const DEFAULT_MODEL = 'gemini-2.5-flash';
export const PRO_MODEL = 'gemini-2.5-pro';
export const ULTIMATE_MODEL = 'gemini-3.1-pro-preview';
export const IMAGEN_MODEL = 'imagen-3.0-generate-001';
export const EMBEDDING_MODEL = 'gemini-embedding-2-preview';
export const MAX_RETRIES = 2;
export const GENERATION_TIMEOUT_MS = 60_000; // 60 seconds for 3.1 Pro

// --- CREDIT COSTS ---
export const AI_COSTS = {
    TEXT_BASIC: 1,      // Quiz, assessment, worked example, ideas
    ILLUSTRATION: 5,   // Contextual AI Illustrations (Imagen)
    PRESENTATION: 10,  // Math Gamma Presentations (PRO)
    BULK: 5,           // Bulk generation of multiple materials
    LEARNING_PATH: 3,  // Complex multi-step learning paths
    VARIANTS: 3,       // 3 levels of differentiation
    ANNUAL_PLAN: 10    // Full year curriculum planning
};

// Initialize the Generative AI with the API Key from environment
// VITE_ prefix is used for client-side access, but for security, 
// we'll prefer the proxy/server-side for sensitive operations if possible.
// For now, we use the key directly as it was in .env.local
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

// --- TYPES FOR INTERNAL USE ---
export enum Type {
    OBJECT = "object",
    ARRAY = "array",
    STRING = "string",
    INTEGER = "integer",
    NUMBER = "number",
    BOOLEAN = "boolean",
}

export interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

export interface Content {
    role: 'user' | 'model';
    parts: Part[];
}

export interface SafetySetting {
    category: string;
    threshold: string;
}

// --- DAILY QUOTA GUARD ---
// Once the daily free-tier quota is exhausted, all calls fail immediately until the next
// Pacific midnight (= actual Gemini reset time = 09:00 MK time).
// BUG FIX: Previously used UTC date comparison → cleared at 01:00 MK, but Gemini resets at
// 09:00 MK. Auto-calls in the 01:00–09:00 window re-exhausted quota every day for 10+ days.
export const DAILY_QUOTA_KEY = 'ai_daily_quota_exhausted';

// ---------------------------------------------------------------------------
// Quota storage helpers — dual write: cookie (primary) + localStorage (fallback)
// Edge/Firefox Tracking Prevention often blocks localStorage for *.vercel.app
// but first-party SameSite=Strict cookies are never blocked by Tracking Prevention.
// ---------------------------------------------------------------------------
export function quotaRead(): string | null {
  // Try cookie first (immune to Tracking Prevention)
  try {
    const match = document.cookie.split('; ').find(r => r.startsWith('ai_quota='));
    if (match) return decodeURIComponent(match.slice('ai_quota='.length));
  } catch { /* ignore */ }
  // Fallback to localStorage
  try { return localStorage.getItem(DAILY_QUOTA_KEY); } catch { return null; }
}

export function quotaWrite(value: string, expiresMs: number): void {
  // Write to cookie (primary — survives Tracking Prevention)
  try {
    document.cookie = `ai_quota=${encodeURIComponent(value)}; expires=${new Date(expiresMs).toUTCString()}; SameSite=Strict; path=/`;
  } catch { /* ignore */ }
  // Also write to localStorage for environments that support it
  try { localStorage.setItem(DAILY_QUOTA_KEY, value); } catch { /* ignore */ }
}

export function quotaClear(): void {
  try { document.cookie = 'ai_quota=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict; path=/'; } catch { /* ignore */ }
  try { localStorage.removeItem(DAILY_QUOTA_KEY); } catch { /* ignore */ }
}

/** Returns the Unix timestamp (ms) of the next Pacific midnight (Gemini's reset point). */
export function getNextPacificMidnightMs(): number {
  const now = new Date();
  const year = now.getUTCFullYear();

  // US Pacific DST: starts 2nd Sunday in March at 02:00 PST (= 10:00 UTC)
  //                 ends   1st Sunday in November at 02:00 PDT (= 09:00 UTC)
  const march1Day = new Date(Date.UTC(year, 2, 1)).getUTCDay();
  const dstStart  = new Date(Date.UTC(year, 2, (7 - march1Day) % 7 + 8, 10)); // 2nd Sun Mar 10:00 UTC
  const nov1Day   = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const dstEnd    = new Date(Date.UTC(year, 10, (7 - nov1Day) % 7 + 1, 9));   // 1st Sun Nov 09:00 UTC

  const isPDT = now >= dstStart && now < dstEnd;
  // Pacific midnight in UTC: PST → 08:00 UTC, PDT → 07:00 UTC
  const utcHour = isPDT ? 7 : 8;

  const nextMidnight = new Date();
  nextMidnight.setUTCHours(utcHour, 0, 0, 0);
  if (nextMidnight.getTime() <= now.getTime()) {
    nextMidnight.setUTCDate(nextMidnight.getUTCDate() + 1);
  }
  return nextMidnight.getTime();
}

export function checkDailyQuotaGuard(): void {
  // PAID TIER MODIFICATION:
  // Со платен клуч, немаме потреба од строг client-side лимит.
  // Ја прескокнуваме оваа проверка за да не го блокираме корисникот непотребно.
  return; 

  /* ORIGINAL CODE (Disabled for Paid Tier):
  try {
    const stored = quotaRead();
    if (!stored) return;
    const parsed = JSON.parse(stored);
    const nextResetMs: number = parsed.nextResetMs ?? 0;
    if (Date.now() < nextResetMs) {
      throw new RateLimitError("Дневната AI квота е исцрпена. Обидете се повторно утре или надградете го планот.");
    }
    quotaClear(); // Pacific midnight passed — clear the flag
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    // Ignore storage read/parse errors silently
  }
  */
}

export function markDailyQuotaExhausted(): void {
  try {
    const nextResetMs = getNextPacificMidnightMs();
    quotaWrite(JSON.stringify({
      exhaustedAt: new Date().toISOString(),
      nextResetMs,
    }), nextResetMs);
    scheduleQuotaNotification(nextResetMs);
  } catch { /* ignore write errors */ }
}

// Schedules a browser notification when the quota resets (exported for manual testing)
export function scheduleQuotaNotification(nextResetMs: number): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const delay = nextResetMs - Date.now();
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return;
  setTimeout(() => {
    new Notification('AI Квотата е обновена!', {
      body: 'Gemini AI е повторно достапен. Можете да генерирате материјали.',
      icon: '/icons/icon-192.png',
      tag: 'quota-reset',
    });
  }, delay);
}

// Exported so the UI can check quota state without making an API call
export function isDailyQuotaKnownExhausted(): boolean {
  try {
    const stored = quotaRead();
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    const nextResetMs: number = parsed.nextResetMs ?? 0;
    return Date.now() < nextResetMs;
  } catch { return false; }
}

// Exported so the user can manually clear a stale or false-positive quota flag
export function clearDailyQuotaFlag(): void {
  quotaClear();
}

/** Returns diagnostic info about the current quota flag (reads cookie first, then localStorage). */
export function getQuotaDiagnostics(): {
  source: 'cookie' | 'localStorage' | 'none';
  exhaustedAt?: string;
  nextResetMs?: number;
  nextResetISO?: string;
  isCurrentlyExhausted: boolean;
} {
  let raw: string | null = null;
  let source: 'cookie' | 'localStorage' | 'none' = 'none';
  try {
    const match = document.cookie.split('; ').find(r => r.startsWith('ai_quota='));
    if (match) { raw = decodeURIComponent(match.slice('ai_quota='.length)); source = 'cookie'; }
  } catch { /* ignore */ }
  if (!raw) {
    try {
      const ls = localStorage.getItem(DAILY_QUOTA_KEY);
      if (ls) { raw = ls; source = 'localStorage'; }
    } catch { /* ignore */ }
  }
  if (!raw) return { source: 'none', isCurrentlyExhausted: false };
  try {
    const parsed = JSON.parse(raw);
    const nextResetMs: number = parsed.nextResetMs ?? 0;
    return {
      source,
      exhaustedAt: parsed.exhaustedAt,
      nextResetMs,
      nextResetISO: nextResetMs ? new Date(nextResetMs).toISOString() : undefined,
      isCurrentlyExhausted: Date.now() < nextResetMs,
    };
  } catch {
    return { source, isCurrentlyExhausted: false };
  }
}

// --- QUEUE SYSTEM ---
let lastRequest: Promise<any> = Promise.resolve();
export async function queueRequest<T>(fn: () => Promise<T>): Promise<T> {
  checkDailyQuotaGuard(); // Block immediately if daily quota is known exhausted
  const result = lastRequest.then(fn);
  lastRequest = result.catch(() => {});
  return result;
}

// --- AUTH HELPER ---
export async function getAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Не сте најавени. Ве молиме најавете се повторно.');
  }
  return user.getIdToken();
}

// --- DIRECT SDK HELPERS ---
export function normalizeContents(contents: any): any[] {
  if (!contents) return [];
  if (typeof contents === 'string') return [{ role: 'user', parts: [{ text: contents }] }];
  if (!Array.isArray(contents)) return [{ role: 'user', parts: [{ text: String(contents) }] }];
  
  // Check if it's already an array of Content objects
  if (contents.length > 0 && contents[0].parts) return contents;

  // Check if it's an array of Parts (text or inlineData)
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

  return contents.map(c => {
    if (typeof c === 'string') return { role: 'user', parts: [{ text: c }] };
    if (c.role && c.parts) return c;
    if (c.parts) return { role: 'user', parts: c.parts };
    if (c.text) return { role: 'user', parts: [{ text: c.text }] };
    return { role: 'user', parts: [{ text: String(JSON.stringify(c)) }] };
  });
}

// --- PROXY API HELPERS ---
export async function callGeminiProxy(params: {
  model: string;
  contents: any;
  generationConfig?: any;
  systemInstruction?: string;
  safetySettings?: any;
  userTier?: string; // Optional user tier
}, signal?: AbortSignal): Promise<{ text: string; candidates: any[] }> {
  return queueRequest(async () => {
    // Build a combined abort signal: caller signal OR 60-second timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(new Error('Request timed out after 60s')), GENERATION_TIMEOUT_MS);
    const effectiveSignal = signal
      ? anySignalAborted([signal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const token = await getAuthToken();

      // Select model based on user tier if tier is provided
      let modelToUse = params.model;
      if (params.userTier === 'Pro' || params.userTier === 'Unlimited') {
          modelToUse = ULTIMATE_MODEL;
      } else if (params.userTier === 'Standard') {
          modelToUse = PRO_MODEL;
      } else {
          modelToUse = DEFAULT_MODEL;
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: modelToUse,
          contents: normalizeContents(params.contents),
          config: {
            systemInstruction: params.systemInstruction,
            safetySettings: params.safetySettings,
            ...params.generationConfig
          }
        }),
        signal: effectiveSignal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.error("Gemini Proxy Error:", err.message || err);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

/** Returns an AbortSignal that fires when ANY of the provided signals abort. */
function anySignalAborted(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) { controller.abort(sig.reason); break; }
    sig.addEventListener('abort', () => controller.abort(sig.reason), { once: true });
  }
  return controller.signal;
}

export async function callImagenProxy(params: {
  model?: string;
  prompt: string;
}, signal?: AbortSignal): Promise<any> {
  return queueRequest(async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/imagen', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: params.model || IMAGEN_MODEL,
          contents: params.prompt
        }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.error("Imagen Proxy Error:", err.message || err);
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          contents: text
        }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding.values;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      console.error("Embedding Proxy Error:", err.message || err);
      throw err;
    }
  });
}

export async function callGeminiEmbed(params: {
  model?: string;
  contents: any;
}): Promise<{ embeddings: { values: number[] } }> {
  return queueRequest(async () => {
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/gemini-embed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: params.model || 'text-embedding-004',
          contents: normalizeContents(params.contents)[0]?.parts || []
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error("Gemini Embedding Error:", err.message || err);
      throw err;
    }
  });
}

export async function* streamGeminiProxy(params: {
  model: string;
  contents: any;
  generationConfig?: any;
  systemInstruction?: string;
  safetySettings?: any;
  userTier?: string;
}, signal?: AbortSignal): AsyncGenerator<string, void, unknown> {
  // Streaming gets a longer timeout (120s) since it can legitimately take longer
  const STREAM_TIMEOUT_MS = 120_000;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(new Error('Stream timed out after 120s')), STREAM_TIMEOUT_MS);
  const effectiveSignal = signal ? anySignalAborted([signal, timeoutController.signal]) : timeoutController.signal;

  try {
  const token = await getAuthToken();

  // Select model based on user tier
  let modelToUse = params.model;
  if (params.userTier === 'Pro' || params.userTier === 'Unlimited') {
      modelToUse = ULTIMATE_MODEL;
  } else if (params.userTier === 'Standard') {
      modelToUse = PRO_MODEL;
  } else {
      modelToUse = DEFAULT_MODEL;
  }

  const response = await fetch('/api/gemini-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: modelToUse,
      contents: normalizeContents(params.contents),
      config: {
        systemInstruction: params.systemInstruction,
        safetySettings: params.safetySettings,
        ...params.generationConfig
      }
    }),
    signal: effectiveSignal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

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
          if (data.error) throw new Error(data.error);
        } catch (e) {
          console.error("Error parsing stream chunk:", e);
        }
      }
    }
    // Flush remaining buffer (handles server [DONE] without trailing newline)
    if (buffer.startsWith('data: ')) {
      const dataStr = buffer.slice(6).trim();
      if (dataStr !== '[DONE]') {
        try {
          const data = JSON.parse(dataStr);
          if (data.text) yield data.text;
        } catch { /* partial final chunk — discard */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- RICH STREAMING (thinking tokens) ---
export type StreamChunk = { kind: 'text'; text: string } | { kind: 'thinking'; text: string };

export async function* streamGeminiProxyRich(params: {
  model: string;
  contents: any;
  generationConfig?: any;
  systemInstruction?: string;
  safetySettings?: any;
  userTier?: string;
}): AsyncGenerator<StreamChunk, void, unknown> {
  const token = await getAuthToken();

  let modelToUse = params.model;
  if (params.userTier === 'Pro' || params.userTier === 'Unlimited') {
    modelToUse = ULTIMATE_MODEL;
  } else if (params.userTier === 'Standard') {
    modelToUse = PRO_MODEL;
  } else {
    modelToUse = DEFAULT_MODEL;
  }

  const response = await fetch('/api/gemini-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      model: modelToUse,
      contents: normalizeContents(params.contents),
      config: {
        systemInstruction: params.systemInstruction,
        safetySettings: params.safetySettings,
        ...params.generationConfig
      }
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

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
          if (data.error) throw new Error(data.error);
        } catch (e) {
          console.error("Error parsing rich stream chunk:", e);
        }
      }
    }
    // Flush any remaining buffer content (handles [DONE] without trailing newline)
    if (buffer.startsWith('data: ')) {
      const dataStr = buffer.slice(6).trim();
      if (dataStr !== '[DONE]') {
        try {
          const data = JSON.parse(dataStr);
          if (data.thinking) yield { kind: 'thinking', text: data.thinking };
          else if (data.text) yield { kind: 'text', text: data.text };
        } catch { /* partial/malformed final chunk — discard */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- INPUT SANITIZATION ---
/**
 * Sanitizes user-provided strings before injecting them into AI prompts.
 * Strips control characters, null bytes, and limits length to prevent
 * prompt injection and token over-runs.
 */
export function sanitizePromptInput(text: string | undefined | null, maxLength = 1000): string {
  if (!text) return '';
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // control chars (keep \t \n \r)
    .replace(/\s+/g, ' ')                                 // collapse whitespace
    .trim()
    .slice(0, maxLength);
}

// --- UTILS ---
export function handleGeminiError(error: unknown, customMessage?: string): never {
    console.error("Gemini Service Error:", error);
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new RateLimitError();
    }
    if (errorMessage.includes("api key not valid") || errorMessage.includes("permission denied") || errorMessage.includes("403")) {
        throw new AuthError();
    }
    if (errorMessage.includes("server error") || errorMessage.includes("500") || errorMessage.includes("overloaded")) {
        throw new ServerError();
    }
    
    const displayMessage = customMessage || (error instanceof Error ? error.message : "An unknown error occurred with the AI service.");
    throw new ApiError(displayMessage);
}

export function cleanJsonString(text: string): string {
    if (!text) return "";
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIndex = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) startIndex = firstBrace;
    else if (firstBracket !== -1) startIndex = firstBracket;
    if (startIndex !== -1) cleaned = cleaned.substring(startIndex);
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    let endIndex = -1;
    if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) endIndex = lastBrace;
    else if (lastBracket !== -1) endIndex = lastBracket;
    if (endIndex !== -1) cleaned = cleaned.substring(0, endIndex + 1);
    cleaned = cleaned.replace(/\\(?![^"nrtbf\/u\\])/g, '\\\\');
    return cleaned.trim();
}

export function minifyContext(context: GenerationContext): any {
    if (!context) return {};
    const safeString = (str: string | undefined, maxLength: number) => (str || '').substring(0, maxLength);
    return {
        type: context.type,
        gradeLevel: context.grade?.level,
        topic: context.topic ? { title: context.topic.title, description: safeString(context.topic.description, 200) } : undefined,
        concepts: context.concepts?.map(c => ({
            title: c.title,
            description: safeString(c.description, 150),
            contentPoints: c.content?.slice(0, 5),
            assessmentStandards: c.assessmentStandards,
            suggestedActivities: c.activities?.slice(0, 4),
            prerequisiteConcepts: context.prerequisitesByConceptId?.[c.id] ?? [],
        })),
        standard: context.standard ? { code: context.standard.code, description: safeString(context.standard.description, 200) } : undefined,
        scenario: safeString(context.scenario, 500),
        bloomEmphasis: context.bloomDistribution && Object.keys(context.bloomDistribution).length > 0
            ? Object.keys(context.bloomDistribution)
            : undefined,
        verticalProgression: context.verticalProgression?.length
            ? context.verticalProgression
            : undefined,
    };
}

// --- SYSTEM INSTRUCTIONS ---
export const TEXT_SYSTEM_INSTRUCTION = `
Ти си врвен експерт за методика на наставата по математика во Македонија.
Твојата цел е да генерираш креативни, ангажирачки и педагошки издржани содржини.

ПРАВИЛА ЗА ИЗЛЕЗ:
1. Јазик: {{LANGUAGE_RULE}}
2. Форматирање: Користи Markdown за добра читливост.
3. Математички формули: Користи стандарден LaTeX со $ за инлајн и $$ за блок. Користи \\cdot за множење и : за делење. Користи децимална запирка (,).

УПОТРЕБА НА КОНТЕКСТ:
- contentPoints: точна математичка содржина која треба да ја покриеш — задолжително ја вклучи.
- assessmentStandards: конкретни исходи за оценување — генерираните прашања/задачи МОРА да ги покриваат.
- suggestedActivities: педагошки активности од наставната програма — инспирирај се, адаптирај, не копирај буквално.
- prerequisiteConcepts: листа на концепти кои учениците мора да ги знаат однапред — ако не е празна, вклучи кратка 'Активирање предзнаење' секција (5 мин) со конкретна активност за тие концепти.
`;

export const JSON_SYSTEM_INSTRUCTION = `Ти си API кое генерира строго валиден JSON за наставни материјали по математика. 
ОДГОВОРИ ИСКЛУЧИВО СО RAW JSON ОБЈЕКТ. БЕЗ MARKDOWN (\`\`\`json) И БЕЗ ДОПОЛНИТЕЛЕН ТЕКСТ.`;

// --- MACEDONIAN LOCAL CONTEXT ---
export const MK_LOCAL_CONTEXT_KEY = 'mk_local_context_enabled';

export function isMacedonianContextEnabled(): boolean {
    try { return localStorage.getItem(MK_LOCAL_CONTEXT_KEY) !== 'false'; } catch { return true; }
}
export function setMacedonianContextEnabled(val: boolean): void {
    try { localStorage.setItem(MK_LOCAL_CONTEXT_KEY, String(val)); } catch { /* ignore */ }
}

export const MACEDONIAN_CONTEXT_SNIPPET = `
МАКЕДОНСКИ ЛОКАЛЕН КОНТЕКСТ (задолжителен):
Сите примери, задачи и наративи мора да ја одразуваат македонската реалност:
- Валута: денари (ден.) — не долари или евра. Примери: "Марко купил леб за 35 ден.", "Производот чини 850 ден."
- Имиња: Македонски имиња — Марко, Ана, Стефан, Ивана, Борис, Сара, Давид, Елена, Никола, Тина, Ристе, Благица.
- Градови/места: Скопје, Битола, Охрид, Куманово, Прилеп, Тетово, Велес, Струга, Кичево, Гевгелија.
- Локален контекст: пазарување на Зелен пазар, екскурзија до Охридското езеро, натпревар во скокање во торба, делење кифли во одделение, набројување цреши во градина.
- Храна: јаболка, сливи, тиква, баница, бурек, кравајче, ајвар.
- Природа: Вардар, Шар Планина, Пелистер, Матка, Тиквешко.
НЕ КОРИСТИ: долари, Јани/Мери/Боб, Лондон, Њујорк, MLB, NBA, пица (американска).
`;

export async function buildDynamicSystemInstruction(baseInstruction: string, gradeLevel?: number, conceptId?: string, topicId?: string): Promise<string> {
    let instruction = baseInstruction;
    let lang = 'mk';
    try { lang = localStorage.getItem('preferred_language') || 'mk'; } catch(e){}
    let langRule = "Користи литературен македонски јазик.";
    if (lang === 'sq') langRule = "Задолжително користи АЛБАНСКИ јазик (Shqip) за целиот текст и содржина.";
    if (lang === 'tr') langRule = "Задолжително користи ТУРСКИ јазик (Türkçe) за целиот текст и содржина.";
    if (lang === 'en') langRule = "Задолжително користи АНГЛИСКИ јазик (English) за целиот текст и содржина.";
    
    instruction = instruction.replace('{{LANGUAGE_RULE}}', langRule);
    
    if (!instruction.includes('{{LANGUAGE_RULE}}') && lang && lang !== 'mk') {
        instruction += "\nВАЖНА НАПОМЕНА: Сите текстуални вредности во JSON објектот (наслови, описи, задачи) МОРА да бидат напишани исклучиво на " + 
                       (lang === 'sq' ? 'АЛБАНСКИ (Shqip)' : lang === 'tr' ? 'ТУРСКИ (Türkçe)' : 'АНГЛИСКИ (English)') + " јазик!";
    }

    if (gradeLevel && conceptId) {
        instruction += await ragService.getConceptContext(gradeLevel, conceptId);
    } else if (gradeLevel && topicId) {
        instruction += await ragService.getTopicContext(gradeLevel, topicId);
    }

    // Inject Macedonian local context when enabled (default: on)
    if (isMacedonianContextEnabled()) {
        instruction += MACEDONIAN_CONTEXT_SNIPPET;
    }

    // Simplification bounds for young students
    if (gradeLevel && gradeLevel <= 3) {
        instruction += `\nЗАБЕЛЕШКА: Ова е за рана училишна возраст (1-3 одд). Користи многу едноставни зборови, кратки реченици и конкретни физички предмети за примери (како јаболка, играчки, моливи итн.). Избегнувај апстрактни поими.`;
    }

    return instruction;
}

export const SAFETY_SETTINGS: SafetySetting[] = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_ONLY_HIGH' },
];

// --- CORE JSON HELPER ---
export async function generateAndParseJSON<T>(contents: Part[], schema: any, model: string = DEFAULT_MODEL, zodSchema?: z.ZodTypeAny, retries = MAX_RETRIES, useThinking = false, customSystemInstruction?: string, userTier?: string): Promise<T> {
    const activeModel = useThinking ? 'gemini-3.1-pro' : model;
    const _controller = new AbortController();
    const _timeoutId = setTimeout(() => _controller.abort(), GENERATION_TIMEOUT_MS);
    try {
      const generationConfig: any = {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 8192
      };

      if (useThinking) {
        generationConfig.thinkingConfig = { thinkingBudget: 16000 };
      } else {
        // Force the model to output raw JSON — no markdown wrappers possible
        generationConfig.responseMimeType = 'application/json';
      }

      // Keep schema as a structural hint in the prompt
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

    // responseMimeType guarantees clean JSON for the standard model.
    // For the thinking model (no responseMimeType support), cleanJsonString strips any markdown.
    const rawText = response.text || "";
    const jsonString = useThinking ? cleanJsonString(rawText) : rawText.trim();
    if (!jsonString) throw new Error("AI returned empty response");

    const parsedJson = JSON.parse(jsonString);

    if (zodSchema) {
        const validation = zodSchema.safeParse(parsedJson);
        if (!validation.success) throw new Error(`Validation failed: ${validation.error.message}`);
        return validation.data as T;
    }
    return parsedJson as T;
  } catch (error: any) {
    // Timeout: AbortController fired after GENERATION_TIMEOUT_MS — not retryable
    if (error?.name === 'AbortError') {
      throw new Error('Генерирањето траеше предолго. Обидете се повторно.');
    }
    const errorMessage = error.message?.toLowerCase() || "";

    // Daily quota exhaustion is not retryable — it resets at midnight UTC, not in seconds.
    // Check both: (a) already a RateLimitError thrown by callGeminiProxy, or
    // (b) fallback string matching for cases where proxy quotaType wasn't available (e.g. old build).
    const isDailyQuotaExhausted =
      error instanceof RateLimitError ||
      (errorMessage.includes("429") && (
        errorMessage.includes("perday") ||
        errorMessage.includes("per_day") ||
        errorMessage.includes("requests_per_day") ||
        errorMessage.includes("free_tier_requests")  // actual metric name from Google API
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
        if (!(error instanceof RateLimitError)) markDailyQuotaExhausted(); // Fallback: mark if not already marked
        throw new RateLimitError("Дневната AI квота е исцрпена. Обидете се повторно утре или контактирајте го администраторот за надградба на планот.");
      }
      console.error("Non-retryable AI error:", error);
      throw error;
    }

    if (retries > 0) {
      const match = errorMessage.match(/retry in (\d+(\.\d+)?)s/i);
      const delay = match
        ? (parseFloat(match[1]) + 1) * 1000
        : 2000 * Math.pow(2, MAX_RETRIES - retries);
      console.warn(`[AI] Retry in ${delay}ms, ${retries} attempt(s) left.`);
      await new Promise(r => setTimeout(r, delay));
      return generateAndParseJSON<T>(contents, schema, model, zodSchema, retries - 1, useThinking);
    }
    handleGeminiError(error);
  } finally {
    clearTimeout(_timeoutId);
  }
}

// --- SERVICE IMPLEMENTATION ---
// --- HELPER FUNCTIONS FOR CACHING ---
export async function getCached<T>(key: string): Promise<T | null> {
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, key));
        if (cachedDoc.exists()) return cachedDoc.data().content as T;
    } catch (e) {
        // console.warn('Cache read error:', e); 
        // Silent fail on cache read is okay, we just regenerate
    }
    return null;
}

export async function setCached(key: string, content: any, metadata: any = {}) {
    try {
        await setDoc(doc(db, CACHE_COLLECTION, key), {
            content,
            ...metadata,
            createdAt: serverTimestamp()
        });
    } catch (e) {
        console.error('Cache write error:', e);
    }
}

