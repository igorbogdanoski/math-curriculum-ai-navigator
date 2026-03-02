/**
 * Pure gamification helpers — extracted from firestoreService.updateStudentGamification.
 * No Firebase dependencies; fully unit-testable.
 */

/**
 * Calculates XP earned for a completed quiz.
 * +10 base, +10 if percentage ≥ 70%, +20 if percentage ≥ 90%, +50 if concept just mastered.
 */
export function calcXP(percentage: number, justMastered: boolean): number {
    let xp = 10;
    if (percentage >= 70) xp += 10;
    if (percentage >= 90) xp += 20;
    if (justMastered) xp += 50;
    return xp;
}

/**
 * Calculates the new streak value.
 * - Same day  → no increment (already counted today)
 * - Yesterday → consecutive day → increment
 * - Anything else → reset to 1
 */
export function calcStreak(
    currentStreak: number,
    lastActivityDate: string,
    todayStr: string,
    yesterdayStr: string,
): number {
    if (lastActivityDate === todayStr) return currentStreak;       // already played today
    if (lastActivityDate === yesterdayStr) return currentStreak + 1; // consecutive
    return 1;                                                        // streak broken
}

/**
 * Determines whether an achievement should be newly granted.
 * Returns true only if the condition is met AND the achievement isn't already earned.
 */
export function isNewAchievement(id: string, condition: boolean, earned: string[]): boolean {
    return condition && !earned.includes(id);
}

/**
 * Full achievement check list — mirrors the logic in updateStudentGamification.
 * Returns the IDs of newly earned achievements.
 */
export function computeNewAchievements(
    totalQuizzes: number,
    longestStreak: number,
    percentage: number,
    totalMastered: number,
    alreadyEarned: string[],
): string[] {
    const checks: Array<[string, boolean]> = [
        ['first_quiz',  totalQuizzes >= 1],
        ['quiz_10',     totalQuizzes >= 10],
        ['quiz_50',     totalQuizzes >= 50],
        ['streak_3',    longestStreak >= 3],
        ['streak_7',    longestStreak >= 7],
        ['score_90',    percentage >= 90],
        ['mastered_1',  totalMastered >= 1],
        ['mastered_5',  totalMastered >= 5],
        ['mastered_10', totalMastered >= 10],
    ];
    return checks
        .filter(([id, cond]) => isNewAchievement(id, cond, alreadyEarned))
        .map(([id]) => id);
}
