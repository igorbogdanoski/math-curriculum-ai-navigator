/**
 * /api/matura-grade — server-side AI grading + tamper-proof cache write for Matura Part 2/3.
 *
 * Previously, views/maturaPractice/maturaPracticeGrading.ts called Gemini directly from the
 * client and then wrote the resulting grade to `matura_ai_grades` via a plain client-side
 * `setDoc` (firestoreService.matura.ts's saveAIGrade). Since the cache key is a deterministic
 * hash of (examId, questionNumber, answer), any authenticated client could precompute it and
 * write a fabricated "correct" grade before ever submitting a real answer. firestore.rules now
 * denies direct client writes to that collection — this route is the only writer: it re-runs
 * the CAS pre-check + Gemini grading server-side and persists the cache itself via the Admin SDK.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withErrorTracking } from './_lib/sentryNode.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { setCorsHeaders, authenticateAndRateLimit, requireSufficientCredits } from './_lib/sharedUtils.js';
import { recordLatency } from './_lib/sloTracker.js';
import { reserveCredits, refundCredits, type ReserveResult } from './_lib/aiCredits.js';
import { verifyExpressionEquivalence } from '../utils/cas/casEngine.js';
import { DEFAULT_MODEL } from '../services/gemini/core.constants.js';

// Must match firestoreService.matura.ts's hashAnswer exactly — the cache key format is
// shared with pre-existing (pre-fix) client-written entries and must stay byte-identical.
function hashAnswer(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
    h = h >>> 0;
  }
  return h.toString(36);
}

function buildGradeCacheKey(examId: string, questionNumber: number, studentAnswer: string): string {
  return `${examId}_q${questionNumber}_${hashAnswer(studentAnswer.trim().toLowerCase())}`;
}

interface GradeRequestBody {
  mode: 'part2' | 'part3' | 'sim-part2';
  examId: string;
  questionNumber: number;
  questionText: string;
  correctAnswer?: string;
  answer: string;
  /** sim-part2 only: the exam's two-sub-answer format (see splitTwoPartAnswer, maturaSimUtils.ts). */
  answerB?: string;
  imageBase64?: string;
  imageMimeType?: string;
  maxScore: number;
}

interface AIGradeResult {
  score: number;
  maxScore: number;
  feedback: string;
  correct?: boolean;
  comment?: string;
  verifiedByCas?: boolean;
  // sim-part2 only
  partA?: boolean;
  partB?: boolean;
  commentA?: string;
  commentB?: string;
}

function clampScore(score: unknown, maxScore: number): number {
  const n = typeof score === 'number' && Number.isFinite(score) ? score : 0;
  return Math.max(0, Math.min(maxScore, Math.round(n)));
}

function safeParseJSON(text: string | undefined): Record<string, unknown> | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Splits a two-part reference answer like "A. 96, B. 10" (Latin or Cyrillic А/Б labels).
 * Duplicated from views/maturaSimulation/maturaSimUtils.ts's splitTwoPartAnswer — that copy
 * stays as the client-side preview helper; this one is what the trusted server path uses to
 * decide the CAS pre-gate, so it must match exactly.
 */
function splitTwoPartAnswer(correctAnswer: string): { a: string; b: string } | null {
  const match = correctAnswer.match(/^\s*[AА][.:)]\s*(.+?)\s*,?\s*[BБ][.:)]\s*(.+)$/s);
  if (!match) return null;
  const a = match[1].trim();
  const b = match[2].trim();
  if (!a || !b) return null;
  return { a, b };
}

async function callGeminiForGrade(prompt: string, image?: { data: string; mimeType: string }): Promise<string> {
  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.VITE_GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
  ].filter((k): k is string => !!k && k.trim().length > 10);
  if (apiKeys.length === 0) throw new Error('GEMINI_API_KEY not configured on server.');

  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [{ text: prompt }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });

  let lastError: Error | null = null;
  for (const apiKey of apiKeys) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 512 },
      });
      return (await result.response).text();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('Gemini grading call failed.');
}

async function handler(req: VercelRequest, res: VercelResponse) {
  const handlerStart = Date.now();
  setCorsHeaders(res);

  const authResult = await authenticateAndRateLimit(req, res);
  if (authResult === null) { recordLatency('matura-grade', Date.now() - handlerStart); return; } // response already sent
  const uid = authResult;

  if (!(await requireSufficientCredits(req, res))) {
    recordLatency('matura-grade', Date.now() - handlerStart);
    return;
  }

  const body = (req.body ?? {}) as Partial<GradeRequestBody>;
  const { mode, examId, questionNumber, questionText, correctAnswer, answer, answerB, imageBase64, imageMimeType, maxScore } = body;
  if (!mode || !examId || typeof questionNumber !== 'number' || !questionText || typeof maxScore !== 'number') {
    res.status(400).json({ error: 'Missing required fields.' });
    return;
  }

  const cacheKeyInput = mode === 'sim-part2'
    ? `${answer ?? ''}|||${answerB ?? ''}`
    : (answer ?? '') + (imageBase64 ? '_img' : '');
  const cacheKey = buildGradeCacheKey(examId, questionNumber, cacheKeyInput);

  // Declared outside the try block so the catch clause below can refund it — reserveCredits()
  // itself is called inside the try (after the cache-hit check).
  let reservation: ReserveResult | null = null;

  try {
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const cacheRef = db.collection('matura_ai_grades').doc(cacheKey);

    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data()!;
      recordLatency('matura-grade', Date.now() - handlerStart);
      res.status(200).json({ score: data.score, maxScore: data.maxPoints, feedback: data.feedback } as AIGradeResult);
      return;
    }

    // Atomic check-and-deduct — see aiCredits.ts's reserveCredits() doc comment.
    // requireSufficientCredits() above was only a fast-path pre-check. Placed after the cache
    // check so a cache hit (no CAS/Gemini work at all) never reserves/bills a credit.
    reservation = await reserveCredits(uid, 'TEXT_BASIC');
    if (!reservation.ok) {
      recordLatency('matura-grade', Date.now() - handlerStart);
      res.status(402).json({ error: 'Insufficient AI credits.', quotaType: 'credits' });
      return;
    }

    const hasImage = Boolean(imageBase64);

    const saveAndReturn = async (g: AIGradeResult) => {
      await cacheRef.set({
        examId, questionNumber, inputHash: cacheKey,
        score: g.score, maxPoints: maxScore, feedback: g.feedback,
        cachedAt: FieldValue.serverTimestamp(),
      });
      // Already reserved atomically above — nothing further to deduct.
      recordLatency('matura-grade', Date.now() - handlerStart);
      res.status(200).json(g);
    };

    // CAS pre-gate (text answers only) — mirrors the prior client-side logic.
    if (mode === 'part2' && !hasImage && answer?.trim() && correctAnswer) {
      const casResult = verifyExpressionEquivalence(answer, correctAnswer);
      if (casResult.verdict === 'equivalent') {
        await saveAndReturn({
          score: maxScore, maxScore, correct: true,
          feedback: 'Проверено со CAS — одговорот е математички еквивалентен на точниот.',
          comment: 'Проверено со CAS', verifiedByCas: true,
        });
        return;
      }
    }
    if (mode === 'sim-part2' && answer?.trim() && answerB?.trim() && correctAnswer) {
      const split = splitTwoPartAnswer(correctAnswer);
      if (split) {
        const [resultA, resultB] = [verifyExpressionEquivalence(answer, split.a), verifyExpressionEquivalence(answerB, split.b)];
        if (resultA.verdict === 'equivalent' && resultB.verdict === 'equivalent') {
          await saveAndReturn({
            score: 2, maxScore: 2, feedback: 'Проверено со CAS — двата дела се точни.',
            partA: true, partB: true, commentA: 'Точно (CAS)', commentB: 'Точно (CAS)', verifiedByCas: true,
          });
          return;
        }
      }
    }

    const image = hasImage ? { data: imageBase64!, mimeType: imageMimeType ?? 'image/jpeg' } : undefined;
    const prompt = mode === 'part2'
      ? `Ти си асистент за оценување матура на македонски јазик.

Задача Q${questionNumber} (${maxScore} поени): ${questionText}
Точен одговор: ${correctAnswer ?? '(нема)'}
${hasImage ? `Ученикот испратил фотографија на своето решение${answer ? ` (дополнително: "${answer}")` : ''}.` : `Одговор на ученикот: ${answer || '(нема одговор)'}`}

Оцени го одговорот. Споредувај математичко значење, не буквален текст.
Врати САМО валиден JSON:
{"score":0,"correct":false,"comment":"...","feedback":"..."}

- score = цел број од 0 до ${maxScore}.
- correct = true ако одговорот суштински совпаѓа со точниот.
- comment = кратка реченица за одговорот (на македонски).
- feedback = детална повратна информација (на македонски).`
      : mode === 'sim-part2'
      ? `Ти си асистент за оценување матура на македонски јазик.
Задача Q${questionNumber}: ${questionText}
Точен одговор: ${correctAnswer ?? '(нема)'}
Одговор на ученикот: А. ${answer || '(нема)'} | Б. ${answerB || '(нема)'}
Оцени ги двата дела. Секој дел вреди 1 поен.
Врати САМО валиден JSON: {"score":0,"partA":false,"partB":false,"commentA":"...","commentB":"...","feedback":"..."}
- Споредувај математичко значење, не буквален текст. score = 0, 1 или 2.`
      : `Ти си асистент за оценување матура на македонски јазик.

Задача Q${questionNumber} (${maxScore} поени): ${questionText}
Точен одговор: ${correctAnswer ?? '(нема)'}
${hasImage ? `Ученикот испратил фотографија на своето решение${answer ? ` (опис: "${answer}")` : ''}.` : `Опис на решението на ученикот: ${answer || '(нема опис)'}`}

Оцени го решението. Врати САМО валиден JSON:
{"score":0,"feedback":"детален коментар на македонски"}

- score: цел број 0..${maxScore}
- Биди праведен, конструктивен и охрабрувачки.`;

    const text = await callGeminiForGrade(prompt, image);
    const parsed = safeParseJSON(text);
    if (!parsed) {
      await refundCredits(uid, reservation.amount);
      res.status(502).json({ error: 'AI grading response could not be parsed.' });
      return;
    }
    const grade: AIGradeResult = mode === 'sim-part2'
      ? {
          score: clampScore(parsed.score, 2),
          maxScore: 2,
          feedback: String(parsed.feedback ?? ''),
          partA: Boolean(parsed.partA),
          partB: Boolean(parsed.partB),
          commentA: String(parsed.commentA ?? ''),
          commentB: String(parsed.commentB ?? ''),
        }
      : {
          score: clampScore(parsed.score, maxScore),
          maxScore,
          feedback: String(parsed.feedback ?? ''),
          correct: Boolean(parsed.correct),
          comment: parsed.comment ? String(parsed.comment) : undefined,
        };

    await saveAndReturn(grade);
  } catch (err) {
    // Refund whatever was reserved above — nothing was delivered/cached on this path.
    if (reservation && reservation.amount > 0) {
      await refundCredits(uid, reservation.amount);
    }
    console.error('[matura-grade] Error:', err);
    recordLatency('matura-grade', Date.now() - handlerStart);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Grading failed.' });
  }
}

export default withErrorTracking('matura-grade', handler);

export const __testables = {
  hashAnswer,
  buildGradeCacheKey,
  clampScore,
  safeParseJSON,
  splitTwoPartAnswer,
};
