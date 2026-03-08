const fs = require('fs');
const THEME_MAP = {
    'NUMBERS': ['БРОЕВ', 'АРИТМЕТИ', 'ПРЕСМЕТ'],
    'GEOMETRY': ['ГЕОМЕТР', 'ФОРМ', 'ОБЛИЦ', 'ФИГУРИ', 'ПЛОШТИН', 'ВОЛУМЕН', 'ЛОКАЦИ', 'ДВИЖЕЊ'],
    'MEASUREMENT': ['МЕРЕЊ', 'МЕРКИ', 'ГОЛЕМИН', 'ВРЕМЕ', 'МАСА', 'ДОЛЖИН'],
    'DATA': ['ПОДАТОЦ', 'ВЕРОЈАТНОСТ', 'ОБРАБОТКА НА ПОДАТОЦИ'],
    'ALGEBRA': ['АЛГЕБР', 'ФУНКЦ', 'РАВЕНК', 'ИЗРАЗИ', 'МОДЕЛ']
};

function getTheme(title) {
    let t = title.toUpperCase();
    for (let key in THEME_MAP) {
        if (THEME_MAP[key].some(k => t.includes(k))) return key;
    }
    return null;
}

let missedTopics = [];
let totalConcepts = 0;
let linkedConcepts = 0;

for (let g = 1; g <= 9; g++) {
    let content = fs.readFileSync('data/grade' + g + '.ts', 'utf8');
    let topicsSplit = content.split('"id": "g' + g + '-topic-');
    
    for (let i = 1; i < topicsSplit.length; i++) {
        let block = topicsSplit[i];
        let titleMatch = block.match(/"title":\s*"([^"]+)"/);
        if(!titleMatch) continue;
        
        let theme = getTheme(titleMatch[1]);
        if (!theme) {
            missedTopics.push(\Grade \: \\);
        }
        
        // Count concept links vs concepts
        let cMatches = block.match(/"id":\s*"[^"]+-concept-[^"]+"/g);
        if (cMatches) {
            totalConcepts += cMatches.length;
            
            // Actually, a better way is to count "priorKnowledgeIds":
            let priorMatches = block.match(/"priorKnowledgeIds":/g);
            if (priorMatches) {
                linkedConcepts += priorMatches.length;
            }
        }
    }
}

console.log('Missed/Uncategorized Topics (won\\'t have links):');
console.log(missedTopics);
console.log('\\nTotal Concepts:', totalConcepts);
console.log('Linked Concepts (with prior):', linkedConcepts);
