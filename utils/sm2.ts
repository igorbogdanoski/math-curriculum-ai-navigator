/**
 * SM-2 Spaced Repetition Algorithm (Supermemo 2, 1987)
 * Used for scheduling lesson reviews in the Academy portal.
 *
 * Reference: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
 */

export interface SM2Card {
  lessonId: string;
  ef: number;          // easiness factor, starts at 2.5, min 1.3
  interval: number;    // days until next review
  repetitions: number; // successful reviews in a row
  nextReview: string;  // ISO date string YYYY-MM-DD
  lastReview?: string; // ISO date string YYYY-MM-DD
}

/** quality: 0=blackout, 1=wrong, 2=hard correct, 3=correct, 4=easy, 5=perfect */
export type Quality = 0 | 1 | 2 | 3 | 4 | 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

// ── Core SM-2 update ──────────────────────────────────────────────────────────

/**
 * Apply one review to a card and return the updated card.
 *
 * Algorithm:
 *   - quality < 3: reset (repetitions=0, interval=1)
 *   - quality >= 3:
 *       rep == 0 → interval = 1
 *       rep == 1 → interval = 6
 *       else     → interval = round(prev_interval * ef)
 *   - EF update: ef = max(1.3, ef + 0.1 − (5−q) × (0.08 + (5−q) × 0.02))
 *   - nextReview = today + interval
 */
export function sm2Update(card: SM2Card, quality: Quality): SM2Card {
  const today = todayStr();

  // EF update (applied regardless of quality)
  const q = quality;
  const newEf = Math.max(1.3, card.ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));

  let newRepetitions: number;
  let newInterval: number;

  if (q < 3) {
    // Failed recall — reset
    newRepetitions = 0;
    newInterval = 1;
  } else {
    // Successful recall
    if (card.repetitions === 0) {
      newInterval = 1;
    } else if (card.repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(card.interval * card.ef);
    }
    newRepetitions = card.repetitions + 1;
  }

  return {
    ...card,
    ef: Math.round(newEf * 1000) / 1000, // round to 3 decimal places
    interval: newInterval,
    repetitions: newRepetitions,
    lastReview: today,
    nextReview: addDays(today, newInterval),
  };
}

// ── Due check ─────────────────────────────────────────────────────────────────

/**
 * Returns true if the card is due for review today or overdue.
 */
export function isDueToday(card: SM2Card): boolean {
  const today = todayStr();
  return card.nextReview <= today;
}

/**
 * Returns true if the card is due within the next `withinDays` days (exclusive of today).
 */
export function isDueWithin(card: SM2Card, withinDays: number): boolean {
  const today = todayStr();
  const cutoff = addDays(today, withinDays);
  return card.nextReview > today && card.nextReview <= cutoff;
}

/**
 * Returns how many days until the card is due (0 = today, negative = overdue).
 */
export function daysUntilDue(card: SM2Card): number {
  const today = new Date(todayStr());
  const due = new Date(card.nextReview);
  const diffMs = due.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

// ── Card factory ──────────────────────────────────────────────────────────────

function createCard(lessonId: string): SM2Card {
  return {
    lessonId,
    ef: 2.5,
    interval: 1,
    repetitions: 0,
    nextReview: todayStr(),
  };
}

/**
 * Returns the existing card for the given lessonId, or creates a new one with
 * SM-2 defaults (ef=2.5, interval=1, repetitions=0, nextReview=today).
 */
export function getOrCreateCard(lessonId: string, cards: SM2Card[]): SM2Card {
  const existing = cards.find((c) => c.lessonId === lessonId);
  return existing ?? createCard(lessonId);
}

// ── localStorage persistence ──────────────────────────────────────────────────

export const SM2_STORAGE_KEY = 'academy_sm2_cards_v1';

export function loadCards(): SM2Card[] {
  try {
    const raw = localStorage.getItem(SM2_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Basic structural validation
    return parsed.filter(
      (item): item is SM2Card =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.lessonId === 'string' &&
        typeof item.ef === 'number' &&
        typeof item.interval === 'number' &&
        typeof item.repetitions === 'number' &&
        typeof item.nextReview === 'string',
    );
  } catch {
    return [];
  }
}

export function saveCards(cards: SM2Card[]): void {
  try {
    localStorage.setItem(SM2_STORAGE_KEY, JSON.stringify(cards));
  } catch {
    // Silently ignore storage errors (e.g., private browsing quota)
  }
}

/**
 * Upsert a card into the cards array and return the new array.
 * Convenience helper for updating one card and persisting.
 */
export function upsertCard(cards: SM2Card[], updated: SM2Card): SM2Card[] {
  const idx = cards.findIndex((c) => c.lessonId === updated.lessonId);
  if (idx === -1) return [...cards, updated];
  const next = [...cards];
  next[idx] = updated;
  return next;
}
