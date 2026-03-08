const fs = require('fs');

const THEME_MAP = {
    'NUMBERS': ['БРОЕВ', 'АРИТМЕТИ', 'ПРЕСМЕТ'],
    'GEOMETRY': ['ГЕОМЕТР', 'ФОРМ', 'ОБЛИЦ'],
    'MEASUREMENT': ['МЕРЕЊ', 'МЕРКИ'],
    'DATA': ['ПОДАТОЦ', 'ВЕРОЈАТНОСТ', 'ОБРАБОТКА НА ПОДАТОЦИ'],
    'ALGEBRA': ['АЛГЕБР', 'ФУНКЦ', 'РАВЕНК']
};

function getTheme(title) {
    let t = title.toUpperCase();
    for (let key in THEME_MAP) {
        if (THEME_MAP[key].some(k => t.includes(k))) return key;
    }
    return null;
}

let allConcepts = {};

// Phase 1: Collect
for (let g = 1; g <= 9; g++) {
    allConcepts[g] = {};
    let content = fs.readFileSync('data/grade' + g + '.ts', 'utf8');
    let topicsSplit = content.split('"id": "g' + g + '-topic-');
    for (let i = 1; i < topicsSplit.length; i++) {
        let block = topicsSplit[i];
        let titleMatch = block.match(/"title":\s*"([^"]+)"/);
        if (!titleMatch) continue;
        let theme = getTheme(titleMatch[1]);
        if (!theme) continue;
        if (!allConcepts[g][theme]) allConcepts[g][theme] = [];
        let cMatches = block.match(/"id":\s*"([^"]+)"(.|\n)*?"title":\s*"([^"]+)"/g);
        if (cMatches) {
            cMatches.forEach(cm => {
                let idMatch = cm.match(/"id":\s*"([^"]+)"/);
                if (idMatch && idMatch[1].includes('-concept-')) {
                   allConcepts[g][theme].push(idMatch[1]);
                }
            });
        }
    }
}

// Phase 2: Inject
for (let g = 2; g <= 9; g++) {
    let content = fs.readFileSync('data/grade' + g + '.ts', 'utf8');
    let topicsSplit = content.split('"id": "g' + g + '-topic-');
    let newBlocks = [topicsSplit[0]];
    
    for (let i = 1; i < topicsSplit.length; i++) {
        let block = topicsSplit[i];
        let titleMatch = block.match(/"title":\s*"([^"]+)"/);
        let theme = titleMatch ? getTheme(titleMatch[1]) : null;
        
        if (theme && allConcepts[g-1] && allConcepts[g-1][theme] && allConcepts[g-1][theme].length > 0) {
            let priorList = allConcepts[g-1][theme];
            let cIndex = 0;
            
            block = block.replace(/"id":\s*"([^"]+)"([\s\S]*?)"priorKnowledgeIds":\s*\[\]/g, (match, ide, middle) => {
                if (ide.includes('-concept-')) {
                    let pId = priorList[Math.min(cIndex, priorList.length - 1)];
                    cIndex++;
                    if (pId) {
                        return '"id": "' + ide + '"' + middle + '"priorKnowledgeIds": ["' + pId + '"]';
                    }
                }
                return match;
            });
        }
        newBlocks.push(block);
    }
    
    let finalContent = newBlocks.join('"id": "g' + g + '-topic-');
    fs.writeFileSync('data/grade' + g + '.ts', finalContent, 'utf8');
    console.log('Processed grade ' + g);
}
