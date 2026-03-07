const fs = require('fs');

const extractCyrillicLines = (filePath) => {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let results = [];
    lines.forEach((l, i) => {
        if (/[А-Яа-я]+/.test(l)) results.push(`${i}: ${l.trim()}`);
    });
    console.log(`--- ${filePath} ---`);
    console.log(results.join('\n'));
};

extractCyrillicLines('views/PlannerView.tsx');
