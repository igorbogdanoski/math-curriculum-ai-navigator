import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calcXP,
  calcStreak,
  computeNewAchievements,
  calcFibonacciLevel,
  getAvatar,
  isNewAchievement,
} from '../utils/gamification';

// -------------------------------------------------------------------
// calcXP
// -------------------------------------------------------------------
describe('calcXP', () => {
  beforeEach(() => {
    // Disable random Pi bonus so results are deterministic
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('awards 10 XP for a result below 70%', () => {
    expect(calcXP(50, false)).toBe(10);
  });

  it('awards 20 XP for a result >= 70% (base + passing bonus)', () => {
    expect(calcXP(70, false)).toBe(20);
  });

  it('awards 40 XP for a result >= 90% (base + passing + excellence bonus)', () => {
    expect(calcXP(90, false)).toBe(40);
  });

  it('adds 50 XP mastery bonus on top of score bonuses', () => {
    expect(calcXP(90, true)).toBe(90);
    expect(calcXP(50, true)).toBe(60);
  });

  it('awards Pi bonus when random <= 0.0314', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.0314);
    const xp = calcXP(50, false); // base 10, then * 3.14 = 31
    expect(xp).toBe(Math.floor(10 * 3.14));
  });
});

// -------------------------------------------------------------------
// calcStreak
// -------------------------------------------------------------------
describe('calcStreak', () => {
  it('keeps streak unchanged if last activity was today', () => {
    expect(calcStreak(5, '2026-03-09', '2026-03-09', '2026-03-08')).toBe(5);
  });

  it('increments streak by 1 if last activity was yesterday', () => {
    expect(calcStreak(5, '2026-03-08', '2026-03-09', '2026-03-08')).toBe(6);
  });

  it('resets streak to 1 if last activity was two or more days ago', () => {
    expect(calcStreak(5, '2026-03-06', '2026-03-09', '2026-03-08')).toBe(1);
  });

  it('resets streak to 1 if no previous activity (empty string)', () => {
    expect(calcStreak(0, '', '2026-03-09', '2026-03-08')).toBe(1);
  });
});

// -------------------------------------------------------------------
// isNewAchievement
// -------------------------------------------------------------------
describe('isNewAchievement', () => {
  it('returns true when condition is met and not already earned', () => {
    expect(isNewAchievement('first_quiz', true, [])).toBe(true);
  });

  it('returns false when condition is not met', () => {
    expect(isNewAchievement('first_quiz', false, [])).toBe(false);
  });

  it('returns false when already earned', () => {
    expect(isNewAchievement('first_quiz', true, ['first_quiz'])).toBe(false);
  });
});

// -------------------------------------------------------------------
// computeNewAchievements
// -------------------------------------------------------------------
describe('computeNewAchievements', () => {
  it('grants first_quiz on very first quiz', () => {
    const result = computeNewAchievements(1, 1, 60, 0, []);
    expect(result).toContain('first_quiz');
  });

  it('grants score_90 when score reaches 90%', () => {
    const result = computeNewAchievements(1, 1, 90, 0, []);
    expect(result).toContain('score_90');
  });

  it('does NOT re-grant already earned achievements', () => {
    const result = computeNewAchievements(1, 1, 90, 0, ['first_quiz', 'score_90']);
    expect(result).not.toContain('first_quiz');
    expect(result).not.toContain('score_90');
  });

  it('grants streak badges at correct thresholds', () => {
    const streak3 = computeNewAchievements(5, 3, 60, 0, []);
    expect(streak3).toContain('streak_3');
    expect(streak3).not.toContain('streak_7');

    const streak7 = computeNewAchievements(5, 7, 60, 0, []);
    expect(streak7).toContain('streak_3');
    expect(streak7).toContain('streak_7');
  });

  it('grants mastery badges at correct thresholds', () => {
    const m1 = computeNewAchievements(5, 1, 60, 1, []);
    expect(m1).toContain('mastered_1');
    expect(m1).not.toContain('mastered_5');

    const m5 = computeNewAchievements(5, 1, 60, 5, []);
    expect(m5).toContain('mastered_5');
  });

  it('grants golden_ratio only on 100% with >= 5 quizzes', () => {
    expect(computeNewAchievements(4, 1, 100, 0, [])).not.toContain('golden_ratio');
    expect(computeNewAchievements(5, 1, 100, 0, [])).toContain('golden_ratio');
    expect(computeNewAchievements(10, 1, 99, 0, [])).not.toContain('golden_ratio');
  });

  it('returns empty array when all conditions already met and earned', () => {
    const allEarned = [
      'first_quiz', 'quiz_10', 'quiz_50', 'streak_3', 'streak_7',
      'score_90', 'mastered_1', 'mastered_5', 'mastered_10',
      'pythagorean_master', 'euler_path', 'golden_ratio',
    ];
    const result = computeNewAchievements(50, 7, 100, 10, allEarned);
    expect(result).toHaveLength(0);
  });
});

// -------------------------------------------------------------------
// calcFibonacciLevel
// -------------------------------------------------------------------
describe('calcFibonacciLevel', () => {
  it('starts at level 1 with 0 XP', () => {
    const { level } = calcFibonacciLevel(0);
    expect(level).toBe(1);
  });

  it('advances to level 2 at exactly 100 XP', () => {
    const { level } = calcFibonacciLevel(100);
    expect(level).toBe(2);
  });

  it('advances to level 3 at 200 XP', () => {
    const { level } = calcFibonacciLevel(200);
    expect(level).toBe(3);
  });

  it('reports progress percentage between 0 and 100', () => {
    const { progress } = calcFibonacciLevel(150);
    expect(progress).toBeGreaterThanOrEqual(0);
    expect(progress).toBeLessThanOrEqual(100);
  });

  it('currentXp resets to 0 at each level boundary', () => {
    const { currentXp } = calcFibonacciLevel(100);
    expect(currentXp).toBe(0);
  });
});

// -------------------------------------------------------------------
// getAvatar
// -------------------------------------------------------------------
describe('getAvatar', () => {
  it('returns Почетник for level 1', () => {
    expect(getAvatar(1).title).toBe('Почетник');
  });

  it('returns Математичар for level 7', () => {
    expect(getAvatar(7).title).toBe('Математичар');
  });

  it('returns Гениј for level 9+', () => {
    expect(getAvatar(9).title).toBe('Гениј');
    expect(getAvatar(99).title).toBe('Гениј');
  });

  it('returns correct emoji for each tier', () => {
    expect(getAvatar(1).emoji).toBe('🌱');
    expect(getAvatar(2).emoji).toBe('📐');
    expect(getAvatar(9).emoji).toBe('🧠');
  });
});
