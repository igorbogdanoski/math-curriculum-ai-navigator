#!/usr/bin/env node
/**
 * scripts/generate-ai-solutions.mjs
 * ──────────────────────────────────────────────────────────────────────────────
 * Генерира `aiSolution` за сите прашања во внатрешната банка.
 * Работи директно на data/matura/raw/internal-matura-bank-gymnasium-mk.json
 *
 * Usage:
 *   node scripts/generate-ai-solutions.mjs                  # генерирај ги сите без решение
 *   node scripts/generate-ai-solutions.mjs --dry-run        # само броење, без пишување
 *   node scripts/generate-ai-solutions.mjs --force          # регенерирај дури и ако постои
 *   node scripts/generate-ai-solutions.mjs --limit 50       # само први N прашања
 *   node scripts/generate-ai-solutions.mjs --from 100       # почни од Q#100
 *   node scripts/generate-ai-solutions.mjs --topic algebra  # само дадена тема
 *   node scripts/generate-ai-solutions.mjs --part 1         # само МС (Дел 1)
 *   node scripts/generate-ai-solutions.mjs --part 2         # само Дел 2
 *   node scripts/generate-ai-solutions.mjs --save-every 10  # зачувувај секои N прашања (default: 20)
 *
 * Requires: GEMINI_API_KEY или VITE_GEMINI_API_KEY во .env.local
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const BANK_PATH = join(ROOT, 'data', 'matura', 'raw', 'internal-matura-bank-gymnasium-mk.json');

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const DRY_RUN   = args.includes('--dry-run');
const FORCE     = args.includes('--force');

function getArg(name) {
  const i = args.indexOf(name);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
}

const limitArg     = getArg('--limit')      ? Number(getArg('--limit'))      : null;
const fromArg      = getArg('--from')       ? Number(getArg('--from'))       : null;
const topicArg     = getArg('--topic')      ?? null;
const partArg      = getArg('--part')       ? Number(getArg('--part'))       : null;
const saveEvery    = getArg('--save-every') ? Number(getArg('--save-every')) : 20;

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
  console.error('✗ GEMINI_API_KEY не е поставен во .env.local');
  process.exit(1);
}

// ─── Gemini helper ────────────────────────────────────────────────────────────
// gemini-3-flash-preview: thinking enabled → поточни математички деривации за мatura решенија
// Fallback: gemini-2.5-flash-lite ако 3-flash не е достапен
const MODEL = 'gemini-3-flash-preview';

async function callGemini(prompt, retries = 4) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            maxOutputTokens: 2048,
            topP: 0.9,
          },
        }),
      });

      if (res.status === 429) {
        const wait = Math.min(attempt * 20000, 60000);
        process.stdout.write(`\n     ⏳ Rate limit — чекам ${wait/1000}s… `);
        await sleep(wait);
        continue;
      }
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body.substring(0, 200)}`);
      }
      const data = await res.json();
      // gemini-2.5 may return multiple parts (thinking + output); join all text parts
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter(p => p.text && !p.thought)  // skip thinking parts
        .map(p => p.text)
        .join('')
        .trim();
      if (!text) throw new Error('Празен одговор од Gemini');
      return text;

    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(4000 * attempt);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(q) {
  const isMC   = q.questionType === 'mc';
  const isPart3 = q.part === 3;

  if (isMC) {
    const choicesText = q.choices
      ? Object.entries(q.choices).map(([k, v]) => `${k}) ${v}`).join('\n')
      : '';
    const correctLabel = q.correctAnswer ?? '?';

    return `Ти си наставник по математика кој пишува кратки објаснувања за македонска државна матура.

Прашање (Дел 1 — мн. избор, 1 поен):
${q.questionText}

Избори:
${choicesText}

Точен одговор: ${correctLabel}

Напиши кратко решение на МАКЕДОНСКИ јазик. Барања:
- Прво покажи ја постапката за пресметување на точниот одговор (1-3 чекори)
- Потоа образложи зошто точниот одговор е точен (1 реченица)
- За секој погрешен избор, накратко објасни зошто е погрешен (по 1 реченица)
- Користи LaTeX нотација за математика (пр. $x^2$, $\\frac{a}{b}$)
- Максимум 120 збори
- НЕ го повторувај прашањето
- Почни директно со постапката

Врати САМО текст на решението, без JSON, без Markdown хедери.`;
  }

  if (isPart3) {
    return `Ти си наставник по математика кој пишува детални решенија за македонска државна матура.

Прашање (Дел 3 — отворен, ${q.points} поени, тема: ${q.topic ?? q.topicArea}):
${q.questionText}

Напиши ДЕТАЛНО чекор-по-чекор решение на МАКЕДОНСКИ јазик. Барања:
- Стратегија: накратко наведи метод (1 реченица)
- Целосна постапка со нумерирани чекори и LaTeX нотација
- Проверка на решението
- Финален одговор нагласен со ∴
- LaTeX нотација за сè математичко (пр. $\\sin^2\\alpha + \\cos^2\\alpha = 1$)
- Максимум 300 збори
- НЕ го повторувај прашањето
- Почни со „**Стратегија:**"

Врати САМО текст на решението, без JSON, без Markdown хедери.`;
  }

  // Part 2 — standard open question
  return `Ти си наставник по математика кој пишува чекор-по-чекор решенија за македонска државна матура.

Прашање (Дел 2 — отворен, ${q.points} поени, тема: ${q.topic ?? q.topicArea}):
${q.questionText}

Напиши чекор-по-чекор решение на МАКЕДОНСКИ јазик. Барања:
- Нумерирани чекори со LaTeX нотација за математика
- Јасна постапка, без прескокнување чекори
- Финален одговор нагласен со ∴
- Ако прашањето има повеќе делови (а, б, в...) — реши ги сите
- Максимум 200 збори
- НЕ го повторувај прашањето
- Почни директно со Чекор 1

Врати САМО текст на решението, без JSON, без Markdown хедери.`;
}

// ─── Load bank ────────────────────────────────────────────────────────────────
const bank      = JSON.parse(readFileSync(BANK_PATH, 'utf8'));
const questions = bank.questions;

// ─── Filter questions to process ─────────────────────────────────────────────
let toProcess = questions.filter(q => {
  if (!FORCE && q.aiSolution?.trim()) return false;
  if (partArg  !== null && q.part !== partArg)           return false;
  if (topicArg !== null && q.topicArea !== topicArg)     return false;
  if (fromArg  !== null && q.questionNumber < fromArg)   return false;
  return true;
});

if (limitArg !== null) toProcess = toProcess.slice(0, limitArg);

// ─── Stats header ─────────────────────────────────────────────────────────────
const sep = '═'.repeat(62);
console.log(`\n${sep}`);
console.log(`  Внатрешна банка — Auto-generate aiSolution`);
console.log(sep);
console.log(`  Вкупно во банката: ${questions.length}`);
console.log(`  За генерирање:     ${toProcess.length}`);
console.log(`  Модел:             ${MODEL}`);
console.log(`  Mode:              ${DRY_RUN ? 'DRY-RUN' : FORCE ? 'FORCE' : 'NORMAL'}`);
if (partArg)  console.log(`  Филтер дел:        ${partArg}`);
if (topicArg) console.log(`  Филтер тема:       ${topicArg}`);
if (fromArg)  console.log(`  Почни од Q#:       ${fromArg}`);
if (limitArg) console.log(`  Лимит:             ${limitArg}`);
console.log(sep);

if (toProcess.length === 0) {
  console.log('\n✓ Нема прашања за генерирање. Користи --force за регенерирање.\n');
  process.exit(0);
}

if (DRY_RUN) {
  const byTopic = {};
  const byPart  = {};
  toProcess.forEach(q => {
    byTopic[q.topicArea] = (byTopic[q.topicArea] || 0) + 1;
    byPart[q.part]       = (byPart[q.part]       || 0) + 1;
  });
  console.log('\nПо теми:', JSON.stringify(byTopic, null, 2));
  console.log('По дел:', JSON.stringify(byPart, null, 2));
  console.log(`\n✓ Dry-run. Отстрани --dry-run за генерирање.\n`);
  process.exit(0);
}

// ─── Process ──────────────────────────────────────────────────────────────────
// Build a mutable index for fast writes
const qIndex = new Map(questions.map(q => [q.questionNumber, q]));

let done   = 0;
let errors = 0;

console.log('');

for (let i = 0; i < toProcess.length; i++) {
  const q     = toProcess[i];
  const pct   = Math.round(((i + 1) / toProcess.length) * 100);
  const label = `Q#${String(q.questionNumber).padStart(3)} [${q.topicArea.substring(0,8).padEnd(8)}] Дел${q.part} ${q.points}pt`;

  process.stdout.write(`  [${String(i + 1).padStart(3)}/${toProcess.length}] ${pct.toString().padStart(3)}% ${label} … `);

  try {
    const prompt   = buildPrompt(q);
    const solution = await callGemini(prompt);

    // Write back into the index
    qIndex.get(q.questionNumber).aiSolution = solution;
    done++;

    const preview = solution.replace(/\n/g, ' ').slice(0, 70);
    console.log(`✓ "${preview}…"`);

  } catch (e) {
    console.log(`✗ ГРЕШКА: ${e.message.substring(0, 80)}`);
    errors++;
  }

  // Periodic save
  if ((i + 1) % saveEvery === 0) {
    bank.questions = Array.from(qIndex.values());
    writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2), 'utf8');
    console.log(`\n  💾 Зачувано (${done} генерирани, ${errors} грешки)\n`);
  }

  // Rate limit: ~2 req/sec (paid key — adjust down to 1500ms if 429s appear)
  await sleep(500);
}

// Final save
bank.questions = Array.from(qIndex.values());
writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2), 'utf8');

// ─── Summary ──────────────────────────────────────────────────────────────────
const remaining = bank.questions.filter(q => !q.aiSolution).length;
console.log(`\n${sep}`);
console.log(`  ✓ Генерирани:        ${done}`);
if (errors > 0)
  console.log(`  ✗ Грешки:           ${errors}`);
console.log(`  Преостанати без:     ${remaining}`);
console.log(sep);
console.log('');
