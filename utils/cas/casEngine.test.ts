import { describe, it, expect } from 'vitest';
import { verifyExpressionEquivalence } from './casEngine';

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
