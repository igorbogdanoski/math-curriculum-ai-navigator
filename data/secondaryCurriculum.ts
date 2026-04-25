/**
 * Secondary education curriculum module (Н4 — Средно образование).
 * Exports 4 track curricula:
 *   - gymnasium           → grades 10–13 (4 години гимназија)
 *   - gymnasium_elective  → изборни предмети по гимназија
 *   - vocational4         → grades 10–13
 *   - vocational3         → grades 10–12
 *   - vocational2         → grades 10–11
 */

import type { SecondaryCurriculumModule, SecondaryTrack } from '../types';
import { gymnasiumGrade10, gymnasiumGrade11, gymnasiumGrade12, gymnasiumGrade13 } from './secondary/gymnasium';
import {
  elementaryAlgebraGrade11,
  elementaryAlgebraGeometryGrade11,
  algebraGrade12,
  linearAlgebraAnalyticGeometryGrade12,
  mathematicalAnalysisGrade13,
} from './secondary/gymnasium_electives';
import { vocational4Grade10, vocational4Grade11, vocational4Grade12, vocational4Grade13 } from './secondary/vocational4';
import { vocational3Grade10, vocational3Grade11, vocational3Grade12 } from './secondary/vocational3';
import { vocational2Grade10, vocational2Grade11 } from './secondary/vocational2';

export const secondaryCurricula: SecondaryCurriculumModule[] = [
  {
    track: 'gymnasium',
    label: 'Гимназиско (X–XIII)',
    curriculum: {
      grades: [gymnasiumGrade10, gymnasiumGrade11, gymnasiumGrade12, gymnasiumGrade13],
    },
  },
  {
    track: 'gymnasium_elective',
    label: 'Гимназија — Изборни предмети',
    curriculum: {
      grades: [
        elementaryAlgebraGrade11,
        elementaryAlgebraGeometryGrade11,
        algebraGrade12,
        linearAlgebraAnalyticGeometryGrade12,
        mathematicalAnalysisGrade13,
      ],
    },
  },
  {
    track: 'vocational4',
    label: 'Стручно 4-год (X–XIII)',
    curriculum: {
      grades: [vocational4Grade10, vocational4Grade11, vocational4Grade12, vocational4Grade13],
    },
  },
  {
    track: 'vocational3',
    label: 'Стручно 3-год (X–XII)',
    curriculum: {
      grades: [vocational3Grade10, vocational3Grade11, vocational3Grade12],
    },
  },
  {
    track: 'vocational2',
    label: 'Стручно 2-год (X–XI)',
    curriculum: {
      grades: [vocational2Grade10, vocational2Grade11],
    },
  },
];

/** Quick lookup: track → SecondaryCurriculumModule */
export const secondaryCurriculumByTrack = Object.fromEntries(
  secondaryCurricula.map((m) => [m.track, m])
) as Record<SecondaryTrack, SecondaryCurriculumModule>;
