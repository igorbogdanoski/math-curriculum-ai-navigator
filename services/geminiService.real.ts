import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import {
    Concept,
    Topic,
    Grade,
    ChatMessage,
    TeachingProfile,
    StudentProfile,
    QuestionType,
    DifferentiationLevel,
    GenerationContext,
    AIGeneratedIdeas,
    AIGeneratedAssessment,
    AIGeneratedPracticeMaterial,
    AIGeneratedThematicPlan,
    AIGeneratedRubric,
    AIGeneratedIllustration,
    AIGeneratedLearningPaths,
    CoverageAnalysisReport,
    AIRecommendation,
    AIPedagogicalAnalysis,
    LessonPlan,
    PlannerItem,
    NationalStandard,
    GeneratedTest,
    AssessmentQuestion
} from '../types';
import { ragService } from './ragService';
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
} from '../utils/schemas';
import { ApiError, RateLimitError, AuthError, ServerError } from './apiErrors';

// --- CONSTANTS ---
const CACHE_COLLECTION = 'cached_ai_materials';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_RETRIES = 2;
const GENERATION_TIMEOUT_MS = 45_000; // 45 seconds per attempt before aborting

// --- TYPES FOR INTERNAL USE ---
export enum Type {
    OBJECT = "object",
    ARRAY = "array",
    STRING = "string",
    INTEGER = "integer",
    NUMBER = "number",
}

interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface Content {
    role: 'user' | 'model';
    parts: Part[];
}

interface SafetySetting {
    category: string;
    threshold: string;
}

// --- DAILY QUOTA GUARD ---
// Once the daily free-tier quota is exhausted, all calls fail immediately until the next
// Pacific midnight (= actual Gemini reset time = 09:00 MK time).
// BUG FIX: Previously used UTC date comparison → cleared at 01:00 MK, but Gemini resets at
// 09:00 MK. Auto-calls in the 01:00–09:00 window re-exhausted quota every day for 10+ days.
const DAILY_QUOTA_KEY = 'ai_daily_quota_exhausted';

// ---------------------------------------------------------------------------
// Quota storage helpers — dual write: cookie (primary) + localStorage (fallback)
// Edge/Firefox Tracking Prevention often blocks localStorage for *.vercel.app
// but first-party SameSite=Strict cookies are never blocked by Tracking Prevention.
// ---------------------------------------------------------------------------
function quotaRead(): string | null {
  // Try cookie first (immune to Tracking Prevention)
  try {
    const match = document.cookie.split('; ').find(r => r.startsWith('ai_quota='));
    if (match) return decodeURIComponent(match.slice('ai_quota='.length));
  } catch { /* ignore */ }
  // Fallback to localStorage
  try { return localStorage.getItem(DAILY_QUOTA_KEY); } catch { return null; }
}

function quotaWrite(value: string, expiresMs: number): void {
  // Write to cookie (primary — survives Tracking Prevention)
  try {
    document.cookie = `ai_quota=${encodeURIComponent(value)}; expires=${new Date(expiresMs).toUTCString()}; SameSite=Strict; path=/`;
  } catch { /* ignore */ }
  // Also write to localStorage for environments that support it
  try { localStorage.setItem(DAILY_QUOTA_KEY, value); } catch { /* ignore */ }
}

function quotaClear(): void {
  try { document.cookie = 'ai_quota=; expires=Thu, 01 Jan 1970 00:00:00 UTC; SameSite=Strict; path=/'; } catch { /* ignore */ }
  try { localStorage.removeItem(DAILY_QUOTA_KEY); } catch { /* ignore */ }
}

/** Returns the Unix timestamp (ms) of the next Pacific midnight (Gemini's reset point). */
function getNextPacificMidnightMs(): number {
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

function checkDailyQuotaGuard(): void {
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

function markDailyQuotaExhausted(): void {
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
async function queueRequest<T>(fn: () => Promise<T>): Promise<T> {
  checkDailyQuotaGuard(); // Block immediately if daily quota is known exhausted
  const result = lastRequest.then(fn);
  lastRequest = result.catch(() => {});
  return result;
}

// --- AUTH HELPER ---
async function getAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Не сте најавени. Ве молиме најавете се повторно.');
  }
  return user.getIdToken();
}

// --- DIRECT SDK HELPERS ---
function normalizeContents(contents: any): any[] {
  if (!contents) return [];
  if (typeof contents === 'string') return [{ role: 'user', parts: [{ text: contents }] }];
  if (!Array.isArray(contents)) return [{ role: 'user', parts: [{ text: String(contents) }] }];
  
  return contents.map(c => {
    if (typeof c === 'string') return { role: 'user', parts: [{ text: c }] };
    if (c.role && c.parts) return c;
    if (c.parts) return { role: 'user', parts: c.parts };
    if (c.text) return { role: 'user', parts: [{ text: c.text }] };
    return { role: 'user', parts: [{ text: String(JSON.stringify(c)) }] };
  });
}

async function callGeminiProxy(params: {
  model: string;
  contents: any;
  generationConfig?: any;
  systemInstruction?: string;
  safetySettings?: any;
}, signal?: AbortSignal): Promise<{ text: string; candidates: any[] }> {
  return queueRequest(async () => {
    try {
      const token = await getAuthToken();
      
      // Мапирање на моделот за Vercel Whitelist
      let modelName = params.model;
      if (modelName === 'gemini-1.5-flash' || modelName === 'gemini-1.5-flash-latest' || modelName === 'gemini-1.5-flash-8b' || modelName === 'gemini-1.5-flash-8b-latest') modelName = 'gemini-2.0-flash';
      else if (modelName.includes('thinking')) modelName = 'gemini-2.0-flash-thinking-exp';
      // Остави ги другите како што се (на пр. gemini-2.0-flash)

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          model: modelName,
          contents: normalizeContents(params.contents),
          config: {
            ...params.generationConfig,
            systemInstruction: params.systemInstruction,
            safetySettings: params.safetySettings
          }
        }),
        signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // If the proxy flagged this as a daily quota error, mark it and throw immediately
        if (response.status === 429 && errorData.quotaType === 'daily') {
          markDailyQuotaExhausted();
          throw new RateLimitError("Дневната AI квота е исцрпена. Обидете се повторно утре или надградете го планот.");
        }
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      return await response.json();
    } catch (err: any) {
      console.error("Gemini Proxy Error:", err.message || err);
      throw err;
    }
  });
}

async function* streamGeminiProxy(params: { 
  model: string; 
  contents: any; 
  generationConfig?: any;
  systemInstruction?: string;
  safetySettings?: any;
}): AsyncGenerator<string, void, unknown> {
  const token = await getAuthToken();
  
  let modelName = params.model;
  if (modelName === 'gemini-1.5-flash' || modelName === 'gemini-1.5-flash-latest' || modelName === 'gemini-1.5-flash-8b' || modelName === 'gemini-1.5-flash-8b-latest') modelName = 'gemini-2.0-flash';
  else if (modelName.includes('thinking')) modelName = 'gemini-2.0-flash-thinking-exp';
  // Остави ги другите како што се (на пр. gemini-2.0-flash)

  const response = await fetch('/api/gemini-stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: modelName,
      contents: normalizeContents(params.contents),
      config: {
        ...params.generationConfig,
        systemInstruction: params.systemInstruction,
        safetySettings: params.safetySettings
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Mirror the same daily-quota detection as callGeminiProxy
    if (response.status === 429 && errorData.quotaType === 'daily') {
      markDailyQuotaExhausted();
      throw new RateLimitError("Дневната AI квота е исцрпена. Обидете се повторно утре или надградете го планот.");
    }
    throw new Error(errorData.error || `Stream error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) throw new Error("No reader available");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.text) yield parsed.text;
          if (parsed.error) throw new Error(parsed.error);
        } catch (e) {
          console.warn("Error parsing stream chunk", e);
        }
      }
    }
  }
}

// --- UTILS ---
function handleGeminiError(error: unknown, customMessage?: string): never {
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

function cleanJsonString(text: string): string {
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

function minifyContext(context: GenerationContext): any {
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
const TEXT_SYSTEM_INSTRUCTION = `
Ти си врвен експерт за методика на наставата по математика во Македонија.
Твојата цел е да генерираш креативни, ангажирачки и педагошки издржани содржини.

ПРАВИЛА ЗА ИЗЛЕЗ:
1. Јазик: Користи литературен македонски јазик.
2. Форматирање: Користи Markdown за добра читливост.
3. Математички формули: Користи стандарден LaTeX со $ за инлајн и $$ за блок. Користи \\cdot за множење и : за делење. Користи децимална запирка (,).

УПОТРЕБА НА КОНТЕКСТ:
- contentPoints: точна математичка содржина која треба да ја покриеш — задолжително ја вклучи.
- assessmentStandards: конкретни исходи за оценување — генерираните прашања/задачи МОРА да ги покриваат.
- suggestedActivities: педагошки активности од наставната програма — инспирирај се, адаптирај, не копирај буквално.
- prerequisiteConcepts: листа на концепти кои учениците мора да ги знаат однапред — ако не е празна, вклучи кратка 'Активирање предзнаење' секција (5 мин) со конкретна активност за тие концепти.
`;

const JSON_SYSTEM_INSTRUCTION = `Ти си API кое генерира строго валиден JSON за наставни материјали по математика. 
ОДГОВОРИ ИСКЛУЧИВО СО RAW JSON ОБЈЕКТ. БЕЗ MARKDOWN (\`\`\`json) И БЕЗ ДОПОЛНИТЕЛЕН ТЕКСТ.`;

export async function buildDynamicSystemInstruction(baseInstruction: string, gradeLevel?: number, conceptId?: string, topicId?: string): Promise<string> {
    let instruction = baseInstruction;
    if (gradeLevel && conceptId) {
        instruction += await ragService.getConceptContext(gradeLevel, conceptId);
    } else if (gradeLevel && topicId) {
        instruction += await ragService.getTopicContext(gradeLevel, topicId);
    }
    
    // Simplification bounds for young students
    if (gradeLevel && gradeLevel <= 3) {
        instruction += `\nЗАБЕЛЕШКА: Ова е за рана училишна возраст (1-3 одд). Користи многу едноставни зборови, кратки реченици и конкретни физички предмети за примери (како јаболка, играчки, моливи итн.). Избегнувај апстрактни поими.`;
    }

    return instruction;
}

const SAFETY_SETTINGS: SafetySetting[] = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_ONLY_HIGH' },
];

// --- CORE JSON HELPER ---
async function generateAndParseJSON<T>(contents: Part[], schema: any, model: string = DEFAULT_MODEL, zodSchema?: z.ZodTypeAny, retries = MAX_RETRIES, useThinking = false, customSystemInstruction?: string): Promise<T> {
    const activeModel = useThinking ? 'gemini-2.0-flash-thinking-exp' : model;
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
      safetySettings: SAFETY_SETTINGS
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
async function getCached<T>(key: string): Promise<T | null> {
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, key));
        if (cachedDoc.exists()) return cachedDoc.data().content as T;
    } catch (e) {
        // console.warn('Cache read error:', e); 
        // Silent fail on cache read is okay, we just regenerate
    }
    return null;
}

async function setCached(key: string, content: any, metadata: any = {}) {
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

export const realGeminiService = {
  async generateLessonPlanIdeas(concepts: Concept[], topic: Topic, gradeLevel: number, profile?: TeachingProfile, options?: { focus: string; tone: string; learningDesign?: string; }, customInstruction?: string): Promise<AIGeneratedIdeas> {
    const conceptId = concepts?.[0]?.id || 'no_concept';
    const cacheKey = `ideas_${conceptId}_g${gradeLevel}`;
    // Skip cache when custom instruction is provided — user wants specific generation, not community cache
    if (!customInstruction) {
      try {
          const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
          if (cachedDoc.exists()) return cachedDoc.data().content as AIGeneratedIdeas;
      } catch (e) { console.warn("Cache read error:", e); }
    }

    const conceptList = concepts.map(c => c.title).join(', ');
    const topicTitle = topic?.title || "Општа математичка тема";
    let prompt = `Генерирај идеи за час на македонски јазик. Контекст: Одделение ${gradeLevel}, Тема: ${topicTitle}. Поими: ${conceptList}.`;
    if (customInstruction) prompt += `\nДополнителна инструкција: ${customInstruction}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            openingActivity: { type: Type.STRING },
            mainActivity: { 
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        bloomsLevel: { type: Type.STRING, enum: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'] }
                    },
                    required: ["text", "bloomsLevel"]
                }
            },
            differentiation: { type: Type.STRING },
            assessmentIdea: { type: Type.STRING },
        },
        required: ["title", "openingActivity", "mainActivity", "differentiation", "assessmentIdea"]
    };

    const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, gradeLevel, conceptId, topic?.id);
    const result = await generateAndParseJSON<AIGeneratedIdeas>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedIdeasSchema, MAX_RETRIES, false, systemInstr);
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: result, type: 'ideas', conceptId, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return result;
  },

  async *getChatResponseStream(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }): AsyncGenerator<string, void, unknown> {
    checkDailyQuotaGuard(); // П30: block streaming if daily quota is exhausted
    const systemInstruction = `${TEXT_SYSTEM_INSTRUCTION}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;
    const contents: Content[] = history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
    if (attachment && contents.length > 0) {
        const lastMessage = contents[contents.length - 1];
        if (lastMessage.role === 'user') lastMessage.parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } });
    }
    yield* streamGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents, 
        systemInstruction, 
        safetySettings: SAFETY_SETTINGS 
    });
  },

  async generateIllustration(prompt: string, image?: { base64: string, mimeType: string }): Promise<AIGeneratedIllustration> {
    const contents: Part[] = [{ text: prompt }];
    if (image) contents.unshift({ inlineData: { data: image.base64, mimeType: image.mimeType } });
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: contents }], 
        generationConfig: { responseModalities: ['IMAGE'] }, 
        safetySettings: SAFETY_SETTINGS 
    });
    const candidate = response.candidates[0];
    if (candidate && candidate.content.parts[0].inlineData) {
        const data = candidate.content.parts[0].inlineData;
        return { imageUrl: `data:${data.mimeType};base64,${data.data}`, prompt };
    }
    throw new Error("AI did not return image");
  },

  async generateLearningPaths(context: GenerationContext, studentProfiles: StudentProfile[], profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedLearningPaths> {
    const profileNames = studentProfiles.map(p => p.name).join(', ');
    const vertProgText = context.verticalProgression?.length
        ? `\nВЕРТИКАЛНА ПРОГРЕСИЈА (развој на концептот низ годините):\n${context.verticalProgression.map(vp => `- ${vp.title}: ${vp.progression.map(p => `${p.grade} одд. → "${p.conceptTitle}"`).join(' → ')}`).join('\n')}`
        : '';
    const prompt = `Креирај индивидуализирани патеки за учење за следните профили на ученици: ${profileNames || 'основно ниво'}.

БАРАЊА:
1. Секоја патека мора да има 5–7 конкретни чекори (активности).
2. Типови на чекори (МОРА да користиш ТОЧНО еден од овие): "Introductory" (воведно/загревање), "Practice" (вежбање), "Consolidation" (консолидација/утврдување), "Assessment" (самопроверка/оценување), "Project" (проект/примена).
3. Чекорите треба да бидат конкретни и изводливи — не само „реши задачи", туку опиши ЧТО конкретно прави ученикот.
4. Патеките треба да се диференцирани — различно темпо, сложеност и поддршка за секој профил.
5. Ако постои вертикална прогресија, поврзи го тековното знаење со претходното и идното учење.
${vertProgText}
${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, paths: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { profileName: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stepNumber: { type: Type.INTEGER }, activity: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["stepNumber", "activity"] } } }, required: ["profileName", "steps"] } } }, required: ["title", "paths"] };
    return generateAndParseJSON<AIGeneratedLearningPaths>([{ text: prompt }, { text: JSON.stringify(minifyContext(context)) }], schema, DEFAULT_MODEL, AIGeneratedLearningPathsSchema, MAX_RETRIES, false);
  },

  async generateAnalogy(concept: Concept, gradeLevel: number): Promise<string> {
    const cacheKey = `analogy_${concept.id}_g${gradeLevel}`;
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
        if (cachedDoc.exists()) return cachedDoc.data().content;
    } catch (e) { console.warn(e); }

    const prompt = `Објасни го поимот "${concept.title}" за ${gradeLevel} одделение преку аналогија.`;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS 
    });
    const text = response.text || "";
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: text, type: 'analogy', conceptId: concept.id, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return text;
  },

  async generateStepByStepSolution(conceptTitle: string, gradeLevel: number, customInstruction?: string): Promise<{ problem: string, strategy?: string, steps: any[] }> {
    // Cache is skipped when customInstruction is provided (user wants specific problem)
    const cacheKey = `solver_thinking_${conceptTitle.replace(/\s+/g, '_')}_g${gradeLevel}`;
    if (!customInstruction) {
      try {
          const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
          if (cachedDoc.exists()) return cachedDoc.data().content;
      } catch (e) { console.warn("Cache error:", e); }
    }

    const prompt = `
      Ти си експерт за математичка педагогија. Креирај една типична задача за "${conceptTitle}" за ${gradeLevel} одделение.
      Користи Tree of Thoughts (ToT) пристап: размисли за 2 различни методи на решавање и избери ја онаа која е најјасна за ученик.
      Реши ја задачата детално преку Chain of Thought (CoT) — секој чекор мора да биде логично поврзан.

      Внимавај на математичката точност! Направи само-проверка пред финалниот одговор.
      ${customInstruction ? `\nКонтекст од курикулумот:\n${customInstruction}` : ''}

      Врати JSON точно по овој формат:
      {
        "problem": "текст на задачата",
        "strategy": "зошто ја избравме оваа метода наспроти алтернативата",
        "steps": [{"explanation": "зошто го правиме овој чекор", "expression": "LaTeX или чист текст"}]
      }
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            problem: { type: Type.STRING },
            strategy: { type: Type.STRING },
            steps: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        expression: { type: Type.STRING }
                    },
                    required: ["explanation", "expression"]
                }
            }
        },
        required: ["problem", "steps", "strategy"]
    };

    // Standard model is sufficient and 3-5x cheaper on quota than thinking model
    const result = await generateAndParseJSON<any>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
    // Only cache non-custom results for community reuse
    if (!customInstruction && result) {
      await setDoc(doc(db, CACHE_COLLECTION, cacheKey), {
          content: result,
          type: 'solver',
          conceptTitle,
          gradeLevel,
          createdAt: serverTimestamp()
      }).catch(console.error);
    }
    return result;
  },

  async solveSpecificProblemStepByStep(problemText: string): Promise<{ problem: string, strategy?: string, steps: any[] }> {
    const prompt = `
      Ти си експерт за математичка педагогија. Ученикот не успеа да ја реши следнава задача:
      ЗАДАЧА: "${problemText}"

      За да му помогнеш:
      1. Реши ја задачата детално преку Chain of Thought (CoT) — секој чекор мора да биде логично поврзан и едноставен за следење.
      2. Во полето "strategy" напиши кратка, охрабрувачка реченица (на пр. "Ајде да ја разложиме оваа задача на неколку едноставни чекори!").
      
      Внимавај на математичката точност!
      
      Врати JSON точно по овој формат:
      {
        "problem": "${problemText.replace(/"/g, '\\"')}",
        "strategy": "почетна стратегија или охрабрување",
        "steps": [{"explanation": "зошто го правиме овој чекор", "expression": "LaTeX или чист текст"}]
      }
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            problem: { type: Type.STRING },
            strategy: { type: Type.STRING },
            steps: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        expression: { type: Type.STRING }
                    },
                    required: ["explanation", "expression"]
                }
            }
        },
        required: ["problem", "steps"]
    };

    const result = await generateAndParseJSON<any>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
    return result;
  },

  async diagnoseMisconception(question: string, correctAnswer: string, studentAnswer: string): Promise<string> {
    const prompt = `
      Ти си искусен наставник по математика кој се обидува да ја разбере логиката зад грешката на ученикот.
      
      Прашање: "${question}"
      Точен одговор: "${correctAnswer}"
      Одговор на ученикот: "${studentAnswer}"

      Твоја задача:
      Дијагностицирај каква концептуална или пресметковна грешка направил ученикот. 
      Ако е очигледна концептуална грешка (пр. ги собира именителите кај дропки, не ги разбира негативните броеви, ги меша периметар и плоштина), опиши ја кратко.
      Ако изгледа како обична пресметковна или случајна грешка, кажи "Пресметковна грешка или случајно погодување".
      
      Врати САМО една кратка реченица на македонски јазик која ја опишува грешката (без објаснувања и совети).
      Пример: "Ученикот ги собира именителите наместо да бара НЗС."
    `;

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: "Врати само една кратка реченица со дијагноза на грешката.",
                    temperature: 0.1
                }
            })
        });

        if (!response.ok) return "Непозната грешка";
        
        const data = await response.json();
        return data.text ? data.text.trim().replace(/^"|"$/g, '') : "Непозната грешка";
    } catch (e) {
        console.error("Грешка при дијагностицирање:", e);
        return "Непозната грешка";
    }
  },

  async explainSpecificStep(problem: string, stepExplanation: string, stepExpression: string): Promise<string> {
    const prompt = `
      Како наставник по математика, објасни му на ученик ЗОШТО го направивме овој чекор во контекст на задачата.
      Задача: ${problem}
      Чекор: ${stepExplanation} (${stepExpression})
      Објасни го математичкото правило во 2 кратки реченици на македонски јазик.
    `;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS 
    });
    return response.text || "";
  },

  async generatePracticeMaterials(concept: Concept, gradeLevel: number, materialType: 'problems' | 'questions'): Promise<AIGeneratedPracticeMaterial> {
    const typeKey = materialType === 'problems' ? 'quiz' : 'discussion';
    const cacheKey = `${typeKey}_${concept.id}_g${gradeLevel}`;
    
    const cached = await getCached<AIGeneratedPracticeMaterial>(cacheKey);
    if (cached) return cached;

    const task = materialType === 'problems' ? 'quiz with 5 multiple-choice problems' : 'discussion guide with 5 questions';
    const prompt = `Create a ${task} for "${concept.title}" (${gradeLevel} od.). Врати JSON: { "title": "...", "items": [{"type": "multiple-choice", "text": "...", "answer": "...", "solution": "...", "options": ["...", "..."]}] }`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, text: { type: Type.STRING }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["text", "answer"] } } }, required: ["title", "items"] };
    const result = await generateAndParseJSON<AIGeneratedPracticeMaterial>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedPracticeMaterialSchema);
    await setCached(cacheKey, result, { type: typeKey, conceptId: concept.id, gradeLevel });
    return result;
  },

  async generateAssessment(type: 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS', questionTypes: QuestionType[], numQuestions: number, context: GenerationContext, profile?: TeachingProfile, differentiationLevel: DifferentiationLevel = 'standard', studentProfiles?: StudentProfile[], image?: { base64: string, mimeType: string }, customInstruction?: string, includeSelfAssessment?: boolean): Promise<AIGeneratedAssessment> {
    const bloomLevels = context.bloomDistribution && Object.keys(context.bloomDistribution).length > 0
      ? Object.keys(context.bloomDistribution)
      : null;
    const bloomPart = bloomLevels ? ` Нагласени Блумови нивоа: ${bloomLevels.join(', ')}.` : '';
    const selfAssessmentPart = includeSelfAssessment ? ' Додај 2-3 метакогнитивни прашања за само-оценување на крајот.' : '';
    const diffDescriptions: Record<string, string> = {
      support: 'ПОДДРШКА: Поедноставени прашања со детални упатства, помал вокабулар, насочување низ решавање чекор по чекор',
      standard: 'ОСНОВНО: Стандардни прашања соодветни за просечен ученик',
      advanced: 'ЗБОГАТУВАЊЕ: Предизвикувачки прашања со отворен крај, критичко размислување, меѓупредметни врски и примена во реален контекст',
    };
    const diffDesc = diffDescriptions[differentiationLevel] || diffDescriptions.standard;
    const gradeLevelPrompt = context.grade.level && context.grade.level <= 3 
      ? ' ЗАБЕЛЕШКА ЗА ВОЗРАСТА: Ова е за рана училишна возраст (1-3 одд). Користи МНОГУ ЕДНОСТАВЕН јазик, кратки реченици и примери со конкретни предмети (на пр. јаболка, играчки). Бројките да соодветствуваат на нивото.' 
      : '';
    const prompt = `Генерирај ${type} со ${numQuestions} прашања на македонски. Типови: ${questionTypes.join(', ')}. Ниво на диференцијација: ${diffDesc}.${bloomPart}${selfAssessmentPart}${gradeLevelPrompt} За секое прашање задолжително наведи 'cognitiveLevel' (Remembering/Understanding/Applying/Analyzing/Evaluating/Creating) и 'difficulty_level' (лесно/средно/тешко). ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, alignment_goal: { type: Type.STRING }, selfAssessmentQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, cognitiveLevel: { type: Type.STRING }, difficulty_level: { type: Type.STRING }, concept_evaluated: { type: Type.STRING } }, required: ["type", "question", "answer", "cognitiveLevel"] } } }, required: ["title", "questions"] };

    const canCache = !customInstruction && !studentProfiles?.length && differentiationLevel === 'standard' && !image;
    const conceptCacheId = context.concepts?.[0]?.id || 'gen';
    const cacheKey = canCache ? `assessment_${type}_${conceptCacheId}_g${context.grade.level}_${[...questionTypes].sort().join('_')}_n${numQuestions}` : '';
    
    if (canCache && cacheKey) {
        const cached = await getCached<AIGeneratedAssessment>(cacheKey);
        if (cached) return cached;
    }

    const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
    if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    
    // RAG INJECTION
    const systemInstr = await buildDynamicSystemInstruction(
        JSON_SYSTEM_INSTRUCTION, 
        context.grade.level, 
        conceptCacheId !== 'gen' ? conceptCacheId : undefined, 
        context.topic?.id
    );

    const result = await generateAndParseJSON<AIGeneratedAssessment>(
        contents, 
        schema, 
        DEFAULT_MODEL, 
        AIGeneratedAssessmentSchema, 
        MAX_RETRIES, 
        false, 
        systemInstr
    );
    
    if (canCache && cacheKey) {
        await setCached(cacheKey, result, { type: 'assessment', conceptId: conceptCacheId !== 'gen' ? conceptCacheId : undefined, gradeLevel: context.grade.level });
    }
    return result;
  },

  async generateExitTicket(numQuestions: number, focus: string, context: GenerationContext, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedAssessment> {
      return this.generateAssessment('ASSESSMENT', [QuestionType.SHORT_ANSWER], numQuestions, context, profile, 'standard', undefined, undefined, `Фокус: ${focus}. ${customInstruction || ''}`);
  },

  async generateRubric(gradeLevel: number, activityTitle: string, activityType: string, criteriaHints: string, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedRubric> {
    const prompt = `Креирај рубрика за ${activityTitle} (${activityType}). ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, criteria: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { criterion: { type: Type.STRING }, levels: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { levelName: { type: Type.STRING }, description: { type: Type.STRING }, points: { type: Type.STRING } }, required: ["levelName", "description"] } } }, required: ["criterion", "levels"] } } }, required: ["title", "criteria"] };

    if (!customInstruction) {
        const cacheKey = `rubric_g${gradeLevel}_${activityTitle.replace(/\W/g, '_').toLowerCase().substring(0, 40)}`;
        const cached = await getCached<AIGeneratedRubric>(cacheKey);
        if (cached) return cached;
        
        const result = await generateAndParseJSON<AIGeneratedRubric>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedRubricSchema);
        await setCached(cacheKey, result, { type: 'rubric', gradeLevel });
        return result;
    }
    return generateAndParseJSON<AIGeneratedRubric>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedRubricSchema);
  },

  async generatePresentationOutline(concept: Concept, gradeLevel: number): Promise<string> {
    const cacheKey = `outline_${concept.id}_g${gradeLevel}`;
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;

    const prompt = `Креирај структура за презентација за "${concept.title}" (${gradeLevel} одд.).`;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS 
    });
    const text = response.text || "";
    await setCached(cacheKey, text, { type: 'outline', conceptId: concept.id, gradeLevel });
    return text;
  },

  async generateDetailedLessonPlan(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): Promise<Partial<LessonPlan>> {
      const prompt = `Генерирај детална подготовка за час на македонски јазик.`;
      const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, objectives: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, bloomsLevel: { type: Type.STRING } }, required: ["text"] } }, scenario: { type: Type.OBJECT, properties: { introductory: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } }, main: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } }, concluding: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } } } }, required: ["title", "objectives", "scenario"] };
      const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
      if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      const systemInstr = await buildDynamicSystemInstruction(JSON_SYSTEM_INSTRUCTION, context.grade?.level || 6, context.concepts?.[0]?.id, context.topic?.id);
      return generateAndParseJSON<Partial<LessonPlan>>(contents, schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, systemInstr);
  },

  async enhanceText(textToEnhance: string, action: string, fieldType: string, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    let promptText = `Подобри го текстот за '${fieldType}' (${gradeLevel} одд). Оригинален текст: "${textToEnhance}"`;
    
    switch(action) {
        case 'simplify':
            promptText = `Поедностави го следниот текст за '${fieldType}' (${gradeLevel} одд) за да биде полесен за разбирање: "${textToEnhance}"`;
            break;
        case 'shorten':
            promptText = `Скрати го и сумирај го следниот текст за '${fieldType}' (${gradeLevel} одд), задржувајќи ја клучната поента: "${textToEnhance}"`;
            break;
        case 'expand':
            promptText = `Направи го поинтересен, поопширен и подетален следниот текст за '${fieldType}' (${gradeLevel} одд): "${textToEnhance}"`;
            break;
        case 'inclusion':
            promptText = `Прилагоди го следниот текст за '${fieldType}' (${gradeLevel} одд) за ученици со попреченост (инклузија), додавајќи соодветни лесни чекори: "${textToEnhance}"`;
            break;
        case 'auto':
        default:
            promptText = `Професионализирај го и подобри го следниот текст за '${fieldType}' (${gradeLevel} одд) во контекст на наставна подготовка: "${textToEnhance}"`;
            break;
    }
    
    const prompt = `${promptText}. Врати САМО преработен текст, без дополнителни воведи или објаснувања.`;
    
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS 
    });
    return response.text || "";
  },

  async analyzeLessonPlan(plan: Partial<LessonPlan>, profile?: TeachingProfile): Promise<AIPedagogicalAnalysis> {
    const prompt = `Направи педагошка анализа на подготовка за час.`;
    const schema = { type: Type.OBJECT, properties: { pedagogicalAnalysis: { type: Type.OBJECT, properties: { overallImpression: { type: Type.STRING }, alignment: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, engagement: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, cognitiveLevels: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } } } } }, required: ["pedagogicalAnalysis"] };
    return generateAndParseJSON<AIPedagogicalAnalysis>([{ text: prompt }, { text: `План: ${JSON.stringify(plan)}` }], schema, DEFAULT_MODEL, AIPedagogicalAnalysisSchema, MAX_RETRIES, false);
  },

  async generateProactiveSuggestion(concept: Concept, profile?: TeachingProfile): Promise<string> {
      const prompt = `Генерирај проактивен предлог за "${concept.title}".`;
      const response = await callGeminiProxy({ 
          model: DEFAULT_MODEL, 
          contents: [{ parts: [{ text: prompt }] }], 
          systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
          safetySettings: SAFETY_SETTINGS 
      });
      return response.text || "";
  },

  async generateAnnualPlan(grade: Grade, startDate: string, endDate: string, holidays: string, winterBreak: {start: string, end: string}): Promise<Omit<PlannerItem, 'id'>[]> {
      const prompt = `Генерирај годишен распоред за ${grade.title}.`;
      const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { date: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["date", "title"] } };
      return generateAndParseJSON<Omit<PlannerItem, 'id'>[]>([{ text: prompt }, { text: `Датуми: ${startDate} до ${endDate}` }], schema, DEFAULT_MODEL, AnnualPlanSchema);
  },

  async generateThematicPlan(grade: Grade, topic: Topic): Promise<AIGeneratedThematicPlan> {
      const cacheKey = `thematic_${topic.id}_g${grade.level}`;
      try {
          const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
      const cached = await getCached<AIGeneratedThematicPlan>(cacheKey);
      if (cached) return cached;

      const prompt = `Генерирај тематски план за "${topic.title}" (${grade.level} одд.).`;
      const schema = { type: Type.OBJECT, properties: { thematicUnit: { type: Type.STRING }, lessons: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { lessonNumber: { type: Type.INTEGER }, lessonUnit: { type: Type.STRING }, learningOutcomes: { type: Type.STRING }, keyActivities: { type: Type.STRING }, assessment: { type: Type.STRING } }, required: ["lessonNumber", "lessonUnit"] } } }, required: ["thematicUnit", "lessons"] };
      const result = await generateAndParseJSON<AIGeneratedThematicPlan>([{ text: prompt }, { text: `Тема: ${topic.title}` }], schema, DEFAULT_MODEL, AIGeneratedThematicPlanSchema);
      await setCached(cacheKey, result, { type: 'thematicplan', gradeLevel: grade.level, topicId: topic.id });
      return result;
    } catch (error) {
      console.error('Error generating thematic plan:', error);
      throw error;
    }
  },

  async analyzeReflection(wentWell: string, challenges: string, profile?: TeachingProfile): Promise<string> {
      const prompt = `Анализирај рефлексија: "${wentWell}". Предизвици: "${challenges}".`;
      const response = await callGeminiProxy({ 
          model: DEFAULT_MODEL, 
          contents: [{ parts: [{ text: prompt }] }], 
          systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
          safetySettings: SAFETY_SETTINGS 
      });
      return response.text || "";
  },

  async generateReflectionQuestions(lessonTitle: string, grade: number, theme: string): Promise<{ wentWell: string; challenges: string; nextSteps: string }> {
      const prompt = `Наставникот штотуку одржа час "${lessonTitle}" (${grade} одд., тема: ${theme}).
Генерирај конкретни рефлексивни прашања кои ќе му помогнат да размисли за часот.
Секое поле треба да биде 1-2 насочувачки прашања (не одговори).
Врати JSON: { "wentWell": "Кои активности беа успешни?...", "challenges": "Кај кои концепти учениците имаа потешкотии?...", "nextSteps": "Кои конкретни промени би ги направиле следниот пат?..." }`;
      const schema = { type: Type.OBJECT, properties: { wentWell: { type: Type.STRING }, challenges: { type: Type.STRING }, nextSteps: { type: Type.STRING } }, required: ["wentWell", "challenges", "nextSteps"] };
      return generateAndParseJSON<{ wentWell: string; challenges: string; nextSteps: string }>([{ text: prompt }], schema, DEFAULT_MODEL);
  },

  async analyzeCoverage(lessonPlans: LessonPlan[], allNationalStandards: NationalStandard[]): Promise<CoverageAnalysisReport> {
      const prompt = `Анализирај ја покриеноста на националните стандарди.`;
      const schema = { type: Type.OBJECT, properties: { analysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { gradeLevel: { type: Type.INTEGER }, coveredStandardIds: { type: Type.ARRAY, items: { type: Type.STRING } }, summary: { type: Type.STRING } }, required: ["gradeLevel", "coveredStandardIds", "summary"] } } }, required: ["analysis"] };
      return generateAndParseJSON<CoverageAnalysisReport>([{ text: prompt }], schema, DEFAULT_MODEL, CoverageAnalysisSchema);
  },

  async getPersonalizedRecommendations(profile: TeachingProfile, lessonPlans: LessonPlan[]): Promise<AIRecommendation[]> {
      const prompt = `Генерирај 3 персонализирани препораки.`;
      const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, title: { type: Type.STRING }, recommendationText: { type: Type.STRING } }, required: ["category", "title", "recommendationText"] } };
      return generateAndParseJSON<AIRecommendation[]>([{ text: prompt }], schema, DEFAULT_MODEL, AIRecommendationSchema);
  },

  async parsePlannerInput(input: string): Promise<{ title: string; date: string; type: string; description: string }> {
    const prompt = `Extract details: "${input}".`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["title", "date", "type"] };
    return generateAndParseJSON<any>([{ text: prompt }], schema);
  },

  /**
   * Generates 3 concrete, actionable class-level pedagogical recommendations
   * based on real quiz result analytics and mastery tracking data.
   *
   * Called on-demand from TeacherAnalyticsView (not auto-called to save quota).
   */
  async generateClassRecommendations(analyticsData: {
    totalAttempts: number;
    avgScore: number;
    passRate: number;
    weakConcepts: Array<{ conceptId: string; title: string; avgPct: number; attempts: number }>;
    masteredCount: number;
    inProgressCount: number;
    strugglingCount: number;
    uniqueStudentCount: number;
  }): Promise<Array<{
    priority: number;
    icon: string;
    title: string;
    explanation: string;
    actionLabel: string;
    differentiationLevel: 'support' | 'standard' | 'advanced';
    conceptId?: string;
    conceptTitle?: string;
  }>> {
    const weakList = analyticsData.weakConcepts.slice(0, 3)
      .map(c => `"${c.title}" (просек ${c.avgPct}%, ${c.attempts} обид${c.attempts === 1 ? '' : 'и'})`)
      .join('; ') || 'нема идентификувани слаби концепти';

    const prompt = `Ти си педагошки советник за математика (одд. 6-9, Македонија).
Класата има следните реални резултати:
- Вкупно обиди: ${analyticsData.totalAttempts}
- Просечен резултат: ${analyticsData.avgScore.toFixed(1)}%
- Стапка на положување (≥70%): ${analyticsData.passRate.toFixed(1)}%
- Слаби концепти (под 70%): ${weakList}
- Совладани концепти: ${analyticsData.masteredCount}
- Во напредок (streak): ${analyticsData.inProgressCount}
- Потребна помош (повеќе обиди, нема напредок): ${analyticsData.strugglingCount}
- Различни ученици: ${analyticsData.uniqueStudentCount}

Генерирај точно 3 конкретни, акциски педагошки препораки за СЛЕДНИОТ ЧАС/НЕДЕЛА.
Секоја препорака мора:
- Да е директно базирана на горните бројки (не генерички совети)
- Да предложи конкретна акција (генерирај материјал, изведи активност, ремедијација)
- Да укаже на ниво на диференцијација: support/standard/advanced
- icon: само еден емоџи
- priority: 1=итно, 2=важно, 3=препорачано

Врати JSON array со 3 елементи.`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: { type: Type.INTEGER },
          icon: { type: Type.STRING },
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          actionLabel: { type: Type.STRING },
          differentiationLevel: { type: Type.STRING },
          conceptId: { type: Type.STRING },
          conceptTitle: { type: Type.STRING },
        },
        required: ['priority', 'icon', 'title', 'explanation', 'actionLabel', 'differentiationLevel'],
      },
    };

    return generateAndParseJSON<any[]>([{ text: prompt }], schema, DEFAULT_MODEL);
  },

  /**
   * П25 — Предложи следна лекција врз основа на последните лекции во планот.
   * Returns 3 lesson suggestions (title, description, conceptHint).
   */
  async suggestNextLessons(
    recentLessons: Array<{ title: string; date: string; description?: string }>
  ): Promise<Array<{ title: string; description: string; conceptHint: string }>> {
    if (recentLessons.length === 0) {
      return [];
    }

    const lessonsText = recentLessons
      .map(l => `- ${l.date}: ${l.title}${l.description ? ` (${l.description.slice(0, 80)})` : ''}`)
      .join('\n');

    const prompt = `Си наставник по математика. Последните лекции во планот беа:
${lessonsText}

Врз основа на оваа прогресија, предложи 3 логични теми за следната недела.
За секоја тема дај:
- Краток наслов на лекцијата (на македонски)
- Кратко опис (2-3 реченици, на македонски)
- Совет за поврзан концепт или вештина (conceptHint, 1 реченица)

Одговори само во JSON формат.`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title:       { type: Type.STRING },
          description: { type: Type.STRING },
          conceptHint: { type: Type.STRING },
        },
        required: ['title', 'description', 'conceptHint'],
      },
    };

    try {
      const result = await generateAndParseJSON<Array<{ title: string; description: string; conceptHint: string }>>(
        [{ text: prompt }],
        schema,
        DEFAULT_MODEL
      );
      return Array.isArray(result) ? result.slice(0, 3) : [];
    } catch {
      return [];
    }
  },

  /**
   * П28 — Објасни го концептот на едноставен МК јазик за ученик.
   * Враќа plain text (3 реченици) — без JSON parsing overhead.
   */
  async explainConcept(conceptTitle: string, gradeLevel?: number): Promise<string> {
    const cacheKey = `explanation_${conceptTitle.replace(/\s+/g, '_').toLowerCase()}_${gradeLevel || 'gen'}`;
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;

    const prompt = `Објасни го математичкиот концепт „${conceptTitle}"${gradeLevel ? ` за ученик во ${gradeLevel}. одделение` : ''} на едноставен, детски македонски јазик. Максимум 3 кратки реченици. Без математички формули — само со зборови и секојдневни примери.`;

    try {
      const result = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
      });
      const text = result.text?.trim() ?? '';
      if (text) {
        await setCached(cacheKey, text, { type: 'explanation', conceptTitle, gradeLevel });
      }
      return text;
    } catch {
      return '';
    }
  },

  async generateParallelTest(
    topic: string,
    gradeLevel: number,
    questionCount: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<GeneratedTest> {
    const cacheKey = `test_parallel_${topic.replace(/\s+/g, '_').toLowerCase()}_g${gradeLevel}_n${questionCount}_${difficulty}`;
    const cached = await getCached<GeneratedTest>(cacheKey);
    if (cached) return cached;

    const diffMap = { easy: "Лесни (за паметење и разбирање)", medium: "Средни (примена)", hard: "Тешки (анализа и евалуација)" };
    const gradeLevelPrompt = gradeLevel <= 3 
      ? 'ЗАБЕЛЕШКА: Ова е за рана училишна возраст (1-3 одд). Користи многу едноставни зборови и секојдневни предмети во текстуалните задачи.' 
      : 'Вклучи и текстуални задачи.';

    const prompt = `Генерирај тест по математика за "${topic}" (одделение ${gradeLevel}).
Тестот треба да има ДВЕ ГРУПИ (Група А и Група Б).
Вкупно прашања по група: ${questionCount}.
Тежина: ${diffMap[difficulty]}.

ВАЖНО:
- Прашањата во Група А и Група Б мора да бидат "паралелни" (исти по тип и тежина, но со различни бројки или примери).
- Пр: Ако 1. задача во А е "2+3", во Б треба да биде "4+5".
  - Типот на прашањето ("type") МОРА ДА БИДЕ ЕДНО ОД СЛЕДНИВЕ: "multiple-choice", "short-answer", ИЛИ "word-problem". Строго забрането е користење други типови.
  - ${gradeLevelPrompt}

Врати JSON:
{
  "title": "Тест по Математика: ${topic}",
  "groups": [
    { "groupName": "Group A", "questions": [ ... ] },
    { "groupName": "Group B", "questions": [ ... ] }
  ]
}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            groups: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        groupName: { type: Type.STRING },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    text: { type: Type.STRING },
                                    type: { type: Type.STRING, description: "Must be 'multiple-choice', 'short-answer', or 'word-problem'" },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    correctAnswer: { type: Type.STRING },
                                    points: { type: Type.NUMBER },
                                    cognitiveLevel: { type: Type.STRING }
                                },
                                required: ["id", "text", "correctAnswer", "points"]
                            }
                        }
                    },
                    required: ["groupName", "questions"]
                }
            }
        },
        required: ["title", "groups"]
    };

    const result = await generateAndParseJSON<any>([{ text: prompt }], schema, DEFAULT_MODEL, GeneratedTestSchema);
    
    // Enrich with metadata not returned by AI
    const enrichedResult: GeneratedTest = {
        ...result,
        topic,
        gradeLevel,
        createdAt: new Date().toISOString(),
        groups: result.groups.map((g: any) => ({
            ...g,
            questions: g.questions.map((q: any) => ({
                ...q,
                difficulty: difficulty, // Assign the requested difficulty to all questions
                type: q.type === 'multiple-choice' ? 'multiple-choice' : 'open-ended' // Normalize types
            }))
        }))
    };

    await setCached(cacheKey, enrichedResult, { type: 'test_parallel', gradeLevel, topic });
    return enrichedResult;
  },

  async generateParallelQuestions(originalQuestions: AssessmentQuestion[]): Promise<AssessmentQuestion[]> {
    const prompt = `Дадени ти се следниве прашања од математички квиз:
${JSON.stringify(originalQuestions, null, 2)}

Твојата задача е да генерираш ПАРАЛЕЛНИ прашања (Mastery Learning). 
Секое ново прашање треба да има ИСТА ТЕЖИНА, ИСТ ОЧЕКУВАН НАЧИН НА РЕШАВАЊЕ и ИСТ ФОРМАТ како оригиналот, но со РАЗЛИЧНИ БРОЈКИ или РАЗЛИЧЕН КОНТЕКСТ (пр. сменети имиња, предмети).
Врати JSON формат строго копирајќи го property-структурирањето на оригиналот, 
и генерирај точно ${originalQuestions.length} прашања.`;

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.NUMBER },
                type: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                solution: { type: Type.STRING }
            },
            required: ["type", "question", "answer"]
        }
    };

    const newQuestions = await generateAndParseJSON<AssessmentQuestion[]>([{ text: prompt }], schema);
    return newQuestions;
  },

  async askTutor(message: string, history: Array<{role: string, content: string}>): Promise<string> {
    const systemPrompt = `Ти си безбеден AI тутор по математика за ученици во основно образование. Твојата главна цел е да им помогнеш да ги разберат концептите, НЕ да им ги решаваш задачите.
    
ПРАВИЛА КОИ МОРА ДА ГИ СЛЕДИШ:
1. НИКОГАШ не го давај конечниот одговор на задача пред ученикот да се обиде сам.
2. Постави му прашање на ученикот за да го насочиш да размислува.
3. Доколку ученикот згреши, немој да го критикуваш - објасни му каде згрешил и обиди се повторно.
4. Користи јасен, едноставен јазик прилагоден за основци (на македонски јазик).
5. Разложувај ги проблемите на помали, полесни чекори.
6. Ако изгледа дека ученикот сака само да препише решение, потсети го дека твојата улога е да објаснуваш, а не да решаваш.`;

    const contents = history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    try {
      const response = await callGeminiProxy({
          model: DEFAULT_MODEL,
          contents: contents,
          systemInstruction: systemPrompt,
          safetySettings: SAFETY_SETTINGS
      });
      return response.text || "Извини, се појави проблем при генерирањето на одговорот.";
    } catch (e) {
      console.error("Tutor API error:", e);
      return "Настана грешка при комуникацијата со туторот. Обиди се повторно.";
    }
  },

  async refineMaterialJSON(originalMaterial: any, tweakInstruction: string, materialType?: string): Promise<any> {
    const prompt = `You are an expert educational AI assistant.

The teacher has already generated the following educational material (in JSON format):
\`\`\`json
${JSON.stringify(originalMaterial, null, 2)}
\`\`\`

The teacher wants to modify/refine this material with the following instructional request:
"${tweakInstruction}"

Please modify the JSON to incorporate exactly what the teacher requested.
IMPORTANT: You must return the updated material EXACTLY in the same generic JSON schema/structure as the input. Do not add any conversational text or markdown wrappers outside of the JSON block if it can be avoided. Return ONLY the raw JSON object.`;

    try {
      const response = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: 'You are a helpful AI that strictly outputs valid JSON that matches the format of the provided input document, just with modified values based on the prompt.',
        safetySettings: SAFETY_SETTINGS
      });
      return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      console.error('Refine material error:', e);
      throw e;
    }
  }
};
