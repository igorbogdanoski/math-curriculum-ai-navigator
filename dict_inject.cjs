const fs=require('fs');
let code = fs.readFileSync('i18n/translations.ts', 'utf8');

// injecting nav_language dictionary items into each language block
code = code.replace("nav_dashboard: 'Контролна Табла',", "nav_language: 'ЈАЗИК',\n    nav_dashboard: 'Контролна Табла',");
code = code.replace("nav_dashboard: 'Kroskosi',", "nav_language: 'GJUHA',\n    nav_dashboard: 'Kroskosi',");
code = code.replace("nav_dashboard: 'Gösterge Paneli',", "nav_language: 'DİL',\n    nav_dashboard: 'Gösterge Paneli',");

fs.writeFileSync('i18n/translations.ts', code, 'utf8');
console.log('Injected translations');
