const fs = require('fs');
let code = fs.readFileSync('i18n/translations.ts', 'utf8');

code = code.replace(
  /'nav\.home':\s*'Почетна',/,
  "'nav.academy': 'Едукативен Центар',\n    'nav.home': 'Почетна',"
);

code = code.replace(
  /'nav\.home':\s*'Home',/,
  "'nav.academy': 'Teacher Academy',\n    'nav.home': 'Home',"
);

code = code.replace(
  /'nav\.home':\s*'Ballina',/,
  "'nav.academy': 'Qëndra Edukative',\n    'nav.home': 'Ballina',"
);

fs.writeFileSync('i18n/translations.ts', code, 'utf8');
console.log('patched');
