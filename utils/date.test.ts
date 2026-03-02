import { describe, it, expect } from 'vitest';
import { getWeekRange, getDaysInWeek } from './date';

// Helper: format a Date as YYYY-MM-DD using local time (not UTC)
const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('date utils', () => {
    describe('getWeekRange', () => {
        it('should return the correct week range for a Monday', () => {
            // Use local midnight to avoid UTC offset issues
            const date = new Date(2024, 8, 9); // 2024-09-09 (month is 0-indexed)
            const { start, end } = getWeekRange(date);
            expect(fmt(start)).toBe('2024-09-09');
            expect(fmt(end)).toBe('2024-09-15');
        });

        it('should return the correct week range for a Sunday', () => {
            const date = new Date(2024, 8, 15); // 2024-09-15 (Sunday)
            const { start, end } = getWeekRange(date);
            expect(fmt(start)).toBe('2024-09-09');
            expect(fmt(end)).toBe('2024-09-15');
        });

        it('should return the correct week range for a mid-week day', () => {
            const date = new Date(2024, 8, 11); // 2024-09-11 (Wednesday)
            const { start, end } = getWeekRange(date);
            expect(fmt(start)).toBe('2024-09-09');
            expect(fmt(end)).toBe('2024-09-15');
        });

        it('week end should be at end-of-day (23:59:59)', () => {
            const date = new Date(2024, 8, 11);
            const { end } = getWeekRange(date);
            expect(end.getHours()).toBe(23);
            expect(end.getMinutes()).toBe(59);
            expect(end.getSeconds()).toBe(59);
        });

        it('should handle a date at the very start of the year', () => {
            const date = new Date(2025, 0, 1); // 2025-01-01 (Wednesday)
            const { start, end } = getWeekRange(date);
            expect(fmt(start)).toBe('2024-12-30'); // Monday
            expect(fmt(end)).toBe('2025-01-05'); // Sunday
        });
    });

    describe('getDaysInWeek', () => {
        it('should return an array of exactly 7 days', () => {
            const date = new Date(2024, 8, 11); // Wednesday
            const days = getDaysInWeek(date);
            expect(days).toHaveLength(7);
        });

        it('should start on Monday and end on Sunday', () => {
            const date = new Date(2024, 8, 11); // Wednesday
            const days = getDaysInWeek(date);
            expect(fmt(days[0])).toBe('2024-09-09'); // Monday
            expect(fmt(days[6])).toBe('2024-09-15'); // Sunday
        });

        it('days should be consecutive', () => {
            const date = new Date(2024, 8, 11);
            const days = getDaysInWeek(date);
            for (let i = 1; i < days.length; i++) {
                const diff = days[i].getDate() - days[i - 1].getDate();
                // Handle month boundary: diff could be negative (next month wraps around)
                const msPerDay = 86_400_000;
                expect(days[i].getTime() - days[i - 1].getTime()).toBe(msPerDay);
            }
        });
    });
});
