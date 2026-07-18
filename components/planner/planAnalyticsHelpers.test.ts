import { describe, it, expect } from 'vitest';
import { detectGrade } from './planAnalyticsHelpers';

describe('detectGrade', () => {
  it('detects primary grades 1-9 from official title format', () => {
    expect(detectGrade('I (прво) Одделение')).toBe(1);
    expect(detectGrade('II (второ) Одделение')).toBe(2);
    expect(detectGrade('IV (четврто) Одделение')).toBe(4);
    expect(detectGrade('IX (деветто) Одделение')).toBe(9);
  });

  it('regression: does NOT misread secondary/vocational/elective titles as primary grades 1/2/4', () => {
    // Roman numerals I/II/IV appear in these titles but denote a secondary-track year,
    // not an elementary grade — БРО standards and grade1-9 official curriculum grounding
    // do not apply to secondary/vocational/elective tracks.
    expect(detectGrade('I (прва) — Стручно 2-год')).toBeNull();
    expect(detectGrade('II (втора) — Стручно 2-год')).toBeNull();
    expect(detectGrade('IV — Математичка анализа (изборен)')).toBeNull();
    expect(detectGrade('XI (единаесетто) / II (втора) година — Гимназиско')).toBeNull();
    expect(detectGrade('X (десетто) — Гимназиско')).toBeNull();
  });

  it('returns null for unrecognized titles', () => {
    expect(detectGrade('')).toBeNull();
    expect(detectGrade('Некој случаен наслов')).toBeNull();
  });
});
