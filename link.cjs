const fs = require('fs');

const THEME_MAP = {
    'БРОЕВИ': 'NUMBERS',
    'ГЕОМЕТРИЈА': 'GEOMETRY',
    'МЕРЕЊЕ': 'MEASUREMENT',
    'ПОДАТОЦИ': 'DATA',
    'АЛГЕБРА': 'ALGEBRA'
};

function getThemeKey(title) {
    const t = title.toUpperCase();
    if (t.includes('БРОЕВ')) return THEME_MAP['БРОЕВИ'];
    if (t.includes('ГЕОМЕТР')) return THEME_MAP['ГЕОМЕТРИЈА'];
    if (t.includes('МЕРЕЊ')) return THEME_MAP['МЕРЕЊЕ'];
    if (t.includes('ПОДАТОЦ')) return THEME_MAP['ПОДАТОЦИ'];
    if (t.includes('АЛГЕБР')) return THEME_MAP['АЛГЕБРА'];
    return 'UNKNOWN';
}

// 1. First parse all concepts and categorize them by Grade and ThemeKey
let globalConcepts = {}; // { grade: { themeKey: [ { id, title }, ... ] } }

for (let g = 1; g <= 9; g++) {
    globalConcepts[g] = {};
    const text = fs.readFileSync('data/grade' + g + '.ts', 'utf8');
    
    // We will find topics
    const topicRegex = /"id":\s*"([^"]+)",\s*"title":\s*"([^"]+)",[\s\S]*?"concepts":\s*\[([\s\S]*?)(?=\s*\]\s*,\s*"activities"|\s*\]\s*\n\s*\})/g;
    
    let parts = text.split('"topics": [');
    if(parts.length < 2) continue;
    
    let topicsBlock = parts[1];
    
    // Manual crude traversal
    // Let's use eval since it's much easier to manipulate a JS object
    // Wait, the files are exported as 'export const grade1Data = { ... }'
}
