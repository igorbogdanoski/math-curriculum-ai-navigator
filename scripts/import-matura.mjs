/**
 * scripts/import-matura.mjs
 * Imports a validated matura JSON file into Firestore.
 *
 * Usage:
 *   npm run matura:import -- --input data/matura/raw/dim-gymnasium-2025-august-mk.json
 *   npm run matura:import -- --input data/matura/raw/dim-gymnasium-2025-august-mk.json --dry-run
 *
 * Requires: GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT env var pointing
 * to a Firebase Admin SDK service account JSON.
 *
 * Collections written:
 *   matura_exams/{examId}           — exam metadata
 *   matura_questions/{examId_qN}    — one doc per question
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const dryRun = args.includes('--dry-run');

if (inputIdx === -1 || !args[inputIdx + 1]) {
  console.error('Usage: npm run matura:import -- --input <path-to-json> [--dry-run]');
  process.exit(1);
}
const inputPath = args[inputIdx + 1];

// ─── Run validate first ────────────────────────────────────────────────────────
console.log('\n▶ Running validation first...');
try {
  execSync(`node scripts/validate-matura.mjs --input ${inputPath}`, { stdio: 'inherit' });
} catch {
  console.error('\n✗ Validation failed — import aborted.');
  process.exit(1);
}

// ─── Load JSON ────────────────────────────────────────────────────────────────
const raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf-8'));
const { exam, questions } = raw;

if (dryRun) {
  console.log('\n🔍 DRY-RUN MODE — nothing will be written to Firestore.\n');
  console.log(`   Exam doc:  matura_exams/${exam.id}`);
  console.log(`   Questions: ${questions.length} docs in matura_questions/`);
  questions.forEach(q => {
    const docId = `${exam.id}_q${String(q.questionNumber).padStart(2, '0')}`;
    console.log(`     matura_questions/${docId}  (Q${q.questionNumber} part=${q.part} pts=${q.points} topicArea=${q.topicArea ?? '-'})`);
  });
  console.log(`\n✓ Dry-run complete. Run without --dry-run to import.\n`);
  process.exit(0);
}

// ─── Firebase Admin SDK ────────────────────────────────────────────────────────
// We use dynamic import so the script can be run without firebase-admin when dry-running.
let admin;
try {
  const adminModule = await import('firebase-admin');
  admin = adminModule.default;
} catch {
  console.error('✗ firebase-admin not found. Run: npm install firebase-admin');
  process.exit(1);
}

// Initialise — supports GOOGLE_APPLICATION_CREDENTIALS (file path) or
// FIREBASE_SERVICE_ACCOUNT (inline JSON string, for CI/CD secrets)
if (!admin.apps.length) {
  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saEnv) {
    const serviceAccount = JSON.parse(saEnv);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } else {
    console.error(
      '✗ No Firebase credentials found.\n' +
      '  Set GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccount.json\n' +
      '  or FIREBASE_SERVICE_ACCOUNT=<inline JSON>',
    );
    process.exit(1);
  }
}

const db = admin.firestore();

// ─── Build exam doc ────────────────────────────────────────────────────────────
const examDoc = {
  ...exam,
  questionCount: questions.length,
  totalPoints: questions.reduce((s, q) => s + (q.points || 0), 0),
  importedAt: new Date().toISOString(),
};

// ─── Build question docs ───────────────────────────────────────────────────────
const questionDocs = questions.map(q => {
  const docId = `${exam.id}_q${String(q.questionNumber).padStart(2, '0')}`;
  return {
    id: docId,
    examId: exam.id,
    year: exam.year,
    session: exam.session ?? null,
    track: exam.track,
    language: exam.language,
    gradeLevel: exam.gradeLevel,
    questionNumber: q.questionNumber,
    part: q.part ?? null,
    points: q.points,
    questionText: q.questionText,
    choices: q.choices,
    correctAnswer: q.correctAnswer,
    topic: q.topic ?? null,
    topicArea: q.topicArea ?? null,
    conceptIds: q.conceptIds ?? [],
    imageUrls: q.imageUrls ?? [],
    hasImage: q.hasImage ?? false,
    imageDescription: q.imageDescription ?? null,
    dokLevel: q.dokLevel ?? null,
    questionGroupId: q.questionGroupId ?? null,
    hints: q.hints ?? [],
    aiSolution: q.aiSolution ?? null,
    successRatePercent: q.successRatePercent ?? null,
    createdAt: new Date().toISOString(),
  };
});

// ─── Write to Firestore ────────────────────────────────────────────────────────
console.log(`\n▶ Importing to Firestore...`);
console.log(`   Exam: matura_exams/${exam.id}`);
console.log(`   Questions: ${questionDocs.length} docs`);

// Firestore batch limit is 500 ops. We have ≤20 questions + 1 exam = well within limit.
const batch = db.batch();

// Exam metadata
const examRef = db.collection('matura_exams').doc(exam.id);
batch.set(examRef, examDoc, { merge: true });

// Questions
for (const qDoc of questionDocs) {
  const { id, ...data } = qDoc;
  const qRef = db.collection('matura_questions').doc(id);
  batch.set(qRef, data, { merge: true });
}

await batch.commit();

console.log(`\n✓ Import complete.`);
console.log(`   matura_exams/${exam.id}  (merged)`);
console.log(`   matura_questions/*  (${questionDocs.length} docs merged)\n`);
