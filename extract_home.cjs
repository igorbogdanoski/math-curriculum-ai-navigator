const fs = require('fs');
const extractCyrillicLines = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    let results = [];
    // using regex for cyrillic characters
    const cyrillicPattern = /[\u0400-\u04FF]+/;
    lines.forEach((l, i) => {
        if (cyrillicPattern.test(l)) results.push((i+1) + ': ' + l.trim());
    });
    console.log('--- ' + filePath + ' ---');
    console.log(results.join('\n'));
};
extractCyrillicLines('views/HomeView.tsx');
