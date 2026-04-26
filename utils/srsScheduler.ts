/**
 * SRS Scheduler — builds a review schedule from Firestore SpacedRepRecords.
 * Groups concepts by urgency so Academy View can show "Денес повтори X, утре Y".
 */

import type { SpacedRepRecord } from './spacedRepetition';
import { getNextReviewLabel, isDueForReview } from './spacedRepetition';

export interface SRSItem {
  conceptId: string;
  studentId: string;
  nextReviewLabel: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  lastReviewedAt: string;
  overdue: boolean;
  /** Signed days from now — negative = overdue (used for sort priority) */
  daysFromNow: number;
}

export interface ReviewSchedule {
  today: SRSItem[];
  tomorrow: SRSItem[];
  thisWeek: SRSItem[];
  later: SRSItem[];
  totalDue: number;
}

function daysUntil(record: SpacedRepRecord): number {
  const now = new Date();
  const next = new Date(record.nextReviewDate);
  // Math.floor: an item due in 0.9 days still belongs to "today", not "tomorrow"
  return Math.floor((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function buildReviewSchedule(records: SpacedRepRecord[]): ReviewSchedule {
  const today: SRSItem[] = [];
  const tomorrow: SRSItem[] = [];
  const thisWeek: SRSItem[] = [];
  const later: SRSItem[] = [];

  for (const r of records) {
    // Skip unseen concepts (interval=0 = never reviewed via quiz)
    if (r.repetitions === 0 && r.interval === 0) continue;

    const days = daysUntil(r);
    const item: SRSItem = {
      conceptId: r.conceptId,
      studentId: r.studentId,
      nextReviewLabel: getNextReviewLabel(r),
      interval: r.interval,
      easeFactor: r.easeFactor,
      repetitions: r.repetitions,
      lastReviewedAt: r.lastReviewedAt,
      overdue: days < 0,
      daysFromNow: days,
    };

    if (days <= 0) {
      today.push(item);
    } else if (days === 1) {
      tomorrow.push(item);
    } else if (days <= 7) {
      thisWeek.push(item);
    } else {
      later.push(item);
    }
  }

  // Sort: overdue items first (most overdue = most negative daysFromNow first), then due-today by interval
  const byUrgency = (a: SRSItem, b: SRSItem) => {
    if (a.overdue && !b.overdue) return -1;
    if (!a.overdue && b.overdue) return 1;
    if (a.overdue && b.overdue) return a.daysFromNow - b.daysFromNow; // most negative first
    return a.interval - b.interval;
  };

  today.sort(byUrgency);
  tomorrow.sort((a, b) => a.interval - b.interval);
  thisWeek.sort((a, b) => a.daysFromNow - b.daysFromNow);
  later.sort((a, b) => a.daysFromNow - b.daysFromNow);

  return {
    today,
    tomorrow,
    thisWeek,
    later,
    totalDue: today.length,
  };
}

export function getScheduleStats(schedule: ReviewSchedule) {
  return {
    dueToday: schedule.today.length,
    dueTomorrow: schedule.tomorrow.length,
    dueThisWeek: schedule.thisWeek.length + schedule.tomorrow.length,
    total: schedule.today.length + schedule.tomorrow.length + schedule.thisWeek.length + schedule.later.length,
  };
}
