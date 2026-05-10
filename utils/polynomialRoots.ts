/**
 * Durand-Kerner polynomial root finder — degree 2..8.
 *
 * Simultaneously approximates all n complex roots of a monic polynomial
 * p(z) = z^n + a_{n-1}z^{n-1} + ... + a_0 using the Weierstrass-Durand-Kerner
 * fixed-point iteration: z_k ← z_k − p(z_k) / ∏_{j≠k}(z_k − z_j).
 */

export interface Cx { re: number; im: number }

export const CX_ZERO: Cx = { re: 0, im: 0 };
export const CX_ONE:  Cx = { re: 1, im: 0 };

export function cxAdd(a: Cx, b: Cx): Cx { return { re: a.re+b.re, im: a.im+b.im }; }
export function cxSub(a: Cx, b: Cx): Cx { return { re: a.re-b.re, im: a.im-b.im }; }
export function cxMul(a: Cx, b: Cx): Cx {
  return { re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re };
}
export function cxDiv(a: Cx, b: Cx): Cx {
  const d = b.re*b.re + b.im*b.im;
  if (d < 1e-30) return CX_ZERO;
  return { re: (a.re*b.re + a.im*b.im)/d, im: (a.im*b.re - a.re*b.im)/d };
}
export function cxAbs(a: Cx): number { return Math.sqrt(a.re*a.re + a.im*a.im); }
export function cxFmt(a: Cx, digits = 4): string {
  const re = parseFloat(a.re.toFixed(digits));
  if (Math.abs(a.im) < 5e-5) return re.toString();
  const im = parseFloat(a.im.toFixed(digits));
  const sign = im >= 0 ? '+' : '−';
  return `${re} ${sign} ${Math.abs(im)}i`;
}

/** Evaluate polynomial p(z) using Horner's method. coeffs[0] = leading. */
export function polyEval(coeffs: number[], z: Cx): Cx {
  let acc: Cx = CX_ZERO;
  for (const c of coeffs) {
    acc = cxMul(acc, z);
    acc = cxAdd(acc, { re: c, im: 0 });
  }
  return acc;
}

/** Evaluate polynomial at real x (Horner). */
export function polyHorner(coeffs: number[], x: number): number {
  let y = 0;
  for (const c of coeffs) y = y * x + c;
  return y;
}

/**
 * Find all roots of the polynomial defined by `coeffs`.
 * coeffs[0] is the leading coefficient (must be non-zero), coeffs[n] is the constant.
 */
export function durandKerner(coeffs: number[], maxIter = 200): Cx[] {
  const n = coeffs.length - 1;
  if (n <= 0) return [];
  const lead = coeffs[0];
  if (Math.abs(lead) < 1e-14) return [];

  // Monic normalised polynomial
  const p = coeffs.map(c => c / lead);

  // Cauchy radius bound as initial circle radius
  const radius = 1 + Math.max(...p.slice(1).map(Math.abs));

  // Initial approximations: equally spaced on circle (offset by 0.4 rad for stability)
  const roots: Cx[] = Array.from({ length: n }, (_, k) => {
    const theta = (2 * Math.PI * k) / n + 0.4;
    return { re: radius * Math.cos(theta), im: radius * Math.sin(theta) };
  });

  for (let iter = 0; iter < maxIter; iter++) {
    let maxMove = 0;
    const next = roots.map((zk, k) => {
      const pzk = polyEval(p, zk);
      let denom: Cx = CX_ONE;
      for (let j = 0; j < n; j++) {
        if (j !== k) denom = cxMul(denom, cxSub(zk, roots[j]));
      }
      const corr = cxDiv(pzk, denom);
      maxMove = Math.max(maxMove, cxAbs(corr));
      return cxSub(zk, corr);
    });
    for (let k = 0; k < n; k++) roots[k] = next[k];
    if (maxMove < 1e-12) break;
  }

  return roots;
}

export function isRealRoot(z: Cx, tol = 1e-5): boolean {
  return Math.abs(z.im) <= tol;
}

/** Sort: real roots by value, then complex pairs by real part. */
export function sortRoots(roots: Cx[]): Cx[] {
  return [...roots].sort((a, b) => {
    const ar = isRealRoot(a), br = isRealRoot(b);
    if (ar && br) return a.re - b.re;
    if (ar) return -1;
    if (br) return 1;
    if (Math.abs(a.re - b.re) > 1e-4) return a.re - b.re;
    return a.im - b.im;
  });
}
