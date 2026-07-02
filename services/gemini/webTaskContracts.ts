/**
 * services/gemini/webTaskContracts.ts
 * Web Task Extraction Contracts — OCR utilities, web/YouTube task extraction,
 * chunked extraction, and pedagogy enrichment.
 *
 * Contracts:
 *   5. webTaskExtraction  — structured math tasks from plain text (YouTube / webpage)
 *   OCR utils             — extractTextFromDocument, extractTextFromImage
 *   pedagogy              — enrichExtractedPedagogy, generateTaskSolution, generateTaskDifferentiation
 */

import { callGeminiProxy, DEFAULT_MODEL, ULTIMATE_MODEL, SAFETY_SETTINGS } from './core';

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT 5 — web_task_extraction
// Extracts structured math tasks from plain text (YouTube transcript / webpage)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TaskSolution {
  steps: string[];
  finalAnswer: string;
}

export interface TaskDifferentiation {
  support: string;
  standard: string;
  advanced: string;
}

export interface ExtractedWebTask {
  title: string;
  statement: string;
  latexStatement: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  topicMk: string;
  imagenPrompt: string;
  dokLevel?: 1 | 2 | 3 | 4;
  solution?: TaskSolution;
  differentiation?: TaskDifferentiation;
}

export interface WebTaskExtractionOutput {
  tasks: ExtractedWebTask[];
  topicsSummary: string;
  quality: {
    score: number;
    label: 'poor' | 'fair' | 'good' | 'excellent';
  };
}

function isWebTaskExtractionOutput(o: unknown): o is WebTaskExtractionOutput {
  if (!o || typeof o !== 'object') return false;
  const obj = o as Record<string, unknown>;
  const q = obj.quality as Record<string, unknown> | undefined;
  return (
    Array.isArray(obj.tasks) &&
    typeof obj.topicsSummary === 'string' &&
    q !== undefined && typeof q.score === 'number' &&
    ['poor', 'fair', 'good', 'excellent'].includes(q.label as string)
  );
}

const WEB_TASK_FALLBACK: WebTaskExtractionOutput = {
  tasks: [],
  topicsSummary: '',
  quality: { score: 0, label: 'poor' },
};

// ─── Text extraction from PDF / image via Gemini Vision ──────────────────────

/**
 * Supported source languages for OCR/document extraction. The hint is passed
 * to the model so it preserves diacritics and chooses the right decoder for
 * Cyrillic vs. Latin scripts.
 *
 * S42-E3 — multi-language hint added so old textbooks in MK/SR/HR/RU/TR/EN
 * are decoded correctly without prompt-engineering by the user.
 */
export const OCR_SUPPORTED_LANGUAGES = ['auto', 'mk', 'sr', 'hr', 'ru', 'tr', 'en'] as const;
export type OcrLanguage = typeof OCR_SUPPORTED_LANGUAGES[number];

const LANGUAGE_LABEL: Record<OcrLanguage, string> = {
  auto: 'Auto-detect',
  mk:   'Macedonian (Cyrillic)',
  sr:   'Serbian (Cyrillic + Latin)',
  hr:   'Croatian (Latin, diacritics: čćžšđ)',
  ru:   'Russian (Cyrillic)',
  tr:   'Turkish (Latin, diacritics: ğşıİçöü)',
  en:   'English (Latin)',
};

/**
 * Build the language-aware OCR prompt fragment. Pure helper so it can be
 * unit-tested without invoking Gemini.
 */
export function buildOcrLanguagePromptFragment(lang: OcrLanguage = 'auto'): string {
  if (lang === 'auto') {
    return 'Detect the source language automatically. Preserve all diacritics and original script (Cyrillic / Latin) exactly as written.';
  }
  return `Original language: ${LANGUAGE_LABEL[lang]}. Preserve diacritics and the source script exactly. Do NOT transliterate.`;
}

const BASE_OCR_INSTRUCTION = 'Extract ALL text from this source as plain text. Preserve mathematical expressions using LaTeX notation ($...$ for inline math, $$...$$ for display math). Return ONLY the extracted text with no commentary.';

export interface DocumentExtractionOptions {
  language?: OcrLanguage;
}

/**
 * Extracts plain text (with LaTeX math) from a base64-encoded PDF document.
 * Used by ExtractionHub document-upload mode before chunked task extraction.
 */
export async function extractTextFromDocument(
  pdfBase64: string,
  options: DocumentExtractionOptions = {},
): Promise<string> {
  const langFragment = buildOcrLanguagePromptFragment(options.language);
  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{
      role: 'user' as const,
      parts: [
        { text: `${BASE_OCR_INSTRUCTION}\n${langFragment}` },
        { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
      ],
    }],
    generationConfig: { maxOutputTokens: 16384 },
    safetySettings: SAFETY_SETTINGS,
    skipTierOverride: true,
  });
  return response.text.trim();
}

/**
 * S42-E2a — Extracts text + LaTeX from a single base64 image (PNG/JPEG/WEBP).
 * Reuses the same prompt skeleton as the PDF path so downstream chunked
 * extraction is identical.
 */
export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string,
  options: DocumentExtractionOptions = {},
): Promise<string> {
  const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/png';
  const langFragment = buildOcrLanguagePromptFragment(options.language);
  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{
      role: 'user' as const,
      parts: [
        { text: `${BASE_OCR_INSTRUCTION}\n${langFragment}` },
        { inlineData: { mimeType: safeMime, data: imageBase64 } },
      ],
    }],
    generationConfig: { maxOutputTokens: 8192 },
    safetySettings: SAFETY_SETTINGS,
    skipTierOverride: true,
  });
  return response.text.trim();
}

// ─── Chunked extraction for long texts ───────────────────────────────────────

const CHUNK_SIZE = 10_000;
const CHUNK_OVERLAP = 400;

/**
 * Splits text at natural boundaries (paragraph → sentence → word) so that
 * no chunk cuts a sentence mid-way, giving the AI complete context per chunk.
 */
function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const tentativeEnd = Math.min(start + chunkSize, text.length);
    if (tentativeEnd === text.length) { chunks.push(text.slice(start)); break; }
    // Search last 300 chars for a clean boundary
    const lb = Math.min(300, tentativeEnd - start);
    const win = text.slice(tentativeEnd - lb, tentativeEnd);
    const paraIdx = win.lastIndexOf('\n\n');
    const sentIdx = win.lastIndexOf('. ');
    const wordIdx = win.lastIndexOf(' ');
    const best = paraIdx >= 0 ? tentativeEnd - lb + paraIdx + 2
      : sentIdx >= 0 ? tentativeEnd - lb + sentIdx + 2
      : wordIdx >= 0 ? tentativeEnd - lb + wordIdx + 1
      : tentativeEnd;
    chunks.push(text.slice(start, best));
    start = Math.max(best - overlap, start + 1);
  }
  return chunks;
}

/**
 * Normalizes a task statement for deduplication:
 * strips LaTeX delimiters, collapses whitespace, lowercases.
 */
function taskDedupKey(task: ExtractedWebTask): string {
  return task.statement
    .toLowerCase()
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')  // strip display math
    .replace(/\$[^$]*\$/g, ' ')          // strip inline math
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

export interface ChunkExtractionResult {
  output: WebTaskExtractionOutput;
  fallback: boolean;
  chunksProcessed: number;
  tasksBeforeDedup: number;
}

/**
 * Splits long text into sentence-boundary-aware overlapping chunks,
 * runs webTaskExtractionContract on each sequentially, then deduplicates
 * using LaTeX-normalized statement fingerprints.
 * Falls back to a single call for texts ≤ CHUNK_SIZE.
 */
export async function chunkAndExtractTasks(input: {
  text: string;
  sourceType: 'youtube' | 'webpage';
  sourceRef?: string;
  specificInstructions?: string;
  model?: string;
  mediaParts?: Array<{ inlineData: { mimeType: string; data: string } }>;
  onChunkProgress?: (current: number, total: number) => void;
}): Promise<ChunkExtractionResult> {
  if (input.text.length <= CHUNK_SIZE) {
    const single = await webTaskExtractionContract({ ...input });
    return { ...single, chunksProcessed: 1, tasksBeforeDedup: single.output.tasks.length };
  }

  const chunks = splitTextIntoChunks(input.text, CHUNK_SIZE, CHUNK_OVERLAP);

  const allTasks: ExtractedWebTask[] = [];
  const summaries: string[] = [];
  let totalScore = 0;
  let successfulChunks = 0;
  let anyFallback = false;

  for (let i = 0; i < chunks.length; i++) {
    input.onChunkProgress?.(i + 1, chunks.length);
    const { output, fallback } = await webTaskExtractionContract({
      text: chunks[i],
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      specificInstructions: input.specificInstructions,
      model: input.model,
      // Pass images only to first chunk — they describe the source document context
      mediaParts: i === 0 ? input.mediaParts : undefined,
    });
    if (!fallback) {
      allTasks.push(...output.tasks);
      summaries.push(output.topicsSummary);
      totalScore += output.quality.score;
      successfulChunks++;
    } else {
      anyFallback = true;
    }
  }

  const tasksBeforeDedup = allTasks.length;

  // Deduplicate using LaTeX-normalized statement fingerprint (100 chars)
  const seen = new Set<string>();
  const deduped = allTasks.filter(t => {
    const key = taskDedupKey(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const avgScore = successfulChunks > 0 ? Math.round(totalScore / successfulChunks) : 0;
  const label: WebTaskExtractionOutput['quality']['label'] =
    avgScore >= 90 ? 'excellent' : avgScore >= 70 ? 'good' : avgScore >= 40 ? 'fair' : 'poor';

  return {
    output: {
      tasks: deduped,
      topicsSummary: summaries.filter(Boolean).join(' · ').slice(0, 400),
      quality: { score: avgScore, label },
    },
    fallback: anyFallback && deduped.length === 0,
    chunksProcessed: chunks.length,
    tasksBeforeDedup,
  };
}

// ─── webTaskExtractionContract ────────────────────────────────────────────────

export async function webTaskExtractionContract(input: {
  text: string;
  sourceType: 'youtube' | 'webpage';
  sourceRef?: string;
  specificInstructions?: string;
  model?: string;
  mediaParts?: Array<{ inlineData: { mimeType: string; data: string } }>;
}): Promise<{ output: WebTaskExtractionOutput; fallback: boolean }> {
  const instructionExtra = input.specificInstructions
    ? `\nSpecific instructions from the teacher: ${input.specificInstructions}`
    : '';

  const prompt = `You are a world-class Macedonian math teacher extracting educational math tasks from ${
    input.sourceType === 'youtube' ? 'a YouTube video transcript' : 'a web page'
  }.${instructionExtra}

Source reference: ${input.sourceRef ?? 'unknown'}

Extract ALL distinct math tasks, problems, examples and exercises from this content.
Return ONLY a JSON object:
{
  "tasks": [
    {
      "title": "Short task title in Macedonian (max 8 words)",
      "statement": "Full task statement in Macedonian, clear and self-contained",
      "latexStatement": "Same statement but with proper LaTeX math: $...$ inline, $$...$$ display",
      "difficulty": "basic | intermediate | advanced",
      "topicMk": "Math topic in Macedonian (e.g. Алгебра, Геометрија, Тригонометрија...)",
      "imagenPrompt": "English prompt for an educational illustration of this math concept (max 30 words, no text/equations in the image)",
      "dokLevel": 2
    }
  ],
  "topicsSummary": "Brief summary in Macedonian of the mathematical topics covered",
  "quality": {
    "score": 85,
    "label": "good"
  }
}

Rules:
- Extract ALL tasks, not just some. Min 1 task if any math exists.
- difficulty: basic = grades 1-6, intermediate = grades 7-9, advanced = grades 10-12
- dokLevel: Webb's Depth of Knowledge — 1=Recall/facts/procedures, 2=Skills/concepts/interpretation, 3=Strategic thinking/multi-step/proof, 4=Extended thinking/research/interdisciplinary
- quality.score: 0-100; poor(<40), fair(40-69), good(70-89), excellent(≥90)
- If no math tasks are found, return tasks:[] and quality.score≤20
- Write all Macedonian text in Macedonian Cyrillic script
- imagenPrompt: English only, no formulas, describe a VISUAL concept illustration

TEXT TO ANALYZE (first 12000 chars):
${input.text.slice(0, 12000)}`;

  const modelToUse = input.model ?? ULTIMATE_MODEL;

  try {
    const extraParts = (input.mediaParts ?? []).map(mp => ({ inlineData: mp.inlineData }));
    const response = await callGeminiProxy({
      model: modelToUse,
      contents: [{ role: 'user' as const, parts: [{ text: prompt }, ...extraParts] }],
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings: SAFETY_SETTINGS,
      skipTierOverride: true,
    });

    const stripped = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(stripped) as unknown;
    if (isWebTaskExtractionOutput(parsed)) {
      return { output: parsed, fallback: false };
    }
  } catch {
    // fall through
  }

  return { output: WEB_TASK_FALLBACK, fallback: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PEDAGOGY ENRICHMENT — S45-C (MathDigitizer integration)
// Enriches extracted tasks with Bloom level, prerequisite concepts, knowledge
// graph keywords and estimated grade range. Runs as a lightweight post-process
// step after webTaskExtractionContract / chunkAndExtractTasks.
// ═══════════════════════════════════════════════════════════════════════════════

export interface PedagogyEnrichment {
  bloomLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  bloomLevelMk: string;
  prerequisiteConcepts: string[];
  knowledgeGraphKeywords: string[];
  estimatedGradeRange: string;
  cognitiveLoad: 'low' | 'medium' | 'high';
  realWorldContext?: string;
}

export type EnrichedWebTask = ExtractedWebTask & { pedagogy?: PedagogyEnrichment };

export async function enrichExtractedPedagogy(
  tasks: ExtractedWebTask[],
): Promise<EnrichedWebTask[]> {
  if (!tasks.length) return [];

  const taskList = tasks
    .map((t, i) => `${i + 1}. [${t.difficulty}] ${t.topicMk}: ${t.statement}`)
    .join('\n');

  const prompt = `You are an expert math curriculum designer. Enrich the following extracted math tasks with pedagogical metadata.

TASKS:
${taskList}

For EACH task (in the same order), return a JSON array where each item has:
{
  "bloomLevel": "Remember|Understand|Apply|Analyze|Evaluate|Create",
  "bloomLevelMk": "Помни|Разбира|Применува|Анализира|Оценува|Создава",
  "prerequisiteConcepts": ["concept1 in Macedonian", "concept2"],
  "knowledgeGraphKeywords": ["keyword1", "keyword2", "keyword3"],
  "estimatedGradeRange": "e.g. 7-9 одделение",
  "cognitiveLoad": "low|medium|high",
  "realWorldContext": "Optional: one sentence real-world application in Macedonian"
}

Return ONLY the JSON array with exactly ${tasks.length} items, no markdown.`;

  try {
    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' },
      safetySettings: SAFETY_SETTINGS,
      skipTierOverride: true,
    });

    const stripped = response.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(stripped) as unknown;

    if (Array.isArray(parsed) && parsed.length === tasks.length) {
      return tasks.map((task, i) => ({
        ...task,
        pedagogy: parsed[i] as PedagogyEnrichment,
      }));
    }
  } catch {
    // Return tasks without enrichment on any error
  }

  return tasks;
}

// ── Solution Generator ────────────────────────────────────────────────────────

export async function generateTaskSolution(task: ExtractedWebTask): Promise<TaskSolution | null> {
  try {
    const prompt = `Ти си македонски наставник по математика. Реши ја следнава задача чекор-по-чекор на македонски јазик. Користи LaTeX за формули ($ ... $).

Задача: ${task.latexStatement || task.statement}
Тема: ${task.topicMk}

Врати го одговорот САМО во следниот JSON формат (без markdown):
{"steps":["Чекор 1: ...","Чекор 2: ..."],"finalAnswer":"Одговорот е ..."}`;

    const resp = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 600 },
    });
    const stripped = resp.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(stripped) as TaskSolution;
    if (Array.isArray(parsed.steps) && typeof parsed.finalAnswer === 'string') return parsed;
  } catch { /* return null on error */ }
  return null;
}

// ── Differentiation Generator ─────────────────────────────────────────────────

export async function generateTaskDifferentiation(task: ExtractedWebTask): Promise<TaskDifferentiation | null> {
  try {
    const prompt = `Ти си македонски наставник по математика. Врз основа на оваа задача, создај 3 верзии со различна тежина на македонски јазик. Користи LaTeX за формули ($ ... $).

Оригинална задача: ${task.latexStatement || task.statement}
Тема: ${task.topicMk}

Врати САМО следниот JSON (без markdown):
{
  "support": "Полесна верзија за ученици со потреба за поддршка (помали броеви, насока дадена)",
  "standard": "Иста тежина, само со сменети броеви/контекст",
  "advanced": "Потешка верзија која бара подлабоко размислување или екстра чекор"
}`;

    const resp = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 500 },
    });
    const stripped = resp.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(stripped) as TaskDifferentiation;
    if (typeof parsed.support === 'string' && typeof parsed.standard === 'string' && typeof parsed.advanced === 'string') return parsed;
  } catch { /* return null on error */ }
  return null;
}
