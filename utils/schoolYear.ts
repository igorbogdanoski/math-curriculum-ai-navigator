/**
 * Shared academic-year helpers. Extracted 2026-07-19 (Wave 6.3,
 * audit_2026_07_18_full_app_review) from a private copy in
 * firestoreService.weeklyPlans.ts, so the "copy to new school year" feature
 * doesn't grow a second, potentially-divergent implementation of the same
 * September-cutover logic.
 */

/** Returns e.g. "2026/2027" — the school year containing today's date (MK school year starts September). */
export function getCurrentSchoolYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  return date.getMonth() >= 8 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

/** Returns the school year immediately after the given one (or after the current one, if omitted). */
export function getNextSchoolYear(schoolYear?: string): string {
  if (schoolYear) {
    const [start] = schoolYear.split('/').map(s => parseInt(s, 10));
    if (Number.isFinite(start)) return `${start + 1}/${start + 2}`;
  }
  const [start] = getCurrentSchoolYear().split('/').map(s => parseInt(s, 10));
  return `${start + 1}/${start + 2}`;
}
