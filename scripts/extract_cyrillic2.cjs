const fs = require('fs');
const file = process.argv[2];
if (!file) { console.error("Provide a file"); process.exit(1); }
const lines = fs.readFileSync(file, 'utf8').split('\n');
let results = [];
lines.forEach((l, i) => {
    if (/[А-Шa-ш]+/i.test(l) && !l.includes('console.')) {
        results.push(`${i}: ${l.trim()}`);
    }
});
console.log(results.join('\n'));
