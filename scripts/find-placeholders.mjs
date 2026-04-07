import fs from 'fs';
import path from 'path';

const files = [
  'data/matura/raw/dim-gymnasium-2022-august-mk.json',
  'data/matura/raw/dim-gymnasium-2022-august-al.json',
  'data/matura/raw/dim-gymnasium-2023-june-mk.json',
  'data/matura/raw/dim-gymnasium-2023-june-al.json',
  'data/matura/raw/dim-gymnasium-2023-june-tr.json'
];

const placeholders = [
  '[слика/формула]',
  '[fotografi/formulë]',
  '[resim/formül]'
];

const results = {};

files.forEach(file => {
  if (!fs.existsSync(file)) {
    return;
  }

  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fileResults = [];

  data.questions.forEach(q => {
    let hasPlaceholder = false;
    
    // Check questionText
    placeholders.forEach(p => {
      if (typeof q.questionText === 'string' && q.questionText.includes(p)) hasPlaceholder = true;
    });

    // Check choices
    if (q.choices) {
      Object.values(q.choices).forEach(choice => {
        placeholders.forEach(p => {
          if (typeof choice === 'string' && choice.includes(p)) hasPlaceholder = true;
        });
      });
    }

    if (hasPlaceholder) {
      fileResults.push({
        questionNumber: q.questionNumber,
        part: q.part,
        topic: q.topic
      });
    }
  });

  results[file] = fileResults;
});

console.log(JSON.stringify(results, null, 2));
