'use strict';
const fs = require('fs');
const path = require('path');
const BANK_PATH = path.join(__dirname, '..', 'data', 'matura', 'raw', 'internal-matura-bank-gymnasium-mk.json');
const bank = JSON.parse(fs.readFileSync(BANK_PATH, 'utf8'));
const q = bank.questions;

function norm(s){return s.trim().toLowerCase().replace(/\s+/g,' ').replace(/[$\\{}^_]/g,'').replace(/[.,;:!?\s]/g,'');}
function aggnorm(s){return s.replace(/\\dfrac/g,'\\frac').replace(/\\;/g,'').replace(/\\,/g,'').replace(/\\!/g,'').replace(/\\text\{([^}]+)\}/g,'$1').trim().toLowerCase().replace(/\s+/g,' ').replace(/[$\\{}^_]/g,'').replace(/[.,;:!?\s]/g,'');}

const topics = {};
q.forEach(x=>{topics[x.topicArea]=(topics[x.topicArea]||0)+1;});
const dok = {};
q.forEach(x=>{dok[x.dokLevel]=(dok[x.dokLevel]||0)+1;});
const mcNoCA = q.filter(x=>x.questionType==='mc'&&!x.correctAnswer);
const seen = new Map(); const dups=[];
q.forEach(x=>{const n=aggnorm(x.questionText);if(seen.has(n))dups.push([seen.get(n),x]);else seen.set(n,x);});

console.log('=== FINAL BANK STATE ===');
console.log('Total: '+q.length+' questions | '+bank.exam.totalPoints+' points');
console.log('Topics: '+JSON.stringify(topics));
console.log('DoK: '+JSON.stringify(dok));
console.log('No aiSolution: '+q.filter(x=>!x.aiSolution).length);
console.log('MC no correctAnswer ('+mcNoCA.length+'):');
mcNoCA.forEach(x=>console.log('  #'+x.questionNumber+' '+x.questionText.substring(0,80)));
console.log('Remaining dup pairs (aggressive norm): '+dups.length);
dups.forEach(([a,b])=>{
  console.log('  Q#'+a.questionNumber+' vs Q#'+b.questionNumber);
  console.log('    A: '+a.questionText.substring(0,90));
  console.log('    B: '+b.questionText.substring(0,90));
});
