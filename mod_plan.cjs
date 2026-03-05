const fs = require('fs');
let code = fs.readFileSync('NATIONAL_SCALE_PLAN.md', 'utf8');
code = code.replace('- [ ] TourStep', '- [x] TourStep');
fs.writeFileSync('NATIONAL_SCALE_PLAN.md', code, 'utf8');
console.log('Checked off TourStep');
