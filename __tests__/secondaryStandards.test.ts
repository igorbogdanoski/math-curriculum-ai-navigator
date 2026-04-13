/**
 * Unit tests for:
 *   P3 — getDefaultGradeId (useGeneratorState helper)
 *   P4 — Secondary assessmentStandards extraction logic
 *   P6 — Grade.weeklyHours in secondary data files
 *
 * All tests are Firebase-free and DOM-free.
 */
import { describe, it, expect } from 'vitest';
import type { Curriculum, Grade, SecondaryTrack } from '../types';
import { SECONDARY_TRACK_LABELS } from '../types';
import { secondaryCurriculumByTrack } from '../data/secondaryCurriculum';
import { getDefaultGradeId } from '../hooks/useGeneratorState';

// ─────────────────────────────────────────────────────────────────────────────
// P3 — getDefaultGradeId
// ─────────────────────────────────────────────────────────────────────────────

const mockCurriculum: Curriculum = {
    grades: [
        { id: 'grade-1', level: 1, title: 'I одделение', topics: [] },
        { id: 'grade-6', level: 6, title: 'VI одделение', topics: [] },
        { id: 'voc4-grade-10', level: 10, title: 'X — Стручно 4-год', topics: [], secondaryTrack: 'vocational4' },
        { id: 'voc4-grade-11', level: 11, title: 'XI — Стручно 4-год', topics: [], secondaryTrack: 'vocational4' },
        { id: 'voc3-grade-10', level: 10, title: 'X — Стручно 3-год', topics: [], secondaryTrack: 'vocational3' },
        { id: 'gym-grade-10', level: 10, title: 'X — Гимназиско', topics: [], secondaryTrack: 'gymnasium' },
    ] as Grade[],
};

describe('getDefaultGradeId (P3)', () => {
    it('returns first primary grade for teacher with no secondaryTrack', () => {
        expect(getDefaultGradeId(mockCurriculum, undefined)).toBe('grade-1');
    });

    it('returns first primary grade for null secondaryTrack', () => {
        expect(getDefaultGradeId(mockCurriculum, null)).toBe('grade-1');
    });

    it('returns first vocational4 grade for vocational4 teacher', () => {
        expect(getDefaultGradeId(mockCurriculum, 'vocational4')).toBe('voc4-grade-10');
    });

    it('returns first gymnasium grade for gymnasium teacher', () => {
        expect(getDefaultGradeId(mockCurriculum, 'gymnasium')).toBe('gym-grade-10');
    });

    it('returns first vocational3 grade for vocational3 teacher', () => {
        expect(getDefaultGradeId(mockCurriculum, 'vocational3')).toBe('voc3-grade-10');
    });

    it('returns empty string for undefined curriculum', () => {
        expect(getDefaultGradeId(undefined, 'vocational4')).toBe('');
    });

    it('falls back to grade-1 if secondary track has no matching grade in curriculum', () => {
        const minCurriculum: Curriculum = {
            grades: [{ id: 'grade-1', level: 1, title: 'I', topics: [] }] as Grade[],
        };
        expect(getDefaultGradeId(minCurriculum, 'vocational2')).toBe('grade-1');
    });

    it('REGRESSION: primary teacher grade default is unchanged (always grade-1)', () => {
        // Before P3 fix: curriculum.grades[0].id was always used — still correct for primary
        expect(getDefaultGradeId(mockCurriculum, undefined)).toBe('grade-1');
        expect(getDefaultGradeId(mockCurriculum, null)).toBe('grade-1');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 — Secondary assessmentStandards extraction logic
// ─────────────────────────────────────────────────────────────────────────────

// Mirror the extraction logic from useCurriculum.ts so we can test it in isolation
function extractSecondaryStandards(track: SecondaryTrack) {
    const module = secondaryCurriculumByTrack[track];
    const standards: {
        id: string;
        gradeLevel: number;
        description: string;
        category: string;
        conceptId: string;
    }[] = [];

    module.curriculum.grades.forEach(grade => {
        grade.topics?.forEach(topic => {
            topic.concepts?.forEach(concept => {
                concept.assessmentStandards?.forEach((stdText, idx) => {
                    const id = `SEC-${grade.secondaryTrack}-${concept.id}-${idx}`;
                    standards.push({
                        id,
                        gradeLevel: grade.level,
                        description: stdText,
                        category: `Математика — ${SECONDARY_TRACK_LABELS[grade.secondaryTrack!]}`,
                        conceptId: concept.id,
                    });
                });
            });
        });
    });

    return standards;
}

describe('Secondary standards extraction — vocational4 (P4)', () => {
    it('produces > 50 standards (rich curriculum)', () => {
        expect(extractSecondaryStandards('vocational4').length).toBeGreaterThan(50);
    });

    it('covers all 4 grade levels: 10, 11, 12, 13', () => {
        const levels = new Set(extractSecondaryStandards('vocational4').map(s => s.gradeLevel));
        expect(levels.has(10)).toBe(true);
        expect(levels.has(11)).toBe(true);
        expect(levels.has(12)).toBe(true);
        expect(levels.has(13)).toBe(true);
    });

    it('category includes track label', () => {
        const standards = extractSecondaryStandards('vocational4');
        for (const std of standards) {
            expect(std.category).toContain(SECONDARY_TRACK_LABELS['vocational4']);
        }
    });
});

describe('Secondary standards extraction — vocational3 (P4)', () => {
    it('produces > 20 standards', () => {
        expect(extractSecondaryStandards('vocational3').length).toBeGreaterThan(20);
    });

    it('covers grades 10, 11, 12', () => {
        const levels = new Set(extractSecondaryStandards('vocational3').map(s => s.gradeLevel));
        expect(levels.has(10)).toBe(true);
        expect(levels.has(11)).toBe(true);
        expect(levels.has(12)).toBe(true);
    });
});

describe('Secondary standards extraction — vocational2 (P4)', () => {
    it('produces > 10 standards', () => {
        expect(extractSecondaryStandards('vocational2').length).toBeGreaterThan(10);
    });

    it('covers grades 10 and 11', () => {
        const levels = new Set(extractSecondaryStandards('vocational2').map(s => s.gradeLevel));
        expect(levels.has(10)).toBe(true);
        expect(levels.has(11)).toBe(true);
    });
});

describe('Secondary standards — uniqueness across all tracks (P4)', () => {
    it('standard IDs are unique across all secondary tracks', () => {
        const tracks: SecondaryTrack[] = ['vocational4', 'vocational3', 'vocational2', 'gymnasium', 'gymnasium_elective'];
        const allIds: string[] = [];
        for (const track of tracks) {
            extractSecondaryStandards(track).forEach(s => allIds.push(s.id));
        }
        expect(new Set(allIds).size).toBe(allIds.length);
    });

    it('IDs follow SEC-{track}-{conceptId}-{idx} format for vocational3', () => {
        for (const std of extractSecondaryStandards('vocational3')) {
            expect(std.id).toMatch(/^SEC-vocational3-voc3-.+-\d+$/);
        }
    });

    it('IDs follow correct format for vocational2', () => {
        for (const std of extractSecondaryStandards('vocational2')) {
            expect(std.id).toMatch(/^SEC-vocational2-voc2-.+-\d+$/);
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// P4 + P6 — Secondary Curriculum Data Integrity (combined)
// ─────────────────────────────────────────────────────────────────────────────

const ALL_TRACKS: SecondaryTrack[] = ['gymnasium', 'gymnasium_elective', 'vocational4', 'vocational3', 'vocational2'];

describe('Secondary curriculum data integrity (P4 + P6)', () => {
    it('all tracks have ≥1 grade with ≥1 topic', () => {
        for (const track of ALL_TRACKS) {
            const module = secondaryCurriculumByTrack[track];
            expect(module.curriculum.grades.length).toBeGreaterThan(0);
            for (const grade of module.curriculum.grades) {
                expect(grade.topics.length, `Track ${track} grade ${grade.id} has no topics`).toBeGreaterThan(0);
            }
        }
    });

    it('all grades have secondaryTrack field matching their module track', () => {
        for (const track of ALL_TRACKS) {
            for (const grade of secondaryCurriculumByTrack[track].curriculum.grades) {
                expect(grade.secondaryTrack).toBe(track);
            }
        }
    });

    it('all grade IDs are globally unique across all secondary tracks', () => {
        const allGradeIds: string[] = [];
        for (const track of ALL_TRACKS) {
            secondaryCurriculumByTrack[track].curriculum.grades.forEach(g => allGradeIds.push(g.id));
        }
        expect(new Set(allGradeIds).size).toBe(allGradeIds.length);
    });

    it('all concept IDs are globally unique across all secondary tracks', () => {
        const allConceptIds: string[] = [];
        for (const track of ALL_TRACKS) {
            secondaryCurriculumByTrack[track].curriculum.grades.forEach(grade =>
                grade.topics.forEach(topic =>
                    topic.concepts.forEach(c => allConceptIds.push(c.id))
                )
            );
        }
        expect(new Set(allConceptIds).size).toBe(allConceptIds.length);
    });

    it('vocational4 covers grades 10–13', () => {
        const levels = secondaryCurriculumByTrack['vocational4'].curriculum.grades.map(g => g.level).sort((a, b) => a - b);
        expect(levels).toEqual([10, 11, 12, 13]);
    });

    it('vocational3 covers grades 10–12', () => {
        const levels = secondaryCurriculumByTrack['vocational3'].curriculum.grades.map(g => g.level).sort((a, b) => a - b);
        expect(levels).toEqual([10, 11, 12]);
    });

    it('vocational2 covers grades 10–11', () => {
        const levels = secondaryCurriculumByTrack['vocational2'].curriculum.grades.map(g => g.level).sort((a, b) => a - b);
        expect(levels).toEqual([10, 11]);
    });

    it('gymnasium covers grades 10–13', () => {
        const levels = secondaryCurriculumByTrack['gymnasium'].curriculum.grades.map(g => g.level).sort((a, b) => a - b);
        expect(levels).toEqual([10, 11, 12, 13]);
    });

    it('suggestedHours are positive numbers for all topics', () => {
        for (const track of ALL_TRACKS) {
            for (const grade of secondaryCurriculumByTrack[track].curriculum.grades) {
                for (const topic of grade.topics) {
                    if (topic.suggestedHours !== undefined) {
                        expect(topic.suggestedHours, `Topic ${topic.id} has non-positive suggestedHours`).toBeGreaterThan(0);
                    }
                }
            }
        }
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// P6 — weeklyHours correctness
// ─────────────────────────────────────────────────────────────────────────────

describe('Grade.weeklyHours in secondary data (P6)', () => {
    it('gymnasium grades have weeklyHours = 4', () => {
        for (const grade of secondaryCurriculumByTrack['gymnasium'].curriculum.grades) {
            expect(grade.weeklyHours, `gymnasium grade ${grade.id}`).toBe(4);
        }
    });

    it('gymnasium_elective grades have weeklyHours = 3', () => {
        for (const grade of secondaryCurriculumByTrack['gymnasium_elective'].curriculum.grades) {
            expect(grade.weeklyHours, `gymnasium_elective grade ${grade.id}`).toBe(3);
        }
    });

    it('vocational4 grades have weeklyHours = 3', () => {
        for (const grade of secondaryCurriculumByTrack['vocational4'].curriculum.grades) {
            expect(grade.weeklyHours, `vocational4 grade ${grade.id}`).toBe(3);
        }
    });

    it('vocational3 grades have weeklyHours = 2', () => {
        for (const grade of secondaryCurriculumByTrack['vocational3'].curriculum.grades) {
            expect(grade.weeklyHours, `vocational3 grade ${grade.id}`).toBe(2);
        }
    });

    it('vocational2 grades have weeklyHours = 2', () => {
        for (const grade of secondaryCurriculumByTrack['vocational2'].curriculum.grades) {
            expect(grade.weeklyHours, `vocational2 grade ${grade.id}`).toBe(2);
        }
    });

    it('all secondary grades have weeklyHours defined (none are undefined)', () => {
        for (const track of ALL_TRACKS) {
            for (const grade of secondaryCurriculumByTrack[track].curriculum.grades) {
                expect(grade.weeklyHours, `${track} grade ${grade.id} missing weeklyHours`).toBeDefined();
            }
        }
    });

    it('weeklyHours values are only 2, 3 or 4 (valid union values)', () => {
        for (const track of ALL_TRACKS) {
            for (const grade of secondaryCurriculumByTrack[track].curriculum.grades) {
                expect([2, 3, 4]).toContain(grade.weeklyHours);
            }
        }
    });
});
