import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCurrentSchoolWeek, getCurrentTopicForWeek } from './annualPlanPacing';
import type { AIGeneratedAnnualPlan } from '../types';

afterEach(() => {
  vi.useRealTimers();
});

describe('getCurrentSchoolWeek', () => {
  it('returns week 1 on the first day of the school year (Sept 1)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 1));
    expect(getCurrentSchoolWeek()).toBe(1);
  });

  it('treats August as the tail end (capped week 36) of the school year that started the previous September', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 15));
    expect(getCurrentSchoolWeek()).toBe(36);
  });

  it('correctly wraps into the next calendar year (e.g. January belongs to the school year that started the previous September)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 15)); // mid-January 2027 → school year started Sept 2026
    const week = getCurrentSchoolWeek();
    expect(week).toBeGreaterThan(1);
    expect(week).toBeLessThanOrEqual(36);
  });

  it('caps at 36 weeks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 6, 1)); // well past a 36-week school year
    expect(getCurrentSchoolWeek()).toBe(36);
  });
});

describe('getCurrentTopicForWeek', () => {
  const plan: AIGeneratedAnnualPlan = {
    grade: '6',
    subject: 'Математика',
    totalWeeks: 9,
    topics: [
      { title: 'Природни броеви', durationWeeks: 3, objectives: [], suggestedActivities: [] },
      { title: 'Дропки', durationWeeks: 4, objectives: [], suggestedActivities: [] },
      { title: 'Децимални броеви', durationWeeks: 2, objectives: [], suggestedActivities: [] },
    ],
  };

  it('finds the topic covering an early week', () => {
    expect(getCurrentTopicForWeek(plan, 2)?.title).toBe('Природни броеви');
  });

  it('finds the topic covering a week in the middle range', () => {
    expect(getCurrentTopicForWeek(plan, 5)?.title).toBe('Дропки');
  });

  it('finds the topic covering the last week', () => {
    expect(getCurrentTopicForWeek(plan, 9)?.title).toBe('Децимални броеви');
  });

  it('returns null for week 0 or negative (outside school year)', () => {
    expect(getCurrentTopicForWeek(plan, 0)).toBeNull();
    expect(getCurrentTopicForWeek(plan, -1)).toBeNull();
  });

  it('returns null for a week past the end of the plan', () => {
    expect(getCurrentTopicForWeek(plan, 20)).toBeNull();
  });
});
