/**
 * scripts/backfill-matura-correct-answers.mjs
 *
 * Fills in missing `correctAnswer` for Part-2 matura questions that already
 * have a full step-by-step `aiSolution` — extracts the final stated answer
 * deterministically (no AI call), since the answer is already present in
 * trusted, previously-generated solution text. Does NOT attempt to solve
 * questions that have no aiSolution at all (left for manual review — see
 * scripts/__tests__/matura-correct-answer-golden.test.ts for the rationale).
 *
 * Usage:
 *   node scripts/backfill-matura-correct-answers.mjs              # dry-run
 *   node scripts/backfill-matura-correct-answers.mjs --apply      # write JSON files
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dir, '../data/matura/raw');
const DRY_RUN = !process.argv.includes('--apply');

/**
 * Extract the final answer from a worked solution's text.
 *
 * ONLY extracts when an explicit "∴" / "\therefore" conclusion marker is
 * present — spot-checking a sample confirmed these are reliably the actual
 * final answer. An earlier version of this script fell back to "last
 * non-empty line" when no marker was found, but that produced truncated
 * mid-solution fragments (e.g. "Чекор 4: Составување на равенката ... $y -
 * y_M = k(x - x" cut off mid-LaTeX) for solutions that don't end cleanly
 * right after the answer — unsafe for something that grades real students.
 * Those cases are intentionally left for manual review instead of guessed.
 */
export function extractFinalAnswer(aiSolution) {
  if (!aiSolution || !aiSolution.trim()) return null;
  // `\$?` swallows a stray closing math-mode `$` when the source wrote the
  // marker as inline math (`$\therefore$`) rather than plain text.
  const markerMatch = aiSolution.match(/(?:∴|\\therefore)\$?\s*(.+?)\s*$/s);
  if (!markerMatch) return null;
  const answer = markerMatch[1].trim();
  return answer || null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const files = readdirSync(RAW_DIR).filter(f => f.endsWith('.json'));
let totalCandidates = 0, extracted = 0, skippedNoSolution = 0;
const unresolved = [];

for (const file of files) {
  const path = join(RAW_DIR, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));

  let changed = false;
  for (const q of data.questions) {
    if (q.part !== 2 || (q.correctAnswer && q.correctAnswer !== '')) continue;
    totalCandidates++;
    if (!q.aiSolution) { skippedNoSolution++; continue; }

    const answer = extractFinalAnswer(q.aiSolution);
    if (!answer) { unresolved.push({ file, num: q.questionNumber }); continue; }

    q.correctAnswer = answer;
    changed = true;
    extracted++;
  }

  if (changed) {
    if (DRY_RUN) {
      console.log(`[DRY] Would update: ${file}`);
    } else {
      writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
      console.log(`✓ Updated: ${file}`);
    }
  }
}

console.log(`\nSummary: ${extracted}/${totalCandidates} Part-2 questions extracted`);
console.log(`Left for manual review — no aiSolution at all: ${skippedNoSolution}`);
console.log(`Left for manual review — has aiSolution but no clear ∴/therefore marker to extract from: ${unresolved.length}`);
if (unresolved.length > 0 && process.argv.includes('--list-unresolved')) {
  unresolved.forEach(u => console.log(`  - ${u.file} #${u.num}`));
}

if (DRY_RUN) {
  console.log('\n→ Run with --apply to write files');
}
