import { describe, it, expect } from 'vitest';
import { getWeekRange, getDaysInWeek } from './date';

describe('date utils', () => {
    describe('getWeekRange', () => {
        it('should return the correct week range for a Monday', () => {
            const date = new Date('2024-09-09T12:00:00Z'); // A Monday
            const { start, end } = getWeekRange(date);
            expect(start.toISOString().split('T')[0]).toBe('2024-09-09');
            expect(end.toISOString().split('T')[0]).toBe('2024-09-15');
        });

        it('should return the correct week range for a Sunday', () => {
            const date = new Date('2024-09-15T12:00:00Z'); // A Sunday
            const { start, end } = getWeekRange(date);
            expect(start.toISOString().split('T')[0]).toBe('2024-09-09');
            expect(end.toISOString().split('T')[0]).toBe('2024-09-15');
        });

        it('should return the correct week range for a mid-week day', () => {
            const date = new Date('2024-09-11T12:00:00Z'); // A Wednesday
            const { start, end } = getWeekRange(date);
            expect(start.toISOString().split('T')[0]).toBe('2024-09-09');
            expect(end.toISOString().split('T')[0]).toBe('2024-09-15');
        });
    });

    describe('getDaysInWeek', () => {
        it('should return an array of 7 days for the given week', () => {
            const date = new Date('2024-09-11T12:00:00Z'); // A Wednesday
            const days = getDaysInWeek(date);
            expect(days).toHaveLength(7);
            expect(days[0].toISOString().split('T')[0]).toBe('2024-09-09'); // Monday
            expect(days[6].toISOString().split('T')[0]).toBe('2024-09-15'); // Sunday
        });
    });
});
