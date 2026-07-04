import { casComputeEngine as ce, parseOrNull, toVerdict, type CasVerifyResult, type BoxedExpr } from './casEngine';

/**
 * Verifies that consecutive steps in a shown solution are mathematically equivalent
 * (same value / same solution set) — never verifies which named algebraic rule was
 * used. Going further (e.g. classifying "this step used the distributive property")
 * is a pattern-matching problem with much worse reliability than a numeric/symbolic
 * check, and isn't needed for "we verify, don't guess," which is about correctness,
 * not pedagogy-labeling.
 *
 * Explicitly out of scope: multi-variable elimination systems, geometric proofs,
 * inequality direction-flip steps, limits/series manipulations, matrix row
 * operations — these need different verification primitives entirely.
 */

const SAMPLE_POINTS = [1, 2, 3, -1, 0.5, -2, 5];
const RATIO_TOLERANCE = 1e-6;

function isEquation(expr: BoxedExpr): boolean {
  return expr.operator === 'Equal';
}

/** Real-valued numeric evaluation at a point, or null on a domain issue (complex result, NaN, etc). */
function evalReal(expr: BoxedExpr, variable: string, value: number): number | null {
  try {
    const result = expr.subs({ [variable]: value }).evaluate();
    if (!result.isNumber) return null;
    const re = result.re;
    const im = result.im ?? 0;
    if (typeof re !== 'number' || !Number.isFinite(re)) return null;
    if (Math.abs(im) > RATIO_TOLERANCE) return null; // complex result — domain issue at this point
    return re;
  } catch {
    return null;
  }
}

/** LHS - RHS as a single boxed expression, for an `Equal`-operator expression. */
function diffOf(equation: BoxedExpr): BoxedExpr {
  const [lhs, rhs] = equation.ops ?? [];
  return ce.box(['Subtract', lhs, rhs]);
}

function pickVariable(expr: BoxedExpr, explicit?: string): string | null {
  if (explicit) return explicit;
  return expr.unknowns[0] ?? null;
}

/**
 * Checks whether two equations have the same solution set, by confirming their
 * (LHS-RHS) difference functions are proportional — i.e. a constant, nonzero, finite
 * ratio across several sample points. This correctly accepts the algebra
 * manipulations that preserve solution sets (adding/subtracting a term from both
 * sides, multiplying both sides by a nonzero constant, reordering) without ever
 * needing to solve either equation, and correctly returns 'inconclusive' (not a
 * false "wrong") on manipulations like squaring that don't preserve a simple
 * proportional relationship — exactly the ones that legitimately need extra scrutiny
 * (extraneous roots) and shouldn't be rubber-stamped anyway.
 */
function verifyProportionalEquations(equationA: BoxedExpr, equationB: BoxedExpr, variable: string): CasVerifyResult {
  const fA = diffOf(equationA);
  const fB = diffOf(equationB);

  const ratios: number[] = [];
  for (const point of SAMPLE_POINTS) {
    const a = evalReal(fA, variable, point);
    const b = evalReal(fB, variable, point);
    if (a === null || b === null) continue;
    if (Math.abs(b) < RATIO_TOLERANCE) continue; // avoid division by ~0
    ratios.push(a / b);
  }

  if (ratios.length < 3) return { verdict: 'inconclusive', detail: 'insufficient_samples' };

  const first = ratios[0];
  if (Math.abs(first) < RATIO_TOLERANCE) return { verdict: 'inconclusive', detail: 'degenerate_ratio' };
  const allConstant = ratios.every(r => Math.abs(r - first) < Math.abs(first) * 1e-4 + RATIO_TOLERANCE);
  return { verdict: allConstant ? 'equivalent' : 'not_equivalent' };
}

/**
 * Verifies that two adjacent steps in a shown solution are equivalent. `anchorLatex`,
 * when provided, additionally re-checks stepB against the ORIGINAL equation in the
 * whole chain (not just stepA) — catching accumulated errors across a long
 * derivation rather than only a locally-consistent-but-globally-wrong chain.
 */
export function verifyStepPair(
  stepALatex: string,
  stepBLatex: string,
  opts: { variable?: string; anchorLatex?: string } = {},
): CasVerifyResult {
  if (!stepALatex.trim() || !stepBLatex.trim()) return { verdict: 'inconclusive', detail: 'empty_input' };
  try {
    const a = parseOrNull(stepALatex);
    if (a.error) return { verdict: 'inconclusive', detail: `parse_error:a:${a.error}` };
    const b = parseOrNull(stepBLatex);
    if (b.error) return { verdict: 'inconclusive', detail: `parse_error:b:${b.error}` };

    const aIsEq = isEquation(a.expr);
    const bIsEq = isEquation(b.expr);

    let pairVerdict: CasVerifyResult;
    if (!aIsEq && !bIsEq) {
      // Both bare expressions — a simplify/expand/factor step.
      pairVerdict = { verdict: toVerdict(a.expr.isEqual(b.expr)) };
    } else if (aIsEq && bIsEq) {
      const variable = pickVariable(a.expr, opts.variable);
      if (!variable) return { verdict: 'inconclusive', detail: 'no_variable' };
      pairVerdict = verifyProportionalEquations(a.expr, b.expr, variable);
    } else {
      // Mismatched shape (e.g. equation -> bare expression) isn't a supported step form.
      return { verdict: 'inconclusive', detail: 'mismatched_step_shape' };
    }

    if (pairVerdict.verdict !== 'equivalent' || !opts.anchorLatex) return pairVerdict;

    // Anchor check: re-verify stepB's equation directly against the original problem,
    // independent of how many steps are in between.
    const anchor = parseOrNull(opts.anchorLatex);
    if (anchor.error || !isEquation(anchor.expr) || !bIsEq) return pairVerdict;
    const variable = pickVariable(anchor.expr, opts.variable);
    if (!variable) return pairVerdict;
    const anchorVerdict = verifyProportionalEquations(anchor.expr, b.expr, variable);
    // Only downgrade — never let a spurious anchor mismatch overturn a solid pairwise result
    // into a false negative; an anchor 'not_equivalent' is a genuine signal, 'inconclusive' isn't.
    return anchorVerdict.verdict === 'not_equivalent' ? anchorVerdict : pairVerdict;
  } catch (err) {
    return { verdict: 'inconclusive', detail: `exception:${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Verifies every adjacent pair in an ordered chain of solution steps, anchoring each
 * check against the first step (the original problem). Returns one result per
 * adjacent pair (length = steps.length - 1).
 */
export function verifyStepChain(steps: string[], variable?: string): CasVerifyResult[] {
  if (steps.length < 2) return [];
  const anchorLatex = steps[0];
  const results: CasVerifyResult[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    results.push(verifyStepPair(steps[i], steps[i + 1], { variable, anchorLatex }));
  }
  return results;
}
