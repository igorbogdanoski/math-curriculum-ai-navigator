/**
 * matrixOps — S62-C1/C2/C3/C4
 *
 * Generic n×n matrix algebra:
 *   C1: mul, add, sub, transpose, identity, scalar, submatrix
 *   C2: gaussElim with row-op trace, determinant, rank
 *   C3: cramer, determinantCofactor (recursive Laplace)
 *   C4: inverseAdjugate, luDecompose
 */

export type Mat = number[][];

// ─── C1: Basic operations ─────────────────────────────────────────────────────

export function identity(n: number): Mat {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)),
  );
}

export function zeros(rows: number, cols: number): Mat {
  return Array.from({ length: rows }, () => new Array(cols).fill(0));
}

export function cloneMat(m: Mat): Mat {
  return m.map(row => [...row]);
}

export function matAdd(a: Mat, b: Mat): Mat {
  return a.map((row, i) => row.map((v, j) => v + b[i][j]));
}

export function matSub(a: Mat, b: Mat): Mat {
  return a.map((row, i) => row.map((v, j) => v - b[i][j]));
}

export function matMul(a: Mat, b: Mat): Mat {
  const n = a.length, m = b[0].length, k = b.length;
  const out = zeros(n, m);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++)
      for (let p = 0; p < k; p++)
        out[i][j] += a[i][p] * b[p][j];
  return out;
}

export function matScalar(m: Mat, s: number): Mat {
  return m.map(row => row.map(v => v * s));
}

export function transpose(m: Mat): Mat {
  return m[0].map((_, j) => m.map(row => row[j]));
}

/** Returns the submatrix obtained by deleting row `r` and column `c`. */
export function submatrix(m: Mat, r: number, c: number): Mat {
  return m
    .filter((_, i) => i !== r)
    .map(row => row.filter((_, j) => j !== c));
}

// ─── C3: Cofactor / Laplace determinant (recursive) ──────────────────────────

export function determinantCofactor(m: Mat): number {
  const n = m.length;
  if (n === 1) return m[0][0];
  if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  let det = 0;
  for (let j = 0; j < n; j++) {
    det += (j % 2 === 0 ? 1 : -1) * m[0][j] * determinantCofactor(submatrix(m, 0, j));
  }
  return det;
}

// ─── C2: Gauss elimination with row-op trace ─────────────────────────────────

export interface RowOp {
  type: 'swap' | 'scale' | 'elim';
  desc: string;
}

export interface GaussResult {
  U: Mat;              // upper-triangular
  L: Mat;              // lower-triangular factor
  pivotCols: number[];
  steps: RowOp[];
  det: number;
  rank: number;
  /** Augmented solution column if b was provided */
  solution?: number[] | null;
}

export function gaussElim(M: Mat, b?: number[]): GaussResult {
  const n = M.length;
  const U = cloneMat(M);
  const L = identity(n);
  const steps: RowOp[] = [];
  let detSign = 1;
  let detProduct = 1;
  const pivotCols: number[] = [];

  // Augment with b if provided
  const aug: number[] = b ? [...b] : new Array(n).fill(0);

  let col = 0;
  for (let row = 0; row < n && col < n; row++, col++) {
    // Partial pivot
    let maxRow = row;
    for (let k = row + 1; k < n; k++) {
      if (Math.abs(U[k][col]) > Math.abs(U[maxRow][col])) maxRow = k;
    }
    if (maxRow !== row) {
      [U[row], U[maxRow]] = [U[maxRow], U[row]];
      if (b) [aug[row], aug[maxRow]] = [aug[maxRow], aug[row]];
      // Swap corresponding L columns (already-done part)
      for (let k = 0; k < row; k++) {
        [L[row][k], L[maxRow][k]] = [L[maxRow][k], L[row][k]];
      }
      detSign *= -1;
      steps.push({ type: 'swap', desc: `R${row + 1} ↔ R${maxRow + 1}` });
    }

    const pivot = U[row][col];
    if (Math.abs(pivot) < 1e-12) {
      row--;
      continue;
    }
    pivotCols.push(col);
    detProduct *= pivot;

    for (let k = row + 1; k < n; k++) {
      const factor = U[k][col] / pivot;
      if (Math.abs(factor) < 1e-14) continue;
      L[k][col] = factor;
      for (let j = col; j < n; j++) U[k][j] -= factor * U[row][j];
      if (b) aug[k] -= factor * aug[row];
      steps.push({ type: 'elim', desc: `R${k + 1} − ${fmtNum(factor)}·R${row + 1}` });
    }
  }

  const rank = pivotCols.length;
  const det  = detSign * detProduct;

  // Back-substitution for solution
  let solution: number[] | null = null;
  if (b && rank === n) {
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = aug[i];
      for (let j = i + 1; j < n; j++) s -= U[i][j] * x[j];
      x[i] = s / U[i][i];
    }
    solution = x;
  }

  return { U, L, pivotCols, steps, det, rank, solution };
}

// ─── C3: Cramer's rule ────────────────────────────────────────────────────────

export interface CramerResult {
  solution: number[];
  det: number;
  /** Per-variable: replaced matrix and its determinant */
  columns: { Di: Mat; detDi: number }[];
}

export function cramer(A: Mat, b: number[]): CramerResult | null {
  const det = determinantCofactor(A);
  if (Math.abs(det) < 1e-12) return null; // singular

  const n = A.length;
  const columns = b.map((_, i) => {
    const Di = A.map((row, r) => row.map((v, c) => (c === i ? b[r] : v)));
    return { Di, detDi: determinantCofactor(Di) };
  });

  return {
    det,
    columns,
    solution: columns.map(({ detDi }) => detDi / det),
  };
}

// ─── C4: Adjugate inverse ─────────────────────────────────────────────────────

export function inverseAdjugate(A: Mat): Mat | null {
  const det = determinantCofactor(A);
  if (Math.abs(det) < 1e-12) return null;

  const n = A.length;
  const adj = zeros(n, n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      adj[j][i] = ((i + j) % 2 === 0 ? 1 : -1) * determinantCofactor(submatrix(A, i, j));

  return matScalar(adj, 1 / det);
}

// ─── C4: LU decomposition ─────────────────────────────────────────────────────

export interface LUResult {
  L: Mat;
  U: Mat;
  P: Mat; // permutation
  steps: RowOp[];
}

export function luDecompose(A: Mat): LUResult {
  const { L, U, steps } = gaussElim(A);
  const n = A.length;
  // Build permutation from row-swap steps
  const perm = Array.from({ length: n }, (_, i) => i);
  for (const s of steps) {
    if (s.type === 'swap') {
      const m = s.desc.match(/R(\d+) ↔ R(\d+)/);
      if (m) {
        const [, r1, r2] = m.map(Number);
        [perm[r1 - 1], perm[r2 - 1]] = [perm[r2 - 1], perm[r1 - 1]];
      }
    }
  }
  const P = zeros(n, n);
  perm.forEach((col, row) => { P[row][col] = 1; });
  return { L, U, P, steps };
}

// ─── C5: Cholesky decomposition ───────────────────────────────────────────────

export interface CholeskyResult {
  L: Mat;
  isValid: boolean;
  reason?: string;
}

/**
 * Cholesky-Banachiewicz: A = L·Lᵀ for symmetric positive-definite A.
 * Returns isValid=false with a reason if A is not symmetric or not pos-def.
 */
export function choleskyDecompose(A: Mat): CholeskyResult {
  const n = A.length;

  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (Math.abs(A[i][j] - A[j][i]) > 1e-8)
        return { L: zeros(n, n), isValid: false, reason: 'Матрицата не е симетрична' };

  const L = zeros(n, n);
  for (let j = 0; j < n; j++) {
    let diag = A[j][j];
    for (let k = 0; k < j; k++) diag -= L[j][k] * L[j][k];
    if (diag <= 1e-14)
      return { L, isValid: false, reason: 'Матрицата не е позитивно дефинитна' };
    L[j][j] = Math.sqrt(diag);
    for (let i = j + 1; i < n; i++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = s / L[j][j];
    }
  }
  return { L, isValid: true };
}

// ─── S64-A: SVD decomposition ─────────────────────────────────────────────────
// A = U · Σ · Vᵀ  (thin SVD, n×n via Jacobi iteration on AᵀA)

export interface SVDResult {
  U: Mat;             // left singular vectors (columns)
  S: number[];        // singular values (descending)
  Vt: Mat;            // right singular vectors (rows = Vᵀ)
}

function symEigen2x2(M: Mat): { vals: [number, number]; vecs: [[number, number], [number, number]] } {
  const a = M[0][0], b = M[0][1], d = M[1][1];
  const tr = a + d, det = a * d - b * b;
  const disc = Math.max(0, tr * tr / 4 - det);
  const sq = Math.sqrt(disc);
  const l1 = tr / 2 + sq, l2 = tr / 2 - sq;
  const evec = (lam: number): [number, number] => {
    if (Math.abs(b) > 1e-12) { const n = Math.hypot(b, lam - a); return [b / n, (lam - a) / n]; }
    return Math.abs(a - lam) < Math.abs(d - lam) ? [1, 0] : [0, 1];
  };
  return { vals: [l1, l2], vecs: [evec(l1), evec(l2)] };
}

function symEigen3x3(M: Mat): { vals: [number, number, number]; vecs: [[number,number,number],[number,number,number],[number,number,number]] } {
  // QR iteration on symmetric 3x3 (reuse pattern from LinearAlgebraLab's qrStep3)
  let Ak = cloneMat(M);
  for (let iter = 0; iter < 100; iter++) {
    const col = (j: number) => [Ak[0][j], Ak[1][j], Ak[2][j]];
    const qs: number[][] = [];
    const R: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
    for (let j = 0; j < 3; j++) {
      let v = col(j);
      for (let i = 0; i < j; i++) {
        const rij = v[0]*qs[i][0]+v[1]*qs[i][1]+v[2]*qs[i][2];
        R[i][j] = rij;
        v = v.map((x, k) => x - rij * qs[i][k]);
      }
      const nrm = Math.hypot(v[0], v[1], v[2]);
      R[j][j] = nrm;
      qs.push(nrm > 1e-14 ? v.map(x => x / nrm) : [+(j===0),+(j===1),+(j===2)]);
    }
    const Q: Mat = [[qs[0][0],qs[1][0],qs[2][0]],[qs[0][1],qs[1][1],qs[2][1]],[qs[0][2],qs[1][2],qs[2][2]]];
    Ak = matMul(R as Mat, Q);
  }
  const lams: [number,number,number] = [Ak[0][0], Ak[1][1], Ak[2][2]];
  // compute eigenvectors via null-space cross product
  const evec3 = (lam: number): [number,number,number] => {
    const B = M.map((row, i) => row.map((v, j) => v - (i===j ? lam : 0)));
    let best: [number,number,number] = [1,0,0], bestN = 0;
    for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) {
      const cp: [number,number,number] = [B[i][1]*B[j][2]-B[i][2]*B[j][1], B[i][2]*B[j][0]-B[i][0]*B[j][2], B[i][0]*B[j][1]-B[i][1]*B[j][0]];
      const n = Math.hypot(cp[0], cp[1], cp[2]);
      if (n > bestN) { best = cp; bestN = n; }
    }
    const n = Math.hypot(best[0], best[1], best[2]);
    return n > 1e-14 ? [best[0]/n, best[1]/n, best[2]/n] as [number,number,number] : [1,0,0];
  };
  return { vals: lams, vecs: [evec3(lams[0]), evec3(lams[1]), evec3(lams[2])] };
}

// Jacobi eigenvalue algorithm for symmetric n×n matrices.
// Returns eigenvalues and eigenvector matrix V (columns = eigenvectors).
function symEigenNxN(M: Mat): { vals: number[]; V: Mat } {
  const n = M.length;
  const A = M.map(row => [...row]);
  const V = identity(n);
  const maxIter = n * n * 20;
  for (let iter = 0; iter < maxIter; iter++) {
    let p = 0, q = 1, maxOff = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const v = Math.abs(A[i][j]);
      if (v > maxOff) { maxOff = v; p = i; q = j; }
    }
    if (maxOff < 1e-13) break;
    const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
    const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(1 + theta * theta));
    const c = 1 / Math.sqrt(1 + t * t);
    const s = t * c;
    // Update symmetric A (only the p-th and q-th rows/cols change)
    for (let r = 0; r < n; r++) {
      if (r === p || r === q) continue;
      const Apr = A[p][r], Aqr = A[q][r];
      A[p][r] = A[r][p] = c * Apr - s * Aqr;
      A[q][r] = A[r][q] = s * Apr + c * Aqr;
    }
    const App = A[p][p], Aqq = A[q][q], Apq = A[p][q];
    A[p][p] = c * c * App - 2 * s * c * Apq + s * s * Aqq;
    A[q][q] = s * s * App + 2 * s * c * Apq + c * c * Aqq;
    A[p][q] = A[q][p] = 0;
    // Accumulate eigenvectors
    for (let r = 0; r < n; r++) {
      const Vrp = V[r][p], Vrq = V[r][q];
      V[r][p] = c * Vrp - s * Vrq;
      V[r][q] = s * Vrp + c * Vrq;
    }
  }
  return { vals: A.map((row, i) => row[i]), V };
}

export function svdDecompose(A: Mat): SVDResult {
  const n = A.length;
  if (n < 2) throw new Error('SVD барa матрица со n ≥ 2');
  const At = transpose(A);
  const AtA = matMul(At, A);

  // Use specialised closed-form solvers for 2×2 and 3×3 (faster, more accurate)
  // and the general Jacobi solver for n ≥ 4
  let vals: number[];
  let V: Mat;
  if (n === 2) {
    const r = symEigen2x2(AtA);
    vals = [...r.vals];
    V = transpose(r.vecs as Mat);  // vecs rows → V columns
  } else if (n === 3) {
    const r = symEigen3x3(AtA);
    vals = [...r.vals];
    V = transpose(r.vecs as Mat);
  } else {
    const r = symEigenNxN(AtA);
    vals = r.vals;
    V = r.V;
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => vals[b] - vals[a]);
  const S = order.map(i => Math.sqrt(Math.max(0, vals[i])));
  // Vt rows = V columns reordered
  const Vt: Mat = order.map(i => Array.from({ length: n }, (_, r) => V[r][i]));
  const Vmat = transpose(Vt);

  // U columns: u_i = A·v_i / σ_i
  const U: Mat = zeros(n, n);
  for (let i = 0; i < n; i++) {
    const v = Vmat.map(row => row[i]);
    const sigma = S[i];
    if (sigma > 1e-12) {
      const Av = A.map(row => row.reduce((acc, a, j) => acc + a * v[j], 0));
      for (let r = 0; r < n; r++) U[r][i] = Av[r] / sigma;
    } else {
      if (i < n) U[i][i] = 1;
    }
  }
  return { U, S, Vt };
}

// ─── S64-B: Matrix exponential ───────────────────────────────────────────────
// e^A via Padé-like truncated Taylor series (order 20, rescale-and-square)

export function matrixExp(A: Mat): Mat {
  const n = A.length;
  // Scaling: find s such that ||A/2^s||₁ ≤ 1
  const norm1 = A.reduce((mx, row) => Math.max(mx, row.reduce((s, v) => s + Math.abs(v), 0)), 0);
  const s = Math.max(0, Math.ceil(Math.log2(norm1 + 1)));
  const scale = Math.pow(2, -s);
  const As = matScalar(A, scale);

  // Taylor: E = Σ_{k=0}^{20} (As)^k / k!
  let E = identity(n);
  let term = identity(n);
  for (let k = 1; k <= 20; k++) {
    term = matScalar(matMul(term, As), 1 / k);
    E = matAdd(E, term);
    const termNorm = term.reduce((mx, row) => Math.max(mx, row.reduce((sm, v) => sm + Math.abs(v), 0)), 0);
    if (termNorm < 1e-15) break;
  }

  // Squaring: E = E^(2^s)
  for (let i = 0; i < s; i++) E = matMul(E, E);
  return E;
}

// ─── S64-C: Jordan normal form ────────────────────────────────────────────────

export interface JordanBlock {
  eigenvalue: number;
  size: number;      // block dimension
  isComplex?: boolean;
  complexIm?: number;
}

export interface JordanResult {
  J: Mat;
  P: Mat;            // similarity transform: A = P J P⁻¹ (when isValid)
  Pinv: Mat | null;
  blocks: JordanBlock[];
  isValid: boolean;
  reason?: string;
}

// ─── S64-F2 helpers: QR + null-space for general Jordan (n≥4) ────────────────

/** Gram-Schmidt QR decomposition — used only by jordanDecompose. */
function _qrGS(A: Mat): { Q: Mat; R: Mat } {
  const n = A.length;
  const qs: number[][] = [];
  const R: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    let v = A.map(row => row[j]);
    for (let i = 0; i < j; i++) {
      const rij = qs[i].reduce((s, q, k) => s + q * v[k], 0);
      R[i][j] = rij;
      v = v.map((x, k) => x - rij * qs[i][k]);
    }
    const nrm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    R[j][j] = nrm;
    qs.push(nrm > 1e-14 ? v.map(x => x / nrm) : Array.from({ length: n }, (_, k) => (k === j ? 1 : 0)));
  }
  return { Q: Array.from({ length: n }, (_, i) => qs.map(q => q[i])) as Mat, R: R as Mat };
}

/**
 * QR iteration (Rayleigh-shift) to compute real eigenvalues of an n×n matrix.
 * Returns sorted eigenvalues or null when complex eigenvalues are detected
 * (off-diagonal sub-diagonal entry remains large after iteration).
 */
function _qrEigenNxN(A: Mat, maxIter = 500): number[] | null {
  const n = A.length;
  let Ak = cloneMat(A);
  for (let iter = 0; iter < maxIter; iter++) {
    const mu = Ak[n - 1][n - 1];
    const As = Ak.map((row, i) => row.map((v, j) => v - (i === j ? mu : 0)));
    const { Q, R } = _qrGS(As);
    const RQ = matMul(R, Q);
    Ak = RQ.map((row, i) => row.map((v, j) => v + (i === j ? mu : 0)));
  }
  for (let i = 1; i < n; i++) {
    if (Math.abs(Ak[i][i - 1]) > 1e-4) return null;
  }
  return Array.from({ length: n }, (_, i) => Ak[i][i]);
}

/**
 * Compute a basis for null(M) via Gauss-Jordan with partial pivoting.
 * Returns an array of column vectors (each length = M[0].length).
 */
function _nullBasis(M: Mat, tol = 1e-8): number[][] {
  const nR = M.length, nC = M[0].length;
  const G = M.map(r => [...r]);
  const pivotCols: number[] = [];
  let pr = 0;
  for (let col = 0; col < nC && pr < nR; col++) {
    let maxV = tol, maxR = -1;
    for (let r = pr; r < nR; r++) {
      if (Math.abs(G[r][col]) > maxV) { maxV = Math.abs(G[r][col]); maxR = r; }
    }
    if (maxR === -1) continue;
    [G[pr], G[maxR]] = [G[maxR], G[pr]];
    const sc = G[pr][col];
    G[pr] = G[pr].map(x => x / sc);
    for (let r = 0; r < nR; r++) {
      if (r !== pr && Math.abs(G[r][col]) > tol) {
        const f = G[r][col];
        G[r] = G[r].map((x, j) => x - f * G[pr][j]);
      }
    }
    pivotCols.push(col);
    pr++;
  }
  const freeCols = Array.from({ length: nC }, (_, j) => j).filter(j => !pivotCols.includes(j));
  return freeCols.map(fj => {
    const v = new Array(nC).fill(0);
    v[fj] = 1;
    pivotCols.forEach((pc, pi) => { v[pc] = -(G[pi]?.[fj] ?? 0); });
    const nrm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    return nrm > 1e-14 ? v.map(x => x / nrm) : v;
  });
}

/**
 * Solve (A − λI)x = b via Gauss-Jordan on the augmented matrix.
 * Returns a particular solution or null if the system is inconsistent.
 * Free variables are set to 0.
 */
function _solveShifted(A: Mat, lam: number, b: number[]): number[] | null {
  const n = A.length;
  const G = A.map((row, i) => [...row.map((v, j) => v - (i === j ? lam : 0)), b[i]]);
  const pivotCols: number[] = [];
  let pr = 0;
  for (let col = 0; col < n && pr < n; col++) {
    let maxV = 1e-10, maxR = -1;
    for (let r = pr; r < n; r++) {
      if (Math.abs(G[r][col]) > maxV) { maxV = Math.abs(G[r][col]); maxR = r; }
    }
    if (maxR === -1) continue;
    [G[pr], G[maxR]] = [G[maxR], G[pr]];
    const sc = G[pr][col];
    G[pr] = G[pr].map(x => x / sc);
    for (let r = 0; r < n; r++) {
      if (r !== pr && Math.abs(G[r][col]) > 1e-10) {
        const f = G[r][col];
        G[r] = G[r].map((x, j) => x - f * G[pr][j]);
      }
    }
    pivotCols.push(col);
    pr++;
  }
  for (let r = pivotCols.length; r < n; r++) {
    if (Math.abs(G[r][n]) > 1e-6) return null;
  }
  const x = new Array(n).fill(0);
  pivotCols.forEach((pc, pi) => { x[pc] = G[pi][n]; });
  return x;
}

export function jordanDecompose(A: Mat): JordanResult {
  const n = A.length;
  const invalid = (reason: string): JordanResult =>
    ({ J: zeros(n,n), P: identity(n), Pinv: null, blocks: [], isValid: false, reason });

  if (n === 2) {
    const tr = A[0][0]+A[1][1], det = A[0][0]*A[1][1]-A[0][1]*A[1][0];
    const disc = tr*tr - 4*det;

    if (disc < -1e-8) {
      // Complex eigenvalues λ = (tr ± i√|disc|)/2 — real Jordan form as 2×2 rotation block
      const re = tr / 2, im = Math.sqrt(-disc) / 2;
      const J: Mat = [[re, -im], [im, re]];
      return { J, P: identity(2), Pinv: identity(2), blocks: [{ eigenvalue: re, size: 2, isComplex: true, complexIm: im }], isValid: true };
    }

    const sq = Math.sqrt(Math.max(0, disc));
    const l1 = (tr+sq)/2, l2 = (tr-sq)/2;

    if (Math.abs(disc) > 1e-8) {
      // Distinct eigenvalues — diagonal Jordan form
      const evec = (lam: number): [number, number] => {
        const b = A[0][1], c = A[1][0];
        let vx: number, vy: number;
        if (Math.abs(b) > 1e-9)      { vx = b; vy = lam - A[0][0]; }
        else if (Math.abs(c) > 1e-9) { vx = lam - A[1][1]; vy = c; }
        else                          { vx = 1; vy = 0; }
        const nrm = Math.hypot(vx, vy);
        return nrm > 1e-12 ? [vx/nrm, vy/nrm] : [1, 0];
      };
      const [v1x, v1y] = evec(l1), [v2x, v2y] = evec(l2);
      const P: Mat = [[v1x, v2x],[v1y, v2y]];
      const J: Mat = [[l1, 0],[0, l2]];
      return { J, P, Pinv: inverseAdjugate(P), blocks: [{ eigenvalue: l1, size: 1 },{ eigenvalue: l2, size: 1 }], isValid: true };
    }

    // Repeated eigenvalue λ — check geometric multiplicity
    const lam = tr / 2;
    const AmL = A.map((row, i) => row.map((v, j) => v - (i===j ? lam : 0)));
    const r = Math.max(Math.abs(AmL[0][0]), Math.abs(AmL[0][1]), Math.abs(AmL[1][0]), Math.abs(AmL[1][1]));
    if (r < 1e-8) {
      // λI — diagonal Jordan
      const J: Mat = [[lam, 0],[0, lam]];
      return { J, P: identity(2), Pinv: identity(2), blocks: [{ eigenvalue: lam, size: 1 },{ eigenvalue: lam, size: 1 }], isValid: true };
    }
    // Defective: 1 eigenvector, 1 generalized eigenvector
    // Find eigenvector v1 (null space of A-λI)
    let v1: [number, number] = [1, 0];
    if (Math.abs(AmL[0][0]) < Math.abs(AmL[0][1])) v1 = [-(AmL[0][1]), AmL[0][0]];
    else                                              v1 = [-(AmL[1][1]), AmL[1][0]];
    const nrm = Math.hypot(v1[0], v1[1]);
    if (nrm < 1e-12) v1 = [1, 0];
    else v1 = [v1[0]/nrm, v1[1]/nrm];
    // Generalized: (A-λI)v2 = v1 — pick non-zero entry to solve a one-equation system
    let v2: [number, number];
    if (Math.abs(AmL[0][1]) > 1e-9)      v2 = [0, v1[0] / AmL[0][1]];
    else if (Math.abs(AmL[0][0]) > 1e-9) v2 = [v1[0] / AmL[0][0], 0];
    else if (Math.abs(AmL[1][0]) > 1e-9) v2 = [0, v1[1] / AmL[1][0]];
    else                                   v2 = [0, v1[1] / (AmL[1][1] || 1e-9)];
    const P: Mat = [[v1[0], v2[0]],[v1[1], v2[1]]];
    const J: Mat = [[lam, 1],[0, lam]];
    return { J, P, Pinv: inverseAdjugate(P), blocks: [{ eigenvalue: lam, size: 2 }], isValid: true };
  }

  if (n === 3) {
    // Use QR iteration on A itself to get approximate eigenvalues
    let Ak = cloneMat(A);
    for (let i = 0; i < 100; i++) {
      const col = (j: number) => [Ak[0][j], Ak[1][j], Ak[2][j]];
      const qs: number[][] = [];
      const R: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
      for (let j = 0; j < 3; j++) {
        let v = col(j);
        for (let i2 = 0; i2 < j; i2++) {
          const rij = v[0]*qs[i2][0]+v[1]*qs[i2][1]+v[2]*qs[i2][2];
          R[i2][j] = rij;
          v = v.map((x, k) => x - rij * qs[i2][k]);
        }
        const nrm = Math.hypot(v[0], v[1], v[2]);
        R[j][j] = nrm;
        qs.push(nrm > 1e-14 ? v.map(x => x/nrm) : [+(j===0),+(j===1),+(j===2)]);
      }
      const Q: Mat = [[qs[0][0],qs[1][0],qs[2][0]],[qs[0][1],qs[1][1],qs[2][1]],[qs[0][2],qs[1][2],qs[2][2]]];
      Ak = matMul(R as Mat, Q);
    }
    const lams: [number,number,number] = [Ak[0][0], Ak[1][1], Ak[2][2]];

    // Check if all eigenvalues are distinct (no degeneracy)
    const allDistinct = Math.abs(lams[0]-lams[1]) > 1e-6 && Math.abs(lams[1]-lams[2]) > 1e-6 && Math.abs(lams[0]-lams[2]) > 1e-6;
    if (!allDistinct)
      return invalid('Повторени сопствени вредности за 3×3 — Jordanova форма е достапна само за S65+');

    const evec3 = (lam: number): [number,number,number] => {
      const B = A.map((row, i) => row.map((v, j) => v - (i===j ? lam : 0)));
      let best: [number,number,number] = [1,0,0], bestN = 0;
      for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) {
        const cp: [number,number,number] = [B[i][1]*B[j][2]-B[i][2]*B[j][1],B[i][2]*B[j][0]-B[i][0]*B[j][2],B[i][0]*B[j][1]-B[i][1]*B[j][0]];
        const n2 = Math.hypot(cp[0],cp[1],cp[2]);
        if (n2 > bestN) { best = cp; bestN = n2; }
      }
      const n2 = Math.hypot(best[0],best[1],best[2]);
      return n2 > 1e-14 ? [best[0]/n2,best[1]/n2,best[2]/n2] as [number,number,number] : [1,0,0];
    };
    const [v0, v1, v2] = [evec3(lams[0]), evec3(lams[1]), evec3(lams[2])];
    const P: Mat = [[v0[0],v1[0],v2[0]],[v0[1],v1[1],v2[1]],[v0[2],v1[2],v2[2]]];
    const J: Mat = [[lams[0],0,0],[0,lams[1],0],[0,0,lams[2]]];
    return {
      J, P, Pinv: inverseAdjugate(P),
      blocks: lams.map(l => ({ eigenvalue: l, size: 1 })),
      isValid: true,
    };
  }

  // ─── n ≥ 4: general real eigenvalue case (S64-F2) ────────────────────────
  const rawLams = _qrEigenNxN(A);
  if (!rawLams) return invalid('Комплексни сопствени вредности — Jordanova форма достапна само за реални λ');

  // Group eigenvalues by proximity (tol = 1e-4)
  const groups: Array<{ lam: number; algMult: number }> = [];
  for (const lam of rawLams) {
    const g = groups.find(gr => Math.abs(gr.lam - lam) < 1e-4);
    if (g) g.algMult++;
    else groups.push({ lam: Math.round(lam * 1e8) / 1e8, algMult: 1 });
  }

  // For each eigenvalue group, build Jordan chains
  const Pcols: number[][] = [];
  const blocks: JordanBlock[] = [];

  for (const { lam, algMult } of groups) {
    const AlamI = A.map((row, i) => row.map((v, j) => v - (i === j ? lam : 0)));
    const evecs = _nullBasis(AlamI);
    const geomMult = evecs.length;
    if (geomMult === 0) return invalid(`Числена грешка за λ=${lam.toFixed(4)}: null space е празен`);

    // Start one Jordan chain per eigenvector
    const chains: number[][] = evecs.map(v => [v].flat());
    // chains[k] = tip of k-th chain (current last generalized eigenvector)

    const chainFull: Array<number[][]> = evecs.map(v => [v]);

    let filled = geomMult;
    while (filled < algMult) {
      let extended = false;
      for (let k = 0; k < chainFull.length && filled < algMult; k++) {
        const tip = chainFull[k][chainFull[k].length - 1];
        const next = _solveShifted(A, lam, tip);
        if (next) {
          chainFull[k].push(next);
          filled++;
          extended = true;
        }
      }
      if (!extended) break;
    }

    for (const chain of chainFull) {
      for (const v of chain) Pcols.push(v);
      blocks.push({ eigenvalue: lam, size: chain.length });
    }
  }

  if (Pcols.length !== n) return invalid('Неповолна Jordan структура — матрицата може да има комплексни блокови');

  // Build J and P
  const J: Mat = zeros(n, n);
  const P: Mat = Array.from({ length: n }, (_, i) => Pcols.map(col => col[i]));
  let col = 0;
  for (const block of blocks) {
    for (let k = 0; k < block.size; k++) {
      J[col + k][col + k] = block.eigenvalue;
      if (k < block.size - 1) J[col + k][col + k + 1] = 1;
    }
    col += block.size;
  }

  return { J, P, Pinv: inverseAdjugate(P), blocks, isValid: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtNum(n: number, digits = 4): string {
  if (!isFinite(n)) return '—';
  if (Number.isInteger(n) || Math.abs(n) >= 1000) return n.toFixed(0);
  return parseFloat(n.toFixed(digits)).toString();
}

export function matFromFlat(flat: number[], n: number): Mat {
  return Array.from({ length: n }, (_, i) => flat.slice(i * n, i * n + n));
}

export function flatFromMat(m: Mat): number[] {
  return m.flat();
}
