/**
 * scripts/normalize-matura-choices.mjs
 *
 * Normalizes AL and TR matura JSON files so that MC choices and correctAnswer
 * use Macedonian Cyrillic keys (А/Б/В/Г) instead of Latin (A/B/C/Ç or A/B/C/D).
 *
 * Also fixes common correctAnswer issues:
 *   - Disputed/withdrawn questions → "X"
 *
 * Usage:
 *   node scripts/normalize-matura-choices.mjs --input data/matura/raw/file.json
 *   node scripts/normalize-matura-choices.mjs --all          (all AL+TR files in raw/)
 *   node scripts/normalize-matura-choices.mjs --all --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';

// ── Choice key maps ────────────────────────────────────────────────────────────
// Albanian: A B C Ç  →  А Б В Г
const AL_MAP = { A: 'А', B: 'Б', C: 'В', 'Ç': 'Г' };
// Turkish:  A B C D  →  А Б В Г
const TR_MAP = { A: 'А', B: 'Б', C: 'В', D: 'Г' };
// Generic Latin fallback (covers both)
const GENERIC_MAP = { ...AL_MAP, ...TR_MAP };

// Keywords that indicate a withdrawn/disputed question correctAnswer
const WITHDRAWN_PATTERNS = [
  /се отфрла/i, /два точни/i, /poništava/i, /withdrawn/i, /annulled/i,
  /anulohet/i,   // Albanian: "anulohet për shkak të dy përgjigjeve të sakta"
  /iptal edildi/i, // Turkish: "iki doğru cevap olduğu için iptal edildi"
];

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const allMode = args.includes('--all');
const inputIdx = args.indexOf('--input');

let filePaths = [];

if (allMode) {
  const rawDir = path.resolve('data/matura/raw');
  filePaths = fs.readdirSync(rawDir)
    .filter(f => f.endsWith('.json') && (f.includes('-al') || f.includes('-tr')))
    .map(f => path.join(rawDir, f));
  console.log(`\n▶ Normalize ALL AL+TR files (${filePaths.length} files)${dryRun ? ' — DRY RUN' : ''}\n`);
} else if (inputIdx !== -1 && args[inputIdx + 1]) {
  filePaths = [path.resolve(args[inputIdx + 1])];
} else {
  console.error('Usage:\n  --input <file>    normalize single file\n  --all             normalize all AL+TR files in data/matura/raw/');
  process.exit(1);
}

// ── Normalize one file ────────────────────────────────────────────────────────
function normalizeFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const { questions } = raw;
  if (!Array.isArray(questions)) {
    console.warn(`  ⚠ ${path.basename(filePath)}: no questions array — skipped`);
    return;
  }

  // Detect language to pick the right map
  const lang = raw.exam?.language ?? '';
  const choiceMap = lang === 'tr' ? TR_MAP : lang === 'al' ? AL_MAP : GENERIC_MAP;
  const latinKeys = new Set(Object.keys(choiceMap));

  let choicesFixed = 0;
  let answerFixed = 0;
  let withdrawnFixed = 0;

  questions.forEach((q) => {
    // ── Fix choices ────────────────────────────────────────────────────────────
    if (q.choices && typeof q.choices === 'object') {
      const keys = Object.keys(q.choices);
      const needsRemap = keys.some(k => latinKeys.has(k));
      if (needsRemap) {
        const remapped = {};
        for (const [k, v] of Object.entries(q.choices)) {
          remapped[choiceMap[k] ?? k] = v;
        }
        q.choices = remapped;
        choicesFixed++;
      }
    }

    // ── Fix correctAnswer ──────────────────────────────────────────────────────
    if (q.correctAnswer !== undefined) {
      const ans = String(q.correctAnswer);

      // Withdrawn/disputed
      if (WITHDRAWN_PATTERNS.some(p => p.test(ans))) {
        q.correctAnswer = 'X';
        withdrawnFixed++;
      }
      // Latin key → Cyrillic
      else if (choiceMap[ans]) {
        q.correctAnswer = choiceMap[ans];
        answerFixed++;
      }
    }
  });

  const changed = choicesFixed + answerFixed + withdrawnFixed;
  const label = path.basename(filePath);

  if (changed === 0) {
    console.log(`  ✓ ${label} — already normalized (no changes)`);
    return;
  }

  if (!dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(raw, null, 2), 'utf-8');
  }

  console.log(`  ${dryRun ? '[dry]' : '✎'} ${label} — choices: ${choicesFixed}q, answers: ${answerFixed}q, withdrawn→X: ${withdrawnFixed}q`);
}

// ── Run ───────────────────────────────────────────────────────────────────────
for (const fp of filePaths) {
  try {
    normalizeFile(fp);
  } catch (e) {
    console.error(`  ✗ ${path.basename(fp)}: ${e.message}`);
  }
}

console.log(`\n${dryRun ? '[dry-run complete]' : '✓ Normalization complete.'}\n`);
