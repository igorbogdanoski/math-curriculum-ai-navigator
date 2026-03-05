const fs=require('fs');
let code = fs.readFileSync('components/Sidebar.tsx', 'utf8');

if (!code.includes('LanguageSelector')) {
    code = code.replace("import { APP_NAME, ICONS } from '../constants';", "import { APP_NAME, ICONS } from '../constants';\nimport { LanguageSelector } from './common/LanguageSelector';");
    
    // Find the footer div of sidebar and inject language selector above it
    const target = '<div className="mt-auto border-t border-brand-100 bg-white">';
    const replacement = '<div className="px-4 py-3 border-t border-brand-100 mt-auto flex items-center justify-between">\n            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t(\'nav_language\') || \'Јазик\'}</span>\n            <LanguageSelector />\n          </div>\n          <div className="border-t border-brand-100 bg-white">';
    code = code.replace(target, replacement);
    
    fs.writeFileSync('components/Sidebar.tsx', code, 'utf8');
    console.log('Injected LanguageSelector');
}
