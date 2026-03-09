const fs = require('fs');

let code = fs.readFileSync('services/gemini/core.ts', 'utf8');

code = code.replace(
  '1. Јазик: Користи литературен македонски јазик.',
  '1. Јазик: {{LANGUAGE_RULE}}'
);

const injectString = \
    let lang = 'mk';
    try { lang = localStorage.getItem('preferred_language') || 'mk'; } catch(e){}
    let langRule = "Користи литературен македонски јазик.";
    if (lang === 'sq') langRule = "Задолжително користи АЛБАНСКИ јазик (Shqip) за целиот текст и содржина.";
    if (lang === 'tr') langRule = "Задолжително користи ТУРСКИ јазик (Türkçe) за целиот текст и содржина.";
    if (lang === 'en') langRule = "Задолжително користи АНГЛИСКИ јазик (English) за целиот текст и содржина.";
    
    instruction = instruction.replace('{{LANGUAGE_RULE}}', langRule);
    
    if (!instruction.includes('{{LANGUAGE_RULE}}') && lang && lang !== 'mk') {
        instruction += "\\nВАЖНА НАПОМЕНА: Сите текстуални вредности во JSON објектот (наслови, описи, задачи) МОРА да бидат напишани исклучиво на " + 
                       (lang === 'sq' ? 'АЛБАНСКИ (Shqip)' : lang === 'tr' ? 'ТУРСКИ (Türkçe)' : 'АНГЛИСКИ (English)') + " јазик!";
    }
\;

code = code.replace(
  'let instruction = baseInstruction;',
  'let instruction = baseInstruction;' + injectString
);

fs.writeFileSync('services/gemini/core.ts', code);
console.log('patched core.ts');
