import { callGeminiProxy } from '../../services/gemini/core';
import {
  buildGradeCacheKey,
  getCachedAIGrade,
  saveAIGrade,
} from '../../services/firestoreService.matura';
import type { MaturaQuestion } from '../../services/firestoreService.matura';
import { recordMaturaSpacedReview } from '../../services/firestoreService.maturaSpacedRep';
import { safeParseJSON, type AIGrade } from './maturaPracticeHelpers';

function pushSpacedReview(
  uid: string | undefined,
  q: MaturaQuestion,
  score: number,
  maxScore: number,
): void {
  if (!uid || maxScore <= 0) return;
  const pct = Math.max(0, Math.min(100, (score / maxScore) * 100));
  void recordMaturaSpacedReview(uid, q.examId, q.questionNumber, pct);
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

async function urlToBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const [header, data] = result.split(',');
        const mimeType = header.match(/data:([^;]+);/)?.[1] ?? 'image/jpeg';
        resolve(data ? { data, mimeType } : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function gradePart2(q: MaturaQuestion, answer: string, imageUrl?: string, uid?: string): Promise<AIGrade> {
  const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, answer + (imageUrl ? '_img' : ''));
  const maxScore = q.points ?? 4;

  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    pushSpacedReview(uid, q, cached.score, cached.maxPoints);
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const hasImage = Boolean(imageUrl);
  const prompt = `Ти си асистент за оценување матура на македонски јазик.

Задача Q${q.questionNumber} (${maxScore} поени): ${q.questionText}
Точен одговор: ${q.correctAnswer}
${hasImage
    ? `Ученикот испратил фотографија на своето решение${answer ? ` (дополнително: "${answer}")` : ''}.`
    : `Одговор на ученикот: ${answer || '(нема одговор)'}`}

Оцени го одговорот. Споредувај математичко значење, не буквален текст.
Врати САМО валиден JSON:
{"score":0,"correct":false,"comment":"...","feedback":"..."}

- score = цел број од 0 до ${maxScore}.
- correct = true ако одговорот суштински совпаѓа со точниот.
- comment = кратка реченица за одговорот (на македонски).
- feedback = детална повратна информација (на македонски).`;

  const textPart = { text: prompt };
  const parts: object[] = [textPart];
  if (imageUrl) {
    const img = await urlToBase64(imageUrl);
    if (img) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts }],
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
  pushSpacedReview(uid, q, grade.score, maxScore);
  return grade;
}

export async function explainWrongAnswer(q: MaturaQuestion, wrongChoice: string, wrongText: string): Promise<string> {
  const prompt = `Ти си матурантски математички тутор. Одговарај на македонски јазик, концизно (2-4 реченици).

Прашање Q${q.questionNumber}: ${q.questionText}
Ученикот одбра: ${wrongChoice}. ${wrongText}
Точен одговор: ${q.correctAnswer}

Објасни ЗОШТО изборот на ученикот е погрешен и КОЈ концепт или чекор го пропуштил.
Не ги повторувај прашањето или опциите.
Биди охрабрувачки.`;

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
  });
  return resp.text?.trim() ?? 'Не можев да генерирам објаснување.';
}

export async function gradePart3(q: MaturaQuestion, desc: string, imageUrl?: string, uid?: string): Promise<AIGrade> {
  const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, desc + (imageUrl ? '_img' : ''));

  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    pushSpacedReview(uid, q, cached.score, cached.maxPoints);
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const hasImage = Boolean(imageUrl);
  const prompt = `Ти си асистент за оценување матура на македонски јазик.

Задача Q${q.questionNumber} (${q.points} поени): ${q.questionText}
Точен одговор: ${q.correctAnswer}
${hasImage
    ? `Ученикот испратил фотографија на своето решение${desc ? ` (опис: "${desc}")` : ''}.`
    : `Опис на решението на ученикот: ${desc || '(нема опис)'}`}

Оцени го решението. Врати САМО валиден JSON:
{"score":0,"feedback":"детален коментар на македонски"}

- score: цел број 0..${q.points}
- Биди праведен, конструктивен и охрабрувачки.`;

  const textPart = { text: prompt };
  const parts: object[] = [textPart];
  if (imageUrl) {
    const img = await urlToBase64(imageUrl);
    if (img) parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
  }

  const resp = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ role: 'user', parts }],
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
  pushSpacedReview(uid, q, score, q.points);
  return { score, maxScore: q.points, feedback };
}

/**
 * Records an MC auto-grade against the spaced-repetition queue (T3.1).
 * MC questions are graded synchronously in the view, so no AI call is involved.
 */
export function recordMcSpacedReview(
  uid: string | undefined,
  q: MaturaQuestion,
  selected: string,
): void {
  if (!uid) return;
  const correct = (selected ?? '').trim().toLowerCase()
    === (q.correctAnswer ?? '').trim().toLowerCase();
  pushSpacedReview(uid, q, correct ? (q.points ?? 1) : 0, q.points ?? 1);
}
