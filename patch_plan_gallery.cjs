const fs = require('fs');

const planFile = 'PHASE_E_ACTION_PLAN_NEW.md';
let code = fs.readFileSync(planFile, 'utf8');

code = code.replace(/- \*\*E2\.2 Галерија на јавни планови \(Community templates\):\*\*/, `- **[x] E2.2 Галерија на јавни планови (Community templates):**`);

fs.writeFileSync(planFile, code, 'utf8');
