const fs = require('fs');
let c = fs.readFileSync('views/StudentTutorView.tsx', 'utf8');

if (!c.includes("import { useLanguage }")) {
  c = c.replace(/import React, \{([^\}]+)\} from 'react';/, "import React, {$1} from 'react';\nimport { useLanguage } from '../i18n/LanguageContext';");
}

fs.writeFileSync('views/StudentTutorView.tsx', c);
