const fs = require('fs');

const THEME_MAP = {
    'NUMBERS': ['БРОЕВ', 'АРИТМЕТИ', 'ПРЕСМЕТ'],
    'GEOMETRY': ['ГЕОМЕТР', 'ФОРМ', 'ОБЛИЦ', 'ФИГУРИ'],
    'MEASUREMENT': ['МЕРЕЊ', 'МЕРКИ', 'ГОЛЕМИН'],
    'DATA': ['ПОДАТОЦ', 'ВЕРОЈАТНОСТ', 'ОБРАБОТКА НА ПОДАТОЦИ'],
    'ALGEBRA': ['АЛГЕБР', 'ФУНКЦ', 'РАВЕНК', 'ИЗРАЗИ']
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
    
    // First, strip existing priorKnowledgeIds to avoid duplicates!
    content = content.replace(/,\s*"priorKnowledgeIds"\s*:\s*\[.*?\]/g, '');
    
    let topicsSplit = content.split('"id": "g' + g + '-topic-');
    let newBlocks = [topicsSplit[0]];
    
    let modifiedAny = false;
    for (let i = 1; i < topicsSplit.length; i++) {
        let block = topicsSplit[i];
        let titleMatch = block.match(/"title":\s*"([^"]+)"/);
        let theme = titleMatch ? getTheme(titleMatch[1]) : null;
        
        if (theme && allConcepts[g-1] && allConcepts[g-1][theme] && allConcepts[g-1][theme].length > 0) {
            let priorList = allConcepts[g-1][theme];
            let cIndex = 0;
            
            // Try to match id inside a concept, ignoring whether priorKnowledgeIds exists or not
            block = block.replace(/"id":\s*"([^"]+-concept-[^"]+)"/g, (match, ide) => {
                let pId = priorList[Math.min(cIndex, priorList.length - 1)];
                cIndex++;
                if (pId) {
                    modifiedAny = true;
                    // If it already had priorKnowledgeIds from previous run, we could be duplicating it.
                    // But since we know it didn't exist for 1-6, and for 7-9 we will just replace the whole block, wait!
                    // If it already had it, we just add it to the top. To avoid duplicates, we will clean it up first if needed.
                    return '"id": "' + ide + '",\n          "priorKnowledgeIds": ["' + pId + '"]';
                }
                return match;
            });
            // Clean up any old empty priorKnowledgeIds if they exist
            block = block.replace(/,\s*"priorKnowledgeIds"\s*:\s*\[\]/g, '');
        }
        newBlocks.push(block);
    }
    
    if (modifiedAny) {
        let finalContent = newBlocks.join('"id": "g' + g + '-topic-');
        fs.writeFileSync('data/grade' + g + '.ts', finalContent, 'utf8');
        console.log('Processed grade ' + g);
    } else {
        console.log('No priorKnowledgeIds to update for grade ' + g);
    }
}
