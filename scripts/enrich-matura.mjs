/**
 * scripts/enrich-matura.mjs
 * AI-enriches matura questions already in Firestore:
 *   - generates 3-level progressive hints
 *   - generates a step-by-step aiSolution
 *   - auto-tags conceptIds from the curriculum concept list
 *
 * Usage:
 *   npm run matura:enrich -- --examId dim-gymnasium-2025-august-mk
 *   npm run matura:enrich -- --examId dim-gymnasium-2025-august-mk --dry-run
 *   npm run matura:enrich -- --examId dim-gymnasium-2025-august-mk --force   # re-enrich even if already done
 *
 * Requires:
 *   GEMINI_API_KEY (or VITE_GEMINI_API_KEY) in environment
 *   GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT for Firestore
 */

import { execSync } from 'node:child_process';

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const examIdIdx = args.indexOf('--examId');
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (examIdIdx === -1 || !args[examIdIdx + 1]) {
  console.error('Usage: npm run matura:enrich -- --examId <examId> [--dry-run] [--force]');
  process.exit(1);
}
const examId = args[examIdIdx + 1];

// ─── Gemini key ───────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('✗ GEMINI_API_KEY (or VITE_GEMINI_API_KEY) not set.');
  process.exit(1);
}

// ─── Firebase Admin ───────────────────────────────────────────────────────────
let admin;
try {
  const m = await import('firebase-admin');
  admin = m.default;
} catch {
  console.error('✗ firebase-admin not installed. Run: npm install firebase-admin');
  process.exit(1);
}

if (!admin.apps.length) {
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saEnv) {
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saEnv)) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    console.error('✗ No Firebase credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.');
    process.exit(1);
  }
}
const db = admin.firestore();

// ─── Load questions for this exam ─────────────────────────────────────────────
console.log(`\n▶ Loading questions for exam: ${examId}`);
const snapshot = await db.collection('matura_questions')
  .where('examId', '==', examId)
  .orderBy('questionNumber')
  .get();

if (snapshot.empty) {
  console.error(`✗ No questions found for examId="${examId}". Import first with matura:import.`);
  process.exit(1);
}

const docs = snapshot.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));
const toEnrich = force
  ? docs
  : docs.filter(d => !d.hints || d.hints.length === 0 || !d.aiSolution);

console.log(`   Total questions: ${docs.length}`);
console.log(`   Need enrichment: ${toEnrich.length}${force ? ' (--force: all)' : ''}`);

if (toEnrich.length === 0) {
  console.log('\n✓ All questions already enriched. Use --force to re-enrich.\n');
  process.exit(0);
}

if (dryRun) {
  console.log('\n🔍 DRY-RUN — would enrich:');
  toEnrich.forEach(q => console.log(`   Q${q.questionNumber}: ${q.topic ?? q.topicArea ?? '-'}`));
  console.log(`\n✓ Dry-run complete. Remove --dry-run to apply.\n`);
  process.exit(0);
}

// ─── Gemini helper ────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ─── Build enrich prompt ──────────────────────────────────────────────────────
function buildPrompt(q) {
  const choicesText = Object.entries(q.choices ?? {})
    .map(([k, v]) => `${k}) ${v}`)
    .join('\n');

  return `You are a Macedonian high-school mathematics tutor. A student is practicing a state exam (ДИМ) question.

Question ${q.questionNumber} (Part ${q.part ?? '?'}, ${q.points ?? '?'} points, Topic: ${q.topic ?? q.topicArea ?? 'unknown'}):
${q.questionText}

Choices:
${choicesText}

Correct answer: ${q.correctAnswer}

Your task — respond with ONLY valid JSON (no markdown, no extra text):
{
  "hints": [
    "Hint 1 — gentle nudge, no math yet (1 sentence)",
    "Hint 2 — key formula or approach (1-2 sentences, LaTeX ok)",
    "Hint 3 — worked partial solution showing the key step"
  ],
  "aiSolution": "Full step-by-step solution in Macedonian. Use LaTeX for math (inline: $...$, display: $$...$$). Show each step clearly. End with: 'Точниот одговор е ${q.correctAnswer}.'",
  "conceptIds": ["concept-slug-1", "concept-slug-2"]
}

Rules:
- All text in Macedonian (MK)
- hints[0]: no math, just a conceptual direction
- hints[1]: name the key theorem/formula needed
- hints[2]: show the first 1-2 steps
- aiSolution: complete worked solution, all steps visible
- conceptIds: 1-3 lowercase-kebab-case slugs matching the mathematical concepts (e.g. "linearna-funkcija", "kvadratna-ravenka", "trigonometrija-osnovi")
`;
}

// ─── Enrich loop ──────────────────────────────────────────────────────────────
console.log(`\n▶ Enriching ${toEnrich.length} questions with Gemini...\n`);

let successCount = 0;
let errorCount = 0;

for (const q of toEnrich) {
  process.stdout.write(`   Q${String(q.questionNumber).padStart(2, ' ')} (${q.topic ?? q.topicArea ?? '-'})... `);

  try {
    const prompt = buildPrompt(q);
    const raw = await callGemini(prompt);

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const enrichment = JSON.parse(cleaned);

    if (!Array.isArray(enrichment.hints) || enrichment.hints.length !== 3) {
      throw new Error('hints must be array of 3');
    }
    if (typeof enrichment.aiSolution !== 'string') {
      throw new Error('aiSolution must be string');
    }

    await q.ref.update({
      hints: enrichment.hints,
      aiSolution: enrichment.aiSolution,
      ...(Array.isArray(enrichment.conceptIds) && enrichment.conceptIds.length > 0
        ? { conceptIds: enrichment.conceptIds }
        : {}),
      enrichedAt: new Date().toISOString(),
    });

    console.log(`✓  (${enrichment.conceptIds?.join(', ') ?? '-'})`);
    successCount++;

    // Polite rate-limit: 1 req/s to stay within Gemini free tier
    await new Promise(r => setTimeout(r, 1100));
  } catch (err) {
    console.log(`✗  ${err.message}`);
    errorCount++;
  }
}

console.log(`\n─────────────────────────────────────`);
console.log(`✓ Enriched: ${successCount}/${toEnrich.length}`);
if (errorCount > 0) console.log(`✗ Errors:   ${errorCount} (re-run to retry)`);
console.log(`─────────────────────────────────────\n`);
