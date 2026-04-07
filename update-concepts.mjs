import fs from 'fs';
import path from 'path';

const concepts = {
  1: ["gym10-c1-1"],
  2: ["gym10-c1-2"],
  3: ["gym-ea11-c1-1"],
  4: ["gym10-c2-1"],
  5: ["gym10-c2-2"],
  6: ["gym10-c3-2"],
  7: ["gym11-c3-1"],
  8: ["gym10-c2-2"],
  9: ["gym10-c2-2"],
  10: ["gym11-c6-1"],
  11: ["gym11-c6-1"],
  12: ["gym11-c6-1"],
  13: ["gym11-c6-1"],
  14: ["gym11-c6-1"],
  15: ["gym12-c2-4"],
  16: ["gym10-c1-2", "gym10-c1-1"],
  17: ["gym10-c2-2"],
  18: ["gym11-c3-1"],
  19: ["gym12-c4-1", "gym11-c6-1"],
  20: ["gym11-c6-1", "gym12-c2-4"],
  21: ["gym10-c1-1"],
  22: ["gym11-c2-1"],
  23: ["gym10-c2-2"],
  24: ["gym10-c3-1"],
  25: ["gym10-c3-2"],
  26: ["gym10-c3-1"],
  27: ["voc3-10-c3-2"],
  28: ["gym11-c6-1"],
  29: ["gym11-c6-1"],
  30: ["gym12-c2-4"]
};

const files = [
  'data/matura/raw/dim-gymnasium-2023-august-al.json',
  'data/matura/raw/dim-gymnasium-2023-august-mk.json'
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${file}`);
    return;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  data.questions.forEach(q => {
    if (concepts[q.questionNumber]) {
      q.conceptIds = concepts[q.questionNumber];
    }
    if (q.questionNumber === 12) {
      q.correctAnswer = "X";
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`Updated ${file}`);
});
