import { describe, it, expect } from 'vitest';
import { getAdaptiveLevel } from './adaptiveDifficulty';

describe('getAdaptiveLevel — adaptive quiz difficulty (П20)', () => {
    describe("'support' level — percentage < 60%", () => {
        it('returns support at 0%', () => {
            expect(getAdaptiveLevel(0)).toBe('support');
        });
        it('returns support at 59%', () => {
            expect(getAdaptiveLevel(59)).toBe('support');
        });
        it('returns support at 30%', () => {
            expect(getAdaptiveLevel(30)).toBe('support');
        });
    });

    describe("'standard' level — 60% ≤ percentage < 85%", () => {
        it('returns standard at exactly 60%', () => {
            expect(getAdaptiveLevel(60)).toBe('standard');
        });
        it('returns standard at 84%', () => {
            expect(getAdaptiveLevel(84)).toBe('standard');
        });
        it('returns standard at 70%', () => {
            expect(getAdaptiveLevel(70)).toBe('standard');
        });
    });

    describe("'advanced' level — percentage ≥ 85%", () => {
        it('returns advanced at exactly 85%', () => {
            expect(getAdaptiveLevel(85)).toBe('advanced');
        });
        it('returns advanced at 100%', () => {
            expect(getAdaptiveLevel(100)).toBe('advanced');
        });
        it('returns advanced at 90%', () => {
            expect(getAdaptiveLevel(90)).toBe('advanced');
        });
    });

    describe('boundary precision', () => {
        it('59% is support, 60% is standard', () => {
            expect(getAdaptiveLevel(59)).toBe('support');
            expect(getAdaptiveLevel(60)).toBe('standard');
        });
        it('84% is standard, 85% is advanced', () => {
            expect(getAdaptiveLevel(84)).toBe('standard');
            expect(getAdaptiveLevel(85)).toBe('advanced');
        });
    });
});
