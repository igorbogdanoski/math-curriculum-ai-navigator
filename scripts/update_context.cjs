const fs = require('fs');
let code = fs.readFileSync('i18n/LanguageContext.tsx', 'utf8');

// replace literal translations with the imported one
const start = code.indexOf('const translations:');
const end = code.indexOf('const LanguageContext', start);

const importLine = "import { translations } from './translations';\n";

if (start !== -1 && end !== -1) {
  code = code.slice(0, start) + code.slice(end);
  if (!code.includes('import { translations }')) {
     code = importLine + code;
  }
}

fs.writeFileSync('i18n/LanguageContext.tsx', code, 'utf8');
