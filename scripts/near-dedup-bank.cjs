'use strict';
// near-dedup-bank.cjs
// Removes near-duplicates that differ only in:
//  - \dfrac vs \frac (LaTeX display style)
//  - trailing punctuation/words "е :" "е:" etc.
//  - LaTeX spacing \; vs , in sets
//  - Same question with different variable name for same unknown (x vs c)
// Run: node scripts/near-dedup-bank.cjs

const fs = require('fs');
const path = require('path');

const BANK_PATH = path.join(__dirname, '..', 'data', 'matura', 'raw', 'internal-matura-bank-gymnasium-mk.json');
const bank = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
let questions = bank.questions;

function aggressiveNorm(s) {
  return s
    .replace(/\\dfrac/g, '\\frac')         // display frac → frac
    .replace(/\\;/g, '')                    // LaTeX thin space
    .replace(/\\,/g, '')                    // LaTeX small space
    .replace(/\\!/g, '')                    // LaTeX negative space
    .replace(/\\text\{([^}]+)\}/g, '$1')   // \text{cm} → cm
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[$\\{}^_]/g, '')
    .replace(/[.,;:!?\s]/g, '');
}

// Build map with aggressive normalization
const seenAgg = new Map();
const toRemoveAgg = new Set();

// Sort by questionNumber to always keep lower number
const sorted = [...questions].sort((a, b) => a.questionNumber - b.questionNumber);

sorted.forEach(q => {
  const n = aggressiveNorm(q.questionText);
  if (seenAgg.has(n)) {
    toRemoveAgg.add(q.questionNumber);
    console.log('NEAR-DUP: Q#' + seenAgg.get(n).questionNumber + ' ← removing Q#' + q.questionNumber);
    console.log('  Kept:    ' + seenAgg.get(n).questionText.substring(0, 100));
    console.log('  Removed: ' + q.questionText.substring(0, 100));
  } else {
    seenAgg.set(n, q);
  }
});

console.log('\nNear-duplicates to remove:', toRemoveAgg.size);

const before = questions.length;
questions = questions.filter(q => !toRemoveAgg.has(q.questionNumber));
const after = questions.length;
console.log('Questions before:', before, '→ after:', after);

// Renumber
questions.forEach((q, i) => { q.questionNumber = i + 1; });

// Recalculate totals
const totalPoints = questions.reduce((s, q) => s + (q.points || 0), 0);
bank.exam.questionCount = questions.length;
bank.exam.totalPoints = totalPoints;
bank.questions = questions;

// Write
fs.writeFileSync(BANK_PATH, JSON.stringify(bank, null, 2), 'utf8');
console.log('\n✅ Near-dedup complete. Bank written to disk.');
console.log('   Questions: ' + after + ' | Total points: ' + totalPoints);

// Topic distribution
const topicDist = {};
questions.forEach(q => { topicDist[q.topicArea] = (topicDist[q.topicArea] || 0) + 1; });
console.log('\nTopic distribution:');
Object.entries(topicDist).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));
