const fs = require('fs');

// Add Route to App.tsx
const appFile = 'App.tsx';
let appCode = fs.readFileSync(appFile, 'utf8');

const importRegex = /const AnnualPlanGeneratorView = .*;/;
const galleryImport = "\nconst AnnualPlanGalleryView = safeLazy(() => import('./views/AnnualPlanGalleryView').then(module => ({ default: module.AnnualPlanGalleryView })));";

appCode = appCode.replace(importRegex, match => match + galleryImport);

const routeRegex = /\{ path: '\/annual-planner', component: AnnualPlanGeneratorView \},/;
const galleryRoute = "\n      { path: '/annual-gallery', component: AnnualPlanGalleryView },";

appCode = appCode.replace(routeRegex, match => match + galleryRoute);

fs.writeFileSync(appFile, appCode, 'utf8');


// Add Sidebar Link
const sidebarFile = 'components/Sidebar.tsx';
let sidebarCode = fs.readFileSync(sidebarFile, 'utf8');

const linkRegex = /<NavItem path="\/annual-planner".*?\/>/;
const galleryLink = '\n          <NavItem path="/annual-gallery" currentPath={currentPath} icon={ICONS.database} label={"Галерија на Планови"} onClick={onClose} badge="COMMUNITY" />';

sidebarCode = sidebarCode.replace(linkRegex, match => match + galleryLink);

fs.writeFileSync(sidebarFile, sidebarCode, 'utf8');
console.log('App and Sidebar updated');
