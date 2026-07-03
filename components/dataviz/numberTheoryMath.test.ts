import { describe, it, expect } from 'vitest';
import {
  isPrime,
  primeFactors,
  sieve,
  euclideanSteps,
  gcd,
  lcm,
  modTable,
  fibonacci,
  arithmeticSeq,
  geometricSeq,
  generateNumberTheorySet,
} from './numberTheoryMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('isPrime', () => {
  it('identifies known primes', () => {
    for (const p of [2, 3, 5, 7, 11, 13, 17, 19, 23, 97]) {
      expect(isPrime(p)).toBe(true);
    }
  });

  it('identifies known composites', () => {
    for (const c of [4, 6, 8, 9, 10, 15, 21, 25, 100]) {
      expect(isPrime(c)).toBe(false);
    }
  });

  it('handles edge cases: 0, 1, negative numbers', () => {
    expect(isPrime(0)).toBe(false);
    expect(isPrime(1)).toBe(false);
    expect(isPrime(-7)).toBe(false);
    expect(isPrime(-2)).toBe(false);
  });
});

describe('primeFactors', () => {
  it('factorizes 60 = 2^2 x 3 x 5', () => {
    expect(primeFactors(60)).toEqual([
      { base: 2, exp: 2 },
      { base: 3, exp: 1 },
      { base: 5, exp: 1 },
    ]);
  });

  it('factorizes a prime number as itself^1', () => {
    expect(primeFactors(17)).toEqual([{ base: 17, exp: 1 }]);
  });

  it('factorizes a power of a single prime', () => {
    expect(primeFactors(32)).toEqual([{ base: 2, exp: 5 }]);
  });

  it('returns empty array for n < 2', () => {
    expect(primeFactors(1)).toEqual([]);
    expect(primeFactors(0)).toEqual([]);
    expect(primeFactors(-5)).toEqual([]);
  });

  it('reconstructing the product of factors returns n', () => {
    for (const n of [60, 84, 90, 128, 997]) {
      const product = primeFactors(n).reduce((acc, f) => acc * Math.pow(f.base, f.exp), 1);
      expect(product).toBe(n);
    }
  });
});

describe('sieve', () => {
  it('agrees with isPrime for a small limit', () => {
    const limit = 50;
    const result = sieve(limit);
    for (let i = 0; i <= limit; i++) {
      expect(result[i]).toBe(isPrime(i));
    }
  });

  it('marks 0 and 1 as not prime', () => {
    const result = sieve(10);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
  });
});

describe('euclideanSteps', () => {
  it('computes correct steps for gcd(48, 18)', () => {
    const steps = euclideanSteps(48, 18);
    expect(steps).toEqual([
      { a: 48, b: 18, q: 2, r: 12 },
      { a: 18, b: 12, q: 1, r: 6 },
      { a: 12, b: 6, q: 2, r: 0 },
    ]);
    // last non-zero remainder is the gcd
    expect(steps[steps.length - 2].r).toBe(gcd(48, 18));
  });
});

describe('gcd', () => {
  it('computes gcd for hand-verifiable pairs', () => {
    expect(gcd(48, 18)).toBe(6);
    expect(gcd(12, 8)).toBe(4);
    expect(gcd(17, 5)).toBe(1);
    expect(gcd(100, 10)).toBe(10);
  });
});

describe('lcm', () => {
  it('computes lcm for hand-verifiable pairs', () => {
    expect(lcm(4, 6)).toBe(12);
    expect(lcm(3, 5)).toBe(15);
    expect(lcm(8, 12)).toBe(24);
    expect(lcm(7, 7)).toBe(7);
  });
});

describe('modTable', () => {
  it('builds correct addition table mod 4', () => {
    const table = modTable(4, 'add');
    expect(table).toEqual([
      [0, 1, 2, 3],
      [1, 2, 3, 0],
      [2, 3, 0, 1],
      [3, 0, 1, 2],
    ]);
  });

  it('builds correct multiplication table mod 4', () => {
    const table = modTable(4, 'mul');
    expect(table).toEqual([
      [0, 0, 0, 0],
      [0, 1, 2, 3],
      [0, 2, 0, 2],
      [0, 3, 2, 1],
    ]);
  });
});

describe('fibonacci', () => {
  it('generates the known sequence', () => {
    expect(fibonacci(10)).toEqual([1, 1, 2, 3, 5, 8, 13, 21, 34, 55]);
  });

  it('handles small n', () => {
    expect(fibonacci(0)).toEqual([]);
    expect(fibonacci(1)).toEqual([1]);
    expect(fibonacci(2)).toEqual([1, 1]);
  });
});

describe('arithmeticSeq', () => {
  it('computes known arithmetic sequences', () => {
    expect(arithmeticSeq(1, 2, 5)).toEqual([1, 3, 5, 7, 9]);
    expect(arithmeticSeq(0, 5, 4)).toEqual([0, 5, 10, 15]);
  });
});

describe('geometricSeq', () => {
  it('computes known geometric sequences', () => {
    expect(geometricSeq(1, 2, 5)).toEqual([1, 2, 4, 8, 16]);
    expect(geometricSeq(3, 3, 4)).toEqual([3, 9, 27, 81]);
  });
});

describe('generateNumberTheorySet', () => {
  it('returns the requested count', () => {
    for (const count of [3, 6, 9]) {
      expect(generateNumberTheorySet(1, count)).toHaveLength(count);
    }
  });

  it('assigns unique ids within a set', () => {
    const set = generateNumberTheorySet(2, 9);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      const set = generateNumberTheorySet(d, 9);
      for (const ex of set) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('produces varied questions across repeated calls (randomized content)', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orders.add(generateNumberTheorySet(1, 6).map(e => e.question).join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('every exercise has a non-empty hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateNumberTheorySet(d, 9)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    for (const d of [1, 2, 3] as const) {
      for (let i = 0; i < 10; i++) {
        for (const ex of generateNumberTheorySet(d, 9)) {
          if (ex.type === 'multiple_choice') {
            expect(ex.options).toBeDefined();
            expect(ex.options).toContain(ex.correctAnswer);
          }
        }
      }
    }
  });

  it('numeric exercises have a correctAnswer that self-validates via normalizeLabAnswer', () => {
    for (const d of [1, 2, 3] as const) {
      for (let i = 0; i < 10; i++) {
        for (const ex of generateNumberTheorySet(d, 9)) {
          if (ex.type === 'numeric') {
            expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
          }
        }
      }
    }
  });

  it('"is X prime?" question answer matches isPrime(X)', () => {
    for (let i = 0; i < 15; i++) {
      const set = generateNumberTheorySet(1, 6);
      const ex = set.find(e => e.question.startsWith('Дали'));
      if (!ex) continue;
      const match = ex.question.match(/Дали (\d+) е прост број\?/);
      expect(match).not.toBeNull();
      const n = Number(match![1]);
      expect(ex.correctAnswer).toBe(isPrime(n) ? 'Да' : 'Не');
    }
  });

  it('НЗД (gcd) question answer matches the gcd() function', () => {
    for (let i = 0; i < 15; i++) {
      const set = generateNumberTheorySet(1, 6);
      const ex = set.find(e => e.question.startsWith('НЗД'));
      if (!ex) continue;
      const match = ex.question.match(/НЗД\((\d+), (\d+)\)/);
      expect(match).not.toBeNull();
      const [a, b] = [Number(match![1]), Number(match![2])];
      expect(ex.correctAnswer).toBe(String(gcd(a, b)));
    }
  });

  it('НЗС (lcm) question answer matches the lcm() function', () => {
    for (let i = 0; i < 15; i++) {
      const set = generateNumberTheorySet(2, 6);
      const ex = set.find(e => e.question.startsWith('НЗС'));
      if (!ex) continue;
      const match = ex.question.match(/НЗС\((\d+), (\d+)\)/);
      expect(match).not.toBeNull();
      const [a, b] = [Number(match![1]), Number(match![2])];
      expect(ex.correctAnswer).toBe(String(lcm(a, b)));
    }
  });
});
