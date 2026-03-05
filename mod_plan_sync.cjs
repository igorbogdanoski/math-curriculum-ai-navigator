const fs = require('fs');
let code = fs.readFileSync('NATIONAL_SCALE_PLAN.md', 'utf8');
code = code.replace('- [ ] Export на сите AI-генерирани прашања по концепт → Excel/CSV за рецензија', '- [x] Export на сите AI-генерирани прашања по концепт → Excel/CSV за рецензија');
code = code.replace('- [ ] Export на резултати во формат компатибилен со е-Дневник', '- [x] Export на резултати во формат компатибилен со е-Дневник');
code = code.replace('- [ ] PDF извештај по ученик со МК оценка (1-5) и концепти', '- [x] PDF извештај по ученик со МК оценка (1-5) и концепти');
code = code.replace('- [ ] TourStep систем за нови наставници (3-5 чекори)', '- [x] TourStep систем за нови наставници (3-5 чекори)');
fs.writeFileSync('NATIONAL_SCALE_PLAN.md', code, 'utf8');
console.log('Checked off done things');
