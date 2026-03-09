const fs = require('fs');
let code = fs.readFileSync('i18n/LanguageContext.tsx', 'utf8');
code = code.replace(/translations\['mk'\]\[key\]/g, "(translations['mk'] ? translations['mk'][key] : undefined)");
fs.writeFileSync('i18n/LanguageContext.tsx', code);
console.log('Fixed LanguageContext.tsx');
