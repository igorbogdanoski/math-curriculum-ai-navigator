/**
 * Unit tests for getSecondaryTrackContext (P2).
 *
 * Ensures the function returns correct, non-empty pedagogical context
 * for every SecondaryTrack value, and an empty string for primary teachers.
 *
 * The "exhaustive" test below acts as a compile-time guard: if a new
 * SecondaryTrack value is added to types.ts without updating contextMap
 * in core.ts, that test will fail with a short/missing context string.
 */
import { describe, it, expect } from 'vitest';
import { getSecondaryTrackContext } from '../services/gemini/core';
import type { SecondaryTrack } from '../types';

const ALL_TRACKS: SecondaryTrack[] = [
    'gymnasium',
    'gymnasium_elective',
    'vocational4',
    'vocational3',
    'vocational2',
];

describe('getSecondaryTrackContext — primary teacher (no track)', () => {
    it('returns empty string for undefined', () => {
        expect(getSecondaryTrackContext(undefined)).toBe('');
    });

    it('returns empty string for null', () => {
        expect(getSecondaryTrackContext(null)).toBe('');
    });
});

describe('getSecondaryTrackContext — gymnasium', () => {
    it('contains "Гимназиско" in context', () => {
        expect(getSecondaryTrackContext('gymnasium')).toContain('Гимназиско');
    });

    it('mentions 4 hours per week', () => {
        expect(getSecondaryTrackContext('gymnasium')).toContain('4 часа неделно');
    });

    it('mentions theoretical approach', () => {
        expect(getSecondaryTrackContext('gymnasium')).toContain('Теоретски');
    });
});

describe('getSecondaryTrackContext — gymnasium_elective', () => {
    it('contains "изборни" in context', () => {
        expect(getSecondaryTrackContext('gymnasium_elective')).toContain('изборни');
    });

    it('mentions 3 hours per week', () => {
        expect(getSecondaryTrackContext('gymnasium_elective')).toContain('3 часа неделно');
    });

    it('mentions competitions (натпревари)', () => {
        expect(getSecondaryTrackContext('gymnasium_elective')).toContain('натпревари');
    });
});

describe('getSecondaryTrackContext — vocational4', () => {
    it('contains "ПРИМЕНЕТ" — applied approach', () => {
        expect(getSecondaryTrackContext('vocational4')).toContain('ПРИМЕНЕТ');
    });

    it('mentions 3 hours per week', () => {
        expect(getSecondaryTrackContext('vocational4')).toContain('3 часа неделно');
    });

    it('mentions vocational subject connections', () => {
        expect(getSecondaryTrackContext('vocational4')).toContain('стручни');
    });

    it('does NOT mention abstract proofs', () => {
        const ctx = getSecondaryTrackContext('vocational4');
        expect(ctx).toContain('Избегни чисто апстрактни докажувања');
    });
});

describe('getSecondaryTrackContext — vocational3', () => {
    it('contains "ПРАКТИЧЕН" — practical approach', () => {
        expect(getSecondaryTrackContext('vocational3')).toContain('ПРАКТИЧЕН');
    });

    it('mentions 2 hours per week', () => {
        expect(getSecondaryTrackContext('vocational3')).toContain('2 часа неделно');
    });

    it('mentions craft/trade context (занаетот)', () => {
        expect(getSecondaryTrackContext('vocational3')).toContain('занаетот');
    });
});

describe('getSecondaryTrackContext — vocational2', () => {
    it('contains "ОСНОВЕН ПРАКТИЧЕН"', () => {
        expect(getSecondaryTrackContext('vocational2')).toContain('ОСНОВЕН ПРАКТИЧЕН');
    });

    it('mentions 2 hours per week', () => {
        expect(getSecondaryTrackContext('vocational2')).toContain('2 часа неделно');
    });

    it('mentions inclusivity (инклузивност)', () => {
        expect(getSecondaryTrackContext('vocational2')).toContain('инклузивност');
    });
});

describe('getSecondaryTrackContext — structural guarantees (all tracks)', () => {
    it('all tracks produce context wrapped in separator markers', () => {
        for (const track of ALL_TRACKS) {
            const ctx = getSecondaryTrackContext(track);
            expect(ctx).toContain('--- ПЕДАГОШКИ КОНТЕКСТ НА ОБРАЗОВНАТА ПРОГРАМА ---');
            expect(ctx).toContain('--- КРАЈ НА КОНТЕКСТ ---');
        }
    });

    it('EXHAUSTIVE — all 5 tracks produce substantial context (≥100 chars)', () => {
        // If a new SecondaryTrack is added without updating contextMap, this fails.
        for (const track of ALL_TRACKS) {
            const ctx = getSecondaryTrackContext(track);
            expect(ctx.length, `Track "${track}" returned empty/short context — update contextMap in core.ts`).toBeGreaterThan(100);
        }
    });

    it('all tracks include ОБРАЗОВЕН КОНТЕКСТ header', () => {
        for (const track of ALL_TRACKS) {
            expect(getSecondaryTrackContext(track)).toContain('ОБРАЗОВЕН КОНТЕКСТ:');
        }
    });

    it('all tracks include ПЕДАГОШКИ ПРИСТАП header', () => {
        for (const track of ALL_TRACKS) {
            expect(getSecondaryTrackContext(track)).toContain('ПЕДАГОШКИ ПРИСТАП:');
        }
    });

    it('all tracks include ТЕМПО header with hours/week', () => {
        for (const track of ALL_TRACKS) {
            expect(getSecondaryTrackContext(track)).toContain('ТЕМПО:');
            expect(getSecondaryTrackContext(track)).toContain('часа неделно');
        }
    });
});
