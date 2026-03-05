import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcXP, calcStreak, isNewAchievement, computeNewAchievements } from './gamification';

// Disable Pi Bonus randomness for deterministic XP tests
beforeEach(() => { vi.spyOn(Math, 'random').mockReturnValue(0.5); });
afterEach(() => { vi.restoreAllMocks(); });

// ─── calcXP ──────────────────────────────────────────────────────────────────

describe('calcXP — XP earned per quiz', () => {
    it('awards +10 base XP for any score', () => {
        expect(calcXP(0, false)).toBe(10);
        expect(calcXP(50, false)).toBe(10);
    });

    it('awards +10 bonus at exactly 70%', () => {
        expect(calcXP(70, false)).toBe(20); // 10 base + 10 bonus
    });

    it('awards +10 bonus at 69% NOT triggered', () => {
        expect(calcXP(69, false)).toBe(10);
    });

    it('awards +20 bonus at exactly 90%', () => {
        // 10 base + 10 (≥70) + 20 (≥90) = 40
        expect(calcXP(90, false)).toBe(40);
    });

    it('awards +20 bonus at 89% NOT triggered', () => {
        // 10 base + 10 (≥70) = 20
        expect(calcXP(89, false)).toBe(20);
    });

    it('awards +50 mastery bonus when justMastered is true', () => {
        expect(calcXP(0, true)).toBe(60);   // 10 + 50
        expect(calcXP(70, true)).toBe(70);  // 10 + 10 + 50
        expect(calcXP(90, true)).toBe(90);  // 10 + 10 + 20 + 50
    });

    it('perfect score (100%) yields 40 XP without mastery', () => {
        expect(calcXP(100, false)).toBe(40);
    });

    it('perfect score with mastery yields 90 XP', () => {
        expect(calcXP(100, true)).toBe(90);
    });
});

// ─── calcStreak ───────────────────────────────────────────────────────────────

describe('calcStreak — daily streak calculation', () => {
    const today = '2024-09-11';
    const yesterday = '2024-09-10';

    it('increments streak when last activity was yesterday (consecutive day)', () => {
        expect(calcStreak(3, yesterday, today, yesterday)).toBe(4);
    });

    it('keeps streak unchanged when last activity is today (already counted)', () => {
        expect(calcStreak(5, today, today, yesterday)).toBe(5);
    });

    it('resets streak to 1 when last activity was 2+ days ago', () => {
        expect(calcStreak(10, '2024-09-01', today, yesterday)).toBe(1);
    });

    it('resets streak to 1 for empty lastActivityDate (first ever activity)', () => {
        expect(calcStreak(0, '', today, yesterday)).toBe(1);
    });

    it('streak of 1 increments to 2 on second consecutive day', () => {
        expect(calcStreak(1, yesterday, today, yesterday)).toBe(2);
    });
});

// ─── isNewAchievement ─────────────────────────────────────────────────────────

describe('isNewAchievement — achievement guard', () => {
    it('returns true when condition met and achievement not yet earned', () => {
        expect(isNewAchievement('first_quiz', true, [])).toBe(true);
    });

    it('returns false when achievement already earned', () => {
        expect(isNewAchievement('first_quiz', true, ['first_quiz'])).toBe(false);
    });

    it('returns false when condition not met', () => {
        expect(isNewAchievement('quiz_10', false, [])).toBe(false);
    });

    it('returns false when both condition false and already earned', () => {
        expect(isNewAchievement('quiz_10', false, ['quiz_10'])).toBe(false);
    });
});

// ─── computeNewAchievements ───────────────────────────────────────────────────

describe('computeNewAchievements — full achievement detection', () => {
    it('grants first_quiz on the very first quiz', () => {
        const result = computeNewAchievements(1, 1, 50, 0, []);
        expect(result).toContain('first_quiz');
    });

    it('grants score_90 for 90%+ score', () => {
        const result = computeNewAchievements(1, 1, 90, 0, []);
        expect(result).toContain('score_90');
    });

    it('does NOT grant score_90 for 89%', () => {
        const result = computeNewAchievements(1, 1, 89, 0, []);
        expect(result).not.toContain('score_90');
    });

    it('grants streak_3 when longestStreak reaches 3', () => {
        const result = computeNewAchievements(5, 3, 50, 0, ['first_quiz']);
        expect(result).toContain('streak_3');
    });

    it('grants streak_7 when longestStreak reaches 7', () => {
        const result = computeNewAchievements(10, 7, 50, 0, ['first_quiz', 'streak_3']);
        expect(result).toContain('streak_7');
        expect(result).not.toContain('streak_3'); // already earned
    });

    it('grants mastered_1 when totalMastered is 1', () => {
        const result = computeNewAchievements(5, 1, 85, 1, ['first_quiz']);
        expect(result).toContain('mastered_1');
    });

    it('grants mastered_5 when totalMastered is 5', () => {
        const result = computeNewAchievements(20, 5, 80, 5, ['first_quiz', 'mastered_1']);
        expect(result).toContain('mastered_5');
        expect(result).not.toContain('mastered_1'); // already earned
    });

    it('grants mastered_10 when totalMastered is 10', () => {
        const result = computeNewAchievements(50, 7, 85, 10, ['first_quiz', 'mastered_1', 'mastered_5']);
        expect(result).toContain('mastered_10');
    });

    it('grants quiz_10 at exactly 10 quizzes', () => {
        const result = computeNewAchievements(10, 1, 50, 0, ['first_quiz']);
        expect(result).toContain('quiz_10');
    });

    it('grants quiz_50 at exactly 50 quizzes', () => {
        const result = computeNewAchievements(50, 1, 50, 0, ['first_quiz', 'quiz_10']);
        expect(result).toContain('quiz_50');
    });

    it('returns empty array when all conditions already earned', () => {
        const allEarned = ['first_quiz', 'quiz_10', 'quiz_50', 'streak_3', 'streak_7', 'score_90', 'mastered_1', 'mastered_5', 'mastered_10', 'pythagorean_master', 'euler_path', 'golden_ratio'];
        const result = computeNewAchievements(100, 10, 95, 15, allEarned);
        expect(result).toHaveLength(0);
    });

    it('can grant multiple achievements in one quiz', () => {
        // First quiz ever, score 90%, mastery
        const result = computeNewAchievements(1, 1, 90, 1, []);
        expect(result).toContain('first_quiz');
        expect(result).toContain('score_90');
        expect(result).toContain('mastered_1');
    });
});
