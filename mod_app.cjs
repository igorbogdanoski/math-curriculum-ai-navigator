const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

if (!code.includes('GlobalTour')) {
    code = code.replace("import { AuthProvider }", "import { GlobalTour } from './components/GlobalTour';\nimport { AuthProvider }");
    code = code.replace("</AuthProvider>", "  <GlobalTour />\n            </AuthProvider>");
    fs.writeFileSync('App.tsx', code, 'utf8');
    console.log('Injected GlobalTour');
} else {
    console.log('Already injected');
}
