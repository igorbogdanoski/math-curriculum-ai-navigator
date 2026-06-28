import type { ScenarioBankEntry } from '../services/firestoreService.scenarioBank';

export interface ScoredScenario {
  entry: ScenarioBankEntry;
  score: number;
  avgRating: number;
}

/**
 * Ranks ScenarioBankEntry items by a composite relevance score:
 *   - 40% community quality (forkCount + usageCount, normalized)
 *   - 40% peer rating (avg of ratingsByUid)
 *   - 20% topic/grade proximity
 *
 * Returns top N results sorted by score desc.
 */
export function rankScenarios(
  scenarios: ScenarioBankEntry[],
  targetGrade: number,
  targetTopicKeywords: string[],
  topN = 5,
): ScoredScenario[] {
  if (scenarios.length === 0) return [];

  const lowerKeywords = targetTopicKeywords
    .filter(k => k.length >= 3)
    .map(k => k.toLowerCase());

  // Normalisation constants (soft cap)
  const maxFork = Math.max(...scenarios.map(s => s.forkCount), 1);
  const maxUsage = Math.max(...scenarios.map(s => s.usageCount), 1);

  const scored: ScoredScenario[] = scenarios.map(entry => {
    // Community score (0-1)
    const forkNorm = Math.min(entry.forkCount / maxFork, 1);
    const usageNorm = Math.min(entry.usageCount / maxUsage, 1);
    const communityScore = (forkNorm * 0.6 + usageNorm * 0.4);

    // Rating score (0-1): avg of ratingsByUid values (1-5 scale → normalize /5)
    const ratings = Object.values(entry.ratingsByUid ?? {});
    const avgRating = ratings.length
      ? ratings.reduce((s, n) => s + n, 0) / ratings.length
      : 0;
    const ratingScore = avgRating / 5;

    // Proximity score (0-1)
    const gradeMatch = entry.grade === targetGrade ? 1.0 : (Math.abs(entry.grade - targetGrade) <= 1 ? 0.5 : 0.0);
    const topicMatch = lowerKeywords.length > 0
      ? (lowerKeywords.some(k => entry.topicTitle.toLowerCase().includes(k)) ? 1.0 : 0.0)
      : 0.5;
    const proximityScore = gradeMatch * 0.6 + topicMatch * 0.4;

    // BRO/verified bonus
    const verifiedBonus = entry.verifiedByBRO ? 0.1 : 0;
    const featuredBonus = entry.isFeatured ? 0.05 : 0;

    const score =
      communityScore * 0.40 +
      ratingScore * 0.40 +
      proximityScore * 0.20 +
      verifiedBonus +
      featuredBonus;

    return { entry, score, avgRating };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
