import { callGeminiProxy } from '../../services/gemini/core';
import {
  buildGradeCacheKey,
  getCachedAIGrade,
  saveAIGrade,
} from '../../services/firestoreService.matura';
import type { MaturaQuestion } from '../../services/firestoreService.matura';
import { safeParseJSON, type AIGrade } from './maturaPracticeHelpers';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export async function gradePart2(q: MaturaQuestion, answer: string): Promise<AIGrade> {
  const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, answer);
  const maxScore = q.points ?? 4;

  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const prompt = `Ти си асистент за оценување матура на македонски јазик.

Задача Q${q.questionNumber} (${maxScore} поени): ${q.questionText}
Точен одговор: ${q.correctAnswer}
Одговор на ученикот: ${answer || '(нема одговор)'}

Оцени го одговорот. Споредувај математичко значење, не буквален текст.
Врати САМО валиден JSON:
{"score":0,"correct":false,"comment":"...","feedback":"..."}

- score = цел број од 0 до ${maxScore}.
- correct = true ако одговорот суштински совпаѓа со точниот.
- comment = кратка реченица за одговорот (на македонски).
- feedback = детална повратна информација (на македонски).`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const p = safeParseJSON(resp.text);
  if (!p) throw new Error('Parse error');
  const grade: AIGrade = {
    score: Math.min(Number(p.score ?? 0), maxScore),
    maxScore,
    feedback: p.feedback ?? '',
    correct: Boolean(p.correct),
    comment: p.comment,
  };

  saveAIGrade(cacheKey, {
    examId: q.examId, questionNumber: q.questionNumber,
    inputHash: cacheKey, score: grade.score, maxPoints: maxScore, feedback: grade.feedback,
  });
  return grade;
}

export async function gradePart3(q: MaturaQuestion, desc: string): Promise<AIGrade> {
  const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, desc);

  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const prompt = `Ти си асистент за оценување матура на македонски јазик.

Задача Q${q.questionNumber} (${q.points} поени): ${q.questionText}
Точен одговор: ${q.correctAnswer}
Опис на решението на ученикот: ${desc || '(нема опис)'}

Оцени го решението. Врати САМО валиден JSON:
{"score":0,"feedback":"детален коментар на македонски"}

- score: цел број 0..${q.points}
- Биди праведен, конструктивен и охрабрувачки.`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 512 },
  });
  const p = safeParseJSON(resp.text);
  if (!p) throw new Error('Parse error');
  const score = Math.min(Number(p.score ?? 0), q.points);
  const feedback = p.feedback ?? '';

  saveAIGrade(cacheKey, {
    examId: q.examId, questionNumber: q.questionNumber,
    inputHash: cacheKey, score, maxPoints: q.points, feedback,
  });
  return { score, maxScore: q.points, feedback };
}
