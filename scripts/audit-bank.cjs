'use strict';
const fs = require('fs');
const path = require('path');

const BANK_PATH = path.join(__dirname, '..', 'data', 'matura', 'raw', 'internal-matura-bank-gymnasium-mk.json');
const bank = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
const questions = bank.questions;

function norm(s) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[$\\{}^_]/g, '').replace(/[.,;:!?]/g, '');
}

// 1. Topic & DoK distribution
const topicDist = {};
const dokDist = {};
questions.forEach(q => {
  topicDist[q.topicArea] = (topicDist[q.topicArea] || 0) + 1;
  dokDist[q.dokLevel] = (dokDist[q.dokLevel] || 0) + 1;
});

console.log('=== BANK AUDIT REPORT ===');
console.log('Total questions:', questions.length, '| Total points:', bank.exam.totalPoints);
console.log('\n--- Topic Distribution ---');
Object.entries(topicDist).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log('  ' + k + ': ' + v));

console.log('\n--- DoK Distribution ---');
Object.entries(dokDist).sort().forEach(([k,v]) => console.log('  DoK ' + k + ': ' + v));

// 2. aiSolution status
const noAI = questions.filter(q => !q.aiSolution).length;
console.log('\n--- AI Solutions ---');
console.log('  Missing aiSolution: ' + noAI + ' / ' + questions.length);

// 3. MC without correctAnswer
const mcNoCA = questions.filter(q => q.questionType === 'mc' && !q.correctAnswer);
console.log('\n--- MC without correctAnswer (' + mcNoCA.length + ') ---');
mcNoCA.forEach(q => console.log('  #' + q.questionNumber + ' [' + q.topicArea + '] ' + q.questionText.substring(0, 90)));

// 4. Duplicate questionNumbers
const numMap = {};
questions.forEach(q => { numMap[q.questionNumber] = (numMap[q.questionNumber] || 0) + 1; });
const dupNums = Object.entries(numMap).filter(([,v]) => v > 1);
console.log('\n--- Duplicate questionNumbers (' + dupNums.length + ') ---');
dupNums.forEach(([n, c]) => console.log('  #' + n + ' appears ' + c + ' times'));

// 5. Near-duplicate detection (normalized text prefix match)
console.log('\n--- Near-Duplicate Detection ---');
const normMap = {};
const nearDups = [];
questions.forEach(q => {
  const n = norm(q.questionText);
  const key60 = n.substring(0, 60);
  if (normMap[key60]) {
    nearDups.push([normMap[key60], q]);
  } else {
    normMap[key60] = q;
  }
});
console.log('  Suspected near-duplicates (first-60-chars match): ' + nearDups.length + ' pairs');
nearDups.forEach(([a, b]) => {
  console.log('  Q#' + a.questionNumber + ' vs Q#' + b.questionNumber);
  console.log('    A: ' + a.questionText.substring(0, 100));
  console.log('    B: ' + b.questionText.substring(0, 100));
});

// 6. True exact duplicates (full norm match)
const exactMap = {};
const exactDups = [];
questions.forEach(q => {
  const n = norm(q.questionText);
  if (exactMap[n]) {
    exactDups.push([exactMap[n], q]);
  } else {
    exactMap[n] = q;
  }
});
console.log('\n--- Exact Duplicates (full normalized text): ' + exactDups.length + ' pairs ---');
exactDups.forEach(([a, b]) => {
  console.log('  Q#' + a.questionNumber + ' vs Q#' + b.questionNumber + ' | ' + a.questionText.substring(0, 80));
});

// 7. Points distribution
const ptsDist = {};
questions.forEach(q => { ptsDist[q.points] = (ptsDist[q.points] || 0) + 1; });
console.log('\n--- Points Distribution ---');
Object.entries(ptsDist).sort((a,b)=>Number(a[0])-Number(b[0])).forEach(([k,v]) => console.log('  ' + k + ' pts: ' + v + ' questions'));

// 8. Short open questions (possible fill-in-the-blank that may need reclassification)
const shortOpen = questions.filter(q => {
  if (q.questionType !== 'open' || q.part !== 2) return false;
  const stripped = q.questionText.replace(/\$[^$]+\$/g, 'X').replace(/\\[a-z]+\{[^}]*\}/g, 'X').trim();
  return stripped.length < 60;
});
console.log('\n--- Short open Part-2 questions (possible trivial fill-ins): ' + shortOpen.length + ' ---');
shortOpen.forEach(q => console.log('  #' + q.questionNumber + ' [' + q.topicArea + '] ' + q.questionText.substring(0, 100)));

// 9. Concept ID frequency (flag IDs appearing only once)
const ciCount = {};
questions.forEach(q => {
  (q.conceptIds || []).forEach(ci => { ciCount[ci] = (ciCount[ci] || 0) + 1; });
});
const rareCIs = Object.entries(ciCount).filter(([,v]) => v === 1).map(([k]) => k);
console.log('\n--- Concept IDs appearing only once (' + rareCIs.length + ') ---');
rareCIs.forEach(ci => console.log('  ' + ci));

// 10. Summary of what needs to be done
console.log('\n=== ACTION SUMMARY ===');
console.log('  1. Generate aiSolution for ' + noAI + ' questions');
console.log('  2. Fix correctAnswer for ' + mcNoCA.length + ' MC questions');
console.log('  3. Review ' + nearDups.length + ' near-duplicate pairs');
console.log('  4. Review ' + exactDups.length + ' exact duplicate pairs for removal');
console.log('  5. Missing topics: statistika=' + (topicDist['statistika']||0) + ', kombinatorika=' + (topicDist['kombinatorika']||0));
