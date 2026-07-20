import { describe, it, expect } from 'vitest';
import { tikzTemplates } from './tikzTemplates';
import { MATH_STANDARDS } from './allNationalStandardsComplete';
import { grade8OfficialCurriculum } from './official/grade8Official';
import { GRADE9_OFFICIAL_SUBTOPICS } from './official/grade9Official';
import { gymnasiumGrade10, gymnasiumGrade11, gymnasiumGrade12, gymnasiumGrade13 } from './secondary/gymnasium';
import {
  elementaryAlgebraGrade11, elementaryAlgebraGeometryGrade11,
  algebraGrade12, linearAlgebraAnalyticGeometryGrade12, mathematicalAnalysisGrade13,
} from './secondary/gymnasium_electives';
import { vocational2Grade10, vocational2Grade11 } from './secondary/vocational2';
import { vocational3Grade10, vocational3Grade11, vocational3Grade12 } from './secondary/vocational3';
import { vocational4Grade10, vocational4Grade11, vocational4Grade12, vocational4Grade13 } from './secondary/vocational4';

const validStandardCodes = new Set(MATH_STANDARDS.map(s => s.code));

const validPrimaryTopicIds = new Set([
  ...grade8OfficialCurriculum.topics.map(t => t.id),
  ...new Set(GRADE9_OFFICIAL_SUBTOPICS.map(s => s.themeId)),
]);

const allSecondaryGrades = [
  gymnasiumGrade10, gymnasiumGrade11, gymnasiumGrade12, gymnasiumGrade13,
  elementaryAlgebraGrade11, elementaryAlgebraGeometryGrade11,
  algebraGrade12, linearAlgebraAnalyticGeometryGrade12, mathematicalAnalysisGrade13,
  vocational2Grade10, vocational2Grade11,
  vocational3Grade10, vocational3Grade11, vocational3Grade12,
  vocational4Grade10, vocational4Grade11, vocational4Grade12, vocational4Grade13,
];
const validSecondaryConceptIds = new Set(
  allSecondaryGrades.flatMap(g => g.topics.flatMap(t => t.concepts.map(c => c.id))),
);

describe('tikzTemplates curriculumTags', () => {
  it('every primaryStandardCode referenced actually exists in MATH_STANDARDS', () => {
    for (const tpl of tikzTemplates) {
      for (const code of tpl.curriculumTags?.primaryStandardCodes ?? []) {
        expect(validStandardCodes.has(code), `${tpl.id} references unknown standard code ${code}`).toBe(true);
      }
    }
  });

  it('every primaryTopicId referenced actually exists in the grade 8/9 official curriculum', () => {
    for (const tpl of tikzTemplates) {
      for (const id of tpl.curriculumTags?.primaryTopicIds ?? []) {
        expect(validPrimaryTopicIds.has(id), `${tpl.id} references unknown primary topic id ${id}`).toBe(true);
      }
    }
  });

  it('every secondaryConceptId referenced actually exists in the secondary curriculum registry', () => {
    for (const tpl of tikzTemplates) {
      for (const id of tpl.curriculumTags?.secondaryConceptIds ?? []) {
        expect(validSecondaryConceptIds.has(id), `${tpl.id} references unknown secondary concept id ${id}`).toBe(true);
      }
    }
  });

  it('every template id is unique', () => {
    const ids = tikzTemplates.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
