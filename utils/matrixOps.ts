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
