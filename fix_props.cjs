const fs = require('fs');
let code = fs.readFileSync('views/ContentReviewView.tsx', 'utf8');

code = code.replace(/q\.text \|\| ''/g, "q.question || ''");
code = code.replace(/q\.difficulty,/g, "q.difficulty_level,");
code = code.replace(/q\.correctAnswer \|\| ''/g, "q.answer || ''");

fs.writeFileSync('views/ContentReviewView.tsx', code);
console.log('done fixing props');
