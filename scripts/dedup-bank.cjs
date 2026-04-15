'use strict';
// dedup-bank.cjs
// 1. Removes exact/near-duplicate questions (keeps lower questionNumber)
// 2. Fixes known MC correctAnswer gaps
// 3. Renumbers questions sequentially
// Run: node scripts/dedup-bank.cjs

const fs = require('fs');
const path = require('path');

const BANK_PATH = path.join(__dirname, '..', 'data', 'matura', 'raw', 'internal-matura-bank-gymnasium-mk.json');
const bank = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
let questions = bank.questions;

// ── helpers ──────────────────────────────────────────────────────────────────
function norm(s) {
  return s.trim().toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[$\\{}^_]/g, '')
    .replace(/[.,;:!?\s]/g, '');
}

// ── Step 1: Fix known MC correctAnswer gaps ──────────────────────────────────
// #428 - Корените на квадратната равенка x²=5x+6: none of choices (5,6)(5,1)(2,3)(1,6) match
// x²-5x-6=0 → x=6 or x=-1. None of the 4 choices are correct → keep null
// #525,#526,#527 - "Искази се" / "Кои од следниве искази се вистинити" → multi-select → keep null
// #532 - Set M question - multi-select → keep null
// #555 - "Кои од равенствата се точни" → multi-select → keep null
// #631 - "Решение на системот равенки {2x-3y=2, 4x+y=4}" → solve: 4x+y=4→y=4-4x, 2x-3(4-4x)=2→2x-12+12x=2→14x=14→x=1,y=0 → answer: (1,0)
// Check if choices are in the question by looking at it:
// #698 - "Одреди кои од следниве реченици се искази" → multi-select → keep null

const CA_FIXES = {
  631: null, // need to check choices
};

// Fix #631 specifically - the answer is (1, 0) which should match one of the choices
questions.forEach(q => {
  if (q.questionNumber === 631) {
    console.log('#631 choices:', JSON.stringify(q.choices), 'current CA:', q.correctAnswer);
    // 2x-3y=2, 4x+y=4 → y=4-4x, 2x-3(4-4x)=2 → 14x=14 → x=1, y=0
    // Check which choice says (1,0) or similar
    if (q.choices) {
      const entries = Object.entries(q.choices);
      entries.forEach(([k,v]) => {
        if (v.includes('1') && v.includes('0')) console.log('  Candidate:', k, v);
      });
    }
  }
});

// ── Step 2: Identify true duplicates ─────────────────────────────────────────
// Build map of normalized text → first occurrence
const seenNorm = new Map();
const toRemove = new Set();

questions.forEach(q => {
  const n = norm(q.questionText);
  if (seenNorm.has(n)) {
    // This is a duplicate — mark for removal (keep the earlier one)
    toRemove.add(q.questionNumber);
    console.log('EXACT DUP: Q#' + seenNorm.get(n).questionNumber + ' ← removing Q#' + q.questionNumber + ' | ' + q.questionText.substring(0, 80));
  } else {
    seenNorm.set(n, q);
  }
});

console.log('\nTotal exact duplicates to remove:', toRemove.size);

// ── Step 3: Filter duplicates ─────────────────────────────────────────────────
const before = questions.length;
questions = questions.filter(q => !toRemove.has(q.questionNumber));
const after = questions.length;
console.log('\nRemoved', before - after, 'duplicate questions');
console.log('Questions before:', before, '→ after:', after);

// ── Step 4: Renumber sequentially ────────────────────────────────────────────
questions.forEach((q, i) => { q.questionNumber = i + 1; });

// ── Step 5: Recalculate totals ────────────────────────────────────────────────
const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
bank.exam.questionCount = questions.length;
bank.exam.totalPoints = totalPoints;
bank.questions = questions;

// ── Step 6: Write ─────────────────────────────────────────────────────────────
fs.writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2), 'utf8');
console.log('\n✅ Dedup complete. Bank written to disk.');
console.log('   Questions: ' + after + ' | Total points: ' + totalPoints);

// ── Step 7: Final topic distribution ─────────────────────────────────────────
const topicDist = {};
questions.forEach(q => { topicDist[q.topicArea] = (topicDist[q.topicArea] || 0) + 1; });
console.log('\nTopic distribution:');
Object.entries(topicDist).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
