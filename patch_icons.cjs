const fs = require('fs');
let code = fs.readFileSync('src/views/AnnualPlanGalleryView.tsx', 'utf8');

code = code.replace(/ICONS\.heart/g, "ICONS.starSolid");
code = code.replace(/ICONS\.gitFork/g, "ICONS.gitBranch");

fs.writeFileSync('src/views/AnnualPlanGalleryView.tsx', code, 'utf8');
