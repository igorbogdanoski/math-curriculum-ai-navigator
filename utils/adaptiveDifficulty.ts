/**
 * Adaptive difficulty helper — extracted from StudentPlayView.generateRemediaQuiz.
 * No React/Firebase dependencies; fully unit-testable.
 */
import type { DifferentiationLevel } from '../types';

/**
 * Maps a quiz percentage to the appropriate difficulty level for the next quiz.
 *
 * < 60%  → 'support'   (simplified questions, step-by-step guidance)
 * 60–84% → 'standard'  (regular practice)
 * ≥ 85%  → 'advanced'  (challenging, critical thinking)
 */
export function getAdaptiveLevel(percentage: number): DifferentiationLevel {
    if (percentage < 60) return 'support';
    if (percentage < 85) return 'standard';
    return 'advanced';
}
