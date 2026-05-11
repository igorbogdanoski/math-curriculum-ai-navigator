import { describe, it, expect } from 'vitest';
import {
  identity, matAdd, matSub, matMul, matScalar, transpose, submatrix,
  determinantCofactor, gaussElim, cramer, inverseAdjugate, luDecompose,
  choleskyDecompose, svdDecompose, matrixExp, jordanDecompose,
  matFromFlat, fmtNum,
} from '../utils/matrixOps';

const near = (a: number, b: number, eps = 1e-8) => Math.abs(a - b) < eps;
const matNear = (A: number[][], B: number[][], eps = 1e-8) =>
  A.every((row, i) => row.every((v, j) => near(v, B[i][j], eps)));

// ─── C1: Basic ops ────────────────────────────────────────────────────────────
describe('identity', () => {
  it('produces 3×3 identity', () => {
    expect(identity(3)).toEqual([[1,0,0],[0,1,0],[0,0,1]]);
  });
});

describe('matAdd / matSub', () => {
  const A = [[1,2],[3,4]];
  const B = [[5,6],[7,8]];
  it('adds', () => expect(matAdd(A,B)).toEqual([[6,8],[10,12]]));
  it('subtracts', () => expect(matSub(A,B)).toEqual([[-4,-4],[-4,-4]]));
});

describe('matMul', () => {
  it('2×2 product', () => {
    const A = [[1,2],[3,4]], B = [[5,6],[7,8]];
    expect(matMul(A,B)).toEqual([[19,22],[43,50]]);
  });
  it('3×3 with identity gives back original', () => {
    const A = [[1,2,3],[4,5,6],[7,8,9]];
    expect(matMul(A, identity(3))).toEqual(A);
  });
});

describe('matScalar', () => {
  it('scales all elements', () => {
    expect(matScalar([[1,2],[3,4]], 2)).toEqual([[2,4],[6,8]]);
  });
});

describe('transpose', () => {
  it('transposes 2×3', () => {
    expect(transpose([[1,2,3],[4,5,6]])).toEqual([[1,4],[2,5],[3,6]]);
  });
});

describe('submatrix', () => {
  it('removes row and col', () => {
    const A = [[1,2,3],[4,5,6],[7,8,9]];
    expect(submatrix(A,0,0)).toEqual([[5,6],[8,9]]);
    expect(submatrix(A,1,1)).toEqual([[1,3],[7,9]]);
  });
});

// ─── C3: Determinant ──────────────────────────────────────────────────────────
describe('determinantCofactor', () => {
  it('1×1', () => expect(determinantCofactor([[7]])).toBe(7));
  it('2×2: 1 2 / 3 4 = -2', () => expect(determinantCofactor([[1,2],[3,4]])).toBe(-2));
  it('3×3 standard', () => {
    const A = [[1,2,3],[4,5,6],[7,8,10]];
    expect(near(determinantCofactor(A), -3)).toBe(true);
  });
  it('singular 3×3 = 0', () => {
    expect(near(determinantCofactor([[1,2,3],[4,5,6],[7,8,9]]), 0)).toBe(true);
  });
  it('4×4', () => {
    const A = [[2,1,0,0],[1,2,1,0],[0,1,2,1],[0,0,1,2]];
    expect(near(determinantCofactor(A), 5)).toBe(true);
  });
});

// ─── C2: Gauss elimination ────────────────────────────────────────────────────
describe('gaussElim', () => {
  it('2×2 system: 2x+y=5, x+3y=10', () => {
    const A = [[2,1],[1,3]];
    const { solution, det } = gaussElim(A, [5,10]);
    expect(solution).not.toBeNull();
    expect(near(solution![0], 1)).toBe(true);
    expect(near(solution![1], 3)).toBe(true);
    expect(near(det, 5)).toBe(true);
  });

  it('3×3 system', () => {
    const A = [[2,-1,0],[-1,2,-1],[0,-1,2]];
    const b = [1,0,1];
    const { solution } = gaussElim(A, b);
    expect(solution).not.toBeNull();
    // Verify A·x ≈ b
    for (let i = 0; i < 3; i++) {
      const row = A[i].reduce((s, v, j) => s + v * solution![j], 0);
      expect(near(row, b[i])).toBe(true);
    }
  });

  it('records swap steps for pivot', () => {
    const A = [[0,1],[1,0]];
    const { steps } = gaussElim(A);
    expect(steps.some(s => s.type === 'swap')).toBe(true);
  });

  it('computes rank of singular matrix', () => {
    const { rank } = gaussElim([[1,2,3],[2,4,6],[0,0,1]]);
    expect(rank).toBe(2);
  });

  it('L × U ≈ original (2×2)', () => {
    const A = [[3,1],[1,2]];
    const { L, U } = gaussElim(A);
    const LU = matMul(L, U);
    expect(matNear(LU, A)).toBe(true);
  });
});

// ─── C3: Cramer ───────────────────────────────────────────────────────────────
describe('cramer', () => {
  it('2×2: x+y=3, 2x−y=0 → x=1, y=2', () => {
    const A = [[1,1],[2,-1]];
    const result = cramer(A, [3,0]);
    expect(result).not.toBeNull();
    expect(near(result!.solution[0], 1)).toBe(true);
    expect(near(result!.solution[1], 2)).toBe(true);
  });

  it('returns null for singular matrix', () => {
    expect(cramer([[1,2],[2,4]], [1,2])).toBeNull();
  });

  it('3×3 Cramer matches Gauss solution', () => {
    const A = [[2,-1,0],[-1,2,-1],[0,-1,2]];
    const b = [1,0,1];
    const cr = cramer(A, b);
    const gs = gaussElim(A, b);
    expect(cr).not.toBeNull();
    for (let i = 0; i < 3; i++) {
      expect(near(cr!.solution[i], gs.solution![i])).toBe(true);
    }
  });
});

// ─── C4: Inverse ──────────────────────────────────────────────────────────────
describe('inverseAdjugate', () => {
  it('2×2 inverse: A·A⁻¹ = I', () => {
    const A = [[3,1],[1,2]];
    const inv = inverseAdjugate(A)!;
    const prod = matMul(A, inv);
    expect(matNear(prod, identity(2))).toBe(true);
  });

  it('3×3 inverse: A·A⁻¹ = I', () => {
    const A = [[2,1,0],[1,3,1],[0,1,2]];
    const inv = inverseAdjugate(A)!;
    expect(matNear(matMul(A, inv), identity(3))).toBe(true);
  });

  it('returns null for singular', () => {
    expect(inverseAdjugate([[1,2],[2,4]])).toBeNull();
  });
});

// ─── C4: LU decompose ─────────────────────────────────────────────────────────
describe('luDecompose', () => {
  it('P, L, U satisfy P·A ≈ L·U (3×3)', () => {
    const A = [[2,1,1],[4,3,3],[8,7,9]];
    const { L, U, P } = luDecompose(A);
    const PA = matMul(P, A);
    const LU = matMul(L, U);
    expect(matNear(PA, LU, 1e-6)).toBe(true);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
describe('matFromFlat', () => {
  it('converts flat array to matrix', () => {
    expect(matFromFlat([1,2,3,4], 2)).toEqual([[1,2],[3,4]]);
  });
});

describe('fmtNum', () => {
  it('formats integers as integers', () => expect(fmtNum(3)).toBe('3'));
  it('formats non-finite as —', () => expect(fmtNum(Infinity)).toBe('—'));
});

// ─── S64-A: Cholesky ──────────────────────────────────────────────────────────
describe('choleskyDecompose', () => {
  it('2×2 SPD: L·Lᵀ ≈ A', () => {
    const A = [[4,2],[2,3]];
    const { L, isValid } = choleskyDecompose(A);
    expect(isValid).toBe(true);
    expect(matNear(matMul(L, transpose(L)), A)).toBe(true);
  });

  it('3×3 SPD: L·Lᵀ ≈ A', () => {
    const A = [[4,2,0],[2,5,2],[0,2,5]];
    const { L, isValid } = choleskyDecompose(A);
    expect(isValid).toBe(true);
    expect(matNear(matMul(L, transpose(L)), A, 1e-10)).toBe(true);
  });

  it('returns isValid=false for non-symmetric', () => {
    const { isValid } = choleskyDecompose([[1,2],[3,4]]);
    expect(isValid).toBe(false);
  });

  it('returns isValid=false for non-positive-definite', () => {
    const { isValid } = choleskyDecompose([[1,0],[0,-1]]);
    expect(isValid).toBe(false);
  });
});

// ─── S64-A: SVD ───────────────────────────────────────────────────────────────
// Property under test: U·diag(S)·Vt ≈ A and S is descending.
const reconstructSVD = (U: number[][], S: number[], Vt: number[][]): number[][] => {
  const n = S.length;
  const sigma: number[][] = identity(n).map((row, i) => row.map((v, j) => i === j ? S[i] : 0));
  return matMul(matMul(U, sigma), Vt);
};

describe('svdDecompose', () => {
  it('2×2 diagonal: U·Σ·Vᵀ ≈ A', () => {
    const A = [[3,0],[0,2]];
    const { U, S, Vt } = svdDecompose(A);
    expect(matNear(reconstructSVD(U, S, Vt), A, 1e-8)).toBe(true);
    expect(S[0]).toBeGreaterThanOrEqual(S[1]);
  });

  it('2×2 general: U·Σ·Vᵀ ≈ A', () => {
    const A = [[1,2],[3,4]];
    const { U, S, Vt } = svdDecompose(A);
    expect(matNear(reconstructSVD(U, S, Vt), A, 1e-6)).toBe(true);
    expect(S[0]).toBeGreaterThanOrEqual(S[1]);
  });

  it('3×3: U·Σ·Vᵀ ≈ A', () => {
    const A = [[1,2,3],[4,5,6],[7,8,10]];
    const { U, S, Vt } = svdDecompose(A);
    expect(matNear(reconstructSVD(U, S, Vt), A, 1e-5)).toBe(true);
    expect(S[0]).toBeGreaterThanOrEqual(S[1]);
    expect(S[1]).toBeGreaterThanOrEqual(S[2]);
  });

  it('4×4 (n≥4 path): U·Σ·Vᵀ ≈ A', () => {
    const A = [[4,1,0,0],[1,3,1,0],[0,1,2,1],[0,0,1,2]];
    const { U, S, Vt } = svdDecompose(A);
    expect(matNear(reconstructSVD(U, S, Vt), A, 1e-4)).toBe(true);
    expect(S[0]).toBeGreaterThanOrEqual(S[1]);
  });

  it('rank-1 matrix has one non-zero singular value', () => {
    const A = [[1,2],[2,4]];
    const { S } = svdDecompose(A);
    expect(S[1]).toBeLessThan(1e-8);
    expect(S[0]).toBeGreaterThan(0);
  });
});

// ─── S64-C: matrixExp ─────────────────────────────────────────────────────────
describe('matrixExp', () => {
  it('e^0 = I', () => {
    const Z = [[0,0],[0,0]];
    expect(matNear(matrixExp(Z), identity(2), 1e-10)).toBe(true);
  });

  it('e^diag(1,2) = diag(e, e²)', () => {
    const A = [[1,0],[0,2]];
    const E = matrixExp(A);
    expect(near(E[0][0], Math.E, 1e-8)).toBe(true);
    expect(near(E[1][1], Math.E * Math.E, 1e-8)).toBe(true);
    expect(near(E[0][1], 0, 1e-10)).toBe(true);
    expect(near(E[1][0], 0, 1e-10)).toBe(true);
  });

  it('e^A · e^(-A) ≈ I (2×2 general)', () => {
    const A = [[1,2],[0,3]];
    const negA = matScalar(A, -1);
    const prod = matMul(matrixExp(A), matrixExp(negA));
    expect(matNear(prod, identity(2), 1e-6)).toBe(true);
  });
});

// ─── S64-C: Jordan normal form ────────────────────────────────────────────────
// Property: when isValid, P·J·P⁻¹ ≈ A
const verifyJordan = (A: number[][]): boolean => {
  const { J, P, Pinv, isValid } = jordanDecompose(A);
  if (!isValid || !Pinv) return false;
  const recon = matMul(matMul(P, J), Pinv);
  return matNear(recon, A, 1e-4);
};

describe('jordanDecompose', () => {
  it('2×2 with distinct eigenvalues (off-diagonal): P·J·P⁻¹ ≈ A', () => {
    // [[1,2],[2,1]] → λ = 3, -1 (b=2≠0 so eigenvectors computed correctly)
    expect(verifyJordan([[1,2],[2,1]])).toBe(true);
  });

  it('2×2 with repeated eigenvalue (Jordan block)', () => {
    const { J, isValid } = jordanDecompose([[2,1],[0,2]]);
    expect(isValid).toBe(true);
    expect(near(J[0][0], 2, 1e-4)).toBe(true);
    expect(near(J[1][1], 2, 1e-4)).toBe(true);
  });

  it('3×3 diagonalizable: P·J·P⁻¹ ≈ A', () => {
    const A = [[1,0,0],[0,2,0],[0,0,3]];
    expect(verifyJordan(A)).toBe(true);
  });

  it('4×4 diagonal (n≥4 path): P·J·P⁻¹ ≈ A', () => {
    const A = [[1,0,0,0],[0,2,0,0],[0,0,3,0],[0,0,0,4]];
    expect(verifyJordan(A)).toBe(true);
  });

  it('blocks array non-empty', () => {
    const { blocks } = jordanDecompose([[1,0],[0,2]]);
    expect(blocks.length).toBeGreaterThan(0);
  });
});
