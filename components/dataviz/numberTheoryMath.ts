// Pure math utilities for NumberTheoryLab
import type { LabExercise } from '../../types/labTypes';

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

export interface SieveStep {
  prime: number;
  /** Multiples of `prime` newly marked non-prime at this step (excludes numbers already
   *  crossed out by an earlier, smaller prime). */
  crossedOut: number[];
}

/** Same algorithm as sieve(), but records one step per prime found, capturing exactly
 *  which multiples it newly eliminates — for an animated step-by-step reveal. */
export function sieveSteps(limit: number): SieveStep[] {
  const isP = new Array(limit + 1).fill(true);
  isP[0] = isP[1] = false;
  const steps: SieveStep[] = [];
  for (let i = 2; i * i <= limit; i++) {
    if (!isP[i]) continue;
    const crossedOut: number[] = [];
    for (let j = i * i; j <= limit; j += i) {
      if (isP[j]) {
        isP[j] = false;
        crossedOut.push(j);
      }
    }
    steps.push({ prime: i, crossedOut });
  }
  return steps;
}

/** Places `rank` (0-indexed) of `total` points evenly around a circle, rank 0 at
 *  12-o'clock, going clockwise. Shared by the modular-arithmetic clock and the radial
 *  sieve view. */
export function radialPos(rank: number, total: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const angle = (2 * Math.PI * rank) / total - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
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

// ─── Lab exercise generator ───────────────────────────────────────────────────

function ntRand(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function factStr(n: number): string {
  const f = primeFactors(n);
  return f.length ? f.map(p => p.exp > 1 ? `${p.base}^${p.exp}` : `${p.base}`).join(' × ') : '1';
}

/** Generates number-theory exercises for use with useLabSession. */
export function generateNumberTheorySet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const exs: LabExercise[] = [];

  for (let i = 0; i < count; i++) {
    const id = `nt-${difficulty}-${i}`;
    const qType = i % 3;

    if (difficulty === 1) {
      if (qType === 0) {
        // Is X prime?
        const primes   = [5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
        const composit = [9, 15, 21, 25, 27, 35, 39, 49, 51, 55];
        const useP = Math.random() > 0.5;
        const n = useP ? primes[ntRand(0, primes.length - 1)] : composit[ntRand(0, composit.length - 1)];
        exs.push({
          id,
          question: `Дали ${n} е прост број?`,
          type: 'multiple_choice',
          options: ['Да', 'Не'],
          correctAnswer: isPrime(n) ? 'Да' : 'Не',
          hint: `Провери дали ${n} се дели со прост број до √${n} ≈ ${Math.sqrt(n).toFixed(1)}.`,
          explanation: isPrime(n)
            ? `${n} е прост — нема делители освен 1 и самиот себе.`
            : `${n} = ${factStr(n)} → составен број.`,
          difficulty: 1, curriculumRef: 'МОН V–VI одд.',
        });
      } else if (qType === 1) {
        // GCD small numbers
        const factor = ntRand(2, 5);
        const a = factor * ntRand(2, 6);
        const b = factor * ntRand(2, 6);
        const g = gcd(a, b);
        exs.push({
          id,
          question: `НЗД(${a}, ${b}) = ?`,
          type: 'numeric',
          correctAnswer: String(g),
          hint: `Разложи: ${a} = ${factStr(a)}, ${b} = ${factStr(b)}. Земи ги заедничките множители.`,
          explanation: `НЗД(${a}, ${b}) = ${g}`,
          difficulty: 1, curriculumRef: 'МОН V–VI одд.',
        });
      } else {
        // Next Fibonacci term (positions 3–8)
        const pos = ntRand(3, 8);
        const fibFull = fibonacci(pos + 1);
        const shown = fibFull.slice(pos - 3, pos);
        const next  = fibFull[pos];
        exs.push({
          id,
          question: `Фибоначи низа: ${shown.join(', ')}, __?`,
          type: 'numeric',
          correctAnswer: String(next),
          hint: `Секој член е збир на двата претходни: ${shown[1]} + ${shown[2]} = ?`,
          explanation: `${shown[1]} + ${shown[2]} = ${next}`,
          difficulty: 1, curriculumRef: 'МОН VII–IX одд.',
        });
      }
    } else if (difficulty === 2) {
      if (qType === 0) {
        // LCM
        const a = ntRand(4, 12);
        const b = ntRand(4, 12);
        const l = lcm(a, b);
        const g = gcd(a, b);
        exs.push({
          id,
          question: `НЗС(${a}, ${b}) = ?`,
          type: 'numeric',
          correctAnswer: String(l),
          hint: `НЗС = (a × b) / НЗД = (${a} × ${b}) / ${g} = ${a * b} / ${g}.`,
          explanation: `НЗС(${a}, ${b}) = ${a * b} / ${g} = ${l}`,
          difficulty: 2, curriculumRef: 'МОН V–VI одд.',
        });
      } else if (qType === 1) {
        // a + b mod m
        const m = ntRand(5, 11);
        const a = ntRand(0, m - 1);
        const b = ntRand(0, m - 1);
        const res = (a + b) % m;
        exs.push({
          id,
          question: `${a} + ${b} ≡ ? (mod ${m})`,
          type: 'numeric',
          correctAnswer: String(res),
          hint: `Собери: ${a + b}. Потоа: ${a + b} = ${Math.floor((a + b) / m)}×${m} + ${res}.`,
          explanation: `${a} + ${b} = ${a + b} ≡ ${res} (mod ${m})`,
          difficulty: 2, curriculumRef: 'Гимн. X',
        });
      } else {
        // Arithmetic sequence n-th term
        const a1 = ntRand(1, 8);
        const d  = ntRand(2, 7);
        const n  = ntRand(5, 10);
        const an = a1 + (n - 1) * d;
        exs.push({
          id,
          question: `Аритметичка низа: a₁=${a1}, d=${d}. Колку е a₍${n}₎?`,
          type: 'numeric',
          correctAnswer: String(an),
          hint: `aₙ = a₁ + (n−1)·d = ${a1} + (${n}−1)·${d}`,
          explanation: `a₍${n}₎ = ${a1} + ${n - 1}·${d} = ${a1} + ${(n - 1) * d} = ${an}`,
          difficulty: 2, curriculumRef: 'МОН IX одд.',
        });
      }
    } else {
      // difficulty 3
      if (qType === 0) {
        // a × b mod m
        const m = ntRand(5, 13);
        const a = ntRand(2, m - 1);
        const b = ntRand(2, m - 1);
        const res = (a * b) % m;
        exs.push({
          id,
          question: `${a} × ${b} ≡ ? (mod ${m})`,
          type: 'numeric',
          correctAnswer: String(res),
          hint: `${a} × ${b} = ${a * b}. Потоа: ${a * b} mod ${m} = ?`,
          explanation: `${a} × ${b} = ${a * b} = ${Math.floor(a * b / m)}×${m} + ${res} ≡ ${res} (mod ${m})`,
          difficulty: 3, curriculumRef: 'Гимн. X',
        });
      } else if (qType === 1) {
        // Geometric sequence n-th term
        const a1 = ntRand(1, 4);
        const r  = ntRand(2, 3);
        const n  = ntRand(4, 6);
        const an = a1 * Math.pow(r, n - 1);
        exs.push({
          id,
          question: `Геометриска низа: a₁=${a1}, r=${r}. Колку е a₍${n}₎?`,
          type: 'numeric',
          correctAnswer: String(an),
          hint: `aₙ = a₁ × r^(n−1) = ${a1} × ${r}^${n - 1}`,
          explanation: `a₍${n}₎ = ${a1} × ${r}^${n - 1} = ${a1} × ${Math.pow(r, n - 1)} = ${an}`,
          difficulty: 3, curriculumRef: 'МОН IX одд.',
        });
      } else {
        // Prime factorization — multiple choice (curated composites)
        const pool = [12, 18, 20, 24, 28, 30, 36, 40, 42, 45, 48, 50, 54, 56, 60];
        const idx = ntRand(0, pool.length - 1);
        const n   = pool[idx];
        const correct = factStr(n);
        const opt1 = factStr(pool[(idx + 1) % pool.length]);
        const opt2 = factStr(pool[(idx + 2) % pool.length]);
        const options = [correct, opt1, opt2].filter((o, i, a) => a.indexOf(o) === i).slice(0, 3);
        if (!options.includes(correct)) options[0] = correct;
        exs.push({
          id,
          question: `Разложи ${n} на прости множители:`,
          type: 'multiple_choice',
          options: [...options].sort(() => Math.random() - 0.5),
          correctAnswer: correct,
          hint: `Почни со наjмалиот прост делител на ${n}.`,
          explanation: `${n} = ${correct}`,
          difficulty: 3, curriculumRef: 'МОН VI–VII одд.',
        });
      }
    }
  }
  return exs;
}
