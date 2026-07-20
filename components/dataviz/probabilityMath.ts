// Pure math utilities and constants for ProbabilityLab
import type { LabExercise } from '../../types/labTypes';

export type ExperimentType = 'coin' | 'die' | 'two-dice' | 'dice-coin' | 'spinner' | 'binomial';

export interface SpinnerSector { label: string; weight: number; }

export const SPINNER_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

// label fields hold i18n keys (not literal text) — see DuggaQuestionEditor's Q_TYPES/TEST_TYPES convention
export const DEFAULT_SECTORS: SpinnerSector[] = [
  { label: 'dataviz.probLab.sectorBlue',   weight: 3 },
  { label: 'dataviz.probLab.sectorGreen', weight: 2 },
  { label: 'dataviz.probLab.sectorYellow',  weight: 2 },
  { label: 'dataviz.probLab.sectorRed', weight: 1 },
];

export const DIE_FACES = [4, 6, 8, 10, 12, 20] as const;

// label/desc fields hold i18n keys (not literal text) — see DuggaQuestionEditor's Q_TYPES/TEST_TYPES convention
export const EXPERIMENTS: { id: ExperimentType; label: string; emoji: string; desc: string }[] = [
  { id: 'coin',      label: 'dataviz.probLab.tabCoin',      emoji: '🪙',    desc: 'dataviz.probLab.descCoin' },
  { id: 'die',       label: 'dataviz.probLab.tabDie',       emoji: '🎲',    desc: 'dataviz.probLab.descDie' },
  { id: 'two-dice',  label: 'dataviz.probLab.tabTwoDice',   emoji: '🎲🎲', desc: 'dataviz.probLab.descTwoDice' },
  { id: 'dice-coin', label: 'dataviz.probLab.tabDiceCoin',  emoji: '🎲🪙', desc: 'dataviz.probLab.descDiceCoin' },
  { id: 'spinner',   label: 'dataviz.probLab.tabSpinner',   emoji: '🎡',    desc: 'dataviz.probLab.descSpinner' },
  { id: 'binomial',  label: 'dataviz.probLab.tabBinomial',  emoji: '📉',  desc: 'dataviz.probLab.descBinomial' },
];

/** Translated experiment-type label for the given translation function (used for chart titles, etc.). */
export function expLabel(exp: ExperimentType, t: (key: string) => string): string {
  const match = EXPERIMENTS.find(e => e.id === exp);
  return match ? t(match.label) : exp;
}

/** Formats a canonical (internal, Macedonian-keyed) outcome string for display in the current language.
 *  Numeric die faces, custom spinner-sector labels, and binomial 'k=N' outcomes are already language-neutral. */
export function formatOutcomeLabel(outcome: string, t: (key: string) => string): string {
  if (outcome === 'Глава') return t('dataviz.probLab.heads');
  if (outcome === 'Писмо') return t('dataviz.probLab.tails');
  const sumMatch = outcome.match(/^Сума (\d+)$/);
  if (sumMatch) return `${t('dataviz.probLab.sum')} ${sumMatch[1]}`;
  const dcMatch = outcome.match(/^(\d+)-(Г|П)$/);
  if (dcMatch) return `${dcMatch[1]}-${dcMatch[2] === 'Г' ? t('dataviz.probLab.headsShort') : t('dataviz.probLab.tailsShort')}`;
  return outcome;
}

/** Wilson score 95% CI for a proportion. Returns [lo, hi] clamped to [0,1]. */
export function wilsonCI(count: number, total: number): [number, number] {
  if (total === 0) return [0, 1];
  const p = count / total;
  const z = 1.96;
  const z2n = (z * z) / total;
  const center = (p + z2n / 2) / (1 + z2n);
  const margin = (z / (1 + z2n)) * Math.sqrt(p * (1 - p) / total + z2n / (4 * total));
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

/** Exact factorial for small n (≤20); returns Infinity otherwise */
export function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 20) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  return binomCoeff(n, k);
}

export function permutations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = n - k + 1; i <= n; i++) r *= i;
  return r;
}

export function binomCoeff(n: number, k: number): number {
  if (k === 0 || k === n) return 1;
  if (k > n) return 0;
  let c = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) c = c * (n - i) / (i + 1);
  return c;
}

export function binomialPMF(n: number, p: number): number[] {
  return Array.from({ length: n + 1 }, (_, k) => binomCoeff(n, k) * p ** k * (1 - p) ** (n - k));
}

export function normalPDF(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
}

export function getOutcomes(exp: ExperimentType, df: number, sec: SpinnerSector[], bn = 10): string[] {
  switch (exp) {
    case 'coin':      return ['Глава', 'Писмо'];
    case 'die':       return Array.from({ length: df }, (_, i) => String(i + 1));
    case 'two-dice':  return Array.from({ length: 11 }, (_, i) => `Сума ${i + 2}`);
    case 'dice-coin': {
      const out: string[] = [];
      for (let i = 1; i <= 6; i++) { out.push(`${i}-Г`); out.push(`${i}-П`); }
      return out;
    }
    case 'spinner':   return sec.map(s => s.label);
    case 'binomial':  return Array.from({ length: bn + 1 }, (_, k) => `k=${k}`);
  }
}

export function theoretical(exp: ExperimentType, df: number, sec: SpinnerSector[], bn = 10, bp = 0.5): Record<string, number> {
  switch (exp) {
    case 'coin':      return { 'Глава': 0.5, 'Писмо': 0.5 };
    case 'die':       return Object.fromEntries(Array.from({ length: df }, (_, i) => [String(i + 1), 1 / df]));
    case 'two-dice':  return Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => {
        const s = i + 2;
        return [`Сума ${s}`, (6 - Math.abs(s - 7)) / 36];
      })
    );
    case 'dice-coin': {
      const e: [string, number][] = [];
      for (let i = 1; i <= 6; i++) { e.push([`${i}-Г`, 1/12]); e.push([`${i}-П`, 1/12]); }
      return Object.fromEntries(e);
    }
    case 'spinner': {
      const total = sec.reduce((s, x) => s + x.weight, 0) || 1;
      return Object.fromEntries(sec.map(x => [x.label, x.weight / total]));
    }
    case 'binomial': {
      const pmf = binomialPMF(bn, bp);
      return Object.fromEntries(pmf.map((p, k) => [`k=${k}`, p]));
    }
  }
}

export function rollOne(exp: ExperimentType, df: number, sec: SpinnerSector[], bn = 10, bp = 0.5): string {
  switch (exp) {
    case 'coin':      return Math.random() < 0.5 ? 'Глава' : 'Писмо';
    case 'die':       return String(Math.floor(Math.random() * df) + 1);
    case 'two-dice':  return `Сума ${Math.floor(Math.random()*6)+1 + Math.floor(Math.random()*6)+1}`;
    case 'dice-coin': return `${Math.floor(Math.random()*6)+1}-${Math.random()<0.5?'Г':'П'}`;
    case 'spinner': {
      const tot = sec.reduce((s, x) => s + x.weight, 0);
      if (!tot || sec.length === 0) return '—';
      let r = Math.random() * tot;
      for (const s of sec) { r -= s.weight; if (r <= 0) return s.label; }
      return sec[sec.length - 1].label;
    }
    case 'binomial': {
      if (bn <= 0) return 'k=0';
      let successes = 0;
      for (let i = 0; i < bn; i++) if (Math.random() < bp) successes++;
      return `k=${successes}`;
    }
  }
}

// ─── Lab exercise generator ───────────────────────────────────────────────────

function pbRand(lo: number, hi: number) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

export function generateProbabilitySet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const exs: LabExercise[] = [];
  for (let i = 0; i < count; i++) {
    const id = `pb-${difficulty}-${i}`;
    const qt = i % 3;

    if (difficulty === 1) {
      if (qt === 0) {
        exs.push({ id, question: 'Фрлаш монета. Веројатноста за ГЛАВА е?',
          type: 'multiple_choice', options: ['1/2', '1/3', '1/4', '1'],
          correctAnswer: '1/2', hint: 'Монетата има 2 рамноверојатни исходи.',
          explanation: 'P(Глава) = 1/2', difficulty: 1, curriculumRef: 'МОН VII–VIII' });
      } else if (qt === 1) {
        const face = pbRand(1, 6);
        exs.push({ id, question: `Фрлаш фер коцка d6. Веројатноста за ${face} е?`,
          type: 'multiple_choice', options: ['1/6', '1/4', '1/3', '1/2'],
          correctAnswer: '1/6', hint: 'Коцката има 6 страни, секоја рамноверојатна.',
          explanation: `P(${face}) = 1/6 ≈ 0.167`, difficulty: 1, curriculumRef: 'МОН VII–VIII' });
      } else {
        exs.push({ id, question: 'Фрлаш фер коцка d6. Веројатноста за ПАРЕН број е?',
          type: 'multiple_choice', options: ['1/2', '1/3', '2/3', '1/6'],
          correctAnswer: '1/2', hint: 'Парни: 2, 4, 6 — 3 исходи од 6.',
          explanation: 'P(пар) = 3/6 = 1/2', difficulty: 1, curriculumRef: 'МОН VII–VIII' });
      }
    } else if (difficulty === 2) {
      if (qt === 0) {
        exs.push({ id, question: 'C(4, 2) = ? (комбинации)',
          type: 'numeric', correctAnswer: '6',
          hint: 'C(n,k) = n! / (k!(n−k)!) = 4!/(2!·2!)',
          explanation: 'C(4,2) = 24/4 = 6', difficulty: 2, curriculumRef: 'МОН VIII–IX' });
      } else if (qt === 1) {
        exs.push({ id, question: 'Фрлаш две коцки. P(сума = 7) = ?',
          type: 'multiple_choice', options: ['1/6', '1/4', '5/36', '7/36'],
          correctAnswer: '1/6', hint: 'Поволни: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) = 6. Вкупно: 36.',
          explanation: 'P(сума=7) = 6/36 = 1/6', difficulty: 2, curriculumRef: 'МОН VIII–IX' });
      } else {
        const pA = pbRand(2, 8);
        exs.push({ id, question: `Ако P(A) = 0.${pA}, колку е P(A')?`,
          type: 'numeric', correctAnswer: String(+(1 - pA / 10).toFixed(1)),
          hint: "P(A') = 1 − P(A)",
          explanation: `P(A') = 1 − 0.${pA} = ${+(1 - pA / 10).toFixed(1)}`,
          difficulty: 2, curriculumRef: 'МОН VIII–IX' });
      }
    } else {
      const indepCases = [
        { pA: '0.3', pB: '0.4', ans: '0.12' },
        { pA: '0.5', pB: '0.6', ans: '0.3' },
        { pA: '0.4', pB: '0.5', ans: '0.2' },
      ];
      const unionCases = [
        { pA: '0.5', pB: '0.4', pAB: '0.2', ans: '0.7' },
        { pA: '0.6', pB: '0.5', pAB: '0.3', ans: '0.8' },
        { pA: '0.7', pB: '0.4', pAB: '0.2', ans: '0.9' },
      ];
      const n = pbRand(4, 7);
      if (qt === 0) {
        const c = indepCases[pbRand(0, indepCases.length - 1)];
        exs.push({ id, question: `P(A)=${c.pA}, P(B)=${c.pB}, А и Б независни. P(A∩B) = ?`,
          type: 'numeric', correctAnswer: c.ans,
          hint: 'За независни: P(A∩B) = P(A) × P(B)',
          explanation: `P(A∩B) = ${c.pA} × ${c.pB} = ${c.ans}`,
          difficulty: 3, curriculumRef: 'Гимназија' });
      } else if (qt === 1) {
        const u = unionCases[pbRand(0, unionCases.length - 1)];
        exs.push({ id, question: `P(A)=${u.pA}, P(B)=${u.pB}, P(A∩B)=${u.pAB}. P(A∪B) = ?`,
          type: 'numeric', correctAnswer: u.ans,
          hint: 'P(A∪B) = P(A) + P(B) − P(A∩B)',
          explanation: `P(A∪B) = ${u.pA} + ${u.pB} − ${u.pAB} = ${u.ans}`,
          difficulty: 3, curriculumRef: 'Гимназија' });
      } else {
        exs.push({ id, question: `A(${n}, 2) = ? (аранжмани)`,
          type: 'numeric', correctAnswer: String(n * (n - 1)),
          hint: `A(n,k) = n×(n−1)×... = ${n}×${n - 1}`,
          explanation: `A(${n}, 2) = ${n} × ${n - 1} = ${n * (n - 1)}`,
          difficulty: 3, curriculumRef: 'Гимназија' });
      }
    }
  }
  return exs;
}
