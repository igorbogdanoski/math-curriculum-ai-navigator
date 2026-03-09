const fs = require('fs');

let code = fs.readFileSync('views/AcademyLessonView.tsx', 'utf8');
code = code.replace(
  /openGeneratorPanel\(\{ prefill: \{ (learningDesignModel: .*?) \}\}\);/g,
  "openGeneratorPanel({ $1 });"
);
code = code.replace(
  /openGeneratorPanel\(\{ prefill: \{ tone: 'Креативно и ангажирачко' \}\}\);/g,
  "openGeneratorPanel({ tone: 'Креативно и ангажирачко' });"
);
fs.writeFileSync('views/AcademyLessonView.tsx', code, 'utf8');

let codeA = fs.readFileSync('views/AcademyView.tsx', 'utf8');
codeA = codeA.replace(
  /const MODULES = /g,
  "const MODULES: { id: string, title: string, description: string, icon: any, color: string, borderColor: string, topics: {title: string, id?: string}[] }[] = "
);
fs.writeFileSync('views/AcademyView.tsx', codeA, 'utf8');
console.log('patched');
