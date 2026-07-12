import { callGeminiProxy, sanitizePromptInput, DEFAULT_MODEL } from '../services/gemini/core';

export interface FeynmanGrade {
  accuracy: number;      // 0-40
  simplicity: number;    // 0-25
  completeness: number;  // 0-25
  noJargon: number;      // 0-10
  total: number;         // 0-100
  feedback: string;      // 1-2 sentences in Macedonian
}

/**
 * Grades a student's Feynman-style explanation of `concept` using AI.
 * Returns a score out of 100 mapped to `maxPoints` for the question.
 */
export async function gradeFeynmanAnswer(
  concept: string,
  studentText: string,
  _maxPoints: number,
): Promise<FeynmanGrade> {
  const safeConcept = sanitizePromptInput(concept, 300);
  const safeText    = sanitizePromptInput(studentText, 1500);

  const prompt = `Оцени го следново Феинман објаснување на концептот "${safeConcept}".

СТУДЕНТСКИ ТЕКСТ:
"""
${safeText}
"""

Правила:
- Замисли дека ученикот треба да го објасни концептот на дете од 10 години
- Оцени по 4 критериуми и врати САМО валиден JSON:

{
  "accuracy":     <цел број 0–40, дали концептот е точно опишан>,
  "simplicity":   <цел број 0–25, употреба на едноставен јазик>,
  "completeness": <цел број 0–25, дали ги опфаќа клучните точки>,
  "noJargon":     <цел број 0–10, избегнување жаргон без дефиниција>,
  "feedback":     "<2 реченици на македонски — конкретна пофалба + главен совет>"
}`;

  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  let raw: Partial<Omit<FeynmanGrade, 'total'>> = {};
  try { raw = JSON.parse(response.text ?? '{}'); } catch { /* use empty fallback */ }
  const accuracy     = Math.min(40,  Math.max(0, Number(raw.accuracy)     || 0));
  const simplicity   = Math.min(25,  Math.max(0, Number(raw.simplicity)   || 0));
  const completeness = Math.min(25,  Math.max(0, Number(raw.completeness) || 0));
  const noJargon     = Math.min(10,  Math.max(0, Number(raw.noJargon)     || 0));
  const feedback     = typeof raw.feedback === 'string' && raw.feedback ? raw.feedback : 'Нема повратна информација.';
  const total        = Math.min(100, accuracy + simplicity + completeness + noJargon);
  return { accuracy, simplicity, completeness, noJargon, feedback, total };
}

/** Converts a 0-100 Feynman score to the question's point value. */
export function feynmanScoreToPoints(grade: FeynmanGrade, maxPoints: number): number {
  return Math.round((grade.total / 100) * maxPoints * 10) / 10;
}
