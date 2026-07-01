import type { Grade } from '../types';

const ROMAN_TO_LEVEL: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
  IX: 9, X: 10, XI: 11, XII: 12, XIII: 13,
};

// Longest-first: XIII before XII, VIII before V/I, etc.
const GRADE_TOKEN_RE = /\b(XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I|[1-9]|1[0-3])\b/i;

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
