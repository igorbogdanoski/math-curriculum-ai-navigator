/**
 * Regression guard for the 2026-07-23 secondary prerequisite-graph migration
 * (scripts/add-secondary-prerequisites.mjs).
 *
 * Secondary concepts previously had ZERO priorKnowledgeIds, so the curriculum graph
 * (CurriculumGraphView / MindMapView / getConceptChain) rendered them as isolated nodes
 * with no grade-9 → grade-10 bridge. This test guards:
 *  1. every priorKnowledgeIds target in the secondary files resolves to a real concept
 *     (no dangling references from typos or future curriculum edits), and
 *  2. the 9→10 bridge actually exists (grade-10 secondary concepts link back to grade 9).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SECONDARY_DIR = __dirname;
const DATA_DIR = join(__dirname, '..');

const SECONDARY_FILES = [
  'gymnasium.ts', 'vocational4.ts', 'vocational3.ts', 'vocational2.ts', 'gymnasium_electives.ts',
];
const PRIMARY_FILES = [
  'grade1.ts', 'grade2.ts', 'grade3.ts', 'grade4.ts', 'grade5.ts',
  'grade6.ts', 'grade7.ts', 'grade8.ts', 'grade9.ts',
];

// Matches both TS style (id: 'x') and JSON style ("id": "x").
const ID_RE = /(?:\bid:\s*'([^']+)'|"id":\s*"([^"]+)")/g;
const PRIOR_RE = /priorKnowledgeIds:\s*\[([^\]]*)\]/g;
const QUOTED_RE = /'([^']+)'|"([^"]+)"/g;

function collectIds(filePath: string): Set<string> {
  const src = readFileSync(filePath, 'utf8');
  const ids = new Set<string>();
  for (const m of src.matchAll(ID_RE)) ids.add(m[1] ?? m[2]);
  return ids;
}

function collectPriorTargets(filePath: string): string[] {
  const src = readFileSync(filePath, 'utf8');
  const targets: string[] = [];
  for (const m of src.matchAll(PRIOR_RE)) {
    for (const q of m[1].matchAll(QUOTED_RE)) targets.push(q[1] ?? q[2]);
  }
  return targets;
}

describe('secondary prerequisite graph — integrity', () => {
  const validIds = new Set<string>();
  for (const f of PRIMARY_FILES) for (const id of collectIds(join(DATA_DIR, f))) validIds.add(id);
  for (const f of SECONDARY_FILES) for (const id of collectIds(join(SECONDARY_DIR, f))) validIds.add(id);

  const priorTargets: string[] = [];
  for (const f of SECONDARY_FILES) priorTargets.push(...collectPriorTargets(join(SECONDARY_DIR, f)));

  it('built a non-trivial concept ID universe', () => {
    expect(validIds.size).toBeGreaterThan(300);
  });

  it('secondary concepts carry priorKnowledgeIds (graph is no longer empty)', () => {
    expect(priorTargets.length).toBeGreaterThan(150);
  });

  it('every priorKnowledgeIds target resolves to a real concept (no dangling refs)', () => {
    const dangling = priorTargets.filter((id) => !validIds.has(id));
    expect(dangling).toEqual([]);
  });

  it('the grade-9 → grade-10 bridge exists (grade-10 concepts link back to grade 9)', () => {
    const bridgeTargets = priorTargets.filter((id) => id.startsWith('g9-concept-'));
    expect(bridgeTargets.length).toBeGreaterThanOrEqual(10);
  });
});
