const fs = require('fs');
let c = fs.readFileSync('views/StudentTutorView.tsx', 'utf8');

c = c.replace(/'\{t\('tutor\.greeting'\)\}'/g, "t('tutor.greeting')");
c = c.replace(/'\{t\(\\'tutor\.greeting\\'\)\}'/g, "t('tutor.greeting')");
c = c.replace(/'t\('tutor\.greeting'\)'/g, "t('tutor.greeting')");

// Also check where greeting is initialized, and fix if needed:
// content: '{t('tutor.greeting')}' -> content: t('tutor.greeting')
c = c.replace(/content:\s*'\{t\('tutor\.greeting'\)\}'/g, "content: t('tutor.greeting')");
c = c.replace(/content:\s*`\{t\('tutor\.greeting'\)\}`/g, "content: t('tutor.greeting')");

fs.writeFileSync('views/StudentTutorView.tsx', c);
