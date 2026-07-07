import type { Grade, Topic } from '../types';

const ROMAN_TO_LEVEL: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
  IX: 9, X: 10, XI: 11, XII: 12, XIII: 13,
};

// Longest-first: XIII before XII, VIII before V/I, etc.
const GRADE_TOKEN_RE = /\b(XIII|XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I|[1-9]|1[0-3])\b/i;

/**
 * Extracts just the numeric grade level from a free-text label (Roman numeral or digit
 * token), with no dependency on a curriculum Grade[] array — for callers that only need
 * the number (e.g. CurriculumGapBanner), not a full Grade object lookup. A bare
 * `.match(/\d+/)` misses the common case where `plan.grade` is a pure Roman numeral
 * ("VI", "X") with no digit at all.
 */
export function extractGradeLevelFromLabel(label: string | undefined | null): number | null {
  if (!label) return null;
  const tokenMatch = label.match(GRADE_TOKEN_RE);
  if (!tokenMatch) return null;
  const token = tokenMatch[1].toUpperCase();
  const level = ROMAN_TO_LEVEL[token] ?? parseInt(token, 10);
  return Number.isFinite(level) ? level : null;
}

/**
 * Resolves a `Grade` from a free-text label (e.g. AI-generated `plan.grade` values
 * like "VII" or "7. одделение") that may not exactly match `Grade.title`
 * (e.g. "VII (седмо) Одделение"). Falls back through progressively looser matches.
 */
export function resolveGradeByLabel(grades: Grade[], label: string | undefined | null): Grade | undefined {
  if (!label) return undefined;

  const exact = grades.find(g => g.title === label);
  if (exact) return exact;

  const level = extractGradeLevelFromLabel(label);
  if (level !== null) {
    const byLevel = grades.find(g => g.level === level);
    if (byLevel) return byLevel;
  }

  return grades.find(g => g.title.includes(label) || label.includes(g.title));
}

/**
 * Fuzzy-matches a topic by title from a free-text label (e.g. a URL-param prefill that
 * only carries a text theme name, no topicId) — bidirectional substring match, falling
 * back to the grade's first topic. Shared by LessonPlanEditorView and
 * AIThematicPlanGeneratorModal, which both prefill from the same kind of text-only param.
 */
export function findTopicByFuzzyTitle(topics: Topic[], label: string | undefined | null): Topic | undefined {
  if (!label) return topics[0];
  const lowerLabel = label.toLowerCase();
  return topics.find(t => {
    const lowerTitle = t.title.toLowerCase();
    return lowerTitle.includes(lowerLabel) || lowerLabel.includes(lowerTitle);
  }) ?? topics[0];
}

/**
 * Same bidirectional substring match as findTopicByFuzzyTitle, but WITHOUT the
 * fallback-to-first-topic — returns undefined when nothing really matches. Use this
 * whenever a false-positive match would be worse than no match at all (e.g. attributing
 * an annual-plan topic to the wrong curriculum Topic, or grounding an AI generation in
 * unrelated curriculum content just because some topic happened to be first in the list).
 */
export function matchTopicByTitleStrict(topics: Topic[], label: string): Topic | undefined {
  const lowerLabel = label.toLowerCase();
  return topics.find(t => {
    const lowerTitle = t.title.toLowerCase();
    return lowerTitle.includes(lowerLabel) || lowerLabel.includes(lowerTitle);
  });
}
