import { describe, it, expect } from 'vitest';
import {
  toRad,
  toDeg,
  unitCirclePoint,
  sinWave,
  cosWave,
  tanWave,
  generateTrigSet,
} from './trigMath';
import { normalizeLabAnswer } from '../../types/labTypes';

describe('toRad / toDeg', () => {
  it('180 deg = π rad', () => {
    expect(toRad(180)).toBeCloseTo(Math.PI, 10);
  });
  it('90 deg = π/2 rad', () => {
    expect(toRad(90)).toBeCloseTo(Math.PI / 2, 10);
  });
  it('round-trips for a range of degree values', () => {
    for (const deg of [0, 15, 45, 60, 90, 123.4, 270, 359]) {
      expect(toDeg(toRad(deg))).toBeCloseTo(deg, 9);
    }
  });
});

describe('unitCirclePoint', () => {
  const cx = 100, cy = 100, r = 50;

  it('at 0° lands at (cx + r, cy)', () => {
    const p = unitCirclePoint(0, cx, cy, r);
    expect(p.x).toBeCloseTo(cx + r, 9);
    expect(p.y).toBeCloseTo(cy, 9);
    expect(p.sin).toBeCloseTo(0, 9);
    expect(p.cos).toBeCloseTo(1, 9);
  });

  it('at 90° lands at (cx, cy - r)', () => {
    const p = unitCirclePoint(90, cx, cy, r);
    expect(p.x).toBeCloseTo(cx, 9);
    expect(p.y).toBeCloseTo(cy - r, 9);
    expect(p.sin).toBeCloseTo(1, 9);
    expect(p.cos).toBeCloseTo(0, 9);
    expect(p.tan).toBeNull(); // cos ≈ 0 -> undefined tan
  });

  it('at 180° lands at (cx - r, cy)', () => {
    const p = unitCirclePoint(180, cx, cy, r);
    expect(p.x).toBeCloseTo(cx - r, 9);
    expect(p.y).toBeCloseTo(cy, 9);
  });

  it('at 270° lands at (cx, cy + r)', () => {
    const p = unitCirclePoint(270, cx, cy, r);
    expect(p.x).toBeCloseTo(cx, 9);
    expect(p.y).toBeCloseTo(cy + r, 9);
    expect(p.sin).toBeCloseTo(-1, 9);
    expect(p.cos).toBeCloseTo(0, 9);
    expect(p.tan).toBeNull();
  });

  it('x/y always match cx + cos*r, cy - sin*r for arbitrary angles', () => {
    for (const deg of [10, 47, 133, 200, 310]) {
      const p = unitCirclePoint(deg, cx, cy, r);
      expect(p.x).toBeCloseTo(cx + Math.cos(toRad(deg)) * r, 9);
      expect(p.y).toBeCloseTo(cy - Math.sin(toRad(deg)) * r, 9);
    }
  });
});

describe('sinWave / cosWave / tanWave — formula verification', () => {
  it('sinWave(x, A, B, C, D) = A*sin(B*x+C)+D', () => {
    const cases: Array<[number, number, number, number, number]> = [
      [0, 2, 1, 0, 3],
      [1, 3, 2, 0.5, -1],
      [Math.PI / 4, 1, 1, 0, 0],
    ];
    for (const [x, A, B, C, D] of cases) {
      expect(sinWave(x, A, B, C, D)).toBeCloseTo(A * Math.sin(B * x + C) + D, 9);
    }
  });

  it('cosWave(x, A, B, C, D) = A*cos(B*x+C)+D', () => {
    const cases: Array<[number, number, number, number, number]> = [
      [0, 2, 1, 0, 3],
      [1, 3, 2, 0.5, -1],
      [Math.PI / 3, 1, 1, 0, 0],
    ];
    for (const [x, A, B, C, D] of cases) {
      expect(cosWave(x, A, B, C, D)).toBeCloseTo(A * Math.cos(B * x + C) + D, 9);
    }
  });

  it('tanWave(x, A, B, C, D) = A*tan(B*x+C)+D for ordinary (finite) inputs', () => {
    const cases: Array<[number, number, number, number, number]> = [
      [0, 1, 1, 0, 0],
      [Math.PI / 4, 2, 1, 0, 1],
      [0.3, 1, 2, 0.1, -0.5],
    ];
    for (const [x, A, B, C, D] of cases) {
      expect(tanWave(x, A, B, C, D)).toBeCloseTo(A * Math.tan(B * x + C) + D, 9);
    }
  });

  it('near the asymptote (B*x+C == π/2) JS floating point still yields a large FINITE number, not null', () => {
    // Math.tan(Math.PI/2) does not equal Infinity in IEEE-754 double precision
    // (π/2 is not exactly representable), so tanWave's isFinite() guard does not
    // trigger here even though this is mathematically the asymptote.
    const result = tanWave(Math.PI / 2, 1, 1, 0, 0);
    expect(result).not.toBeNull();
    expect(Number.isFinite(result)).toBe(true);
    expect(Math.abs(result as number)).toBeGreaterThan(1e10);
  });

  it('returns null only when the underlying tan value is genuinely non-finite (e.g. x = Infinity)', () => {
    expect(tanWave(Infinity, 1, 1, 0, 0)).toBeNull();
  });
});

describe('generateTrigSet — pool checklist', () => {
  it('returns the requested count', () => {
    expect(generateTrigSet(1, 6)).toHaveLength(6);
    expect(generateTrigSet(2, 9)).toHaveLength(9);
    expect(generateTrigSet(3, 3)).toHaveLength(3);
  });

  it('assigns unique ids within a set', () => {
    const set = generateTrigSet(2, 12);
    const ids = new Set(set.map(e => e.id));
    expect(ids.size).toBe(set.length);
  });

  it('every exercise matches the requested difficulty tier', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateTrigSet(d, 9)) {
        expect(ex.difficulty).toBe(d);
      }
    }
  });

  it('every exercise has a hint, explanation, and curriculumRef', () => {
    for (const d of [1, 2, 3] as const) {
      for (const ex of generateTrigSet(d, 9)) {
        expect(ex.hint.length).toBeGreaterThan(0);
        expect(ex.explanation.length).toBeGreaterThan(0);
        expect(ex.curriculumRef.length).toBeGreaterThan(0);
      }
    }
  });

  it('multiple_choice exercises list the correctAnswer among their options', () => {
    // Run many iterations: option pools are built from randomly-shuffled fixed
    // arrays in some branches, so a rare mismatch would only show up statistically.
    for (let i = 0; i < 60; i++) {
      for (const d of [1, 2, 3] as const) {
        for (const ex of generateTrigSet(d, 9)) {
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
      for (const ex of generateTrigSet(d, 9)) {
        if (ex.type === 'numeric') {
          expect(normalizeLabAnswer(ex.correctAnswer, ex.correctAnswer)).toBe(true);
        }
      }
    }
  });

  // ── Domain-specific spot checks (independently re-derived) ────────────────

  // deg is drawn randomly from a small pool each call; loop enough sets that
  // a specific target angle reliably appears instead of relying on one draw.
  function findAcrossManySets(difficulty: 1 | 2 | 3, question: string) {
    let found: ReturnType<typeof generateTrigSet>[number] | undefined;
    for (let i = 0; i < 20 && !found; i++) {
      found = generateTrigSet(difficulty, 30).find(e => e.question === question);
    }
    return found;
  }

  it('sin(30°) = 1/2 when generated', () => {
    const ex = findAcrossManySets(1, 'sin(30°) = ?');
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe('1/2');
  });

  it('cos(60°) = 1/2 when generated', () => {
    const ex = findAcrossManySets(1, 'cos(60°) = ?');
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe('1/2');
  });

  it('tan(45°) = 1 when generated', () => {
    const found = findAcrossManySets(2, 'tan(45°) = ?');
    expect(found).toBeDefined();
    expect(found?.correctAnswer).toBe('1');
  });

  it('period of sin(2x) is π (T = 2π/B, B=2)', () => {
    const set = generateTrigSet(2, 60);
    const ex = set.find(e => e.question.includes('sin(2x)'));
    expect(ex).toBeDefined();
    expect(ex?.correctAnswer).toBe('π');
  });
});
