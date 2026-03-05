/**
 * Pure gamification helpers — extracted from firestoreService.updateStudentGamification.
 * No Firebase dependencies; fully unit-testable.
 */

/**
 * Calculates XP earned for a completed quiz.
 * +10 base, +10 if percentage >= 70%, +20 if percentage >= 90%, +50 if concept just mastered.
 */
export function calcXP(percentage: number, justMastered: boolean): number {
    let xp = 10;
    if (percentage >= 70) xp += 10;
    if (percentage >= 90) xp += 20;
    // 3.14% chance for "Pi Bonus"
    if (Math.random() <= 0.0314) xp = Math.floor(xp * 3.14);
    if (justMastered) xp += 50;
    return xp;
}

/**
 * Calculates the new streak value.
 * - Same day  -> no increment (already counted today)
 * - Yesterday -> consecutive day -> increment
 * - Anything else -> reset to 1
 */
export function calcStreak(
    currentStreak: number,
    lastActivityDate: string,
    todayStr: string,
    yesterdayStr: string,
): number {
    if (lastActivityDate === todayStr) return currentStreak;
    if (lastActivityDate === yesterdayStr) return currentStreak + 1;
    return 1;
}

/**
 * Determines whether an achievement should be newly granted.
 */
export function isNewAchievement(id: string, condition: boolean, earned: string[]): boolean {
    return condition && !earned.includes(id);
}

/**
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
        ['first_quiz',         totalQuizzes >= 1],
        ['quiz_10',            totalQuizzes >= 10],
        ['quiz_50',            totalQuizzes >= 50],
        ['streak_3',           longestStreak >= 3],
        ['streak_7',           longestStreak >= 7],
        ['score_90',           percentage >= 90],
        ['mastered_1',         totalMastered >= 1],
        ['mastered_5',         totalMastered >= 5],
        ['mastered_10',        totalMastered >= 10],
        // Mathematician-themed badges
        ['pythagorean_master', totalMastered >= 3],                    // Питагоров мајстор
        ['euler_path',         longestStreak >= 5],                    // Ојлеров пат
        ['golden_ratio',       percentage === 100 && totalQuizzes >= 5], // Златен пресек
    ];
    return checks
        .filter(([id, cond]) => isNewAchievement(id, cond, alreadyEarned))
        .map(([id]) => id);
}

/**
 * Avatar evolution — emoji + title per level tier.
 * Levels ≥ the key get this avatar.
 */
export const AVATAR_LEVELS: Array<{ minLevel: number; emoji: string; title: string }> = [
  { minLevel: 1,  emoji: '🌱', title: 'Почетник'    },
  { minLevel: 2,  emoji: '📐', title: 'Геометричар'  },
  { minLevel: 3,  emoji: '⭐', title: 'Ѕвезда'       },
  { minLevel: 4,  emoji: '🔢', title: 'Нумеричар'    },
  { minLevel: 5,  emoji: '🧮', title: 'Алгебрист'    },
  { minLevel: 6,  emoji: '🔭', title: 'Истражувач'   },
  { minLevel: 7,  emoji: '🏆', title: 'Математичар'  },
  { minLevel: 9,  emoji: '🧠', title: 'Гениј'        },
];

/** Returns the avatar info for a given level. */
export function getAvatar(level: number): { emoji: string; title: string } {
  let result = AVATAR_LEVELS[0];
  for (const a of AVATAR_LEVELS) {
    if (level >= a.minLevel) result = a;
  }
  return result;
}

/**
 * Calculates mathematical level based on Fibonacci sequence requirements:
 * Lvl 1: 0-100xp
 * Lvl 2: 100-200xp (+100)
 * Lvl 3: 200-400xp (+200)
 * Lvl 4: 400-700xp (+300)
 * Lvl 5: 700-1200xp (+500)
 * Lvl 6: 1200-2000xp (+800)
 */
export function calcFibonacciLevel(xp: number): { level: number; currentXp: number; nextLevelXp: number; progress: number } {
    let fib1 = 100;
    let fib2 = 100;
    let totalRequired = 100;
    let level = 1;
    let prevRequired = 0;

    while (xp >= totalRequired) {
        level++;
        const nextFib = fib1 + fib2;
        fib1 = fib2;
        fib2 = nextFib;
        prevRequired = totalRequired;
        totalRequired += fib1;
    }

    const currentLevelXp = xp - prevRequired;
    const levelRequirement = totalRequired - prevRequired;
    const progress = Math.min(100, Math.max(0, (currentLevelXp / levelRequirement) * 100));

    return {
        level,
        currentXp: currentLevelXp,
        nextLevelXp: levelRequirement,
        progress
    };
}
