#!/usr/bin/env node
/**
 * scripts/generate-solutions.mjs
 * ──────────────────────────────────────────────────────────────────────────────
 * Генерира чекор-по-чекор `aiSolution` за отворени прашања (Дел II и III)
 * кои сè уште немаат решение во локалните JSON фајлови.
 *
 * Работи ДИРЕКТНО на data/matura/raw/*.json — нема потреба од Firestore.
 * Ги прескокнува: MC прашања (Дел I), прашања кои веќе имаат aiSolution,
 *                 и -key.json фајлови.
 *
 * Usage:
 *   node scripts/generate-solutions.mjs                  # сите фајлови
 *   node scripts/generate-solutions.mjs --exam 2025-june # само еден испит
 *   node scripts/generate-solutions.mjs --lang mk        # само MK верзии
 *   node scripts/generate-solutions.mjs --dry-run        # само листај, без пишување
 *   node scripts/generate-solutions.mjs --force          # регенерирај дури и ако постои
 *   node scripts/generate-solutions.mjs --part 3         # само Дел III
 *
 * Requires: GEMINI_API_KEY во .env.local или environment
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const RAW   = join(ROOT, 'data', 'matura', 'raw');

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE   = args.includes('--force');
function getArg(name) {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}
const examArg = getArg('--exam');
const langArg = getArg('--lang');
const partArg = getArg('--part') ? Number(getArg('--part')) : null;

// ─── Load .env.local ──────────────────────────────────────────────────────────
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('✗ GEMINI_API_KEY not set in .env.local');
  process.exit(1);
}

// ─── Gemini helper ────────────────────────────────────────────────────────────
const MODEL = 'gemini-2.5-flash';

async function callGemini(prompt, retries = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        }),
      });
      if (res.status === 429) {
        const wait = attempt * 15000;
        console.log(`     ⏳ Rate limit — чекам ${wait/1000}s…`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(3000 * attempt);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(q, lang) {
  const langNote = lang === 'mk' ? 'македонски јазик' : lang === 'al' ? 'Albanian language' : 'Turkish language';
  const isPartII = q.part === 2;

  return `You are a mathematics tutor writing step-by-step solutions for Macedonian state exam (ДИМ) questions. Write in ${langNote}.

Question ${q.questionNumber} (Part ${q.part}, ${q.points} points):
${q.questionText}

Correct answer: ${q.correctAnswer}

Write a CONCISE step-by-step solution in ${langNote}. Requirements:
- Use LaTeX math notation (e.g. $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$)
- ${isPartII ? 'Solve both sub-parts А and Б separately, labelled "А." and "Б."' : 'Show all key steps clearly'}
- Maximum 200 words
- Do NOT repeat the question text
- Start directly with the solution steps
- End with the final answer highlighted

Return ONLY the solution text, no JSON, no markdown headers.`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const files = readdirSync(RAW)
  .filter(f => f.endsWith('.json') && !f.includes('-key'))
  .filter(f => !examArg || f.includes(examArg))
  .filter(f => !langArg || f.endsWith(`-${langArg}.json`))
  .sort();

if (files.length === 0) {
  console.error('✗ Нема фајлови кои одговараат на филтерот.');
  process.exit(1);
}

// Collect all work items
const workItems = [];
for (const file of files) {
  const path = join(RAW, file);
  const doc  = JSON.parse(readFileSync(path, 'utf8'));
  const lang = doc.exam?.language ?? 'mk';
  const examLabel = file.replace('dim-gymnasium-', '').replace('.json', '');

  const toProcess = (doc.questions ?? []).filter(q => {
    if (q.part === 1) return false;                         // MC — прескокни
    if (q.questionType === 'mc') return false;              // MC тип — прескокни
    if (!FORCE && q.aiSolution?.trim()) return false;       // веќе има решение
    if (partArg && q.part !== partArg) return false;        // филтер по дел
    return true;
  });

  if (toProcess.length > 0) {
    workItems.push({ file, path, doc, lang, examLabel, toProcess });
  }
}

const totalQ = workItems.reduce((s, w) => s + w.toProcess.length, 0);
const totalF = workItems.length;

console.log(`\n${'═'.repeat(60)}`);
console.log(`  ДИМ Матура — Auto-generate aiSolution`);
console.log(`${'═'.repeat(60)}`);
console.log(`  Фајлови:   ${totalF}`);
console.log(`  Прашања:   ${totalQ}`);
console.log(`  Модел:     ${MODEL}`);
console.log(`  Mode:      ${DRY_RUN ? 'DRY-RUN (без пишување)' : FORCE ? 'FORCE (регенерирај сè)' : 'NORMAL (само без решение)'}`);
console.log(`${'═'.repeat(60)}\n`);

if (totalQ === 0) {
  console.log('✓ Сите отворени прашања веќе имаат aiSolution. Користи --force за регенерирање.\n');
  process.exit(0);
}

if (DRY_RUN) {
  for (const { examLabel, toProcess } of workItems) {
    console.log(`  ${examLabel}: ${toProcess.length} прашање(а)`);
    toProcess.forEach(q => console.log(`    Q${q.questionNumber} (Дел ${q.part}, ${q.points}pt) — ${q.topic ?? q.topicArea ?? '-'}`));
  }
  console.log(`\n✓ Dry-run завршен. Отстрани --dry-run за да генерираш.\n`);
  process.exit(0);
}

// ─── Process ──────────────────────────────────────────────────────────────────
let done = 0;
let errors = 0;

for (const { file, path, doc, lang, examLabel, toProcess } of workItems) {
  console.log(`\n▶ ${examLabel} (${toProcess.length} прашања)`);

  // Build a fresh questions map for this file
  const qMap = new Map(doc.questions.map(q => [q.questionNumber, q]));
  let changed = false;

  for (const q of toProcess) {
    const label = `Q${q.questionNumber} (Дел ${q.part}, ${q.points}pt)`;
    process.stdout.write(`  ${label} … `);

    try {
      const prompt   = buildPrompt(q, lang);
      const solution = await callGemini(prompt);

      if (!solution) throw new Error('Празен одговор од Gemini');

      // Write back into the doc's question object
      qMap.get(q.questionNumber).aiSolution = solution;
      changed = true;
      done++;

      // Print first 80 chars as preview
      const preview = solution.replace(/\n/g, ' ').slice(0, 80);
      console.log(`✓  "${preview}…"`);

    } catch (e) {
      console.log(`✗  ГРЕШКА: ${e.message}`);
      errors++;
    }

    // Small delay between calls to respect rate limits
    await sleep(1200);
  }

  // Save file if anything changed
  if (changed) {
    doc.questions = Array.from(qMap.values());
    writeFileSync(path, JSON.stringify(doc, null, 2), 'utf8');
    console.log(`  💾 Зачувано: ${file}`);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  ✓ Генерирани:  ${done}`);
if (errors > 0) console.log(`  ✗ Грешки:      ${errors}`);
console.log(`${'═'.repeat(60)}\n`);
