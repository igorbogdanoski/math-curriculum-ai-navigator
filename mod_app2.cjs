const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf8');

if (!code.includes('import { GlobalTour }')) {
    code = "import { GlobalTour } from './components/GlobalTour';\n" + code;
    fs.writeFileSync('App.tsx', code, 'utf8');
    console.log('Injected GlobalTour import');
}
