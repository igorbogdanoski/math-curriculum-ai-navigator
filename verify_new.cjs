const fs = require('fs');

let totalConcepts = 0;
let linkedConcepts = 0;
let missedTopics = [];

const THEME_MAP = {
    'NUMBERS': ['БРОЕВ', 'АРИТМЕТ', 'ПРЕСМЕТ'],
    'GEOMETRY': ['ГЕОМЕТР', 'ФОРМ', 'ОБЛИЦ', 'ФИГУРИ', 'ПЛОШТИН', 'ВОЛУМЕН', 'ЛОКАЦИ', 'ДВИЖЕЊ'],
    'MEASUREMENT': ['МЕРЕЊ', 'МЕРК', 'ГОЛЕМИН', 'ВРЕМЕ', 'МАСА', 'ДОЛЖИН'],
    'DATA': ['ПОДАТОЦ', 'ВЕРОЈАТНОСТ'],
    'ALGEBRA': ['АЛГЕБР', 'ФУНКЦ', 'РАВЕНК', 'ИЗРАЗ', 'МОДЕЛ']
};

for (let g = 1; g <= 9; g++) {
    const content = fs.readFileSync('data/grade' + g + '.ts', 'utf8');
    
    // Find all topics
    const topicRegex = /"id": "g\d+-topic-[^"]+",\s*"title": "([^"]+)",/g;
    let match;
    while ((match = topicRegex.exec(content)) !== null) {
        let title = match[1];
        let tUpp = title.toUpperCase();
        let found = false;
        
        for (let th in THEME_MAP) {
            for (let word of THEME_MAP[th]) {
                if (tUpp.includes(word)) {
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        
        if (!found) {
            missedTopics.push('Grad ' + g + ': ' + title);
        }
    }
    
    // Count concepts and prior links
    const concepts = content.match(/"id": "g\d+-topic-[^-]+-concept-[^"]+"/g);
    if (concepts) totalConcepts += concepts.length;
    
    const priors = content.match(/"priorKnowledgeIds":/g);
    if (priors) linkedConcepts += priors.length;
}

console.log('--- MISSING THEMES --');
console.log(missedTopics.join('\n'));
console.log('');
console.log('Concepts:', totalConcepts);
console.log('Links:', linkedConcepts);

