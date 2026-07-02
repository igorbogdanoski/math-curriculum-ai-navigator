import { callGeminiProxy, DEFAULT_MODEL } from '../../services/gemini/core';
import {
    buildGradeCacheKey, getCachedAIGrade, saveAIGrade,
} from '../../services/firestoreService.matura';
import type { MaturaQuestion } from '../../services/firestoreService.matura';

// ── Constants ────────────────────────────────────────────────────────────────

export const CHOICES = ['А', 'Б', 'В', 'Г'] as const;
export const CHOICE_COLORS: Record<string, string> = {
    А: 'from-blue-500 to-blue-600',
    Б: 'from-violet-500 to-violet-600',
    В: 'from-amber-500 to-amber-600',
    Г: 'from-rose-500 to-rose-600',
};
export const CHOICE_LIGHT: Record<string, string> = {
    А: 'border-blue-300 bg-blue-50 text-blue-800',
    Б: 'border-violet-300 bg-violet-50 text-violet-800',
    В: 'border-amber-300 bg-amber-50 text-amber-800',
    Г: 'border-rose-300 bg-rose-50 text-rose-800',
};
export const GRADE_THRESHOLDS = [
    { min: 90, label: '5 — Одличен',          color: 'text-emerald-600' },
    { min: 75, label: '4 — Многу добар',       color: 'text-blue-600'   },
    { min: 55, label: '3 — Добар',             color: 'text-amber-600'  },
    { min: 40, label: '2 — Доволен',           color: 'text-orange-600' },
    { min: 0,  label: '1 — Незадоволителен',   color: 'text-red-600'    },
];
export const SESSION_LABELS: Record<string, string> = {
    june:   'Јунска',
    august: 'Augusztовска',
    march:  'Мартовска',
};
export const SESSION_ORDER = ['june', 'august', 'march'];
export const LANG_ORDER    = ['mk', 'al', 'tr'];
export const LANG_FLAGS: Record<string, string> = { mk: 'МК', al: 'АЛ', tr: 'ТР' };
export const TRACK_LABELS: Record<string, string> = {
    'gymnasium':            'Гимназиско образование',
    'vocational-it':        'Средно стручно — Информатика',
    'vocational-economics': 'Средно стручно — Економија',
    'vocational-electro':   'Средно стручно — Електротехника',
    'vocational-mechanical':'Средно стручно — Машинство',
    'vocational-health':    'Средно стручно — Здравство',
    'vocational-civil':     'Средно стручно — Градежништво',
};
export const TRACK_ORDER = [
    'gymnasium',
    'vocational-it','vocational-economics','vocational-electro',
    'vocational-mechanical','vocational-health','vocational-civil',
];
export const TRACK_ACCENT: Record<string, { pill: string; header: string }> = {
    'gymnasium':            { pill: 'bg-indigo-100 text-indigo-800', header: 'text-indigo-700' },
    'vocational-it':        { pill: 'bg-teal-100 text-teal-800',     header: 'text-teal-700'   },
    'vocational-economics': { pill: 'bg-amber-100 text-amber-800',   header: 'text-amber-700'  },
    'vocational-electro':   { pill: 'bg-blue-100 text-blue-800',     header: 'text-blue-700'   },
    'vocational-mechanical':{ pill: 'bg-slate-100 text-slate-800',   header: 'text-slate-700'  },
    'vocational-health':    { pill: 'bg-rose-100 text-rose-800',     header: 'text-rose-700'   },
    'vocational-civil':     { pill: 'bg-orange-100 text-orange-800', header: 'text-orange-700' },
};
export const DURATION_SECONDS = 180 * 60;

// ── Types ─────────────────────────────────────────────────────────────────────

export type Phase = 'select' | 'exam' | 'grading' | 'results';

export interface SimAnswers {
    mc:  Record<number, string>;
    p2a: Record<number, string>;
    p2b: Record<number, string>;
    p3:  Record<number, string>;
}

export interface QGrade {
    score:     number;
    maxPoints: number;
    correct?:  boolean;
    feedback?: string;
}

export interface SimResult {
    examId:          string;
    examTitle:       string;
    answers:         SimAnswers;
    grades:          Record<number, QGrade>;
    totalScore:      number;
    maxScore:        number;
    durationSeconds: number;
    completedAt:     string;
}

export interface AIGrade {
    score:     number;
    maxScore:  number;
    feedback:  string;
    partA?:    boolean;
    partB?:    boolean;
    commentA?: string;
    commentB?: string;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function formatTime(s: number): string {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

export function gradeFromPercent(pct: number) {
    return GRADE_THRESHOLDS.find(g => pct >= g.min)!;
}

export function examLabel(e: { title?: string; year: number; session: string; language: string }): string {
    const sess = SESSION_LABELS[e.session] ?? e.session;
    const lang = LANG_FLAGS[e.language] ?? e.language.toUpperCase();
    return e.title || `Матура ${e.year} — ${sess} — ${lang}`;
}

export function hasAnswer(q: MaturaQuestion, a: SimAnswers): boolean {
    if (q.part === 1) return Boolean(a.mc[q.questionNumber]);
    if (q.part === 2) return Boolean(a.p2a[q.questionNumber] || a.p2b[q.questionNumber]);
    return Boolean(a.p3[q.questionNumber]);
}

export function safeParseJSON(text: string): Record<string, unknown> | null {
    try {
        const m = text.match(/\{[\s\S]*\}/);
        return m ? JSON.parse(m[0]) : null;
    } catch { return null; }
}

export function progressKey(examId: string): string { return `matura_sim_progress_${examId}`; }
export function resultKey(examId: string): string    { return `matura_sim_result_${examId}`; }

// ── AI grading (with Firestore cache) ────────────────────────────────────────

export async function gradePart2(q: MaturaQuestion, answerA: string, answerB: string): Promise<AIGrade> {
    const cacheInput = `${answerA}|||${answerB}`;
    const cacheKey   = buildGradeCacheKey(q.examId, q.questionNumber, cacheInput);
    const cached     = await getCachedAIGrade(cacheKey);
    if (cached) return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };

    const prompt = `Ти си асистент за оценување матура на македонски јазик.
Задача Q${q.questionNumber}: ${q.questionText}
Точен одговор: ${q.correctAnswer}
Одговор на ученикот: А. ${answerA||'(нема)'} | Б. ${answerB||'(нема)'}
Оцени ги двата дела. Секој дел вреди 1 поен.
Врати САМО валиден JSON: {"score":0,"partA":false,"partB":false,"commentA":"...","commentB":"...","feedback":"..."}
- Споредувај математичко значење, не буквален текст. score = 0, 1 или 2.`;

    const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 512 },
    });
    const p = safeParseJSON(resp.text);
    if (!p) throw new Error('Parse error');
    const grade: AIGrade = {
        score: Number(p.score ?? 0), maxScore: 2, feedback: String(p.feedback ?? ''),
        partA: Boolean(p.partA), partB: Boolean(p.partB),
        commentA: String(p.commentA ?? ''), commentB: String(p.commentB ?? ''),
    };
    saveAIGrade(cacheKey, {
        examId: q.examId, questionNumber: q.questionNumber,
        inputHash: cacheKey, score: grade.score, maxPoints: 2, feedback: grade.feedback,
    });
    return grade;
}

export async function gradePart3(q: MaturaQuestion, desc: string): Promise<AIGrade> {
    const cacheKey = buildGradeCacheKey(q.examId, q.questionNumber, desc);
    const cached   = await getCachedAIGrade(cacheKey);
    if (cached) return { score: cached.score, maxScore: cached.maxPoints, feedback: cached.feedback };

    const prompt = `Ти си асистент за оценување матура на македонски јазик.
Задача Q${q.questionNumber} (${q.points} поени): ${q.questionText}
Точен одговор: ${q.correctAnswer}
Опис на решението: ${desc||'(нема)'}
Врати САМО валиден JSON: {"score":0,"feedback":"коментар на македонски"}
- score: цел број 0..${q.points}. Биди праведен и охрабрувачки.`;

    const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 512 },
    });
    const p = safeParseJSON(resp.text);
    if (!p) throw new Error('Parse error');
    const score    = Math.min(Number(p.score ?? 0), q.points);
    const feedback = String(p.feedback ?? '');
    saveAIGrade(cacheKey, {
        examId: q.examId, questionNumber: q.questionNumber,
        inputHash: cacheKey, score, maxPoints: q.points, feedback,
    });
    return { score, maxScore: q.points, feedback };
}
