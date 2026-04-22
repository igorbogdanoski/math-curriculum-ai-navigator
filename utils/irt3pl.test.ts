import { describe, it, expect } from 'vitest';
import {
  probCorrect3PL, updateThetaMLE, pickNextItem,
  thetaToLevel, percentageToInitialTheta, type ItemParams,
} from './irt3pl';

const easyMc: ItemParams = { a: 1, b: -1, c: 0.25 };
const medMc:  ItemParams = { a: 1, b:  0, c: 0.25 };
const hardMc: ItemParams = { a: 1, b:  1.5, c: 0.25 };
const open:   ItemParams = { a: 1, b: 0, c: 0 };

describe('IRT 3-PL — probCorrect3PL', () => {
  it('returns ~c when θ ≪ b (very low ability)', () => {
    expect(probCorrect3PL(-5, medMc)).toBeCloseTo(0.25, 1);
  });

  it('returns ~1 when θ ≫ b (very high ability)', () => {
    expect(probCorrect3PL(5, medMc)).toBeGreaterThan(0.99);
  });

  it('is monotone increasing in θ', () => {
    const ps = [-2, -1, 0, 1, 2].map(t => probCorrect3PL(t, medMc));
    for (let i = 1; i < ps.length; i++) expect(ps[i]).toBeGreaterThan(ps[i-1]);
  });

  it('floor equals c for free-response (c=0)', () => {
    expect(probCorrect3PL(-5, open)).toBeLessThan(0.01);
  });
});

describe('IRT 3-PL — updateThetaMLE', () => {
  it('increases θ on correct answer', () => {
    const next = updateThetaMLE(0, medMc, true);
    expect(next).toBeGreaterThan(0);
  });

  it('decreases θ on wrong answer', () => {
    const next = updateThetaMLE(0, medMc, false);
    expect(next).toBeLessThan(0);
  });

  it('clips θ to [-3, +3]', () => {
    const veryHigh = updateThetaMLE(2.95, hardMc, true, { learningRate: 5 });
    const veryLow  = updateThetaMLE(-2.95, easyMc, false, { learningRate: 5 });
    expect(veryHigh).toBeLessThanOrEqual(3);
    expect(veryLow).toBeGreaterThanOrEqual(-3);
  });

  it('converges toward true ability after many updates', () => {
    let theta = 0;
    // Simulate a student whose true ability is ~1.5 — should answer hard items right ~70%
    for (let i = 0; i < 30; i++) {
      const correct = Math.random() < probCorrect3PL(1.5, hardMc);
      theta = updateThetaMLE(theta, hardMc, correct);
    }
    expect(theta).toBeGreaterThan(0);
  });
});

describe('IRT 3-PL — pickNextItem', () => {
  it('returns undefined for empty pool', () => {
    expect(pickNextItem(0, [])).toBeUndefined();
  });

  it('picks the medium item near θ=0 (max info)', () => {
    expect(pickNextItem(0, [easyMc, medMc, hardMc])).toBe(medMc);
  });

  it('picks the hard item for high-ability student', () => {
    expect(pickNextItem(1.6, [easyMc, medMc, hardMc])).toBe(hardMc);
  });
});

describe('IRT 3-PL — bucket mapping', () => {
  it('thetaToLevel buckets', () => {
    expect(thetaToLevel(-1)).toBe('support');
    expect(thetaToLevel(0)).toBe('standard');
    expect(thetaToLevel(1.2)).toBe('advanced');
  });

  it('percentageToInitialTheta is monotone & centred at 50%', () => {
    expect(percentageToInitialTheta(50)).toBe(0);
    expect(percentageToInitialTheta(0)).toBe(-2);
    expect(percentageToInitialTheta(100)).toBe(2);
    expect(percentageToInitialTheta(-50)).toBe(-2);
    expect(percentageToInitialTheta(150)).toBe(2);
  });
});
