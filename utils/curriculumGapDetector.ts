import { MATH_STANDARDS } from '../data/allNationalStandardsComplete';
import type { NationalStandardComplete } from '../data/allNationalStandardsComplete';

export interface GapDetectorResult {
  covered: NationalStandardComplete[];
  uncovered: NationalStandardComplete[];
  coveragePct: number;
}

/**
 * Determines which БРО Math standards (III-А.1–27) are covered by a given
 * set of annual plan topic titles.
 *
 * A standard is considered "covered" when at least one of its mathBridge[]
 * keywords matches a topic title (case-insensitive substring), OR when the
 * standard description itself shares significant words with any topic title.
 *
 * Only valid for primary grades (≤ 9). Secondary → all standards uncovered.
 */
export function detectCurriculumGaps(
  topicTitles: string[],
  gradeLevel: number,
): GapDetectorResult {
  if (gradeLevel > 9 || topicTitles.length === 0) {
    return { covered: [], uncovered: MATH_STANDARDS, coveragePct: 0 };
  }

  const lowerTitles = topicTitles.map(t => t.toLowerCase());

  const covered: NationalStandardComplete[] = [];
  const uncovered: NationalStandardComplete[] = [];

  for (const std of MATH_STANDARDS) {
    let isCovered = false;

    // 1. Check mathBridge[] keywords against topic titles
    if (std.mathBridge && std.mathBridge.length > 0) {
      for (const bridge of std.mathBridge) {
        const lowerBridge = bridge.toLowerCase();
        if (lowerTitles.some(t => t.includes(lowerBridge) || lowerBridge.includes(t.slice(0, 6)))) {
          isCovered = true;
          break;
        }
      }
    }

    // 2. Fallback: check significant words from description against topics
    if (!isCovered) {
      const descWords = std.description
        .toLowerCase()
        .split(/[\s,;.—:]+/)
        .filter(w => w.length >= 5);

      for (const word of descWords) {
        if (lowerTitles.some(t => t.includes(word))) {
          isCovered = true;
          break;
        }
      }
    }

    (isCovered ? covered : uncovered).push(std);
  }

  const coveragePct = Math.round((covered.length / MATH_STANDARDS.length) * 100);
  return { covered, uncovered, coveragePct };
}
