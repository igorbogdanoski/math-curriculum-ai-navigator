import { describe, expect, it } from 'vitest';
import type { Concept } from '../types';
import { inferConceptIdsFromExtraction } from '../utils/extractionConceptMap';

const concepts: Concept[] = [
  {
    id: 'c-linear-eq',
    title: 'Linear Equations',
    description: 'Solving one-variable linear equations and checking solutions.',
    assessmentStandards: [],
    content: ['equation', 'variable', 'balance method'],
  },
  {
    id: 'c-fraction-add',
    title: 'Fractions and Common Denominator',
    description: 'Add and subtract fractions with unlike denominators.',
    assessmentStandards: [],
    content: ['least common multiple', 'numerator', 'denominator'],
  },
  {
    id: 'c-geometry-area',
    title: 'Area of Triangle and Parallelogram',
    description: 'Using base and height formulas for area.',
    assessmentStandards: [],
    content: ['A = b*h/2', 'base', 'height'],
  },
];

describe('inferConceptIdsFromExtraction', () => {
  it('keeps selected concepts and appends matched inferred concepts', () => {
    const mapped = inferConceptIdsFromExtraction(
      {
        formulas: ['x + 5 = 17', '2x = 12'],
        theories: ['Solve the equation by isolating the variable.'],
        tasks: ['Find x in each equation.'],
        rawSnippet: 'Equation and variable practice for one-variable linear equations.',
      },
      concepts,
      ['c-fraction-add'],
    );

    expect(mapped[0]).toBe('c-fraction-add');
    expect(mapped).toContain('c-linear-eq');
  });

  it('returns only selected concepts when extraction has no useful tokens', () => {
    const mapped = inferConceptIdsFromExtraction(
      {
        formulas: [],
        theories: [],
        tasks: [],
        rawSnippet: 'и во на со за',
      },
      concepts,
      ['c-geometry-area'],
    );

    expect(mapped).toEqual(['c-geometry-area']);
  });
});
