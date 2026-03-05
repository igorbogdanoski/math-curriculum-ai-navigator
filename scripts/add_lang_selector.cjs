const fs = require('fs');
let c = fs.readFileSync('components/Sidebar.tsx', 'utf8');
c = c.replace(
  '<div className="p-2 border-t bg-gray-50/50 space-y-2">',
  `<div className="p-2 border-t bg-gray-50/50 space-y-2">
        <div className="px-2">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as any)}
              className="w-full text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md shadow-sm focus:ring-brand-primary focus:border-brand-primary py-1.5 px-2"
            >
              <option value="mk">🇲🇰 Македонски</option>
              <option value="sq">🇦🇱 Shqip</option>
              <option value="tr">🇹🇷 Türkçe</option>
            </select>
        </div>`
);
fs.writeFileSync('components/Sidebar.tsx', c, 'utf8');
