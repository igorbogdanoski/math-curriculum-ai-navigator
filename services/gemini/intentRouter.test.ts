import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTaskComplexity,
  shouldUseLiteModel,
  isIntentRouterEnabled,
  setIntentRouterEnabled,
  logRouterDecision,
  getRouterStats,
  clearRouterStats,
  INTENT_ROUTER_KEY,
  type AITaskType,
} from './intentRouter';

const LITE_TASKS: AITaskType[] = ['quiz_title', 'planner_parse', 'concept_explain', 'misconception', 'proactive_suggest', 'analogy'];
const STANDARD_TASKS: AITaskType[] = ['quiz', 'rubric', 'worked_example', 'feedback', 'daily_brief', 'adaptive_homework', 'reflection', 'parent_report', 'learning_paths'];
const ADVANCED_TASKS: AITaskType[] = ['annual_plan', 'presentation', 'recovery_worksheet', 'differentiated_test', 'pedagogical_analysis'];

describe('intentRouter', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('getTaskComplexity', () => {
    it('returns lite for all lite tasks', () => {
      for (const task of LITE_TASKS) {
        expect(getTaskComplexity(task)).toBe('lite');
      }
    });

    it('returns standard for all standard tasks', () => {
      for (const task of STANDARD_TASKS) {
        expect(getTaskComplexity(task)).toBe('standard');
      }
    });

    it('returns advanced for all advanced tasks', () => {
      for (const task of ADVANCED_TASKS) {
        expect(getTaskComplexity(task)).toBe('advanced');
      }
    });

    it('returns standard for default task', () => {
      expect(getTaskComplexity('default')).toBe('standard');
    });
  });

  describe('isIntentRouterEnabled / setIntentRouterEnabled', () => {
    it('is disabled by default (no localStorage key)', () => {
      expect(isIntentRouterEnabled()).toBe(false);
    });

    it('returns true after setIntentRouterEnabled(true)', () => {
      setIntentRouterEnabled(true);
      expect(isIntentRouterEnabled()).toBe(true);
      expect(localStorage.getItem(INTENT_ROUTER_KEY)).toBe('true');
    });

    it('returns false after setIntentRouterEnabled(false)', () => {
      setIntentRouterEnabled(true);
      setIntentRouterEnabled(false);
      expect(isIntentRouterEnabled()).toBe(false);
    });
  });

  describe('shouldUseLiteModel', () => {
    it('returns false for lite task when router is disabled', () => {
      setIntentRouterEnabled(false);
      expect(shouldUseLiteModel('analogy')).toBe(false);
    });

    it('returns true for lite task when router is enabled', () => {
      setIntentRouterEnabled(true);
      for (const task of LITE_TASKS) {
        expect(shouldUseLiteModel(task)).toBe(true);
      }
    });

    it('returns false for standard task even when router is enabled', () => {
      setIntentRouterEnabled(true);
      for (const task of STANDARD_TASKS) {
        expect(shouldUseLiteModel(task)).toBe(false);
      }
    });

    it('returns false for advanced task even when router is enabled', () => {
      setIntentRouterEnabled(true);
      for (const task of ADVANCED_TASKS) {
        expect(shouldUseLiteModel(task)).toBe(false);
      }
    });
  });

  describe('logRouterDecision / getRouterStats / clearRouterStats', () => {
    it('starts with empty stats', () => {
      expect(getRouterStats()).toEqual({});
    });

    it('accumulates counts per task:model key', () => {
      logRouterDecision('analogy', 'gemini-2.0-flash-lite');
      logRouterDecision('analogy', 'gemini-2.0-flash-lite');
      logRouterDecision('quiz', 'gemini-2.5-flash');
      const stats = getRouterStats();
      expect(stats['analogy:gemini-2.0-flash-lite'].count).toBe(2);
      expect(stats['quiz:gemini-2.5-flash'].count).toBe(1);
    });

    it('clearRouterStats empties the stats', () => {
      logRouterDecision('analogy', 'gemini-2.0-flash-lite');
      clearRouterStats();
      expect(getRouterStats()).toEqual({});
    });
  });
});
