export const FEEDBACK_TAXONOMY_ROLLOUT_KEY = 'feedback_taxonomy_rollout_enabled';
const FEEDBACK_TAXONOMY_STATS_KEY = 'feedback_taxonomy_rollout_stats';

export type FeedbackTaxonomyRolloutEvent =
  | 'modal_opened'
  | 'approved_logged'
  | 'revision_requested'
  | 'rejected'
  | 'analytics_card_viewed'
  | 'legacy_reject_fallback';

type FeedbackTaxonomyRolloutStats = Record<
  FeedbackTaxonomyRolloutEvent,
  { count: number; lastAt: string }
>;

export function isFeedbackTaxonomyRolloutEnabled(): boolean {
  try {
    return localStorage.getItem(FEEDBACK_TAXONOMY_ROLLOUT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setFeedbackTaxonomyRolloutEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(FEEDBACK_TAXONOMY_ROLLOUT_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

export function logFeedbackTaxonomyRolloutEvent(event: FeedbackTaxonomyRolloutEvent): void {
  try {
    const raw = sessionStorage.getItem(FEEDBACK_TAXONOMY_STATS_KEY);
    const stats = raw ? JSON.parse(raw) as Partial<FeedbackTaxonomyRolloutStats> : {};
    stats[event] = {
      count: (stats[event]?.count ?? 0) + 1,
      lastAt: new Date().toISOString(),
    };
    sessionStorage.setItem(FEEDBACK_TAXONOMY_STATS_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

export function getFeedbackTaxonomyRolloutStats(): Partial<FeedbackTaxonomyRolloutStats> {
  try {
    const raw = sessionStorage.getItem(FEEDBACK_TAXONOMY_STATS_KEY);
    return raw ? JSON.parse(raw) as Partial<FeedbackTaxonomyRolloutStats> : {};
  } catch {
    return {};
  }
}

export function clearFeedbackTaxonomyRolloutStats(): void {
  try {
    sessionStorage.removeItem(FEEDBACK_TAXONOMY_STATS_KEY);
  } catch {
    /* ignore */
  }
}