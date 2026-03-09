const fs = require('fs');

let indexCode = fs.readFileSync('i18n/index.ts', 'utf8');

indexCode = indexCode.replace(
  /export type Language = 'mk' \| 'sq' \| 'tr';/,
  "export type Language = 'mk' | 'sq' | 'tr' | 'en';"
);

indexCode = indexCode.replace(
  /export const LANGUAGES = \[/,
  "export const LANGUAGES = [\n  { code: 'en', name: 'English', flag: '????' },"
);

indexCode = indexCode.replace(
  /\['mk', 'sq', 'tr'\]/,
  "['mk', 'sq', 'tr', 'en']"
);

indexCode = indexCode.replace(
  /if \(navigator\.language\.startsWith\('tr'\)\) return 'tr';/,
  "if (navigator.language.startsWith('tr')) return 'tr';\n  if (navigator.language.startsWith('en')) return 'en';"
);

fs.writeFileSync('i18n/index.ts', indexCode);
console.log('Updated i18n/index.ts');
