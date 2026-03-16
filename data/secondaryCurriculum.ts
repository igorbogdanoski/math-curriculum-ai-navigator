/**
 * Secondary education curriculum module (Н4 — Средно образование).
 * Exports 3 track curricula:
 *   - gymnasium   → grades 10–12
 *   - vocational4 → grades 10–12
 *   - vocational3 → grades 10–11
 */

import type { SecondaryCurriculumModule, SecondaryTrack } from '../types';
import { SECONDARY_TRACK_LABELS } from '../types';
import { gymnasiumGrade10, gymnasiumGrade11, gymnasiumGrade12 } from './secondary/gymnasium';
import { vocational4Grade10, vocational4Grade11, vocational4Grade12 } from './secondary/vocational4';
import { vocational3Grade10, vocational3Grade11 } from './secondary/vocational3';

export const secondaryCurricula: SecondaryCurriculumModule[] = [
  {
    track: 'gymnasium',
    label: SECONDARY_TRACK_LABELS.gymnasium,
    curriculum: {
      grades: [gymnasiumGrade10, gymnasiumGrade11, gymnasiumGrade12],
    },
  },
  {
    track: 'vocational4',
    label: SECONDARY_TRACK_LABELS.vocational4,
    curriculum: {
      grades: [vocational4Grade10, vocational4Grade11, vocational4Grade12],
    },
  },
  {
    track: 'vocational3',
    label: SECONDARY_TRACK_LABELS.vocational3,
    curriculum: {
      grades: [vocational3Grade10, vocational3Grade11],
    },
  },
];

/** Quick lookup: track → SecondaryCurriculumModule */
export const secondaryCurriculumByTrack = Object.fromEntries(
  secondaryCurricula.map((m) => [m.track, m])
) as Record<SecondaryTrack, SecondaryCurriculumModule>;
