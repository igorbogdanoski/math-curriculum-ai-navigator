/**
 * Pure helpers for ProbabilitySimulator (T4.2).
 *
 * Three experiment kinds: coin (Bernoulli), die (uniform discrete), urn (sample
 * with/without replacement). All RNG goes through an injectable function so
 * tests can pin outcomes deterministically.
 */

export type ExperimentKind = 'coin' | 'die' | 'urn';

export type Rng = () => number;

export const defaultRng: Rng = Math.random;

// ─── Coin ────────────────────────────────────────────────────────────────────

export interface CoinConfig {
  /** Probability of heads. */
  pHeads: number;
}

export interface CoinResult {
  outcomes: ('H' | 'T')[];
  counts: { H: number; T: number };
  totals: { H: number; T: number };
  observed: { H: number; T: number };
}

export function flipCoin(p: CoinConfig, n: number, rng: Rng = defaultRng): CoinResult {
  const outcomes: ('H' | 'T')[] = [];
  let h = 0;
  for (let i = 0; i < n; i += 1) {
    const isH = rng() < p.pHeads;
    outcomes.push(isH ? 'H' : 'T');
    if (isH) h += 1;
  }
  const t = n - h;
  return {
    outcomes,
    counts: { H: h, T: t },
    totals: { H: h, T: t },
    observed: { H: n > 0 ? h / n : 0, T: n > 0 ? t / n : 0 },
  };
}

// ─── Die ─────────────────────────────────────────────────────────────────────

export interface DieConfig {
  /** Number of faces (default 6). */
  faces: number;
}

export interface DieResult {
  outcomes: number[];
  /** Count per face (1-indexed; index 0 unused). */
  counts: number[];
  observed: number[];
  expected: number[];
}

export function rollDie(cfg: DieConfig, n: number, rng: Rng = defaultRng): DieResult {
  const counts = new Array<number>(cfg.faces + 1).fill(0);
  const outcomes: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const face = Math.floor(rng() * cfg.faces) + 1;
    outcomes.push(face);
    counts[face] += 1;
  }
  const observed = counts.map((c) => (n > 0 ? c / n : 0));
  const expected = new Array<number>(cfg.faces + 1).fill(1 / cfg.faces);
  expected[0] = 0;
  observed[0] = 0;
  return { outcomes, counts, observed, expected };
}

// ─── Urn ─────────────────────────────────────────────────────────────────────

export interface UrnConfig {
  /** Map of color → count. e.g. { red: 3, blue: 2 } */
  composition: Record<string, number>;
  /** Sample with replacement? Default false. */
  withReplacement?: boolean;
}

export interface UrnResult {
  draws: string[];
  counts: Record<string, number>;
  observed: Record<string, number>;
  expected: Record<string, number>;
}

export function drawFromUrn(cfg: UrnConfig, n: number, rng: Rng = defaultRng): UrnResult {
  const colors = Object.keys(cfg.composition);
  const total = colors.reduce((s, k) => s + Math.max(0, cfg.composition[k]), 0);
  const draws: string[] = [];
  const counts: Record<string, number> = Object.fromEntries(colors.map((c) => [c, 0]));
  if (total === 0) {
    return {
      draws: [],
      counts,
      observed: Object.fromEntries(colors.map((c) => [c, 0])),
      expected: Object.fromEntries(colors.map((c) => [c, 0])),
    };
  }
  // Build mutable bag.
  const bag: string[] = [];
  for (const c of colors) {
    for (let i = 0; i < cfg.composition[c]; i += 1) bag.push(c);
  }

  const withReplacement = cfg.withReplacement ?? false;
  const draws_n = withReplacement ? n : Math.min(n, bag.length);

  for (let i = 0; i < draws_n; i += 1) {
    const idx = Math.floor(rng() * bag.length);
    const picked = bag[idx];
    draws.push(picked);
    counts[picked] = (counts[picked] ?? 0) + 1;
    if (!withReplacement) {
      bag.splice(idx, 1);
      if (bag.length === 0) break;
    }
  }

  const drawnTotal = draws.length;
  const observed: Record<string, number> = Object.fromEntries(
    colors.map((c) => [c, drawnTotal > 0 ? counts[c] / drawnTotal : 0]),
  );
  const expected: Record<string, number> = Object.fromEntries(
    colors.map((c) => [c, total > 0 ? cfg.composition[c] / total : 0]),
  );
  return { draws, counts, observed, expected };
}

// ─── Mulberry32 deterministic PRNG (test util) ───────────────────────────────

export function makeSeededRng(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Theoretical helper ──────────────────────────────────────────────────────

/** χ² test statistic vs. expected uniform — handy for "is this fair?" UX. */
export function chiSquared(observedCounts: number[], expectedProbs: number[], n: number): number {
  let chi = 0;
  for (let i = 0; i < observedCounts.length; i += 1) {
    const e = (expectedProbs[i] ?? 0) * n;
    if (e <= 0) continue;
    const diff = observedCounts[i] - e;
    chi += (diff * diff) / e;
  }
  return chi;
}
