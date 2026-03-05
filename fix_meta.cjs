const fs = require('fs');
let code = fs.readFileSync('components/planner/PlannerMetaAnalysis.tsx', 'utf8');

const lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('style={{ width:')) {
    lines[i] = '                    style={{ width: `${perc}%` }}';
  }
  if (lines[i].includes('className=') && lines[i].includes('w-2.5 h-2.5 rounded-sm')) {
    lines[i] = '                  <div className={`w-2.5 h-2.5 rounded-sm ${BLOOM_COLORS[level]}`} />';
  }
  if (lines[i].includes('className=') && lines[i].includes('transition-all group relative cursor-help flex items-center justify-center')) {
    lines[i] = '                    className={`${BLOOM_COLORS[level]} h-full transition-all group relative cursor-help flex items-center justify-center`}';
  }
}

fs.writeFileSync('components/planner/PlannerMetaAnalysis.tsx', lines.join('\n'), 'utf8');
console.log('done');