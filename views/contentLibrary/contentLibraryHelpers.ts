import type { CachedMaterial } from '../../services/firestoreService';

export type ScoredMaterial = CachedMaterial & { score: number };

export type ExtractionSource = 'video' | 'image' | 'web';

export const getAvgRating = (m: CachedMaterial): number | null => {
    const vals = m.ratingsByUid ? Object.values(m.ratingsByUid) : [];
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
};

export const toDateValue = (value: any): number => {
    if (!value) return 0;
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

export const extractMaterialDokLevels = (m: CachedMaterial): number[] => {
    const c: any = m.content ?? {};
    const values = new Set<number>();
    if (typeof c?.dokLevel === 'number') values.add(c.dokLevel);
    if (Array.isArray(c?.questions)) {
        for (const q of c.questions) {
            if (typeof q?.dokLevel === 'number') values.add(q.dokLevel);
        }
    }
    return [...values].filter(v => [1, 2, 3, 4].includes(v)).sort((a, b) => a - b);
};

export const normalizeDifficulty = (raw: unknown): string | null => {
    if (typeof raw !== 'string') return null;
    const v = raw.trim().toLowerCase();
    if (!v) return null;
    if (['easy', 'лесно', 'basic', 'основно'].includes(v)) return 'easy';
    if (['medium', 'средно', 'intermediate'].includes(v)) return 'medium';
    if (['hard', 'тешко', 'advanced', 'напредно'].includes(v)) return 'hard';
    if (['support', 'поддршка'].includes(v)) return 'support';
    return v;
};

export const extractMaterialDifficulties = (m: CachedMaterial): string[] => {
    const c: any = m.content ?? {};
    const values = new Set<string>();
    const top = normalizeDifficulty(c?.difficulty_level ?? c?.difficulty);
    if (top) values.add(top);
    if (Array.isArray(c?.questions)) {
        for (const q of c.questions) {
            const d = normalizeDifficulty(q?.difficulty_level ?? q?.difficulty);
            if (d) values.add(d);
        }
    }
    return [...values].sort();
};

export const getExtractionSource = (m: CachedMaterial): ExtractionSource | null => {
    const c: any = m.content ?? {};
    const sourceType = c?.sourceMeta?.sourceType;
    if (sourceType === 'video' || sourceType === 'image' || sourceType === 'web') return sourceType;
    return null;
};

export const getExtractionBundleStats = (m: CachedMaterial): { formulas: number; theories: number; tasks: number } | null => {
    const c: any = m.content ?? {};
    const bundle = c?.extractionBundle;
    if (!bundle) return null;
    return {
        formulas: Array.isArray(bundle.formulas) ? bundle.formulas.length : 0,
        theories: Array.isArray(bundle.theories) ? bundle.theories.length : 0,
        tasks: Array.isArray(bundle.tasks) ? bundle.tasks.length : 0,
    };
};

export const getExtractionQuality = (m: CachedMaterial): { score: number; label: string } | null => {
    const c: any = m.content ?? {};
    const quality = c?.sourceMeta?.extractionQuality;
    if (!quality || typeof quality.score !== 'number') return null;
    return {
        score: quality.score,
        label: typeof quality.label === 'string' ? quality.label : 'unknown',
    };
};

export const getExtractionSearchSnippet = (m: CachedMaterial): string => {
    const c: any = m.content ?? {};
    const bundle = c?.extractionBundle;
    if (!bundle) return '';
    return [
        Array.isArray(bundle.formulas) ? bundle.formulas.join(' ') : '',
        Array.isArray(bundle.theories) ? bundle.theories.join(' ') : '',
        Array.isArray(bundle.tasks) ? bundle.tasks.join(' ') : '',
        typeof bundle.rawSnippet === 'string' ? bundle.rawSnippet : '',
    ].filter(Boolean).join(' ');
};

export const sourceLabel: Record<ExtractionSource, string> = {
    video: 'Видео',
    image: 'Слика',
    web: 'Веб',
};

export const typeLabel: Record<string, string> = {
    quiz: 'Квиз', assessment: 'Тест', rubric: 'Рубрика',
    ideas: 'Идеи', analogy: 'Аналогија', outline: 'План',
    thematicplan: 'Тематски план', discussion: 'Дискусија',
    problems: 'Задачи', solver: 'Решенија',
};

export const typeColor: Record<string, string> = {
    quiz: 'bg-blue-100 text-blue-700',
    assessment: 'bg-purple-100 text-purple-700',
    rubric: 'bg-orange-100 text-orange-700',
};
