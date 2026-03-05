const fs=require('fs');
let code = fs.readFileSync('components/common/LanguageSelector.tsx', 'utf8');
code = code.replace(/..\/i18n/g, '../../i18n'); // Fix relative import path from components/common
fs.writeFileSync('components/common/LanguageSelector.tsx', code, 'utf8');
