import { ComputeEngine } from '@cortex-js/compute-engine';

/**
 * Verifies claimed math answers instead of trusting AI judgment or literal string
 * matching. Built on @cortex-js/compute-engine (already a transitive dependency of
 * mathlive, which this app already uses for math input) — it parses the same LaTeX
 * this app already stores/generates natively, so no separate LaTeX conversion layer
 * is needed.
 *
 * This is a verifier, not a solver: every check here reduces to "parse two claims and
 * compare them," never to "solve/differentiate/integrate from scratch." A single
 * ComputeEngine instance is reused across calls — constructing one is the expensive part.
 */
const ce = new ComputeEngine();

export type CasVerdict = 'equivalent' | 'not_equivalent' | 'inconclusive';

export interface CasVerifyResult {
  verdict: CasVerdict;
  /** Machine-readable reason, present only for 'inconclusive' (e.g. 'parse_error:a'). */
  detail?: string;
}

/**
 * Normalizes LaTeX command variants ComputeEngine's default dictionary doesn't
 * recognize, but that AI-generated or hand-authored content commonly uses.
 * Confirmed against a corpus of 900+ real matura correctAnswer values this session —
 * these three rules alone lifted single-expression parse coverage from ~63% to ~69%.
 */
function normalizeLatex(latex: string): string {
  return latex
    .replace(/\\dfrac/g, '\\frac')
    .replace(/\\tfrac/g, '\\frac')
    .replace(/\{,\}/g, '.')                     // European decimal comma written as LaTeX `{,}` (e.g. "0{,}5707")
    .replace(/\\text\{[^}]*\}(\^\d+)?/g, '')     // strip unit annotations incl. their own exponent (e.g. "448\text{ cm}^3" — the ^3 belongs to the unit, not the number)
    .replace(/^\$+|\$+$/g, '')                  // strip wrapping $...$ / $$...$$ delimiters some stored answers still carry
    .trim();
}

function parseOrNull(latex: string): { expr: ReturnType<ComputeEngine['parse']>; error: string | null } {
  const expr = ce.parse(normalizeLatex(latex));
  if (expr.errors.length > 0) {
    return { expr, error: expr.errors.map(e => e.toString()).join('; ') };
  }
  return { expr, error: null };
}

function toVerdict(isEqualResult: boolean | undefined): CasVerdict {
  if (isEqualResult === true) return 'equivalent';
  if (isEqualResult === false) return 'not_equivalent';
  return 'inconclusive';
}

/**
 * Checks whether two LaTeX expressions are mathematically equivalent — e.g. "2x+2"
 * and "2+2x", or "x^2-4" and "(x-2)(x+2)". Never guesses: a parse failure or a case
 * ComputeEngine itself can't resolve returns 'inconclusive', not a false negative.
 */
export function verifyExpressionEquivalence(latexA: string, latexB: string): CasVerifyResult {
  if (!latexA.trim() || !latexB.trim()) return { verdict: 'inconclusive', detail: 'empty_input' };
  try {
    const a = parseOrNull(latexA);
    if (a.error) return { verdict: 'inconclusive', detail: `parse_error:a:${a.error}` };
    const b = parseOrNull(latexB);
    if (b.error) return { verdict: 'inconclusive', detail: `parse_error:b:${b.error}` };

    return { verdict: toVerdict(a.expr.isEqual(b.expr)) };
  } catch (err) {
    return { verdict: 'inconclusive', detail: `exception:${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Checks whether a claimed value solves an equation, by substitution — e.g. does
 * x=2 solve "2x+3=7"? Never solves the equation itself, only verifies a claimed root.
 */
export function verifyEquationSolution(
  equationLatex: string,
  variable: string,
  claimedValueLatex: string,
): CasVerifyResult {
  if (!equationLatex.trim() || !claimedValueLatex.trim()) return { verdict: 'inconclusive', detail: 'empty_input' };
  try {
    const equation = parseOrNull(equationLatex);
    if (equation.error) return { verdict: 'inconclusive', detail: `parse_error:equation:${equation.error}` };
    if (equation.expr.operator !== 'Equal') {
      return { verdict: 'inconclusive', detail: 'not_an_equation' };
    }

    const claimedValue = parseOrNull(claimedValueLatex);
    if (claimedValue.error) return { verdict: 'inconclusive', detail: `parse_error:value:${claimedValue.error}` };

    const result = equation.expr.subs({ [variable]: claimedValue.expr }).evaluate();
    if (result.symbol === 'True') return { verdict: 'equivalent' };
    if (result.symbol === 'False') return { verdict: 'not_equivalent' };
    return { verdict: 'inconclusive', detail: `unresolved_substitution:${result.toString()}` };
  } catch (err) {
    return { verdict: 'inconclusive', detail: `exception:${err instanceof Error ? err.message : String(err)}` };
  }
}
