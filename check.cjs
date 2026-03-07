const fs = require('fs');
const content = fs.readFileSync('i18n/translations.ts', 'utf-8');

const mkMatch = content.match(/mk:\s*\{([\s\S]*?)\n\s*\},\s*sq:/);
const sqMatch = content.match(/sq:\s*\{([\s\S]*?)\n\s*\},\s*tr:/);
const trMatch = content.match(/tr:\s*\{([\s\S]*?)\n\s*\}\s*\}/);

function parseObj(str) {
  const obj = {};
  const lines = str.split('\n');
  lines.forEach(line => {
    // Match basic 'key': 'value' or key: 'value'
    const match = line.match(/^\s*(?:'([^']+)'|([^:\s]+))\s*:\s*(?:'([^']*)'|"([^"]*)")/);
    if (match) {
      const key = match[1] || match[2];
      const val = match[3] || match[4] || '';
      if (key) obj[key] = val;
    }
  });
  return obj;
}

const mk = parseObj(mkMatch[1]);
const sq = parseObj(sqMatch[1]);
const tr = parseObj(trMatch[1]);

const missingOrSameSq = [];
const missingOrSameTr = [];

for (const key of Object.keys(mk)) {
  if (!sq[key] || sq[key] === mk[key]) missingOrSameSq.push(key);
  if (!tr[key] || tr[key] === mk[key]) missingOrSameTr.push(key);
}

console.log('--- SQ needs translation ---');
missingOrSameSq.forEach(k => console.log(k));
console.log('\n--- TR needs translation ---');
missingOrSameTr.forEach(k => console.log(k));
