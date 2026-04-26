import { logger } from '../../utils/logger';
import {
  DEFAULT_MODEL, SAFETY_SETTINGS,
  callGeminiProxy, checkDailyQuotaGuard,
} from './core';
import type { EnrichedWebTask } from './visionContracts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KahootQuestion {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseResponse(raw: string): KahootQuestion[] {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  let arr: unknown[];
  try {
    arr = JSON.parse(cleaned);
    if (!Array.isArray(arr)) throw new Error('not array');
  } catch {
    // Try to find a JSON array inside the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');
    arr = JSON.parse(match[0]);
  }
  return (arr as Record<string, unknown>[])
    .map((q, i) => ({
      id: `q-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      question: String(q.question ?? '').trim(),
      options: [
        String((q.options as string[])?.[0] ?? ''),
        String((q.options as string[])?.[1] ?? ''),
        String((q.options as string[])?.[2] ?? ''),
        String((q.options as string[])?.[3] ?? ''),
      ] as [string, string, string, string],
      correctIndex: (Math.min(3, Math.max(0, Number(q.correctIndex ?? 0)))) as 0 | 1 | 2 | 3,
      difficulty: (['basic', 'intermediate', 'advanced'].includes(String(q.difficulty))
        ? q.difficulty
        : 'intermediate') as 'basic' | 'intermediate' | 'advanced',
    }))
    .filter(q => q.question.length > 0 && q.options.every(o => o.length > 0));
}

const SCHEMA = `JSON array only — no markdown, no explanation.
[
  {
    "question": "Question text in Macedonian (mk)",
    "options": ["option A", "option B", "option C", "option D"],
    "correctIndex": 0,
    "difficulty": "basic"
  }
]
Rules:
- exacty 4 options per question
- correctIndex is 0–3 (index in options array)
- difficulty: "basic" | "intermediate" | "advanced"
- all text in Macedonian (МК)
- wrong options must be plausible math distractors (common mistakes, off-by-one, wrong sign, etc.)`;

// ─── Generation from extracted tasks ─────────────────────────────────────────

export async function generateKahootFromTasks(
  tasks: EnrichedWebTask[],
): Promise<KahootQuestion[]> {
  checkDailyQuotaGuard();
  const list = tasks
    .map((t, i) => `${i + 1}. ${t.latexStatement || t.statement || t.title || ''}`)
    .filter(Boolean)
    .join('\n');

  const prompt = `You are an expert Macedonian math teacher creating a Kahoot-style multiple-choice quiz.

Convert each of the following math problems into a multiple-choice question with exactly 4 answer options.
Generate 3 plausible but wrong distractors (common student mistakes: wrong sign, arithmetic error, step skipped, etc.).
The correct answer must be mathematically accurate.

Problems:
${list}

${SCHEMA}`;

  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    safetySettings: SAFETY_SETTINGS,
  });
  try {
    return parseResponse(response.text);
  } catch (err) {
    logger.error('[KahootGen] parseResponse(tasks) failed:', err, response.text.slice(0, 300));
    throw new Error('Неуспешно генерирање — обиди се повторно.');
  }
}

// ─── Generation from free-text prompt ────────────────────────────────────────

export async function generateKahootFromPrompt(
  teacherPrompt: string,
  count: number,
): Promise<KahootQuestion[]> {
  checkDailyQuotaGuard();

  const prompt = `You are an expert Macedonian math teacher creating a Kahoot-style multiple-choice quiz.

Generate exactly ${count} multiple-choice math questions based on this teacher request:
"${teacherPrompt}"

Requirements:
- All questions and answers must be in Macedonian (МК)
- Each question must have exactly 4 answer options
- Exactly one correct answer per question
- 3 plausible distractors (common student mistakes)
- Mix of difficulty levels unless specified otherwise

${SCHEMA}`;

  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
    safetySettings: SAFETY_SETTINGS,
  });
  try {
    return parseResponse(response.text);
  } catch (err) {
    logger.error('[KahootGen] parseResponse(prompt) failed:', err, response.text.slice(0, 300));
    throw new Error('Неуспешно генерирање — обиди се повторно.');
  }
}

// ─── Generation from uploaded document (PDF / image) ─────────────────────────

export async function generateKahootFromDocument(
  base64: string,
  mimeType: string,
  count: number,
): Promise<KahootQuestion[]> {
  checkDailyQuotaGuard();

  const prompt = `You are an expert Macedonian math teacher.
Analyze this document (it may be a worksheet, test, or exercise sheet).
Extract up to ${count} math problems from it and convert each into a multiple-choice question with exactly 4 answer options.
Generate plausible wrong distractors based on common student mistakes.
All text must be in Macedonian (МК).

${SCHEMA}`;

  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: base64 } },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    safetySettings: SAFETY_SETTINGS,
  });
  try {
    return parseResponse(response.text);
  } catch (err) {
    logger.error('[KahootGen] parseResponse(doc) failed:', err, response.text.slice(0, 300));
    throw new Error('Неуспешно читање на документот — обиди се повторно.');
  }
}
