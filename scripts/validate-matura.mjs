/**
 * scripts/validate-matura.mjs
 * Validates a matura JSON file before import.
 *
 * Usage:
 *   npm run matura:validate -- --input data/matura/raw/dim-gymnasium-2025-august-mk.json
 */

import fs from 'node:fs';
import path from 'node:path';

const VALID_CHOICES = ['А', 'Б', 'В', 'Г'];
const VALID_TOPIC_AREAS = ['algebra', 'analiza', 'geometrija', 'statistika',
  'kombinatorika', 'trigonometrija', 'matrici-vektori', 'broevi'];
const VALID_LANGUAGES = ['mk', 'al', 'tr'];
const VALID_SESSIONS = ['june', 'august', 'demo'];
const VALID_TRACKS = ['gymnasium', 'vocational4', 'vocational3', 'gymnasium_elective'];

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
if (inputIdx === -1 || !args[inputIdx + 1]) {
  console.error('Usage: npm run matura:validate -- --input <path-to-json>');
  process.exit(1);
}
const inputPath = args[inputIdx + 1];

// ─── Load ─────────────────────────────────────────────────────────────────────
let raw;
try {
  raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf-8'));
} catch (e) {
  console.error(`✗ Cannot read/parse file: ${e.message}`);
  process.exit(1);
}

const errors = [];
const warnings = [];

// ─── Validate exam header ─────────────────────────────────────────────────────
const { exam, questions } = raw;

if (!exam) errors.push('Missing "exam" object');
if (!questions || !Array.isArray(questions)) errors.push('Missing "questions" array');

if (exam) {
  if (!exam.id) errors.push('exam.id is required');
  if (!exam.year || typeof exam.year !== 'number') errors.push('exam.year must be a number');
  if (!exam.track || !VALID_TRACKS.includes(exam.track)) errors.push(`exam.track must be one of: ${VALID_TRACKS.join(', ')}`);
  if (!exam.gradeLevel) errors.push('exam.gradeLevel is required');
  if (!exam.durationMinutes) errors.push('exam.durationMinutes is required');
  if (exam.language && !VALID_LANGUAGES.includes(exam.language)) errors.push(`exam.language must be one of: ${VALID_LANGUAGES.join(', ')}`);
  if (exam.session && !VALID_SESSIONS.includes(exam.session)) errors.push(`exam.session must be one of: ${VALID_SESSIONS.join(', ')}`);
}

// ─── Validate questions ───────────────────────────────────────────────────────
if (Array.isArray(questions)) {
  if (questions.length !== 20) {
    warnings.push(`Expected 20 questions, got ${questions.length}`);
  }

  const nums = new Set();

  questions.forEach((q, i) => {
    const loc = `questions[${i}] (Q${q.questionNumber ?? '?'})`;

    if (!q.questionNumber) errors.push(`${loc}: missing questionNumber`);
    if (nums.has(q.questionNumber)) errors.push(`${loc}: duplicate questionNumber ${q.questionNumber}`);
    nums.add(q.questionNumber);

    if (!q.questionText || q.questionText.trim() === '') errors.push(`${loc}: empty questionText`);
    if (!q.choices || typeof q.choices !== 'object') {
      errors.push(`${loc}: missing choices`);
    } else {
      for (const ch of VALID_CHOICES) {
        if (!q.choices[ch] && q.choices[ch] !== '') errors.push(`${loc}: missing choice "${ch}"`);
      }
    }

    if (!q.correctAnswer) errors.push(`${loc}: missing correctAnswer`);
    else if (!VALID_CHOICES.includes(q.correctAnswer)) errors.push(`${loc}: correctAnswer "${q.correctAnswer}" not in А/Б/В/Г`);

    if (!q.topic) warnings.push(`${loc}: missing topic (recommended)`);
    if (!q.points || typeof q.points !== 'number') errors.push(`${loc}: missing or invalid points`);

    if (q.part !== undefined && ![1, 2, 3].includes(q.part)) errors.push(`${loc}: part must be 1, 2, or 3`);
    if (q.topicArea && !VALID_TOPIC_AREAS.includes(q.topicArea)) errors.push(`${loc}: topicArea "${q.topicArea}" invalid`);
    if (q.dokLevel !== undefined && ![1, 2, 3, 4].includes(q.dokLevel)) errors.push(`${loc}: dokLevel must be 1-4`);
    if (q.hasImage && (!q.imageDescription)) warnings.push(`${loc}: hasImage=true but imageDescription is empty`);

    // Part/points consistency
    if (q.part === 1 && q.points !== 1) warnings.push(`${loc}: part=1 but points=${q.points} (expected 1)`);
    if (q.part === 2 && q.points !== 2) warnings.push(`${loc}: part=2 but points=${q.points} (expected 2)`);
    if (q.part === 3 && q.points !== 3) warnings.push(`${loc}: part=3 but points=${q.points} (expected 3)`);
  });

  // Check part distribution
  const byPart = { 1: 0, 2: 0, 3: 0 };
  questions.forEach(q => { if (q.part) byPart[q.part] = (byPart[q.part] || 0) + 1; });
  if (byPart[1] !== 10) warnings.push(`Part 1 should have 10 questions, has ${byPart[1]}`);
  if (byPart[2] !== 5) warnings.push(`Part 2 should have 5 questions, has ${byPart[2]}`);
  if (byPart[3] !== 5) warnings.push(`Part 3 should have 5 questions, has ${byPart[3]}`);

  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
  if (totalPoints !== 35) warnings.push(`Total points should be 35, got ${totalPoints}`);
}

// ─── Report ───────────────────────────────────────────────────────────────────
console.log(`\n📋 Validation: ${path.basename(inputPath)}`);
console.log(`   Exam: ${exam?.id ?? 'N/A'} | ${exam?.year} ${exam?.session} | ${exam?.language?.toUpperCase()}`);
console.log(`   Questions: ${questions?.length ?? 0}`);

if (warnings.length > 0) {
  console.log(`\n⚠️  Warnings (${warnings.length}):`);
  warnings.forEach(w => console.log(`   - ${w}`));
}

if (errors.length > 0) {
  console.log(`\n✗ Errors (${errors.length}):`);
  errors.forEach(e => console.log(`   - ${e}`));
  console.log('\n✗ Validation FAILED — fix errors before import.\n');
  process.exit(1);
} else {
  console.log(`\n✓ Validation PASSED${warnings.length > 0 ? ' (with warnings)' : ''}.\n`);
}
