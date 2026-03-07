const fs = require('fs');
let content = fs.readFileSync('views/SettingsView.tsx', 'utf8');

// Also inject the hook at the top
if (!content.includes('useUserPreferences')) {
  // Wait, does it use it already? Let's check
  // Just use simple regex to insert
}

const importAnchor = "import { isDailyQuotaKnownExhausted";
const importInsert = "import { useUserPreferences } from '../contexts/UserPreferencesContext';\n";
content = content.replace(importAnchor, importInsert + importAnchor);

const hookAnchor = "const { addNotification } = useNotification();";
const hookInsert = "  const { resetAllTours } = useUserPreferences();\n";
content = content.replace(hookAnchor, hookAnchor + '\n' + hookInsert);

const uiAnchor = "{/* Install App Section */}";
const uiInsert = `
              <Card className="max-w-2xl mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-brand-primary">Туторијали на системот</h2>
                        <p className="text-gray-600 text-sm mt-1">Ресетирај ги сите туторијали за да ги видите новите функционалности низ сите екрани.</p>
                    </div>
                    <button
                        onClick={() => {
                            resetAllTours();
                            addNotification('Туторијалите се ресетирани! Одете на почетната страна.', 'success');
                        }}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-medium transition-colors"
                    >
                        Ресетирај
                    </button>
                </div>
              </Card>
`;
content = content.replace(uiAnchor, uiInsert + uiAnchor);

fs.writeFileSync('views/SettingsView.tsx', content);
