const fs = require('fs');
let code = fs.readFileSync('ACTION_PLAN.md', 'utf8');
code = code.replace('- [ ] Testiranje na `generateStepByStepSolution`', '- [x] Testiranje na `generateStepByStepSolution`');
code = code.replace('- [ ] Proverka na `explainSpecificStep`', '- [x] Proverka na `explainSpecificStep`');
code = code.replace('- [ ] Implementacija na prebaruvanje niz `cached_ai_materials`', '- [x] Implementacija na prebaruvanje niz `cached_ai_materials`');
code = code.replace('- [ ] Dodavanje na indikator "Od Zaednicata"', '- [x] Dodavanje na indikator "Od Zaednicata"');
fs.writeFileSync('ACTION_PLAN.md', code);