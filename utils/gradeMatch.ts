import type { Grade } from '../types';

const ROMAN_TO_LEVEL: Record<string, number> = {
  IX: 9, VIII: 8, VII: 7, VI: 6, IV: 4, V: 5, III: 3, II: 2, I: 1,
  X: 10, XI: 11, XII: 12,
};

// Longest-first so "VIII" matches before "V"/"I" substrings.
const GRADE_TOKEN_RE = /\b(XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I|[1-9]|1[0-2])\b/i;

/**
 * Resolves a `Grade` from a free-text label (e.g. AI-generated `plan.grade` values
 * like "VII" or "7. одделение") that may not exactly match `Grade.title`
 * (e.g. "VII (седмо) Одделение"). Falls back through progressively looser matches.
 */
export function resolveGradeByLabel(grades: Grade[], label: string | undefined | null): Grade | undefined {
  if (!label) return undefined;

  const exact = grades.find(g => g.title === label);
  if (exact) return exact;

  const tokenMatch = label.match(GRADE_TOKEN_RE);
  if (tokenMatch) {
    const token = tokenMatch[1].toUpperCase();
    const level = ROMAN_TO_LEVEL[token] ?? parseInt(token, 10);
    const byLevel = grades.find(g => g.level === level);
    if (byLevel) return byLevel;
  }

  return grades.find(g => g.title.includes(label) || label.includes(g.title));
}
