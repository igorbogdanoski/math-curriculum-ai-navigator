import { describe, it, expect } from 'vitest';
import { pctToGrade } from './grading';

describe('pctToGrade — Macedonian school scale (1–5)', () => {
    describe('grade 5 — Одличен (≥ 90%)', () => {
        it('returns grade 5 at exactly 90%', () => {
            expect(pctToGrade(90).grade).toBe(5);
        });
        it('returns grade 5 at 100%', () => {
            expect(pctToGrade(100).grade).toBe(5);
        });
        it('returns grade 5 at 95%', () => {
            expect(pctToGrade(95).grade).toBe(5);
        });
        it('label is Одличен', () => {
            expect(pctToGrade(90).label).toBe('Одличен');
        });
        it('has green bg and text classes', () => {
            const g = pctToGrade(90);
            expect(g.bgClass).toContain('green');
            expect(g.textClass).toContain('green');
        });
    });

    describe('grade 4 — Многу добар (75–89%)', () => {
        it('returns grade 4 at exactly 75%', () => {
            expect(pctToGrade(75).grade).toBe(4);
        });
        it('returns grade 4 at 89%', () => {
            expect(pctToGrade(89).grade).toBe(4);
        });
        it('returns grade 4 at 80%', () => {
            expect(pctToGrade(80).grade).toBe(4);
        });
        it('label is Многу добар', () => {
            expect(pctToGrade(80).label).toBe('Многу добар');
        });
        it('has blue bg and text classes', () => {
            const g = pctToGrade(80);
            expect(g.bgClass).toContain('blue');
            expect(g.textClass).toContain('blue');
        });
    });

    describe('grade 3 — Добар (60–74%)', () => {
        it('returns grade 3 at exactly 60%', () => {
            expect(pctToGrade(60).grade).toBe(3);
        });
        it('returns grade 3 at 74%', () => {
            expect(pctToGrade(74).grade).toBe(3);
        });
        it('label is Добар', () => {
            expect(pctToGrade(65).label).toBe('Добар');
        });
        it('has yellow bg and text classes', () => {
            const g = pctToGrade(65);
            expect(g.bgClass).toContain('yellow');
            expect(g.textClass).toContain('yellow');
        });
    });

    describe('grade 2 — Задоволителен (50–59%)', () => {
        it('returns grade 2 at exactly 50%', () => {
            expect(pctToGrade(50).grade).toBe(2);
        });
        it('returns grade 2 at 59%', () => {
            expect(pctToGrade(59).grade).toBe(2);
        });
        it('label is Задоволителен', () => {
            expect(pctToGrade(55).label).toBe('Задоволителен');
        });
        it('has orange bg and text classes', () => {
            const g = pctToGrade(55);
            expect(g.bgClass).toContain('orange');
            expect(g.textClass).toContain('orange');
        });
    });

    describe('grade 1 — Недоволен (< 50%)', () => {
        it('returns grade 1 at 49%', () => {
            expect(pctToGrade(49).grade).toBe(1);
        });
        it('returns grade 1 at 0%', () => {
            expect(pctToGrade(0).grade).toBe(1);
        });
        it('label is Недоволен', () => {
            expect(pctToGrade(30).label).toBe('Недоволен');
        });
        it('has red bg and text classes', () => {
            const g = pctToGrade(0);
            expect(g.bgClass).toContain('red');
            expect(g.textClass).toContain('red');
        });
    });

    describe('boundary precision', () => {
        it('59% is grade 2, not grade 3', () => {
            expect(pctToGrade(59).grade).toBe(2);
        });
        it('60% is grade 3, not grade 2', () => {
            expect(pctToGrade(60).grade).toBe(3);
        });
        it('74% is grade 3, not grade 4', () => {
            expect(pctToGrade(74).grade).toBe(3);
        });
        it('75% is grade 4, not grade 3', () => {
            expect(pctToGrade(75).grade).toBe(4);
        });
        it('89% is grade 4, not grade 5', () => {
            expect(pctToGrade(89).grade).toBe(4);
        });
        it('90% is grade 5, not grade 4', () => {
            expect(pctToGrade(90).grade).toBe(5);
        });
    });
});
