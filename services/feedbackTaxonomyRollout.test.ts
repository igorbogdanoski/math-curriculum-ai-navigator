// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearFeedbackTaxonomyRolloutStats,
  FEEDBACK_TAXONOMY_ROLLOUT_KEY,
  getFeedbackTaxonomyRolloutStats,
  isFeedbackTaxonomyRolloutEnabled,
  logFeedbackTaxonomyRolloutEvent,
  setFeedbackTaxonomyRolloutEnabled,
} from './feedbackTaxonomyRollout';

describe('feedback taxonomy rollout controls', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('defaults to disabled and persists toggle state', () => {
    expect(isFeedbackTaxonomyRolloutEnabled()).toBe(false);

    setFeedbackTaxonomyRolloutEnabled(true);
    expect(window.localStorage.getItem(FEEDBACK_TAXONOMY_ROLLOUT_KEY)).toBe('true');
    expect(isFeedbackTaxonomyRolloutEnabled()).toBe(true);

    setFeedbackTaxonomyRolloutEnabled(false);
    expect(window.localStorage.getItem(FEEDBACK_TAXONOMY_ROLLOUT_KEY)).toBe('false');
    expect(isFeedbackTaxonomyRolloutEnabled()).toBe(false);
  });

  it('tracks rollout telemetry in session storage', () => {
    logFeedbackTaxonomyRolloutEvent('modal_opened');
    logFeedbackTaxonomyRolloutEvent('modal_opened');
    logFeedbackTaxonomyRolloutEvent('analytics_card_viewed');

    const stats = getFeedbackTaxonomyRolloutStats();
    expect(stats.modal_opened?.count).toBe(2);
    expect(stats.analytics_card_viewed?.count).toBe(1);
    expect(typeof stats.modal_opened?.lastAt).toBe('string');
  });

  it('clears rollout telemetry on demand', () => {
    logFeedbackTaxonomyRolloutEvent('legacy_reject_fallback');
    clearFeedbackTaxonomyRolloutStats();
    expect(getFeedbackTaxonomyRolloutStats()).toEqual({});
  });
});