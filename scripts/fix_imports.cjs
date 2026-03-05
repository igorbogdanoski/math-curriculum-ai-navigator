const fs = require('fs');
let c = fs.readFileSync('views/StudentPlayView.tsx', 'utf8');
c = c.replace(
  "import { ICONS } from '../constants';",
  "import { ICONS } from '../constants';\\nimport { useLanguage } from '../i18n/LanguageContext';"
);
fs.writeFileSync('views/StudentPlayView.tsx', c, 'utf8');
