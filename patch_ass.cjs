const fs = require('fs');
let t = fs.readFileSync('services/gemini/assessment.ts', 'utf8');

t = t.replace(/(customInstruction\?\: string, includeSelfAssessment\?\: boolean)/g, '$1, includeWorkedExamples?: boolean');

t = t.replace(/(const selfAssessmentPart = [^;]+;)/, `$1
      const workedExamplePart = includeWorkedExamples ? ' Првите 1 или 2 прашања нека бидат решени примери (Worked Examples) за учење (Scaffolding). На нив постави го полето isWorkedExample на true, а во workedExampleType стави "full". Објаснувањето на решението напиши го во полето solution, а answer да биде точниот одговор.' : '';`);

t = t.replace(/(\$\{selfAssessmentPart\})/g, '$1${workedExamplePart}');

t = t.replace(/(isWorkedExample: \{ type: Type\.BOOLEAN \}, workedExampleType: \{ type: Type\.STRING \}, )?cognitiveLevel:/g, 'isWorkedExample: { type: Type.BOOLEAN }, workedExampleType: { type: Type.STRING }, cognitiveLevel:');

fs.writeFileSync('services/gemini/assessment.ts', t);
console.log('done');