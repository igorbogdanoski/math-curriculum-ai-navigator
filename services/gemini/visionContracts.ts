/**
 * services/gemini/visionContracts.ts
 * Vision RAG Contracts v1 — structured AI outputs with JSON validation + retry
 *
 * Contracts:
 *   1. homeworkFeedback  — pedagogical analysis of a student homework scan
 *   2. testGrading       — per-question grading for a handwritten test
 *   3. contentExtraction — extract formulas/theories/tasks from scanned material
 *   4. smartOCR          — world-class LaTeX digitization of math images/handwriting
 */

import { callGeminiProxy, DEFAULT_MODEL, ULTIMATE_MODEL, SAFETY_SETTINGS } from './core';

// ─── Shared helpers ────────────────────────────────────────────────────────────

function buildInlinePart(base64: string, mimeType: string) {
  return { inlineData: { mimeType, data: base64 } };
}

/** Parse Gemini response text as JSON, stripping markdown fences if present. */
function parseJSON<T>(raw: string): T {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(stripped) as T;
}

/** One-shot validated call with a single retry on schema failure. */
async function callWithRetry<T>(
  prompt: string,
  validate: (obj: unknown) => obj is T,
  parts: object[],
): Promise<{ data: T; retried: boolean } | null> {
  const buildContents = (extra: string) => [{
    role: 'user' as const,
    parts: [{ text: prompt + extra }, ...parts],
  }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = attempt === 1
      ? '\n\nCRITICAL: Your previous response did not match the required JSON schema. Return ONLY valid JSON — no markdown, no explanation, no extra fields.'
      : '';
    try {
      const response = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: buildContents(extra),
        generationConfig: { responseMimeType: 'application/json' },
        safetySettings: SAFETY_SETTINGS,
      });
      const parsed = parseJSON<unknown>(response.text);
      if (validate(parsed)) return { data: parsed, retried: attempt === 1 };
    } catch {
      // parse or network error — fall through to retry
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT 1 — homework_feedback
// ═══════════════════════════════════════════════════════════════════════════════

export interface HomeworkFeedbackInput {
  scanRef: string;
  mimeType: string;
  imageBase64: string;
  gradeLevel: number;
  topicId?: string;
  conceptIds?: string[];
  detailMode: 'standard' | 'detailed';
}

export interface HomeworkFeedbackOutput {
  summary: string;
  strengths: string[];
  mistakes: Array<{
    itemRef: string;
    misconceptionType: string;
    whyItIsWrong: string;
    correctionSteps: string[];
  }>;
  nextSteps: string[];
  estimatedMastery: number;
  ragMeta: {
    conceptIds: string[];
    topicId?: string;
    gradeLevel: number;
    evidenceSpans: Array<{ claim: string; source: string }>;
  };
}

function isHomeworkFeedbackOutput(o: unknown): o is HomeworkFeedbackOutput {
  if (!o || typeof o !== 'object') return false;
  const obj = o as Record<string, unknown>;
  return (
    typeof obj.summary === 'string' &&
    Array.isArray(obj.strengths) && obj.strengths.length >= 1 &&
    Array.isArray(obj.mistakes) &&
    (obj.mistakes as unknown[]).every((m) => {
      const mi = m as Record<string, unknown>;
      return typeof mi.itemRef === 'string' &&
        typeof mi.misconceptionType === 'string' &&
        typeof mi.whyItIsWrong === 'string' &&
        Array.isArray(mi.correctionSteps) && (mi.correctionSteps as unknown[]).length >= 1;
    }) &&
    Array.isArray(obj.nextSteps) &&
    typeof obj.estimatedMastery === 'number' &&
    obj.estimatedMastery >= 0 && obj.estimatedMastery <= 100 &&
    obj.ragMeta !== null && typeof obj.ragMeta === 'object'
  );
}

const HOMEWORK_FEEDBACK_FALLBACK: HomeworkFeedbackOutput = {
  summary: 'AI не успеа да ја анализира домашната работа. Обидете се повторно.',
  strengths: ['—'],
  mistakes: [],
  nextSteps: [],
  estimatedMastery: 0,
  ragMeta: { conceptIds: [], gradeLevel: 0, evidenceSpans: [] },
};

export async function homeworkFeedbackContract(
  input: HomeworkFeedbackInput,
): Promise<{ output: HomeworkFeedbackOutput; retried: boolean; fallback: boolean }> {
  const detailExtra = input.detailMode === 'detailed'
    ? `\nAlso provide a "pedagogical_diagnosis" for each mistake: type of misconception (procedural/conceptual), root cause, and 1-step teacher intervention.`
    : '';

  const prompt = `You are an expert Macedonian math teacher grading a student's handwritten homework (grade ${input.gradeLevel}).
${input.topicId ? `Topic: ${input.topicId}` : ''}
${input.conceptIds?.length ? `Relevant concept IDs: ${input.conceptIds.join(', ')}` : ''}
${detailExtra}

Analyse the image and return ONLY a JSON object matching this schema exactly:
{
  "summary": "Short overall summary in Macedonian",
  "strengths": ["at least one strength"],
  "mistakes": [
    {
      "itemRef": "e.g. Task 3a",
      "misconceptionType": "procedural | conceptual | careless",
      "whyItIsWrong": "explanation",
      "correctionSteps": ["step 1", "step 2"]
    }
  ],
  "nextSteps": ["advice 1"],
  "estimatedMastery": 75,
  "ragMeta": {
    "conceptIds": [],
    "topicId": "${input.topicId ?? ''}",
    "gradeLevel": ${input.gradeLevel},
    "evidenceSpans": [{ "claim": "student knows X", "source": "task 2" }]
  }
}`;

  const mediaPart = buildInlinePart(input.imageBase64, input.mimeType);
  const result = await callWithRetry<HomeworkFeedbackOutput>(prompt, isHomeworkFeedbackOutput, [mediaPart]);

  if (result) return { output: result.data, retried: result.retried, fallback: false };
  return { output: HOMEWORK_FEEDBACK_FALLBACK, retried: true, fallback: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT 2 — test_grading
// ═══════════════════════════════════════════════════════════════════════════════

export interface TestGradingInput {
  scanRef: string;
  mimeType: string;
  imageBase64: string;
  questions: Array<{
    id: string;
    text: string;
    points: number;
    correctAnswer: string;
    conceptId?: string;
  }>;
  gradeLevel: number;
  topicId?: string;
}

export interface TestGradingOutput {
  grades: Array<{
    questionId: string;
    earnedPoints: number;
    maxPoints: number;
    feedback: string;
    misconception?: string;
    correctionHint?: string;
    confidence: number;
  }>;
  total: {
    earned: number;
    max: number;
    percentage: number;
  };
  pedagogy: {
    classLevelGaps: string[];
    remediationActions: string[];
  };
  ragMeta: {
    conceptIds: string[];
    topicId?: string;
    gradeLevel: number;
  };
}

function isTestGradingOutput(o: unknown, expectedCount: number): o is TestGradingOutput {
  if (!o || typeof o !== 'object') return false;
  const obj = o as Record<string, unknown>;
  const grades = obj.grades as unknown[];
  const total = obj.total as Record<string, unknown>;
  return (
    Array.isArray(grades) &&
    grades.length === expectedCount &&
    grades.every((g) => {
      const gr = g as Record<string, unknown>;
      return typeof gr.questionId === 'string' &&
        typeof gr.earnedPoints === 'number' &&
        typeof gr.maxPoints === 'number' &&
        gr.earnedPoints >= 0 && gr.earnedPoints <= gr.maxPoints &&
        typeof gr.feedback === 'string' &&
        typeof gr.confidence === 'number' &&
        gr.confidence >= 0 && gr.confidence <= 1;
    }) &&
    total && typeof total.earned === 'number' &&
    typeof total.max === 'number' &&
    typeof total.percentage === 'number' &&
    typeof obj.pedagogy === 'object' &&
    typeof obj.ragMeta === 'object'
  );
}

function buildTestGradingFallback(questions: TestGradingInput['questions']): TestGradingOutput {
  const maxTotal = questions.reduce((s, q) => s + q.points, 0);
  return {
    grades: questions.map(q => ({
      questionId: q.id,
      earnedPoints: 0,
      maxPoints: q.points,
      feedback: 'AI не успеа да ги оцени одговорите.',
      confidence: 0,
    })),
    total: { earned: 0, max: maxTotal, percentage: 0 },
    pedagogy: { classLevelGaps: [], remediationActions: [] },
    ragMeta: { conceptIds: [], gradeLevel: questions.length },
  };
}

export async function testGradingContract(
  input: TestGradingInput,
): Promise<{ output: TestGradingOutput; retried: boolean; fallback: boolean }> {
  const qJson = JSON.stringify(
    input.questions.map(q => ({ id: q.id, text: q.text, points: q.points, correctAnswer: q.correctAnswer })),
    null, 2,
  );

  const prompt = `You are grading a student's handwritten test (grade ${input.gradeLevel}).
${input.topicId ? `Topic: ${input.topicId}` : ''}

Questions to grade:
${qJson}

Look at the handwritten answers in the image and return ONLY a JSON object:
{
  "grades": [
    {
      "questionId": "q1",
      "earnedPoints": 2,
      "maxPoints": 3,
      "feedback": "Macedonian feedback",
      "misconception": "optional",
      "correctionHint": "optional",
      "confidence": 0.9
    }
  ],
  "total": { "earned": 7, "max": 10, "percentage": 70 },
  "pedagogy": {
    "classLevelGaps": ["topic gap"],
    "remediationActions": ["action"]
  },
  "ragMeta": {
    "conceptIds": [],
    "topicId": "${input.topicId ?? ''}",
    "gradeLevel": ${input.gradeLevel}
  }
}

IMPORTANT:
- grades array must have exactly ${input.questions.length} entries in the same order as the input questions.
- earnedPoints must be between 0 and maxPoints inclusive.
- confidence must be between 0 and 1.
- total.percentage = round(earned / max * 100).
- Write all feedback in Macedonian.`;

  const mediaPart = buildInlinePart(input.imageBase64, input.mimeType);
  const validator = (o: unknown): o is TestGradingOutput => isTestGradingOutput(o, input.questions.length);
  const result = await callWithRetry<TestGradingOutput>(prompt, validator, [mediaPart]);

  if (result) return { output: result.data, retried: result.retried, fallback: false };
  return { output: buildTestGradingFallback(input.questions), retried: true, fallback: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT 3 — content_extraction
// ═══════════════════════════════════════════════════════════════════════════════

export interface ContentExtractionInput {
  sourceType: 'image' | 'pdf' | 'web' | 'video';
  sourceRef: string;
  extractedRawText?: string;
  mediaData?: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  gradeLevel?: number;
  topicId?: string;
  conceptIds?: string[];
}

export interface ContentExtractionOutput {
  formulas: string[];
  theories: string[];
  tasks: string[];
  normalizedText: string;
  quality: {
    score: number;
    label: 'poor' | 'fair' | 'good' | 'excellent';
    truncated: boolean;
  };
  ragMeta: {
    conceptIds: string[];
    topicId?: string;
    gradeLevel?: number;
    sourceEvidence: Array<{ itemType: 'formula' | 'theory' | 'task'; text: string }>;
  };
}

function isContentExtractionOutput(o: unknown): o is ContentExtractionOutput {
  if (!o || typeof o !== 'object') return false;
  const obj = o as Record<string, unknown>;
  const quality = obj.quality as Record<string, unknown>;
  return (
    Array.isArray(obj.formulas) &&
    Array.isArray(obj.theories) &&
    Array.isArray(obj.tasks) &&
    typeof obj.normalizedText === 'string' &&
    obj.normalizedText.length >= 0 &&
    quality && typeof quality.score === 'number' &&
    quality.score >= 0 && quality.score <= 100 &&
    ['poor', 'fair', 'good', 'excellent'].includes(quality.label as string) &&
    typeof quality.truncated === 'boolean' &&
    typeof obj.ragMeta === 'object'
  );
}

const CONTENT_EXTRACTION_FALLBACK: ContentExtractionOutput = {
  formulas: [],
  theories: [],
  tasks: [],
  normalizedText: '',
  quality: { score: 0, label: 'poor', truncated: false },
  ragMeta: { conceptIds: [], sourceEvidence: [] },
};

export async function contentExtractionContract(
  input: ContentExtractionInput,
): Promise<{ output: ContentExtractionOutput; retried: boolean; fallback: boolean }> {
  const contextLines = [
    input.gradeLevel ? `Grade level: ${input.gradeLevel}` : '',
    input.topicId ? `Topic: ${input.topicId}` : '',
    input.conceptIds?.length ? `Concept hints: ${input.conceptIds.join(', ')}` : '',
    input.extractedRawText ? `\nExtracted text:\n${input.extractedRawText.slice(0, 4000)}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `You are extracting educational math content from a scanned source (${input.sourceType}).
${contextLines}

Return ONLY a JSON object:
{
  "formulas": ["LaTeX formulas found, e.g. a^2+b^2=c^2"],
  "theories": ["theorems or definitions stated in the source"],
  "tasks": ["exercise or problem statements"],
  "normalizedText": "clean full text of the source in Macedonian or original language",
  "quality": {
    "score": 85,
    "label": "good",
    "truncated": false
  },
  "ragMeta": {
    "conceptIds": [],
    "topicId": "${input.topicId ?? ''}",
    "gradeLevel": ${input.gradeLevel ?? 0},
    "sourceEvidence": [{ "itemType": "formula", "text": "example" }]
  }
}

Rules:
- quality.score in [0, 100]; label: poor(<40), fair(40-69), good(70-89), excellent(≥90)
- If normalizedText is empty or very short (<50 chars), set score ≤ 20 and label "poor".
- Extract all LaTeX-style formulas; wrap in $...$ or $$...$$
- Write all Macedonian content in Macedonian; preserve other languages as-is.`;

  const parts: object[] = [];
  if (input.mediaBase64 && input.mediaMimeType) {
    parts.push(buildInlinePart(input.mediaBase64, input.mediaMimeType));
  }

  const result = await callWithRetry<ContentExtractionOutput>(prompt, isContentExtractionOutput, parts);

  if (result) return { output: result.data, retried: result.retried, fallback: false };
  return { output: CONTENT_EXTRACTION_FALLBACK, retried: true, fallback: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT 4 — smart_ocr
// ═══════════════════════════════════════════════════════════════════════════════

export interface SmartOCRInput {
  imageBase64: string;
  mimeType: string;
  mode: 'image' | 'handwriting';
}

export interface SmartOCROutput {
  latexCode: string;
  normalizedText: string;
  formulas: string[];
  quality: {
    score: number;
    label: 'poor' | 'fair' | 'good' | 'excellent';
  };
  curriculumHints: {
    suggestedGrade?: number;
    suggestedTopicMk?: string;
    suggestedConceptsMk?: string[];
    dokLevel?: 1 | 2 | 3 | 4;
  };
}

function isSmartOCROutput(o: unknown): o is SmartOCROutput {
  if (!o || typeof o !== 'object') return false;
  const obj = o as Record<string, unknown>;
  const q = obj.quality as Record<string, unknown> | undefined;
  return (
    typeof obj.latexCode === 'string' &&
    typeof obj.normalizedText === 'string' &&
    Array.isArray(obj.formulas) &&
    q !== undefined && typeof q.score === 'number' &&
    ['poor', 'fair', 'good', 'excellent'].includes(q.label as string) &&
    typeof obj.curriculumHints === 'object' && obj.curriculumHints !== null
  );
}

const SMART_OCR_FALLBACK: SmartOCROutput = {
  latexCode: '',
  normalizedText: '',
  formulas: [],
  quality: { score: 0, label: 'poor' },
  curriculumHints: {},
};

export async function smartOCRContract(
  input: SmartOCRInput,
): Promise<{ output: SmartOCROutput; retried: boolean; fallback: boolean }> {
  const modeHint = input.mode === 'handwriting'
    ? 'The image contains HANDWRITTEN math — prioritize accurate recognition of handwriting.'
    : 'The image is a printed/digital math document — extract all formulas and text precisely.';

  const prompt = `You are a world-class math OCR engine with expert LaTeX knowledge.
${modeHint}

Digitize ALL mathematical content from this image into LaTeX. Return ONLY a JSON object:
{
  "latexCode": "Full LaTeX representation of all math content. Use $...$ for inline math, $$...$$ for display math. Preserve original structure.",
  "normalizedText": "Plain-text version of the content (no LaTeX), readable for screen readers.",
  "formulas": ["each individual formula extracted, as LaTeX string"],
  "quality": {
    "score": 90,
    "label": "excellent"
  },
  "curriculumHints": {
    "suggestedGrade": 8,
    "suggestedTopicMk": "Алгебра",
    "suggestedConceptsMk": ["Линеарни равенки", "Системи на равенки"],
    "dokLevel": 2
  }
}

Rules:
- quality.label: poor(<40), fair(40-69), good(70-89), excellent(≥90)
- suggestedGrade: integer 1-12 (Macedonian curriculum: 1-9 primary, 10-12 secondary)
- suggestedTopicMk and suggestedConceptsMk: in Macedonian, match MK math curriculum
- dokLevel: Webb's Depth of Knowledge — 1=Recall/facts, 2=Skills/concepts, 3=Strategic thinking, 4=Extended thinking
- If the image is blank or unreadable, set latexCode="" and quality.score≤10
- Never omit the curriculumHints object (use {} if unsure)`;

  const mediaPart = buildInlinePart(input.imageBase64, input.mimeType);
  const result = await callWithRetry<SmartOCROutput>(prompt, isSmartOCROutput, [mediaPart]);

  if (result) return { output: result.data, retried: result.retried, fallback: false };
  return { output: SMART_OCR_FALLBACK, retried: true, fallback: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT 5 — web_task_extraction
// Extracts structured math tasks from plain text (YouTube transcript / webpage)
// ═══════════════════════════════════════════════════════════════════════════════

export interface ExtractedWebTask {
  title: string;
  statement: string;
  latexStatement: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  topicMk: string;
  imagenPrompt: string;
  dokLevel?: 1 | 2 | 3 | 4;
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

// ─── Text extraction from PDF via Gemini Vision ───────────────────────────────

/**
 * Extracts plain text (with LaTeX math) from a base64-encoded PDF document.
 * Used by ExtractionHub document-upload mode before chunked task extraction.
 */
export async function extractTextFromDocument(pdfBase64: string): Promise<string> {
  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{
      role: 'user' as const,
      parts: [
        {
          text: 'Extract ALL text from this document as plain text. Preserve mathematical expressions using LaTeX notation ($...$ for inline math, $$...$$ for display math). Keep the original language. Return ONLY the extracted text with no commentary.',
        },
        { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
      ],
    }],
    generationConfig: { maxOutputTokens: 16384 },
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
  onChunkProgress?: (current: number, total: number) => void;
}): Promise<ChunkExtractionResult> {
  if (input.text.length <= CHUNK_SIZE) {
    const single = await webTaskExtractionContract(input);
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
    const response = await callGeminiProxy({
      model: modelToUse,
      contents: [{ role: 'user' as const, parts: [{ text: prompt }] }],
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
