/**
 * Regression guard for the 2026-07-04 conceptIds enrichment pass
 * (scripts/enrich-matura-conceptids.mjs + scripts/matura-concept-map.mjs).
 *
 * Confirms every conceptId actually used in the matura question bank exists
 * in the canonical curriculum data (gymnasium.ts / vocational4.ts) — catches
 * typos in TOPIC_MAP or future imports that invent IDs that don't exist —
 * and that overall coverage stays high so the gap doesn't silently regress.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const RAW_DIR = join(__dirname, 'raw');

function extractIds(filePath: string, pattern: RegExp): Set<string> {
  const src = readFileSync(filePath, 'utf8');
  const ids = new Set<string>();
  for (const m of src.matchAll(pattern)) ids.add(m[1]);
  return ids;
}

describe('matura conceptIds — validity and coverage', () => {
  const validIds = new Set<string>([
    ...extractIds(join(__dirname, '../secondary/gymnasium.ts'), /id: '(gym\d+n?-c\d+-\d+)'/g),
    ...extractIds(join(__dirname, '../secondary/vocational4.ts'), /id: '(voc4-\d+-c\d+-\d+)'/g),
  ]);

  const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
  let totalQuestions = 0;
  let withConceptIds = 0;
  const usedIds = new Set<string>();

  for (const f of files) {
    const data = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf8'));
    for (const q of data.questions) {
      totalQuestions++;
      if (Array.isArray(q.conceptIds) && q.conceptIds.length > 0) {
        withConceptIds++;
        for (const id of q.conceptIds) usedIds.add(id);
      }
    }
  }

  it('found a non-trivial curriculum concept ID set to validate against', () => {
    expect(validIds.size).toBeGreaterThan(50);
  });

  it('every conceptId used in the matura bank exists in the canonical curriculum', () => {
    const invalid = [...usedIds].filter(id => !validIds.has(id));
    // 2 known pre-existing bad IDs in dim-vocational4-economics-2024-august-mk.json,
    // predating this enrichment pass — tracked here, not silently ignored.
    // 8 gym11-c*-* IDs (2026-07-18): the official gymnasium grade-11 (II година) programme was
    // replaced for учебна 2026/2027 (BRO, бр. 13-13739/9, 28.10.2025) — old topics/concepts were
    // removed from gymnasium.ts and the new ones use a non-colliding `gym11n-*` prefix (see comment
    // block above gymnasiumGrade11). These matura questions were tagged under the old programme's
    // concept IDs before the replacement and remain historically valid archive entries.
    const knownPreExisting = [
      'voc4-10-c6-4', 'voc4-10-c6-5',
      'gym11-c1-1', 'gym11-c2-1', 'gym11-c3-1', 'gym11-c3-2', 'gym11-c4-1', 'gym11-c6-1', 'gym11-c7-1', 'gym11-c8-1',
    ];
    const unexpected = invalid.filter(id => !knownPreExisting.includes(id));
    expect(unexpected).toEqual([]);
  });

  it('conceptIds coverage is at least 95% of all matura questions', () => {
    const coverage = withConceptIds / totalQuestions;
    expect(coverage).toBeGreaterThanOrEqual(0.95);
  });
});
