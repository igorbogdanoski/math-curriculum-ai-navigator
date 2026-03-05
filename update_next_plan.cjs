const fs = require('fs');
let code = fs.readFileSync('NEXT_PHASES_ACTION_PLAN.md', 'utf8');

// Mark Priority 3 Offline as Done
code = code.replace('### 🟢 Приоритет 3: Офлајн-прва Архитектура (Service Worker) (Ж3) ✅', '### 🟢 Приоритет 3: Офлајн-прва Архитектура (Service Worker) (Ж3) ✅ [ЦЕЛОСНО ЗАВРШЕНО]');

// Mark Priority 4 specific items as done
code = code.replace('2. **Онбординг на Наставници (З3)**: Завршување на логиката за TourStep на најважните делови.', '2. **Онбординг на Наставници (З3)**: ✅ Завршување на логиката за TourStep предводена од react-joyride.');
code = code.replace('3. **Проверка од Наставници (З2)**: Механизам наставниците да стават Approved на генериран материјал, по што ќе стане достапен за сите други узери.', '3. **Проверка од Наставници (З1)**: ✅ Имплементиран е ContentReviewView каде Админи можат да одобрат (Approved) генериран материјал.');

// Mark Priority 5 specific items as done
code = code.replace('1. **Интеграција со Е-Дневник (И2)**: CSV/PDF експорт формално подесен на стандардот од МОН (Оценки 1-5).', '1. **Интеграција со Е-Дневник (И2)**: ✅ CSV/PDF експорт формално изведен и вграден во TeacherAnalyticsView.');

fs.writeFileSync('NEXT_PHASES_ACTION_PLAN.md', code, 'utf8');
console.log('Docs synced.');
