import { describe, it, expect } from 'vitest';
import { verifyExpressionEquivalence, verifyEquationSolution, verifyDerivative, verifyAntiderivative } from './casEngine';

describe('verifyExpressionEquivalence — core algebra cases', () => {
  it('recognises the exact Dugga string-equality bug this feature fixes', () => {
    expect(verifyExpressionEquivalence('2x+2', '2+2x').verdict).toBe('equivalent');
  });

  it('recognises distribution', () => {
    expect(verifyExpressionEquivalence('2(a+b)', '2a+2b').verdict).toBe('equivalent');
  });

  it('recognises factoring equivalence, not just numeric coincidence', () => {
    expect(verifyExpressionEquivalence('x^2-4', '(x-2)(x+2)').verdict).toBe('equivalent');
  });

  it('recognises fraction vs decimal forms', () => {
    expect(verifyExpressionEquivalence('x/2', '0.5x').verdict).toBe('equivalent');
  });

  it('rejects genuinely different expressions', () => {
    expect(verifyExpressionEquivalence('x^2', '2x').verdict).toBe('not_equivalent');
  });

  it('rejects a superficially-similar but wrong fraction rewrite', () => {
    expect(verifyExpressionEquivalence('\\frac{x}{2}', '\\frac{x+2}{2}').verdict).toBe('not_equivalent');
  });

  it('returns inconclusive rather than guessing on a case ComputeEngine itself cannot resolve', () => {
    // sin^2(x) + cos^2(x) === 1 is a real identity ComputeEngine does not resolve symbolically —
    // must not be silently reported as either 'equivalent' or 'not_equivalent'.
    const result = verifyExpressionEquivalence('\\sin^2(x)+\\cos^2(x)', '1');
    expect(result.verdict).toBe('inconclusive');
  });
});

describe('verifyExpressionEquivalence — graceful degradation on unparseable input', () => {
  it('returns inconclusive (not a crash, not a false verdict) on malformed LaTeX', () => {
    expect(verifyExpressionEquivalence('\\notarealcommand{x}', '1').verdict).toBe('inconclusive');
  });

  it('correctly rejects set-difference notation compared against an unrelated number (not equivalent, and it does parse)', () => {
    expect(verifyExpressionEquivalence('R \\setminus \\{-2, 2\\}', '1').verdict).toBe('not_equivalent');
  });

  it('returns inconclusive on ratio notation (explicitly out of v1 scope)', () => {
    expect(verifyExpressionEquivalence('1:4', '1').verdict).toBe('inconclusive');
  });

  it('never throws on empty or whitespace-only input', () => {
    expect(() => verifyExpressionEquivalence('', '')).not.toThrow();
    expect(verifyExpressionEquivalence('', '').verdict).toBe('inconclusive');
  });
});

describe('verifyExpressionEquivalence — normalization fixes confirmed against real matura content', () => {
  // Each of these LaTeX forms was pulled from real data/matura/raw/*.json correctAnswer
  // values that failed to parse before the corresponding normalization rule was added.
  it('normalizes \\dfrac to \\frac', () => {
    expect(verifyExpressionEquivalence('\\dfrac{1}{2}', '0.5').verdict).toBe('equivalent');
  });

  it('normalizes the European decimal-comma LaTeX idiom {,}', () => {
    // real example: "16 \\cdot 0{,}5707" style answers from trigonometry questions
    expect(verifyExpressionEquivalence('0{,}5707', '0.5707').verdict).toBe('equivalent');
  });

  it('strips \\text{} unit annotations so the numeric part is still comparable', () => {
    // real example: "448\\text{ cm}^3", "V = 9600\\text{ cm}^3"
    expect(verifyExpressionEquivalence('448\\text{ cm}^3', '448').verdict).toBe('equivalent');
  });

  it('strips wrapping $...$ delimiters some stored answers still carry', () => {
    expect(verifyExpressionEquivalence('$36\\pi$', '36\\pi').verdict).toBe('equivalent');
  });

  it('normalizes a plain (non-LaTeX-wrapped) MK decimal comma, e.g. a Dugga fill-in typed as "0,5"', () => {
    expect(verifyExpressionEquivalence('0,5', '0.5').verdict).toBe('equivalent');
    expect(verifyExpressionEquivalence('3,14', '3.14').verdict).toBe('equivalent');
  });

  it('handles multiple plain decimal commas in one expression', () => {
    expect(verifyExpressionEquivalence('0,5+1,2', '0.5+1.2').verdict).toBe('equivalent');
  });

  it('does not mangle a spaced comma (list/set separator, not a decimal)', () => {
    // "-2, 2" has a space after the comma, so it must stay a two-element set, not become "-2.2".
    expect(verifyExpressionEquivalence('R \\setminus \\{-2, 2\\}', '1').verdict).toBe('not_equivalent');
  });
});

describe('verifyEquationSolution', () => {
  it('confirms a correct claimed root by substitution', () => {
    expect(verifyEquationSolution('2x+3=7', 'x', '2').verdict).toBe('equivalent');
  });

  it('rejects an incorrect claimed root', () => {
    expect(verifyEquationSolution('2x+3=7', 'x', '3').verdict).toBe('not_equivalent');
  });

  it('handles a fraction as the claimed root', () => {
    expect(verifyEquationSolution('2x=1', 'x', '\\frac{1}{2}').verdict).toBe('equivalent');
  });

  it('handles an irrational claimed root', () => {
    expect(verifyEquationSolution('x^2=2', 'x', '\\sqrt{2}').verdict).toBe('equivalent');
  });

  it('returns inconclusive when the input is not an equation (no top-level =)', () => {
    expect(verifyEquationSolution('2x+3', 'x', '2').verdict).toBe('inconclusive');
  });

  it('returns inconclusive on a parse failure in either the equation or the claimed value', () => {
    expect(verifyEquationSolution('\\notarealcommand=7', 'x', '2').verdict).toBe('inconclusive');
    expect(verifyEquationSolution('2x+3=7', 'x', '\\notarealcommand').verdict).toBe('inconclusive');
  });

  it('never throws on empty input', () => {
    expect(() => verifyEquationSolution('', 'x', '')).not.toThrow();
    expect(verifyEquationSolution('', 'x', '').verdict).toBe('inconclusive');
  });
});

describe('verifyDerivative', () => {
  it('confirms a correct claimed derivative of a product', () => {
    expect(verifyDerivative('x^2\\sin(x)', '2x\\sin(x)+x^2\\cos(x)').verdict).toBe('equivalent');
  });

  it('confirms a correct derivative of a simple polynomial', () => {
    expect(verifyDerivative('x^2+3x', '2x+3').verdict).toBe('equivalent');
  });

  it('rejects an incorrect claimed derivative', () => {
    expect(verifyDerivative('x^2', '3x').verdict).toBe('not_equivalent');
  });

  it('returns inconclusive on a parse failure in either input', () => {
    expect(verifyDerivative('\\notarealcommand', 'x').verdict).toBe('inconclusive');
    expect(verifyDerivative('x^2', '\\notarealcommand').verdict).toBe('inconclusive');
  });

  it('never throws on empty input', () => {
    expect(() => verifyDerivative('', '')).not.toThrow();
    expect(verifyDerivative('', '').verdict).toBe('inconclusive');
  });
});

describe('verifyAntiderivative', () => {
  it('confirms a correct claimed antiderivative by differentiating the claim, sidestepping symbolic integration', () => {
    expect(verifyAntiderivative('2x', 'x^2').verdict).toBe('equivalent');
  });

  it('correctly handles a free +C constant in the claimed antiderivative (no special-casing needed)', () => {
    expect(verifyAntiderivative('2x', 'x^2+C').verdict).toBe('equivalent');
  });

  it('rejects an incorrect claimed antiderivative', () => {
    expect(verifyAntiderivative('2x', 'x^3').verdict).toBe('not_equivalent');
  });

  it('returns inconclusive on a parse failure in either input', () => {
    expect(verifyAntiderivative('\\notarealcommand', 'x^2').verdict).toBe('inconclusive');
    expect(verifyAntiderivative('2x', '\\notarealcommand').verdict).toBe('inconclusive');
  });

  it('never throws on empty input', () => {
    expect(() => verifyAntiderivative('', '')).not.toThrow();
    expect(verifyAntiderivative('', '').verdict).toBe('inconclusive');
  });
});

describe('verifyExpressionEquivalence — real single-value matura answers, self-consistency snapshot', () => {
  // A curated snapshot of real correctAnswer strings from data/matura/raw/*.json
  // (Part 2/3, single-value, non-composite) — comparing each against itself confirms
  // the parser+normalizer handles this real content, not just hand-picked examples.
  // This is a coverage regression guard: if a future ComputeEngine upgrade or a
  // normalizeLatex change breaks parsing on real content, this test catches it.
  const realSingleValueAnswers = [
    '2', '5', '4/5', '45', '9', '4', 'y = -2x + 4', '1/6', '3069',
    '36\\pi', 'y = 3x - 1', '18', '1/3', '(3, 1)', '2, 3', '162', '160\\pi',
    '(x - 2)^2 + (y + 3)^2 = 25', '1,5\\sqrt{2}', '(2, 3)', '15/77',
  ];

  it.each(realSingleValueAnswers)('parses and self-matches: %s', (answer) => {
    const result = verifyExpressionEquivalence(answer, answer);
    expect(result.verdict).toBe('equivalent');
  });
});
