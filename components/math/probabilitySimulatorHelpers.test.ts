import { describe, it, expect } from 'vitest';
import {
  chiSquared, drawFromUrn, flipCoin, makeSeededRng, rollDie,
} from './probabilitySimulatorHelpers';

describe('probabilitySimulatorHelpers', () => {
  describe('flipCoin', () => {
    it('with p=1 always lands heads', () => {
      const r = flipCoin({ pHeads: 1 }, 20);
      expect(r.counts.H).toBe(20);
      expect(r.counts.T).toBe(0);
      expect(r.observed.H).toBe(1);
    });

    it('with p=0 always lands tails', () => {
      const r = flipCoin({ pHeads: 0 }, 10);
      expect(r.counts.T).toBe(10);
    });

    it('seeded RNG produces stable counts at p=0.5', () => {
      const rng = makeSeededRng(42);
      const r = flipCoin({ pHeads: 0.5 }, 100, rng);
      expect(r.counts.H + r.counts.T).toBe(100);
      // Mulberry32 with seed 42 over 100 trials lands in a sane window.
      expect(r.counts.H).toBeGreaterThan(30);
      expect(r.counts.H).toBeLessThan(70);
    });

    it('observed is 0 for n=0', () => {
      const r = flipCoin({ pHeads: 0.5 }, 0);
      expect(r.observed.H).toBe(0);
      expect(r.outcomes).toEqual([]);
    });
  });

  describe('rollDie', () => {
    it('all rolls are within [1, faces]', () => {
      const rng = makeSeededRng(7);
      const r = rollDie({ faces: 6 }, 200, rng);
      for (const f of r.outcomes) {
        expect(f).toBeGreaterThanOrEqual(1);
        expect(f).toBeLessThanOrEqual(6);
      }
    });

    it('counts sum to n', () => {
      const r = rollDie({ faces: 6 }, 50);
      const total = r.counts.slice(1).reduce((a, b) => a + b, 0);
      expect(total).toBe(50);
    });

    it('expected probability is uniform 1/faces', () => {
      const r = rollDie({ faces: 4 }, 0);
      expect(r.expected[1]).toBeCloseTo(0.25);
      expect(r.expected[4]).toBeCloseTo(0.25);
    });
  });

  describe('drawFromUrn', () => {
    it('without replacement caps draws at bag size', () => {
      const r = drawFromUrn({ composition: { red: 2, blue: 3 }, withReplacement: false }, 10);
      expect(r.draws.length).toBe(5);
      expect(r.counts.red + r.counts.blue).toBe(5);
    });

    it('with replacement draws exactly n', () => {
      const r = drawFromUrn({ composition: { red: 1, blue: 1 }, withReplacement: true }, 20);
      expect(r.draws.length).toBe(20);
    });

    it('expected probabilities match composition ratios', () => {
      const r = drawFromUrn({ composition: { red: 3, blue: 1 } }, 0);
      expect(r.expected.red).toBeCloseTo(0.75);
      expect(r.expected.blue).toBeCloseTo(0.25);
    });

    it('handles empty composition gracefully', () => {
      const r = drawFromUrn({ composition: { red: 0 } }, 5);
      expect(r.draws).toEqual([]);
      expect(r.counts.red).toBe(0);
    });
  });

  describe('chiSquared', () => {
    it('returns 0 when observed exactly matches expected', () => {
      const chi = chiSquared([10, 10, 10], [1 / 3, 1 / 3, 1 / 3], 30);
      expect(chi).toBeCloseTo(0, 6);
    });

    it('returns positive for skewed observed', () => {
      const chi = chiSquared([20, 5, 5], [1 / 3, 1 / 3, 1 / 3], 30);
      expect(chi).toBeGreaterThan(0);
    });

    it('skips zero-expected cells', () => {
      const chi = chiSquared([5, 0, 0], [1, 0, 0], 5);
      expect(chi).toBe(0);
    });
  });
});
