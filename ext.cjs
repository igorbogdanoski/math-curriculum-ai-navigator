const fs = require('fs');

for (let g = 1; g <= 9; g++) {
    const text = fs.readFileSync('data/grade' + g + '.ts', 'utf8');
    const topicRegex = /"id":\s*"([^"]+)",\s*"title":\s*"([^"]+)"/g;
    let match;
    console.log('\nGRADE ' + g);
    while((match = topicRegex.exec(text)) !== null) {
        if(match[1].includes('-topic-')) {
             console.log(match[1], '=>', match[2]);
        }
    }
}
