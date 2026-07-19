import { describe, it, expect } from 'vitest';
import { getCurrentSchoolYear, getNextSchoolYear } from './schoolYear';

describe('getCurrentSchoolYear', () => {
  it('returns the September-start school year for a date in autumn', () => {
    expect(getCurrentSchoolYear(new Date(2026, 8, 15))).toBe('2026/2027'); // Sep 2026
  });

  it('returns the September-start school year for a date in spring (still last year\'s cycle)', () => {
    expect(getCurrentSchoolYear(new Date(2027, 2, 10))).toBe('2026/2027'); // Mar 2027
  });

  it('treats August as still the prior school year', () => {
    expect(getCurrentSchoolYear(new Date(2026, 7, 31))).toBe('2025/2026'); // Aug 2026
  });
});

describe('getNextSchoolYear', () => {
  it('increments a given school year by one', () => {
    expect(getNextSchoolYear('2026/2027')).toBe('2027/2028');
  });

  it('falls back to the current school year + 1 when none is given', () => {
    const currentStart = parseInt(getCurrentSchoolYear().split('/')[0], 10);
    expect(getNextSchoolYear()).toBe(`${currentStart + 1}/${currentStart + 2}`);
  });

  it('handles a malformed input by falling back to current+1', () => {
    const currentStart = parseInt(getCurrentSchoolYear().split('/')[0], 10);
    expect(getNextSchoolYear('not-a-year')).toBe(`${currentStart + 1}/${currentStart + 2}`);
  });
});
