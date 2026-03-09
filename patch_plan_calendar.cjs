const fs = require('fs');

const planFile = 'PHASE_E_ACTION_PLAN_NEW.md';
let code = fs.readFileSync(planFile, 'utf8');

code = code.replace(/- \*\*E2\.3 Интелигентна детекција на празници:(.*)/, `- **[x] E2.3 Интелигентна детекција на празници:$1\n\n--- \n\n## Готов модул Е2 (AI Годишна Програма)\nСите напредни 'world-class' параметри за оваа фаза се комплетирани. Спремни сме за почеток со E3 (Повеќејазичност) или E1 (Push Notifications).`);

fs.writeFileSync(planFile, code, 'utf8');
