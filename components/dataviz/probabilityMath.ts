// Pure math utilities and constants for ProbabilityLab

export type ExperimentType = 'coin' | 'die' | 'two-dice' | 'dice-coin' | 'spinner' | 'binomial';

export interface SpinnerSector { label: string; weight: number; }

export const SPINNER_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export const DEFAULT_SECTORS: SpinnerSector[] = [
  { label: 'Сино',   weight: 3 },
  { label: 'Зелено', weight: 2 },
  { label: 'Жолто',  weight: 2 },
  { label: 'Црвено', weight: 1 },
];

export const DIE_FACES = [4, 6, 8, 10, 12, 20] as const;

export const EXPERIMENTS: { id: ExperimentType; label: string; emoji: string; desc: string }[] = [
  { id: 'coin',      label: 'Монета',       emoji: '🪙',    desc: '2 исходи' },
  { id: 'die',       label: 'Коцка',        emoji: '🎲',    desc: 'N страни' },
  { id: 'two-dice',  label: 'Две коцки',    emoji: '🎲🎲', desc: 'Сума 2–12' },
  { id: 'dice-coin', label: 'Коцка+Монета', emoji: '🎲🪙', desc: '12 исходи' },
  { id: 'spinner',   label: 'Спинер',       emoji: '🎡',    desc: 'Прилагоди' },
  { id: 'binomial',  label: 'Биномна расп.', emoji: '📉',  desc: 'B(n,p) + нормална' },
];

export const EXP_LABEL: Record<ExperimentType, string> = Object.fromEntries(
  EXPERIMENTS.map(e => [e.id, e.label])
) as Record<ExperimentType, string>;

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
