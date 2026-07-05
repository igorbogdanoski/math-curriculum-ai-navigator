/**
 * Clamps a raw AI-returned score field to a safe [0, maxPoints] integer range.
 * `Number(x ?? 0)` alone only guards `null`/`undefined` — a malformed non-numeric
 * field (e.g. the model returning "N/A") produces `NaN`, which then silently poisons
 * any downstream sum (`totalScore += NaN` → the whole exam total becomes NaN). This
 * also floors negative values, which `Math.min(x, max)` alone does not.
 */
export function clampAiScore(raw: unknown, maxPoints: number): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(n, maxPoints));
}
