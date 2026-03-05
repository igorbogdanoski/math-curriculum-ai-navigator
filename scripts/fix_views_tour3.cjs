const fs = require('fs');

const views = [
  'views/ExploreView.tsx',
  'views/LessonPlanLibraryView.tsx',
  'views/MaterialsGeneratorView.tsx',
  'views/PlannerView.tsx'
];

views.forEach(viewPath => {
  let lines = fs.readFileSync(viewPath, 'utf8').split('\n');
  
  // 1. remove introJs declaration
  lines = lines.map(line => line.includes('declare var introJs') ? '' : line);
  
  // 2. inject useTour import
  if (!lines.some(l => l.includes('import { useTour }'))) {
     lines.unshift("import { useTour } from '../hooks/useTour';");
  }

  // 3. remove the specific introJs useEffect block
  let inIntroJsEffect = false;
  let effectBraceCount = 0;
  
  const modifiedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('useEffect(') && (
        (lines[i+1] && lines[i+1].includes('introJs')) ||
        (lines[i+2] && lines[i+2].includes('introJs')) ||
        (lines[i+1] && lines[i+1].includes('toursSeen') && lines[i+1].includes('typeof introJs')) ||
        (lines[i+1] && lines[i+1].includes('toursSeen') && lines[i+5] && lines[i+5].includes('introJs()')) ||
        // Generator view has a comment before it "Disable tours on small screens as they are often buggy"
        (lines[i+4] && lines[i+4].includes('introJs()') && line.includes('useEffect(() => {')) ||
        (lines[i+1] && lines[i+1].includes('toursSeen') && lines[i+6] && lines[i+6].includes('introJs()')) ||
        (line.includes("const tourInstance = React.useRef<any>(null);")) // skip this entirely
    )) {
      if (!line.includes("const tourInstance")) {
        inIntroJsEffect = true;
        effectBraceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        continue;
      }
    }
    
    // Also strip the tourInstance ref
    if (line.includes("const tourInstance")) continue;

    if (inIntroJsEffect) {
      effectBraceCount += (line.match(/\{/g) || []).length;
      effectBraceCount -= (line.match(/\}/g) || []).length;
      if (effectBraceCount <= 0) {
        inIntroJsEffect = false;
      }
      continue; // skip the introJs effect lines
    }
    
    modifiedLines.push(line);
  }
  
  let content = modifiedLines.join('\n');
  
  // 4. Inject the useTour immediately after `const { toursSeen`
  const insertAnchor = /const { toursSeen.*?= useUserPreferences\(\);/;
  
  let extraCondition = 'true';
  let stepsVar = '';
  let tourName = '';
  if (viewPath.includes('ExploreView')) { tourName = 'explore'; stepsVar = 'exploreTourSteps'; extraCondition = '!isLoading'; }
  if (viewPath.includes('LessonPlanLibraryView')) { tourName = 'library'; stepsVar = 'libraryTourSteps'; extraCondition = 'lessonPlans.length > 0 && !isLoading'; }
  if (viewPath.includes('MaterialsGeneratorView')) { tourName = 'generator'; stepsVar = 'generatorTourSteps'; extraCondition = '!!generatorTourSteps && !isCurriculumLoading'; }
  if (viewPath.includes('PlannerView')) { tourName = 'planner'; stepsVar = 'plannerTourSteps'; extraCondition = '!isLoading'; }

  content = content.replace(insertAnchor, (match) => {
     return `useTour('${tourName}', ${stepsVar}, ${extraCondition});\n    ${match}`;
  });

  fs.writeFileSync(viewPath, content);
});
