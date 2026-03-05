const fs = require('fs');
let code = fs.readFileSync('components/Sidebar.tsx', 'utf8');

// Replace mojibake manually by looking at lines
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('aria-label') && lines[i].includes('Ð“Ð»Ð°Ð²Ð½Ð° Ð½Ð°Ð²Ð¸Ð³Ð°Ñ†Ð¸Ñ˜Ð°')) {
    lines[i] = '      <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar" aria-label="Главна навигација">';
  }
  if (lines[i].includes('showMore ?') && lines[i].includes('ÐŸÐ¾Ð¼Ð°Ð»ÐºÑƒ')) {
    lines[i] = '            <span>{showMore ? \'Помалку\' : \'Повеќе алатки\'}</span>';
  }
  if (lines[i].includes('tracking-widest') && lines[i].includes('Ð˜ÑÑ‚Ñ€Ð°Ð¶Ð¸')) {
    lines[i] = '              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">Истражи</p>';
  }
  if (lines[i].includes('tracking-widest') && lines[i].includes('AI ÐÐ»Ð°Ñ‚ÐºÐ¸')) {
    lines[i] = '              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">AI Алатки</p>';
  }
  if (lines[i].includes('tracking-widest') && lines[i].includes('Ð ÐµÑÑƒÑ€ÑÐ¸')) {
    lines[i] = '              <p className="px-4 pb-1 text-[10px] font-bold text-gray-300 uppercase tracking-widest">Ресурси</p>';
  }
}

fs.writeFileSync('components/Sidebar.tsx', lines.join('\n'), 'utf8');
console.log("Done");