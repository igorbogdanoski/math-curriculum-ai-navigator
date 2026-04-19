import type { MaturaChoice, DokLevel } from '../../types';
import type { MaturaQuestion, MaturaExamMeta } from '../../services/firestoreService.matura';
import {
  buildGradeCacheKey,
  getCachedAIGrade,
  saveAIGrade,
} from '../../services/firestoreService.matura';
import { callGeminiProxy } from '../../services/gemini/core';

const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─── Constants ───────────────────────────────────────────────────────────────
export const CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];

export const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Алгебра', analiza: 'Анализа', geometrija: 'Геометрија',
  trigonometrija: 'Тригонометрија', 'matrici-vektori': 'Матрици/Вектори',
  broevi: 'Броеви', statistika: 'Статистика', kombinatorika: 'Комбинаторика',
};
export const TOPIC_COLORS: Record<string, string> = {
  algebra: 'bg-blue-100 text-blue-800', analiza: 'bg-purple-100 text-purple-800',
  geometrija: 'bg-green-100 text-green-800', trigonometrija: 'bg-orange-100 text-orange-800',
  'matrici-vektori': 'bg-teal-100 text-teal-800', broevi: 'bg-gray-100 text-gray-700',
  statistika: 'bg-yellow-100 text-yellow-800', kombinatorika: 'bg-pink-100 text-pink-800',
};
export const PART_LABELS: Record<number, string> = { 1: 'Дел I', 2: 'Дел II', 3: 'Дел III' };
export const PART_COLORS: Record<number, string> = {
  1: 'bg-sky-100 text-sky-700', 2: 'bg-amber-100 text-amber-700', 3: 'bg-rose-100 text-rose-700',
};
export const LANG_FLAGS: Record<string, string> = { mk: '🇲🇰 МК', al: '🇦🇱 АЛ', tr: '🇹🇷 ТР' };
export const SESSION_LABELS: Record<string, string> = {
  june:       'Јуни',
  august:     'Август',
  march:      'Март',
  ucilisna:   'Училишна матура',
  bank:       'Базен прашања',
  zavrshen:   'Завршен испит',
};
export const TRACK_LABELS: Record<string, string> = {
  'gymnasium':            'Државна гимназиска матура',
  'vocational-it':        'Стручна матура — ИТ',
  'vocational-economics': 'Стручна матура — Економија',
  'vocational-electro':   'Стручна матура — Електро',
  'vocational-mechanical':'Стручна матура — Машинство',
  'vocational-health':    'Стручна матура — Здравство',
  'vocational-civil':     'Стручна матура — Градежништво',
  'vocational-art':       'Уметничка матура',
  'vocational3-zavrshen': 'Завршен испит — Стручно 3-год',
  'vocational2-zavrshen': 'Завршен испит — Стручно 2-год',
  'vocational4':          'Стручна матура (4-год)',
};

// ─── AI grade type ───────────────────────────────────────────────────────────
export interface AIGrade {
  score: number; maxScore: number; feedback: string;
  correct?: boolean; comment?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function isOpen(q: MaturaQuestion | { questionType?: string; choices?: Record<string, string> }): boolean {
  if (q.questionType === 'open' || q.questionType === 'short') return true;
  if (q.questionType === 'mc') return false;
  return !('choices' in q) || !q.choices || Object.keys(q.choices).length === 0;
}
export function safeParseJSON(text: string): any {
  try { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
  catch { return null; }
}
export function examLabel(e: MaturaExamMeta): string {
  const session = SESSION_LABELS[e.session] ?? e.session;
  const lang    = LANG_FLAGS[e.language]    ?? e.language.toUpperCase();
  return `${session} ${e.year} — ${lang}`;
}

// ─── AI grading ──────────────────────────────────────────────────────────────
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
Опис на решението: ${desc||'(нема)'}
Врати САМО валиден JSON:
{"score":0,"feedback":"коментар на македонски"}
- score: цел број 0..${q.points}. Биди праведен и охрабрувачки.`;

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
