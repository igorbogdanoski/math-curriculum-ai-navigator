/**
 * services/gemini/visionContracts.ts
 * Vision RAG Contracts v1 — structured AI outputs with JSON validation + retry
 *
 * Contracts:
 *   1. homeworkFeedback  — pedagogical analysis of a student homework scan
 *   2. testGrading       — per-question grading for a handwritten test
 *   3. contentExtraction — extract formulas/theories/tasks from scanned material
 */

import { callGeminiProxy, DEFAULT_MODEL, SAFETY_SETTINGS } from './core';

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
