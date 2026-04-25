#!/usr/bin/env node
/**
 * scripts/eval-ocr-cyrillic.mjs — S41-D6 МОН OCR recall evaluator.
 *
 * Loads eval/ocr-mk-golden.json, computes token-level recall between the
 * ground-truth LaTeX and Gemini Vision OCR output for each sample, and
 * fails the run when the average recall drops below the configured
 * minRecall (default 0.8).
 *
 * Usage:
 *   node scripts/eval-ocr-cyrillic.mjs [--min-recall 0.8] [--dry-run]
 *
 * Behaviour:
 *   --dry-run        Skip the actual Gemini call; print golden set summary.
 *   No GEMINI_API_KEY → prints a friendly skip notice and exits with code 0
 *                      so the CI gate is non-blocking until creds + images
 *                      are wired in.
 *   Missing image    → sample is reported as "skipped" (not failure) so the
 *                      golden set can grow incrementally.
 *
 * Exit codes:
 *   0   success or skipped (no creds / dry-run / no usable samples)
 *   1   recall fell below the threshold
 *   2   golden set malformed
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const minRecallIdx = args.indexOf('--min-recall');
const minRecallFlag = minRecallIdx !== -1 ? Number(args[minRecallIdx + 1]) : null;

const ROOT = process.cwd();
const GOLDEN_PATH = path.join(ROOT, 'eval', 'ocr-mk-golden.json');

function loadGolden() {
  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error(`✗ Golden set not found at ${GOLDEN_PATH}`);
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  } catch (e) {
    console.error('✗ Failed to parse golden set:', e.message);
    process.exit(2);
  }
  if (!Array.isArray(parsed?.samples)) {
    console.error('✗ Golden set missing `samples` array.');
    process.exit(2);
  }
  return parsed;
}

/** Normalize LaTeX for comparison: lowercase, strip whitespace + braces. */
function tokenize(latex) {
  return String(latex || '')
    .toLowerCase()
    .replace(/[{}\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Token-recall = |GT ∩ OCR| / |GT|. */
export function tokenRecall(groundTruth, ocr) {
  const gt = tokenize(groundTruth);
  if (gt.length === 0) return 0;
  const ocrSet = new Set(tokenize(ocr));
  let hit = 0;
  for (const t of gt) if (ocrSet.has(t)) hit++;
  return hit / gt.length;
}

async function ocrViaGemini(imagePath, apiKey) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const data = fs.readFileSync(imagePath);
  const mime = imagePath.endsWith('.jpg') || imagePath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
  const result = await model.generateContent([
    {
      inlineData: { data: data.toString('base64'), mimeType: mime },
    },
    'Extract the mathematical expression from this image. Return ONLY the LaTeX without any commentary, no $ delimiters.',
  ]);
  return result.response.text().trim();
}

async function main() {
  const golden = loadGolden();
  const minRecall = Number.isFinite(minRecallFlag) ? minRecallFlag : Number(golden.minRecall ?? 0.8);

  console.log(`▶ МОН OCR cyrillic recall evaluator`);
  console.log(`  Golden samples: ${golden.samples.length}`);
  console.log(`  Min recall:     ${(minRecall * 100).toFixed(0)}%`);

  if (dryRun) {
    console.log('\n— Dry-run — listing samples:');
    for (const s of golden.samples) {
      console.log(`  ${s.id}  [${s.kind}]  ${s.image}  →  ${s.groundTruthLatex}`);
    }
    process.exit(0);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.log('\n⚠ No GEMINI_API_KEY set — skipping live OCR. CI gate is non-blocking in this state.');
    process.exit(0);
  }

  let scored = 0;
  let skipped = 0;
  let recallSum = 0;
  const failures = [];

  for (const s of golden.samples) {
    const imgPath = path.join(ROOT, s.image);
    if (!fs.existsSync(imgPath)) {
      console.log(`  ${s.id}: SKIPPED (image missing: ${s.image})`);
      skipped++;
      continue;
    }
    try {
      const ocr = await ocrViaGemini(imgPath, apiKey);
      const recall = tokenRecall(s.groundTruthLatex, ocr);
      recallSum += recall;
      scored++;
      const ok = recall >= minRecall;
      console.log(`  ${s.id}: ${(recall * 100).toFixed(0)}%  ${ok ? '✓' : '✗'}`);
      if (!ok) failures.push({ id: s.id, recall, ocr });
    } catch (e) {
      console.log(`  ${s.id}: ERROR (${e.message})`);
      failures.push({ id: s.id, recall: 0, error: e.message });
      scored++;
    }
  }

  if (scored === 0) {
    console.log('\n⚠ No usable samples — gate is a no-op until images land.');
    process.exit(0);
  }

  const avg = recallSum / scored;
  console.log(`\n=== Result ===`);
  console.log(`  Scored:   ${scored}`);
  console.log(`  Skipped:  ${skipped}`);
  console.log(`  Avg recall: ${(avg * 100).toFixed(1)}%`);
  console.log(`  Failures:   ${failures.length}`);

  if (avg < minRecall) {
    console.error(`\n✗ Avg recall ${(avg * 100).toFixed(1)}% < threshold ${(minRecall * 100).toFixed(0)}%.`);
    process.exit(1);
  }
  console.log(`\n✓ Recall meets gate (≥ ${(minRecall * 100).toFixed(0)}%).`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
