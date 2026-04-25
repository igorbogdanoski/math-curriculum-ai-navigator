#!/usr/bin/env node
/**
 * scripts/eval-ocr-cyrillic.mjs — S42-E5 МОН OCR recall evaluator (multi-language).
 *
 * Loads every JSON under eval/ocr-golden/<lang>.json, computes token-level
 * recall per sample, and fails when any language's average recall drops below
 * the configured minRecall (default 0.8).
 *
 * Falls back to eval/ocr-mk-golden.json when the folder is absent so the
 * old behaviour is preserved for existing CI pipelines.
 *
 * Usage:
 *   node scripts/eval-ocr-cyrillic.mjs [--min-recall 0.8] [--dry-run] [--lang mk]
 *
 * Behaviour:
 *   --dry-run        Skip Gemini calls; print golden set summary.
 *   --lang <code>    Evaluate only this language (e.g. --lang mk).
 *   No GEMINI_API_KEY → prints a skip notice and exits 0 (non-blocking).
 *   Missing image    → sample is reported as "skipped" (not failure).
 *
 * Exit codes:
 *   0   success, skipped, or dry-run
 *   1   recall fell below threshold for at least one language
 *   2   golden set malformed
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun      = args.includes('--dry-run');
const langIdx     = args.indexOf('--lang');
const langFilter  = langIdx !== -1 ? args[langIdx + 1] : null;
const minRecallIdx = args.indexOf('--min-recall');
const minRecallFlag = minRecallIdx !== -1 ? Number(args[minRecallIdx + 1]) : null;

const ROOT              = process.cwd();
const GOLDEN_DIR        = path.join(ROOT, 'eval', 'ocr-golden');
const LEGACY_GOLDEN     = path.join(ROOT, 'eval', 'ocr-mk-golden.json');

// ─── Load golden files ────────────────────────────────────────────────────────

function loadGoldenFile(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`✗ Failed to parse ${filePath}: ${e.message}`);
    process.exit(2);
  }
  if (!Array.isArray(parsed?.samples)) {
    console.error(`✗ Missing 'samples' array in ${filePath}`);
    process.exit(2);
  }
  return parsed;
}

function collectGoldenFiles() {
  // Prefer per-language folder
  if (fs.existsSync(GOLDEN_DIR)) {
    const files = fs.readdirSync(GOLDEN_DIR)
      .filter(f => f.endsWith('.json'))
      .filter(f => !langFilter || f === `${langFilter}.json`)
      .map(f => path.join(GOLDEN_DIR, f));
    if (files.length > 0) return files;
  }

  // Fallback: legacy mk-only file
  if (fs.existsSync(LEGACY_GOLDEN)) {
    if (!langFilter || langFilter === 'mk') {
      console.log('⚠ eval/ocr-golden/ not found — using legacy eval/ocr-mk-golden.json');
      return [LEGACY_GOLDEN];
    }
  }

  console.error('✗ No golden files found.');
  process.exit(2);
}

// ─── Token recall ─────────────────────────────────────────────────────────────

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

// ─── Gemini OCR ───────────────────────────────────────────────────────────────

async function ocrViaGemini(imagePath, language, apiKey) {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const data = fs.readFileSync(imagePath);
  const mime = /\.jpe?g$/i.test(imagePath) ? 'image/jpeg' : 'image/png';

  const langHint = language && language !== 'auto'
    ? `Original language: ${language}. Preserve diacritics and the source script exactly. Do NOT transliterate.`
    : 'Detect the source language automatically. Preserve all diacritics and original script exactly.';

  const result = await model.generateContent([
    { inlineData: { data: data.toString('base64'), mimeType: mime } },
    `Extract the mathematical expression from this image. ${langHint} Return ONLY the LaTeX without any commentary, no $ delimiters.`,
  ]);
  return result.response.text().trim();
}

// ─── Evaluate one golden file ─────────────────────────────────────────────────

async function evaluateFile(filePath, minRecallDefault, apiKey) {
  const golden = loadGoldenFile(filePath);
  const lang     = golden.language ?? path.basename(filePath, '.json');
  const minRecall = Number.isFinite(minRecallFlag) ? minRecallFlag
    : Number.isFinite(Number(golden.minRecall)) ? Number(golden.minRecall)
    : minRecallDefault;

  console.log(`\n▶ Language: ${lang.toUpperCase()}  (${golden.samples.length} samples, threshold ${(minRecall * 100).toFixed(0)}%)`);

  if (dryRun) {
    for (const s of golden.samples) {
      console.log(`  ${s.id}  [${s.kind}]  ${s.image}  →  ${s.groundTruthLatex}`);
    }
    return { lang, pass: true, skipped: golden.samples.length, scored: 0 };
  }

  let scored = 0, skipped = 0, recallSum = 0;
  const failures = [];

  for (const s of golden.samples) {
    const imgPath = path.join(ROOT, s.image);
    if (!fs.existsSync(imgPath)) {
      console.log(`  ${s.id}: SKIPPED (image missing)`);
      skipped++;
      continue;
    }
    try {
      const ocr = await ocrViaGemini(imgPath, lang, apiKey);
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
    console.log('  ⚠ No usable samples — gate is a no-op until images land.');
    return { lang, pass: true, skipped, scored: 0 };
  }

  const avg = recallSum / scored;
  const pass = avg >= minRecall;
  console.log(`  Avg recall: ${(avg * 100).toFixed(1)}%  Failures: ${failures.length}  ${pass ? '✓ PASS' : '✗ FAIL'}`);
  return { lang, pass, skipped, scored, avg, failures };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = collectGoldenFiles();

  console.log(`▶ МОН OCR multi-language recall evaluator`);
  console.log(`  Golden files: ${files.length} (${files.map(f => path.basename(f, '.json')).join(', ')})`);

  if (dryRun) {
    console.log('  Mode: dry-run\n');
    for (const f of files) await evaluateFile(f, 0.8, null);
    process.exit(0);
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.log('\n⚠ No GEMINI_API_KEY — skipping live OCR. CI gate is non-blocking in this state.');
    process.exit(0);
  }

  const results = [];
  for (const f of files) {
    results.push(await evaluateFile(f, 0.8, apiKey));
  }

  const failed = results.filter(r => !r.pass);
  console.log(`\n=== Summary ===`);
  for (const r of results) {
    const avgStr = r.avg !== undefined ? `${(r.avg * 100).toFixed(1)}%` : 'n/a (no images)';
    console.log(`  ${r.lang.toUpperCase()}: ${avgStr}  ${r.pass ? '✓' : '✗'}`);
  }

  if (failed.length > 0) {
    console.error(`\n✗ ${failed.length} language(s) below threshold: ${failed.map(r => r.lang).join(', ')}`);
    process.exit(1);
  }
  console.log(`\n✓ All languages meet the recall gate.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
