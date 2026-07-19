import { callGeminiProxy, DEFAULT_MODEL, getAuthToken } from '../../services/gemini/core';
import {
  buildGradeCacheKey,
  getCachedAIGrade,
} from '../../services/firestoreService.matura';
import type { MaturaQuestion } from '../../services/firestoreService.matura';
import { recordMaturaSpacedReview } from '../../services/firestoreService.maturaSpacedRep';
import type { AIGrade } from './maturaPracticeHelpers';

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

/**
 * Grading now happens server-side via /api/matura-grade (see that file's header comment for
 * why: the matura_ai_grades cache key is a deterministic hash, so a client-side grade+cache-write
 * would let a student precompute the key for their own wrong answer and write a fabricated
 * "correct" grade). This still checks the cache directly first (read-only, allowed by
 * firestore.rules) purely as a fast path to skip invoking the serverless function on a hit.
 */
async function gradeViaServer(
  mode: 'part2' | 'part3',
  q: MaturaQuestion,
  answer: string,
  maxScore: number,
  imageUrl?: string,
): Promise<AIGrade> {
  const image = imageUrl ? await urlToBase64(imageUrl) : null;
  const token = await getAuthToken();
  const res = await fetch('/api/matura-grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      mode,
      examId: q.examId,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
      answer,
      imageBase64: image?.data,
      imageMimeType: image?.mimeType,
      maxScore,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Grading failed (HTTP ${res.status})`);
  }
  return (await res.json()) as AIGrade;
}

export async function gradePart2(q: MaturaQuestion, answer: string, imageUrl?: string, uid?: string): Promise<AIGrade> {
  const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, answer + (imageUrl ? '_img' : ''));
  const maxScore = q.points ?? 4;

  const cached = await getCachedAIGrade(cacheKey);
  if (cached) {
    pushSpacedReview(uid, q, cached.score, cached.maxPoints);
    return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };
  }

  const grade = await gradeViaServer('part2', q, answer, maxScore, imageUrl);
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

  const grade = await gradeViaServer('part3', q, desc, q.points, imageUrl);
  pushSpacedReview(uid, q, grade.score, q.points);
  return grade;
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
  // Officially voided questions (see MaturaQuestion.voided) have no correct answer —
  // never score them or feed them into the spaced-repetition signal.
  if (q.voided) return;
  const correct = (selected ?? '').trim().toLowerCase()
    === (q.correctAnswer ?? '').trim().toLowerCase();
  pushSpacedReview(uid, q, correct ? (q.points ?? 1) : 0, q.points ?? 1);
}
