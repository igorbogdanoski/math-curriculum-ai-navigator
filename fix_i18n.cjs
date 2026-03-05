const fs=require('fs');
let code = fs.readFileSync('i18n/index.ts', 'utf8');
code = code.replace(/name: 'ÐœÐ°ÐºÐµÐ´Ð¾Ð½ÑÐºÐ¸'/, "name: 'Македонски'");
fs.writeFileSync('i18n/index.ts', code, 'utf8');
console.log('Fixed mojibake in i18n/index.ts');
