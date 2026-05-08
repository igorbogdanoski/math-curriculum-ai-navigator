/**
 * Eval & perf gates (T5.3 + T5.4).
 *
 * - Asserts the latest entry in score-history.json meets the smoke-gate
 *   threshold (avgScore ≥ 70) so regressions are caught even when the live
 *   `eval:smoke-gate` script can't run (e.g. forks without API keys).
 * - Asserts performance-budget.json exists and the root-gzip budget is
 *   strict enough (≤ 1500 kB).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..');

interface ScoreEntry {
  runAt: string;
  casesEvaluated: number;
  avgScore: number;
  embeddingDim?: number;
  label?: string;
}
interface ScoreHistory { entries: ScoreEntry[] }

interface BudgetEntry {
  path?: string;
  resourceType?: 'script' | 'stylesheet' | 'total' | 'third-party' | 'root-gzip';
  budget: number;
  comment?: string;
}

describe('T5.3 — eval smoke gate baseline', () => {
  const history: ScoreHistory = JSON.parse(
    readFileSync(resolve(ROOT, 'eval', 'score-history.json'), 'utf8'),
  );

  it('history file has at least one entry', () => {
    expect(history.entries.length).toBeGreaterThan(0);
  });

  it('latest entry meets smoke-gate threshold (avgScore ≥ 70)', () => {
    const latest = history.entries[history.entries.length - 1];
    expect(latest.avgScore, `latest run @ ${latest.runAt}`).toBeGreaterThanOrEqual(70);
  });

  it('a 768-dim re-baseline entry is present (S60 T5.3)', () => {
    const has768 = history.entries.some((e) => e.embeddingDim === 768);
    expect(has768).toBe(true);
  });
});

describe('T5.4 — performance budget configuration', () => {
  const budgets: BudgetEntry[] = JSON.parse(
    readFileSync(resolve(ROOT, 'performance-budget.json'), 'utf8'),
  );

  it('budget file is non-empty', () => {
    expect(budgets.length).toBeGreaterThan(0);
  });

  it('root-gzip budget is set and ≤ 1500 kB', () => {
    const rg = budgets.find((b) => b.resourceType === 'root-gzip');
    expect(rg, 'root-gzip budget missing').toBeTruthy();
    expect(rg!.budget).toBeLessThanOrEqual(1500);
  });

  it('total assets budget is configured', () => {
    expect(budgets.some((b) => b.resourceType === 'total')).toBe(true);
  });

  it('third-party budget is configured', () => {
    expect(budgets.some((b) => b.resourceType === 'third-party')).toBe(true);
  });
});
