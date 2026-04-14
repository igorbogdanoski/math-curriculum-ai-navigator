/**
 * Unit tests for:
 *   P5 — SECONDARY_TRACK_TO_MATURA_TRACKS mapping
 *
 * Tests that the mapping is correct for all 5 SecondaryTrack values,
 * and that it only references valid matura track keys.
 */
import { describe, it, expect } from 'vitest';
import { SECONDARY_TRACK_TO_MATURA_TRACKS } from '../types';

// These are the known valid matura/exam track keys in the app
// Includes both state matura tracks and завршен испит tracks (vocational2/3)
const KNOWN_MATURA_TRACKS = [
    'gymnasium',
    'vocational-it',
    'vocational-economics',
    'vocational-electro',
    'vocational-mechanical',
    'vocational-health',
    'vocational-civil',
    'vocational-art',          // уметничка матура
    'vocational3-zavrshen',    // завршен испит 3-год стручно
    'vocational2-zavrshen',    // завршен испит 2-год стручно
    'vocational4',             // generic 4-год fallback
];

describe('SECONDARY_TRACK_TO_MATURA_TRACKS (P5)', () => {
    it('gymnasium maps to ["gymnasium"]', () => {
        expect(SECONDARY_TRACK_TO_MATURA_TRACKS.gymnasium).toEqual(['gymnasium']);
    });

    it('gymnasium_elective maps to ["gymnasium"]', () => {
        expect(SECONDARY_TRACK_TO_MATURA_TRACKS.gymnasium_elective).toEqual(['gymnasium']);
    });

    it('vocational4 maps to multiple vocational tracks', () => {
        const tracks = SECONDARY_TRACK_TO_MATURA_TRACKS.vocational4!;
        expect(tracks.length).toBeGreaterThan(3);
        expect(tracks).toContain('vocational-it');
        expect(tracks).toContain('vocational-economics');
        expect(tracks).toContain('vocational-electro');
        expect(tracks).toContain('vocational-mechanical');
    });

    it('vocational3 maps to mechanical and civil (craft schools)', () => {
        const tracks = SECONDARY_TRACK_TO_MATURA_TRACKS.vocational3!;
        expect(tracks).toContain('vocational-mechanical');
        expect(tracks).toContain('vocational-civil');
    });

    it('vocational2 maps to vocational2-zavrshen (no state matura, but завршен испит applies)', () => {
        // vocational2 has no state мatura; however the "завршен испит" track is relevant
        // for the MaturaLibraryView smart-default so teachers see the correct exam data.
        expect(SECONDARY_TRACK_TO_MATURA_TRACKS.vocational2).toEqual(['vocational2-zavrshen']);
    });

    it('all mapped track keys are valid known matura tracks', () => {
        for (const [, tracks] of Object.entries(SECONDARY_TRACK_TO_MATURA_TRACKS)) {
            for (const t of (tracks ?? [])) {
                expect(KNOWN_MATURA_TRACKS).toContain(t);
            }
        }
    });

    it('no track maps to undefined (all have explicit arrays)', () => {
        const curriculumTracks = ['gymnasium', 'gymnasium_elective', 'vocational4', 'vocational3', 'vocational2'];
        for (const track of curriculumTracks) {
            // Each must be explicitly defined (even if empty [])
            expect(SECONDARY_TRACK_TO_MATURA_TRACKS).toHaveProperty(track);
        }
    });

    it('gymnasium and gymnasium_elective both map to the same matura track', () => {
        // Both teach the same curriculum → same exam
        expect(SECONDARY_TRACK_TO_MATURA_TRACKS.gymnasium).toEqual(
            SECONDARY_TRACK_TO_MATURA_TRACKS.gymnasium_elective,
        );
    });
});
