import fs from 'fs';
import path from 'path';

const concepts = {
  1: ['gym10-c1-1'],
  2: ['gym11-c2-1'],
  3: ['gym10-c1-2'],
  4: ['gym10-c2-1'],
  5: ['gym10-c2-3'],
  6: ['gym10-c1-2'],
  7: ['gym10-c2-2'],
  8: ['gym10-c3-4'],
  9: ['gym10-c2-3'],
  10: ['gym11-c6-1'],
  11: ['gym11-c6-1'],
  12: ['gym10-c4-1'],
  13: ['gym11-c6-1'],
  14: ['gym11-c7-1'],
  15: ['gym11-c1-1'],
  16: ['gym10-c1-1'],
  17: ['gym10-c2-2'],
  18: ['gym10-c3-3'],
  19: ['gym11-c6-1'],
  20: ['gym11-c7-1'],
  21: ['gym10-c1-1'],
  22: ['gym10-c1-3'],
  23: ['gym10-c2-3'],
  24: ['gym10-c3-5'],
  25: ['gym11-c3-1'],
  26: ['gym11-c4-1'],
  27: ['gym11-c6-1'],
  28: ['gym11-c7-1'],
  29: ['gym11-c7-1'],
  30: ['gym11-c1-1'],
};

const correctAnswers = {
  1: 'В',
  2: 'Б',
  3: 'А',
  4: 'В',
  5: 'А',
  6: 'Б',
  7: 'В',
  8: 'В',
  9: 'В',
  10: 'Б',
  11: 'В',
  12: 'А',
  13: 'В',
  14: 'Г',
  15: 'Б',
};

const files = [
  'data/matura/raw/dim-gymnasium-2023-june-mk.json',
  'data/matura/raw/dim-gymnasium-2023-june-al.json',
  'data/matura/raw/dim-gymnasium-2023-june-tr.json',
];

files.forEach(file => {
  const filePath = path.resolve(file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix unescaped backslashes before parsing
  // We want to escape a backslash if it's NOT followed by n, r, t, ", or \
  // AND it's NOT preceded by another backslash.
  content = content.replace(/(?<!\\)\\(?![nr"\\])/g, '\\\\');
  
  const data = JSON.parse(content);

  data.questions.forEach(q => {
    q.conceptIds = concepts[q.questionNumber] || [];
    
    // Update correct answers for MC
    if (q.questionNumber <= 15) {
      q.correctAnswer = correctAnswers[q.questionNumber];
    }
    
    // Fix TR language specifics for MC answers (convert В to V etc? No, the validator expects А/Б/В/Г)
    // Actually the validator says VALID_CHOICES = ['А', 'Б', 'В', 'Г'] (Cyrillic)
    // If the TR file uses A/B/C/D, we should convert them.
    if (data.exam.language === 'tr' || data.exam.language === 'al') {
       const map = {'A': 'А', 'B': 'Б', 'C': 'В', 'Ç': 'В', 'V': 'В', 'D': 'Г', 'G': 'Г'};
       // Check if correctAnswer is Latin
       if (map[q.correctAnswer]) {
         q.correctAnswer = map[q.correctAnswer];
       }
    }

    // Update image for Q29
    if (q.questionNumber === 29) {
      q.hasImage = true;
      q.imageUrls = ['/matura/images/2023/june/q29-fig1.png'];
    }
    
    // Temporary fix for Q1 (missing image) and Q5
    if (q.questionNumber === 1 || q.questionNumber === 5) {
      q.hasImage = false;
      q.imageUrls = [];
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Updated ${file}`);
});
