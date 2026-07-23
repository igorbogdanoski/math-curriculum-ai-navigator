// One-time migration: add `priorKnowledgeIds` to secondary curriculum concepts.
// Secondary concepts (data/secondary/*.ts) had ZERO priorKnowledgeIds, so the curriculum
// graph rendered them as isolated nodes with no 9→10 bridge (2026-07-23 audit). This script
// inserts a mathematically-curated prerequisite edge set for ALL secondary tracks: the
// grade-9 → grade-10 bridge plus the vertical chain within each track.
//
// Idempotent: skips concepts that already have priorKnowledgeIds. Reports any mapped concept
// id not found in its file (typo guard) and fails on any edge referencing an unknown target.
//
// Usage: node scripts/add-secondary-prerequisites.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Grade-9 exit concepts (bridge sources).
const G9 = [
  'g9-concept-1-1', 'g9-concept-1-2', 'g9-concept-1-3', 'g9-concept-1-4', 'g9-concept-1-5',
  'g9-concept-2-1', 'g9-concept-2-2', 'g9-concept-2-3', 'g9-concept-2-4',
  'g9-concept-3-1', 'g9-concept-3-2', 'g9-concept-3-3', 'g9-concept-3-4',
  'g9-concept-4-1', 'g9-concept-4-2',
  'g9-concept-5-1', 'g9-concept-5-2',
];

// ── Гимназија (gymnasium) ─────────────────────────────────────────────────────
const GYMNASIUM_PREREQS = {
  'gym10-c1-1': ['g9-concept-1-1'], 'gym10-c1-2': ['g9-concept-1-2', 'g9-concept-1-3'],
  'gym10-c1-3': ['g9-concept-1-5'], 'gym10-c2-1': ['g9-concept-1-4'],
  'gym10-c2-2': ['g9-concept-3-1'], 'gym10-c2-3': ['gym10-c2-2'],
  'gym10-c3-1': ['g9-concept-3-2'], 'gym10-c3-2': ['gym10-c3-1', 'g9-concept-3-2'],
  'gym10-c3-3': ['g9-concept-3-2'], 'gym10-c3-4': ['gym10-c3-3'],
  'gym10-c3-5': ['g9-concept-3-3', 'gym10-c3-3'], 'gym10-c4-1': ['g9-concept-2-2'],
  'gym10-c4-2': ['g9-concept-2-1', 'g9-concept-2-3'], 'gym10-c4-3': ['g9-concept-2-1'],
  'gym10-c4-4': ['g9-concept-2-3'], 'gym10-c5-1': ['g9-concept-4-1'],
  'gym10-c5-2': ['g9-concept-4-2'], 'gym10-c6-1': ['g9-concept-5-2'],
  'gym10-c6-2': ['g9-concept-5-1'],
  'gym11n-c1-1': ['gym10-c2-1'], 'gym11n-c1-2': ['gym10-c2-1'],
  'gym11n-c1-3': ['gym11n-c1-2', 'gym10-c1-2'], 'gym11n-c1-4': ['gym11n-c1-2'],
  'gym11n-c1-5': ['gym11n-c1-3'], 'gym11n-c1-6': ['gym11n-c1-4', 'gym10-c2-3'],
  'gym11n-c2-1': ['gym10-c3-3', 'gym10-c2-2'], 'gym11n-c2-2': ['gym11n-c2-1'],
  'gym11n-c2-3': ['gym11n-c2-2'], 'gym11n-c2-4': ['gym11n-c2-2'],
  'gym11n-c2-5': ['gym11n-c2-2', 'gym10-c3-4'], 'gym11n-c3-1': ['gym11n-c2-2', 'gym10-c3-2'],
  'gym11n-c3-2': ['gym11n-c3-1', 'gym10-c3-5'], 'gym11n-c3-3': ['gym11n-c3-2'],
  'gym11n-c4-1': ['gym10-c6-1'], 'gym11n-c4-2': ['gym11n-c4-1'],
  'gym11n-c5-1': ['gym10-c4-2'], 'gym11n-c5-2': ['gym10-c4-1', 'gym10-c5-2'],
  'gym11n-c5-3': ['gym11n-c5-2'], 'gym11n-c6-1': ['gym10-c5-1'],
  'gym11n-c6-2': ['gym10-c5-2', 'gym11n-c5-2'], 'gym11n-c6-3': ['gym10-c5-2'],
  'gym11n-c6-4': ['gym10-c5-2'],
  'gym12-c1-1': ['gym11n-c1-1', 'gym10-c3-2'], 'gym12-c1-2': ['gym12-c1-1'],
  'gym12-c1-3': ['gym12-c1-1'], 'gym12-c1-4': ['gym12-c1-3'],
  'gym12-c2-1': ['gym11n-c5-1'], 'gym12-c2-2': ['gym12-c2-1'],
  'gym12-c2-3': ['gym12-c2-1'], 'gym12-c2-4': ['gym12-c2-2', 'gym12-c2-3'],
  'gym12-c2-5': ['gym12-c2-1'], 'gym12-c3-1': ['gym11n-c4-1'],
  'gym12-c3-2': ['gym12-c3-1', 'gym11n-c4-2'], 'gym12-c4-1': ['gym10-c3-1'],
  'gym12-c4-2': ['gym12-c4-1', 'gym10-c3-2'], 'gym12-c4-3': ['gym12-c4-2', 'gym11n-c3-1'],
  'gym13-c1-1': ['g9-concept-3-4', 'gym10-c1-2'], 'gym13-c1-2': ['gym13-c1-1'],
  'gym13-c1-3': ['gym13-c1-1', 'gym12-c1-1'], 'gym13-c1-4': ['gym13-c1-2', 'gym13-c1-3'],
  'gym13-c2-1': ['gym12-c1-4', 'gym12-c2-2'], 'gym13-c2-2': ['gym13-c2-1'],
  'gym13-c2-3': ['gym13-c2-1', 'gym13-c1-4'], 'gym13-c3-1': ['gym13-c2-3'],
  'gym13-c3-2': ['gym13-c3-1'], 'gym13-c4-1': ['gym12-c3-2'],
  'gym13-c5-1': ['gym13-c4-1', 'gym10-c6-2'],
};

// ── Стручно 4-годишно (vocational4) ───────────────────────────────────────────
const VOCATIONAL4_PREREQS = {
  'voc4-10-c1-1': ['g9-concept-1-1'], 'voc4-10-c1-2': ['g9-concept-1-1', 'voc4-10-c1-1'],
  'voc4-10-c2-1': ['g9-concept-1-3'], 'voc4-10-c2-2': ['voc4-10-c2-1'],
  'voc4-10-c2-3': ['voc4-10-c2-2'], 'voc4-10-c2-4': ['voc4-10-c2-3', 'g9-concept-1-2'],
  'voc4-10-c3-1': ['g9-concept-1-4'], 'voc4-10-c3-2': ['voc4-10-c3-1'],
  'voc4-10-c3-3': ['voc4-10-c3-2', 'g9-concept-3-1'], 'voc4-10-c3-4': ['voc4-10-c3-3'],
  'voc4-10-c3-5': ['voc4-10-c3-4'], 'voc4-10-c4-1': ['g9-concept-1-5'],
  'voc4-10-c4-2': ['voc4-10-c4-1'], 'voc4-10-c5-1': ['g9-concept-3-2'],
  'voc4-10-c5-2': ['voc4-10-c5-1', 'g9-concept-3-3'], 'voc4-10-c6-1': ['voc4-10-c5-1', 'g9-concept-3-2'],
  'voc4-10-c6-2': ['voc4-10-c6-1'], 'voc4-10-c7-1': ['g9-concept-2-1'],
  'voc4-10-c8-1': ['voc4-10-c7-1', 'g9-concept-4-1'], 'voc4-10-c8-2': ['voc4-10-c8-1'],
  'voc4-10-c8-3': ['voc4-10-c8-1'], 'voc4-10-c8-4': ['voc4-10-c8-2', 'g9-concept-2-4'],
  'voc4-10-c8-5': ['voc4-10-c8-4'],
  'voc4-11-c1-1': ['voc4-10-c3-1'], 'voc4-11-c1-2': ['voc4-11-c1-1'],
  'voc4-11-c1-3': ['voc4-11-c1-2'], 'voc4-11-c2-1': ['voc4-10-c8-2', 'g9-concept-2-3'],
  'voc4-11-c2-2': ['voc4-11-c2-1'], 'voc4-11-c2-3': ['voc4-11-c2-2'],
  'voc4-11-c3-1': ['voc4-11-c1-1', 'voc4-10-c2-4'], 'voc4-11-c3-2': ['voc4-11-c3-1'],
  'voc4-11-c4-1': ['voc4-10-c5-1', 'voc4-10-c3-3'], 'voc4-11-c4-2': ['voc4-11-c4-1'],
  'voc4-11-c4-3': ['voc4-11-c4-1', 'voc4-10-c3-5'], 'voc4-11-c5-1': ['voc4-11-c4-1'],
  'voc4-11-c5-2': ['voc4-11-c5-1', 'voc4-11-c1-1'], 'voc4-11-c6-1': ['voc4-11-c4-1', 'voc4-10-c6-1'],
  'voc4-11-c6-2': ['voc4-11-c6-1'], 'voc4-11-c6-3': ['voc4-11-c6-1', 'voc4-10-c5-2'],
  'voc4-11-c7-1': ['voc4-10-c7-1'], 'voc4-11-c7-2': ['voc4-11-c7-1', 'voc4-10-c8-5'],
  'voc4-11-c8-1': ['voc4-11-c7-2', 'g9-concept-4-2'], 'voc4-11-c8-2': ['voc4-11-c7-2'],
  'voc4-11-c8-3': ['voc4-11-c7-2'], 'voc4-11-c8-4': ['voc4-11-c7-2'],
  'voc4-11-c8-5': ['voc4-11-c7-2'],
  'voc4-12-c1-1': ['voc4-10-c3-1', 'voc4-11-c6-1'], 'voc4-12-c1-2': ['voc4-12-c1-1'],
  'voc4-12-c2-1': ['voc4-12-c1-1'], 'voc4-12-c2-2': ['voc4-12-c2-1'],
  'voc4-12-c3-1': ['voc4-11-c2-3'], 'voc4-12-c3-2': ['voc4-12-c3-1'],
  'voc4-12-c3-3': ['voc4-12-c3-1'], 'voc4-12-c3-4': ['voc4-12-c3-2', 'voc4-12-c3-3'],
  'voc4-12-c4-1': ['voc4-10-c6-1'], 'voc4-12-c4-2': ['voc4-12-c4-1'],
  'voc4-12-c4-3': ['voc4-12-c4-2', 'voc4-10-c8-4'], 'voc4-12-c5-1': ['voc4-10-c1-1'],
  'voc4-12-c5-2': ['voc4-12-c5-1', 'g9-concept-5-2'],
  'voc4-13-c1-1': ['g9-concept-3-4', 'voc4-10-c2-4'], 'voc4-13-c1-2': ['voc4-13-c1-1', 'voc4-12-c1-1'],
  'voc4-13-c1-3': ['voc4-13-c1-1', 'voc4-13-c1-2'], 'voc4-13-c2-1': ['voc4-11-c6-1', 'voc4-10-c6-1'],
  'voc4-13-c2-2': ['voc4-13-c2-1', 'voc4-12-c2-1'], 'voc4-13-c2-3': ['voc4-12-c3-4'],
  'voc4-13-c3-1': ['voc4-13-c1-3', 'voc4-13-c2-1'], 'voc4-13-c3-2': ['voc4-13-c3-1'],
  'voc4-13-c3-3': ['voc4-13-c3-2', 'voc4-13-c2-3'], 'voc4-13-c4-1': ['voc4-13-c3-1'],
  'voc4-13-c4-2': ['voc4-13-c4-1'],
};

// ── Стручно 3-годишно (vocational3) ───────────────────────────────────────────
const VOCATIONAL3_PREREQS = {
  'voc3-10-c1-1': ['g9-concept-1-3'], 'voc3-10-c1-2': ['voc3-10-c1-1', 'g9-concept-1-2'],
  'voc3-10-c2-1': ['g9-concept-1-4'], 'voc3-10-c2-2': ['voc3-10-c2-1', 'g9-concept-3-1'],
  'voc3-10-c3-1': ['g9-concept-3-2'], 'voc3-10-c3-2': ['voc3-10-c3-1', 'g9-concept-3-2'],
  'voc3-10-c4-1': ['voc3-10-c3-2', 'g9-concept-3-3'], 'voc3-10-c5-1': ['voc3-10-c3-2'],
  'voc3-10-c6-1': ['g9-concept-1-5'], 'voc3-10-c6-2': ['voc3-10-c6-1'],
  'voc3-11-c1-1': ['g9-concept-2-3', 'g9-concept-2-1'], 'voc3-11-c1-2': ['voc3-11-c1-1'],
  'voc3-11-c1-3': ['voc3-11-c1-2'], 'voc3-11-c2-1': ['voc3-10-c3-2', 'voc3-10-c2-2'],
  'voc3-11-c2-2': ['voc3-11-c2-1'], 'voc3-11-c2-3': ['voc3-11-c2-2'],
  'voc3-11-c3-1': ['g9-concept-4-1'], 'voc3-11-c3-2': ['voc3-11-c3-1'],
  'voc3-11-c4-1': ['voc3-11-c3-1', 'g9-concept-4-2'], 'voc3-11-c4-2': ['voc3-11-c4-1'],
  'voc3-12-c1-1': ['voc3-10-c2-1', 'voc3-11-c2-2'], 'voc3-12-c1-2': ['voc3-12-c1-1'],
  'voc3-12-c2-1': ['voc3-10-c3-1'], 'voc3-12-c2-2': ['voc3-12-c2-1'],
  'voc3-12-c3-1': ['voc3-10-c1-1'], 'voc3-12-c4-1': ['voc3-12-c3-1', 'g9-concept-5-2'],
  'voc3-12-c4-2': ['voc3-12-c4-1'],
};

// ── Стручно 2-годишно (vocational2) ───────────────────────────────────────────
const VOCATIONAL2_PREREQS = {
  'voc2-10-c1-1': ['g9-concept-1-3'], 'voc2-10-c1-2': ['voc2-10-c1-1', 'g9-concept-1-2'],
  'voc2-10-c2-1': ['g9-concept-3-2'], 'voc2-10-c2-2': ['voc2-10-c2-1', 'g9-concept-3-2'],
  'voc2-10-c2-3': ['voc2-10-c2-2', 'g9-concept-3-3'], 'voc2-10-c3-1': ['g9-concept-1-5'],
  'voc2-10-c3-2': ['voc2-10-c3-1'],
  'voc2-11-c1-1': ['voc2-10-c2-2'], 'voc2-11-c1-2': ['voc2-11-c1-1'],
  'voc2-11-c1-3': ['voc2-11-c1-2'], 'voc2-11-c2-1': ['g9-concept-4-1'],
  'voc2-11-c2-2': ['voc2-11-c2-1'], 'voc2-11-c3-1': ['voc2-11-c2-1', 'g9-concept-4-2'],
  'voc2-11-c3-2': ['voc2-11-c3-1'],
};

// ── Гимназиски изборни предмети (gymnasium_elective) ──────────────────────────
const ELECTIVES_PREREQS = {
  // XI — Елементарна алгебра
  'gym-ea11-c1-1': ['gym10-c1-2', 'g9-concept-1-3'], 'gym-ea11-c1-2': ['gym-ea11-c1-1'],
  'gym-ea11-c2-1': ['gym10-c1-1'], 'gym-ea11-c2-2': ['gym-ea11-c2-1'],
  'gym-ea11-c3-1': ['gym10-c1-1'], 'gym-ea11-c3-2': ['gym-ea11-c3-1'],
  'gym-ea11-c4-1': ['gym-ea11-c2-1'], 'gym-ea11-c4-2': ['gym-ea11-c4-1'],
  'gym-ea11-c5-1': ['gym10-c3-3', 'gym10-c3-5'], 'gym-ea11-c5-2': ['gym-ea11-c5-1'],
  // XI — Елементарна алгебра и геометрија
  'gym-eag11-c1-1': ['gym10-c5-2'], 'gym-eag11-c2-1': ['gym10-c4-1'],
  'gym-eag11-c3-1': ['gym10-c4-3', 'g9-concept-2-2'], 'gym-eag11-c4-1': ['gym11n-c2-2', 'gym10-c3-4'],
  // XII — Алгебра
  'gym-a12-c1-1': ['gym11n-c1-4'], 'gym-a12-c2-1': ['gym-ea11-c1-2'],
  'gym-a12-c3-1': ['gym10-c3-5', 'gym-ea11-c3-2'], 'gym-a12-c4-1': ['gym10-c2-2'],
  'gym-a12-c5-1': ['gym-a12-c4-1', 'gym11n-c3-2'], 'gym-a12-c6-1': ['gym11n-c1-5', 'gym12-c2-1'],
  // XII — Линеарна алгебра и аналитичка геометрија
  'gym-laag12-c1-1': ['gym10-c3-4'], 'gym-laag12-c2-1': ['gym10-c4-1', 'gym-eag11-c2-1'],
  'gym-laag12-c3-1': ['gym12-c4-2', 'gym11n-c5-2'], 'gym-laag12-c4-1': ['gym-laag12-c1-1'],
  // XIII — Математичка анализа
  'gym-ma13-c1-1': ['gym11n-c2-4'], 'gym-ma13-c2-1': ['gym10-c2-3'],
  'gym-ma13-c3-1': ['gym10-c1-2'], 'gym-ma13-c4-1': ['gym13-c1-4'],
  'gym-ma13-c5-1': ['gym13-c3-1', 'gym13-c2-3'], 'gym-ma13-c6-1': ['gym-ma13-c5-1'],
  'gym-ma13-c7-1': ['gym-ma13-c6-1'],
};

const FILES = [
  { path: join(root, 'data/secondary/gymnasium.ts'), prereqs: GYMNASIUM_PREREQS },
  { path: join(root, 'data/secondary/vocational4.ts'), prereqs: VOCATIONAL4_PREREQS },
  { path: join(root, 'data/secondary/vocational3.ts'), prereqs: VOCATIONAL3_PREREQS },
  { path: join(root, 'data/secondary/vocational2.ts'), prereqs: VOCATIONAL2_PREREQS },
  { path: join(root, 'data/secondary/gymnasium_electives.ts'), prereqs: ELECTIVES_PREREQS },
];

// Every valid edge target = any mapped concept id (across all tracks) + grade-9 bridge sources.
const allKnownTargets = new Set(G9);
for (const { prereqs } of FILES) for (const id of Object.keys(prereqs)) allKnownTargets.add(id);

function applyToFile(filePath, prereqs) {
  const lines = readFileSync(filePath, 'utf8').split('\n');
  const out = [];
  const found = new Set();
  const idLineRe = /^(\s*)id:\s*'([^']+)',\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    const m = line.match(idLineRe);
    if (!m) continue;
    const id = m[2];
    if (!(id in prereqs)) continue;
    found.add(id);
    const next = (lines[i + 1] || '').trim();
    if (next.startsWith('priorKnowledgeIds')) continue; // idempotent
    const list = prereqs[id].map((p) => `'${p}'`).join(', ');
    out.push(`${m[1]}priorKnowledgeIds: [${list}],`);
  }

  writeFileSync(filePath, out.join('\n'));
  return { applied: found.size, missing: Object.keys(prereqs).filter((id) => !found.has(id)) };
}

let totalApplied = 0;
for (const { path, prereqs } of FILES) {
  const badTargets = [];
  for (const [id, targets] of Object.entries(prereqs))
    for (const t of targets) if (!allKnownTargets.has(t)) badTargets.push(`${id} → ${t}`);
  if (badTargets.length) {
    console.error(`✗ ${path}: unknown edge targets:\n  ${badTargets.join('\n  ')}`);
    process.exit(1);
  }
  const { applied, missing } = applyToFile(path, prereqs);
  totalApplied += applied;
  console.log(`✓ ${path.split('\\').pop()}: ${applied} concepts linked`);
  if (missing.length) console.warn(`  ⚠ mapped ids not found: ${missing.join(', ')}`);
}
console.log(`\nDone. ${totalApplied} secondary concepts now carry priorKnowledgeIds (gymnasium already done earlier).`);
