'use strict';
// fix-bank-issues.cjs
// A5: Fix problematic questions + A4: tag all with track: 'gymnasium'
// Run: node scripts/fix-bank-issues.cjs

const fs = require('fs');
const path = require('path');

const BANK_PATH = path.join(__dirname, '..', 'data', 'matura', 'raw', 'internal-matura-bank-gymnasium-mk.json');
const bank = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
let questions = bank.questions;

let fixed = 0;

questions = questions.map(q => {
  const out = { ...q };

  // ── A4: Tag every question with track: 'gymnasium' if not already set ──
  if (!out.track) {
    out.track = 'gymnasium';
    fixed++;
  }

  // ── A5a: Convert multi-select MC to open ──
  // These are questions where MC format doesn't fit (multiple correct answers)
  const multiSelectNums = [492, 493, 494, 499, 522, 622];
  if (multiSelectNums.includes(q.questionNumber) && q.questionType === 'mc') {
    out.questionType = 'open';
    out.choices = null;
    out.correctAnswer = null;
    console.log('FIXED multi-select MC→open: #' + q.questionNumber + ' ' + q.questionText.substring(0, 60));
  }

  // ── A5b: Remove Q#396 (x²=5x+6 — no correct answer in choices) ──
  // x²=5x+6 → x=-1 or x=6; choices are (5,6)(5,1)(2,3)(1,6) — all wrong
  // Mark as open (write-in) instead of removing, since the question itself is valid
  if (q.questionNumber === 396 && q.questionType === 'mc') {
    out.questionType = 'open';
    out.choices = null;
    out.correctAnswer = null;
    out.hints = ['x²-5x-6=0', 'D=25+24=49', 'x₁=6, x₂=-1'];
    console.log('FIXED bad choices MC→open: #' + q.questionNumber);
  }

  // ── A5c: Fix Q#598 ({2x-3y=2, 4x+y=4}) — answer (1,0) not in choices ──
  // Convert to open (the system is valid, the choices in original test were wrong)
  if (q.questionNumber === 598 && q.questionType === 'mc') {
    out.questionType = 'open';
    out.choices = null;
    out.correctAnswer = null;
    console.log('FIXED bad choices MC→open: #' + q.questionNumber);
  }

  return out;
});

// Recalculate counts
bank.questions = questions;
bank.exam.questionCount = questions.length;
bank.exam.totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);

// Write
fs.writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2), 'utf8');

const mcNoCA = questions.filter(q => q.questionType === 'mc' && !q.correctAnswer);
console.log('\n✅ fix-bank-issues complete');
console.log('   Questions tagged track=gymnasium: ' + fixed);
console.log('   Remaining MC without correctAnswer: ' + mcNoCA.length);
mcNoCA.forEach(q => console.log('   #' + q.questionNumber + ' ' + q.questionText.substring(0, 70)));
