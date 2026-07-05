import type { AIGeneratedAnnualPlan, AIGeneratedAnnualPlanTopic } from '../types';

/**
 * Returns the current school week (1-based, school year starts September 1st),
 * or 0 if outside the school year. Same calculation already used by
 * components/home/PlanningHubWidget.tsx's dashboard widget — kept here as a
 * shared, exported version for other call sites (e.g. tutor pacing context)
 * instead of a third inline copy.
 */
export function getCurrentSchoolWeek(): number {
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = now.getMonth() < 8 ? year - 1 : year;
  const start = new Date(yearStart, 8, 1);
  const diffMs = now.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.min(36, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
}

/**
 * Finds which topic in an annual plan covers a given school week, by walking
 * topics in order and accumulating durationWeeks — same approach as
 * views/WeeklyPlanView.tsx's buildTopicRanges, but returning just the single
 * matching topic (or null) since callers here don't need the full range list.
 */
export function getCurrentTopicForWeek(
  plan: AIGeneratedAnnualPlan,
  week: number,
): AIGeneratedAnnualPlanTopic | null {
  if (week <= 0) return null;
  let cumWeek = 0;
  for (const topic of plan.topics ?? []) {
    const dw = topic.durationWeeks ?? 1;
    const weekStart = cumWeek + 1;
    const weekEnd = cumWeek + dw;
    if (week >= weekStart && week <= weekEnd) return topic;
    cumWeek = weekEnd;
  }
  return null;
}
