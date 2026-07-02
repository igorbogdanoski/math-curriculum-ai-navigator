// Pure math utilities for NumberTheoryLab

export interface CurriculumRef {
  primary?: string[];
  gymnasium?: string[];
}

export const NUMTHEORY_CURRICULUM: CurriculumRef = {
  primary: ['5', '6', '7', '8', '9'],
  gymnasium: ['X', 'XI'],
};

// ── Primality & Factorization ──────────────────────────────────────────────────

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

export interface PrimeFactor {
  base: number;
  exp: number;
}

export function primeFactors(n: number): PrimeFactor[] {
  if (n < 2) return [];
  const factors: PrimeFactor[] = [];
  let remaining = n;
  let d = 2;
  while (d * d <= remaining) {
    if (remaining % d === 0) {
      let exp = 0;
      while (remaining % d === 0) { exp++; remaining = Math.floor(remaining / d); }
      factors.push({ base: d, exp });
    }
    d++;
  }
  if (remaining > 1) factors.push({ base: remaining, exp: 1 });
  return factors;
}

// Returns isP[i] = true iff i is prime, for 0 <= i <= limit
export function sieve(limit: number): boolean[] {
  const isP = new Array(limit + 1).fill(true);
  isP[0] = isP[1] = false;
  for (let i = 2; i * i <= limit; i++) {
    if (isP[i]) {
      for (let j = i * i; j <= limit; j += i) isP[j] = false;
    }
  }
  return isP;
}

// ── GCD / LCM ────────────────────────────────────────────────────────────────

export interface EuclidStep {
  a: number;
  b: number;
  q: number;
  r: number;
}

export function euclideanSteps(a: number, b: number): EuclidStep[] {
  const steps: EuclidStep[] = [];
  while (b > 0) {
    const q = Math.floor(a / b);
    const r = a % b;
    steps.push({ a, b, q, r });
    a = b;
    b = r;
  }
  return steps;
}

export function gcd(a: number, b: number): number {
  while (b > 0) { const t = b; b = a % b; a = t; }
  return a;
}

export function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

// ── Modular arithmetic ────────────────────────────────────────────────────────

export function modTable(m: number, op: 'add' | 'mul'): number[][] {
  const table: number[][] = [];
  for (let i = 0; i < m; i++) {
    table.push([]);
    for (let j = 0; j < m; j++) {
      table[i].push(op === 'add' ? (i + j) % m : (i * j) % m);
    }
  }
  return table;
}

// ── Sequences ─────────────────────────────────────────────────────────────────

export function fibonacci(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [1];
  const seq = [1, 1];
  while (seq.length < n) seq.push(seq[seq.length - 1] + seq[seq.length - 2]);
  return seq;
}

export function arithmeticSeq(a1: number, d: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => a1 + i * d);
}

export function geometricSeq(a1: number, r: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => a1 * Math.pow(r, i));
}
