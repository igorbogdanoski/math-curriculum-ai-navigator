const fs = require('fs');
let code = fs.readFileSync('services/ragService.ts', 'utf8');

const regex = /rag \+= \`\\nНАПОМЕНА ЗА AI МОДЕЛОТ.*?\`;/s;
const insertStr = `    if (concept.localContextExamples && concept.localContextExamples.length > 0) {
      rag += '\\nЛОКАЛЕН КОНТЕКСТ (ЗАДОЛЖИТЕЛНО ЗА ПРИМЕРИТЕ):\\n';
      rag += 'При креирање на текстуални задачи или примери од секојдневниот живот, користи ги следниве елементи кои се блиски на учениците во Македонија:\\n';
      concept.localContextExamples.forEach((item) => (rag += '- ' + item + '\\n'));
    } else {
      rag += '\\nЛОКАЛЕН КОНТЕКСТ (ЗАДОЛЖИТЕЛНО ЗА ПРИМЕРИТЕ):\\n';
      rag += 'При креирање на проблеми или примери, секогаш користи македонски контекст: валута Денари (МКД), македонски градови (Скопје, Битола, Охрид, итн.), традиционални македонски имиња и типични локални сценарија. Забрането е користење на долари, евра или американски/британски контексти.\\n';
    }

    `;

if(regex.test(code)) {
    code = code.replace(regex, insertStr + code.match(regex)[0]);
    fs.writeFileSync('services/ragService.ts', code);
    console.log('Success!');
} else {
    console.log('Failed to find');
}
