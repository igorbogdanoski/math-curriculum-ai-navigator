import { describe, it, expect } from 'vitest';
import { verifyStepPair, verifyStepChain } from './casSteps';

describe('verifyStepPair — bare-expression steps (simplify/expand/factor)', () => {
  it('confirms a valid distribution step', () => {
    expect(verifyStepPair('2(x+1)', '2x+2').verdict).toBe('equivalent');
  });

  it('rejects an invalid simplification step', () => {
    expect(verifyStepPair('2(x+1)', '2x+3').verdict).toBe('not_equivalent');
  });
});

describe('verifyStepPair — equation-to-equation steps (solving transformations)', () => {
  it('confirms subtracting a constant from both sides', () => {
    expect(verifyStepPair('2x+3=7', '2x=4').verdict).toBe('equivalent');
  });

  it('confirms dividing both sides by a nonzero constant', () => {
    expect(verifyStepPair('2x=4', 'x=2').verdict).toBe('equivalent');
  });

  it('confirms reordering terms across the equals sign', () => {
    expect(verifyStepPair('2x=4', '4=2x').verdict).toBe('equivalent');
  });

  it('rejects an algebra error mid-derivation', () => {
    expect(verifyStepPair('2x+3=7', 'x=100').verdict).toBe('not_equivalent');
  });

  it('correctly identifies squaring as changing the solution set (extraneous root), not a false equivalence', () => {
    // x=2 has one solution; x^2=4 has two (x=±2) — these are genuinely NOT equivalent equations,
    // which is exactly the "needs extra scrutiny" case the proportionality check should catch.
    expect(verifyStepPair('x=2', 'x^2=4').verdict).toBe('not_equivalent');
  });
});

describe('verifyStepPair — graceful degradation', () => {
  it('returns inconclusive on mismatched step shape (equation vs bare expression)', () => {
    expect(verifyStepPair('2x+3=7', '2x+3').verdict).toBe('inconclusive');
  });

  it('returns inconclusive on a parse failure in either step', () => {
    expect(verifyStepPair('\\notarealcommand=7', '2x=4').verdict).toBe('inconclusive');
    expect(verifyStepPair('2x+3=7', '\\notarealcommand').verdict).toBe('inconclusive');
  });

  it('never throws on empty input', () => {
    expect(() => verifyStepPair('', '')).not.toThrow();
    expect(verifyStepPair('', '').verdict).toBe('inconclusive');
  });
});

describe('verifyStepPair — anchor checking against the original problem', () => {
  it('confirms a valid step against the original equation via the anchor', () => {
    const result = verifyStepPair('2x=4', 'x=2', { anchorLatex: '2x+3=7' });
    expect(result.verdict).toBe('equivalent');
  });

  it('catches an accumulated error the pairwise check alone would miss', () => {
    // Pairwise (2x=4 -> x=3) is NOT proportional either, so this should already fail
    // pairwise -- anchor checking is a second, independent signal on top of that.
    const result = verifyStepPair('2x=4', 'x=3', { anchorLatex: '2x+3=7' });
    expect(result.verdict).toBe('not_equivalent');
  });

  it('does not let a missing/unparseable anchor override a solid pairwise result', () => {
    const result = verifyStepPair('2x=4', 'x=2', { anchorLatex: '\\notarealcommand' });
    expect(result.verdict).toBe('equivalent');
  });
});

describe('verifyStepChain', () => {
  it('verifies every adjacent pair in a full valid derivation, anchored to the first step', () => {
    const results = verifyStepChain(['2x+3=7', '2x=4', 'x=2']);
    expect(results).toHaveLength(2);
    expect(results.every(r => r.verdict === 'equivalent')).toBe(true);
  });

  it('flags the specific pair where an error was introduced', () => {
    const results = verifyStepChain(['2x+3=7', '2x=4', 'x=100']);
    expect(results[0].verdict).toBe('equivalent'); // 2x+3=7 -> 2x=4 is fine
    expect(results[1].verdict).toBe('not_equivalent'); // 2x=4 -> x=100 is the error
  });

  it('returns an empty array for fewer than 2 steps', () => {
    expect(verifyStepChain([])).toEqual([]);
    expect(verifyStepChain(['x=2'])).toEqual([]);
  });
});
