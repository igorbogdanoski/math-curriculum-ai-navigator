/**
 * scripts/validate-matura.mjs
 * Validates a matura JSON file before import.
 *
 * Supports both question types:
 *   'mc'   — multiple-choice (choices А/Б/В/Г, correctAnswer = single letter)
 *   'open' — free-response (no choices, correctAnswer = model answer text)
 *
 * ДИМ Гимназија structure (30 questions):
 *   Part 1: Q1-Q15,  1 pt each, MC
 *   Part 2: Q16-Q20, 2 pts each, open
 *   Part 3: Q21-Q30, 3-5 pts each, open
 *
 * Usage:
 *   npm run matura:validate -- --input data/matura/raw/dim-gymnasium-2025-august-mk.json
 */

import fs from 'node:fs';
import path from 'node:path';

const VALID_CHOICES = ['А', 'Б', 'В', 'Г'];
const VALID_CORRECT_ANSWERS = [...VALID_CHOICES, 'X'];
const VALID_TOPIC_AREAS = [
  'algebra', 'analiza', 'geometrija', 'statistika',
  'kombinatorika', 'trigonometrija', 'matrici-vektori', 'broevi',
];
const VALID_LANGUAGES = ['mk', 'al', 'tr'];
const VALID_SESSIONS = ['june', 'august', 'demo'];
const VALID_TRACKS = ['gymnasium', 'vocational4', 'vocational3', 'gymnasium_elective'];
const VALID_QUESTION_TYPES = ['mc', 'open'];

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
  if (!exam.track || !VALID_TRACKS.includes(exam.track))
    errors.push(`exam.track must be one of: ${VALID_TRACKS.join(', ')}`);
  if (!exam.gradeLevel) errors.push('exam.gradeLevel is required');
  if (!exam.durationMinutes) errors.push('exam.durationMinutes is required');
  if (exam.language && !VALID_LANGUAGES.includes(exam.language))
    errors.push(`exam.language must be one of: ${VALID_LANGUAGES.join(', ')}`);
  if (exam.session && !VALID_SESSIONS.includes(exam.session))
    errors.push(`exam.session must be one of: ${VALID_SESSIONS.join(', ')}`);
}

// ─── Validate questions ───────────────────────────────────────────────────────
if (Array.isArray(questions)) {
  if (questions.length !== 30) {
    warnings.push(`Expected 30 questions, got ${questions.length}`);
  }

  const nums = new Set();

  questions.forEach((q, i) => {
    const loc = `questions[${i}] (Q${q.questionNumber ?? '?'})`;

    // ── Numbering ──────────────────────────────────────────────────────────────
    if (!q.questionNumber) errors.push(`${loc}: missing questionNumber`);
    if (nums.has(q.questionNumber))
      errors.push(`${loc}: duplicate questionNumber ${q.questionNumber}`);
    nums.add(q.questionNumber);

    // ── Question text ──────────────────────────────────────────────────────────
    if (!q.questionText || q.questionText.trim() === '')
      errors.push(`${loc}: empty questionText`);

    // ── questionType ───────────────────────────────────────────────────────────
    if (q.questionType && !VALID_QUESTION_TYPES.includes(q.questionType))
      errors.push(`${loc}: questionType must be 'mc' or 'open'`);

    // Infer type: if choices is null/empty/absent → open; else → mc
    const hasChoices =
      q.choices &&
      typeof q.choices === 'object' &&
      Object.keys(q.choices).length > 0;
    const isOpen = q.questionType === 'open' || !hasChoices;

    // ── MC-specific validation ─────────────────────────────────────────────────
    if (!isOpen) {
      for (const ch of VALID_CHOICES) {
        if (q.choices[ch] === undefined)
          errors.push(`${loc}: missing choice "${ch}"`);
      }
      if (!q.correctAnswer)
        errors.push(`${loc}: missing correctAnswer`);
      else if (!VALID_CORRECT_ANSWERS.includes(q.correctAnswer))
        errors.push(`${loc}: correctAnswer "${q.correctAnswer}" not in А/Б/В/Г/X`);
    }

    // ── Open-specific validation ───────────────────────────────────────────────
    if (isOpen) {
      if (!q.correctAnswer || String(q.correctAnswer).trim() === '')
        errors.push(`${loc}: open question must have correctAnswer (model answer)`);
    }

    // ── Common ────────────────────────────────────────────────────────────────
    if (!q.points || typeof q.points !== 'number')
      errors.push(`${loc}: missing or invalid points`);

    if (!q.topic) warnings.push(`${loc}: missing topic (recommended)`);

    if (q.part !== undefined && ![1, 2, 3].includes(q.part))
      errors.push(`${loc}: part must be 1, 2, or 3`);

    if (q.topicArea && !VALID_TOPIC_AREAS.includes(q.topicArea))
      errors.push(`${loc}: topicArea "${q.topicArea}" invalid`);

    if (q.dokLevel !== undefined && ![1, 2, 3, 4].includes(q.dokLevel))
      errors.push(`${loc}: dokLevel must be 1-4`);

    if (q.hasImage && !q.imageDescription)
      warnings.push(`${loc}: hasImage=true but imageDescription is empty`);

    // ── Part/points consistency ────────────────────────────────────────────────
    if (q.part === 1 && q.points !== 1)
      warnings.push(`${loc}: part=1 but points=${q.points} (expected 1)`);
    if (q.part === 2 && q.points !== 2)
      warnings.push(`${loc}: part=2 but points=${q.points} (expected 2)`);
    if (q.part === 3 && (q.points < 3 || q.points > 5))
      warnings.push(`${loc}: part=3 but points=${q.points} (expected 3-5)`);

    // ── Part/type consistency ──────────────────────────────────────────────────
    if (q.part === 1 && isOpen)
      warnings.push(`${loc}: part=1 question detected as open-ended (expected MC)`);
    if ((q.part === 2 || q.part === 3) && !isOpen)
      warnings.push(`${loc}: part=${q.part} question detected as MC (expected open)`);
  });

  // ── Part distribution ────────────────────────────────────────────────────────
  const byPart = { 1: 0, 2: 0, 3: 0 };
  questions.forEach(q => {
    if (q.part) byPart[q.part] = (byPart[q.part] || 0) + 1;
  });
  if (byPart[1] !== 15) warnings.push(`Part 1 should have 15 questions, has ${byPart[1]}`);
  if (byPart[2] !== 5)  warnings.push(`Part 2 should have 5 questions, has ${byPart[2]}`);
  if (byPart[3] !== 10) warnings.push(`Part 3 should have 10 questions, has ${byPart[3]}`);

  // ── Total points ─────────────────────────────────────────────────────────────
  const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
  const part1pts = byPart[1] * 1;  // 15
  const part2pts = byPart[2] * 2;  // 10
  const minTotal = part1pts + part2pts + byPart[3] * 3;  // min if all Part 3 = 3pts
  const maxTotal = part1pts + part2pts + byPart[3] * 5;  // max if all Part 3 = 5pts
  if (totalPoints < minTotal || totalPoints > maxTotal) {
    warnings.push(
      `Total points ${totalPoints} outside expected range [${minTotal}, ${maxTotal}]`
    );
  }

  // ── MC questions count ────────────────────────────────────────────────────────
  const mcCount = questions.filter(q =>
    q.questionType === 'mc' ||
    (q.choices && typeof q.choices === 'object' && Object.keys(q.choices).length > 0)
  ).length;
  const openCount = questions.length - mcCount;
  if (mcCount !== 15)
    warnings.push(`Expected 15 MC questions, got ${mcCount}`);
  if (openCount !== 15)
    warnings.push(`Expected 15 open questions, got ${openCount}`);
}

// ─── Report ───────────────────────────────────────────────────────────────────
const mc = questions?.filter(q =>
  q.questionType === 'mc' ||
  (q.choices && Object.keys(q.choices).length > 0)
).length ?? 0;
const open = (questions?.length ?? 0) - mc;
const total = questions?.reduce((s, q) => s + (q.points || 0), 0) ?? 0;

console.log(`\n📋 Validation: ${path.basename(inputPath)}`);
console.log(`   Exam: ${exam?.id ?? 'N/A'} | ${exam?.year} ${exam?.session} | ${exam?.language?.toUpperCase()}`);
console.log(`   Questions: ${questions?.length ?? 0} (MC: ${mc}, Open: ${open}) | Total pts: ${total}`);

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
