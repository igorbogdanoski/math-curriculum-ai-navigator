/**
 * useMasteryPredictions — Ж6.2
 *
 * Linear-regression mastery forecasting per (student, concept) pair.
 * Uses the teacher's quiz results to predict when each student will
 * reach mastery (≥85%) for each concept they've been tested on.
 *
 * Algorithm:
 *  1. Group results by (studentName, conceptId)
 *  2. Need ≥2 data points per pair
 *  3. Linear regression on (daysSinceFirst, percentage)
 *  4. Project days until percentage reaches MASTERY_THRESHOLD
 *
 * Status tiers:
 *  mastered  — current score ≥ 85%
 *  on_track  — trend positive + ≤21 days projected
 *  slow      — trend positive + >21 days projected
 *  at_risk   — trend flat or declining + not yet mastered
 *
 * Педагошка основа: Formative Assessment, Bloom's Mastery Learning
 */

import { useMemo } from 'react';
import type { QuizResult } from '../services/firestoreService.types';

// ── Constants ─────────────────────────────────────────────────────────────────

const MASTERY_THRESHOLD = 85;   // % to be considered mastered
const MIN_POINTS      = 2;      // minimum quiz results needed per (student, concept)
const ON_TRACK_DAYS   = 21;     // ≤21 days → on_track; >21 → slow

// ── Types ─────────────────────────────────────────────────────────────────────

export type MasteryStatus = 'mastered' | 'on_track' | 'slow' | 'at_risk';

export interface MasteryPrediction {
  studentName: string;
  conceptId: string;
  conceptLabel: string;
  currentScore: number;         // latest quiz score
  trendPerWeek: number;         // % points per 7 days (positive = improving)
  daysToMastery: number | null; // null = already mastered or declining
  estimatedDate: Date | null;
  status: MasteryStatus;
  dataPoints: number;           // number of quiz results used
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateMs(ts: unknown): number | null {
  if (!ts) return null;
  try {
    const d = (ts as { toDate?: () => Date }).toDate
      ? (ts as { toDate: () => Date }).toDate()
      : new Date(ts as string | number);
    const ms = d.getTime();
    return isNaN(ms) ? null : ms;
  } catch {
    return null;
  }
}

/** Simple OLS linear regression — returns slope in y-units per x-unit */
function linearSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const sumX  = points.reduce((s, p) => s + p.x, 0);
  const sumY  = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useMasteryPredictions(
  results: QuizResult[],
  conceptLabels?: Record<string, string>,
): {
  predictions: MasteryPrediction[];
  atRisk: MasteryPrediction[];
  slow: MasteryPrediction[];
  onTrack: MasteryPrediction[];
  mastered: MasteryPrediction[];
} {
  return useMemo(() => {
    // Only results with both student + concept
    const valid = results.filter(
      r => r.studentName && r.conceptId && r.playedAt,
    );

    // Group by "studentName|conceptId"
    const grouped = new Map<string, QuizResult[]>();
    for (const r of valid) {
      const key = `${r.studentName!}|${r.conceptId!}`;
      const arr = grouped.get(key) ?? [];
      arr.push(r);
      grouped.set(key, arr);
    }

    const predictions: MasteryPrediction[] = [];

    for (const [key, group] of grouped.entries()) {
      if (group.length < MIN_POINTS) continue;

      const [studentName, conceptId] = key.split('|');

      // Sort chronologically
      const sorted = [...group].sort((a, b) => {
        const ta = toDateMs(a.playedAt) ?? 0;
        const tb = toDateMs(b.playedAt) ?? 0;
        return ta - tb;
      });

      const firstMs = toDateMs(sorted[0].playedAt);
      if (firstMs === null) continue;

      const points = sorted
        .map(r => {
          const ms = toDateMs(r.playedAt);
          if (ms === null) return null;
          return { x: (ms - firstMs) / 86_400_000, y: r.percentage }; // days
        })
        .filter((p): p is { x: number; y: number } => p !== null);

      if (points.length < MIN_POINTS) continue;

      const slopePerDay  = linearSlope(points);
      const slopePerWeek = slopePerDay * 7;
      const currentScore = sorted[sorted.length - 1].percentage;

      let status: MasteryStatus;
      let daysToMastery: number | null = null;
      let estimatedDate: Date | null   = null;

      if (currentScore >= MASTERY_THRESHOLD) {
        status = 'mastered';
      } else if (slopePerDay <= 0) {
        status = 'at_risk';
      } else {
        daysToMastery = Math.ceil((MASTERY_THRESHOLD - currentScore) / slopePerDay);
        const latestMs = toDateMs(sorted[sorted.length - 1].playedAt);
        if (latestMs !== null) {
          estimatedDate = new Date(latestMs + daysToMastery * 86_400_000);
        }
        status = daysToMastery <= ON_TRACK_DAYS ? 'on_track' : 'slow';
      }

      predictions.push({
        studentName,
        conceptId,
        conceptLabel: conceptLabels?.[conceptId] ?? conceptId,
        currentScore,
        trendPerWeek: Math.round(slopePerWeek * 10) / 10,
        daysToMastery,
        estimatedDate,
        status,
        dataPoints: sorted.length,
      });
    }

    // Sort: at_risk first, then slow, then on_track, then mastered; secondary: currentScore asc
    const ORDER: Record<MasteryStatus, number> = {
      at_risk: 0, slow: 1, on_track: 2, mastered: 3,
    };
    predictions.sort((a, b) =>
      ORDER[a.status] - ORDER[b.status] || a.currentScore - b.currentScore,
    );

    return {
      predictions,
      atRisk:   predictions.filter(p => p.status === 'at_risk'),
      slow:     predictions.filter(p => p.status === 'slow'),
      onTrack:  predictions.filter(p => p.status === 'on_track'),
      mastered: predictions.filter(p => p.status === 'mastered'),
    };
  }, [results, conceptLabels]);
}
