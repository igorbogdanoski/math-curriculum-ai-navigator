const fs = require('fs');

const views = [
  'views/ExploreView.tsx',
  'views/HomeView.tsx',
  'views/LessonPlanLibraryView.tsx',
  'views/MaterialsGeneratorView.tsx',
  'views/PlannerView.tsx'
];

views.forEach(viewPath => {
  let content = fs.readFileSync(viewPath, 'utf8');

  // Add the useTour import if not present
  if (!content.includes("import { useTour }")) {
    content = "import { useTour } from '../hooks/useTour';\n" + content;
  }

  // Define regex to find the introJs useEffect blocks
  // They generally look like:
  /*
    useEffect(() => {
        if (toursSeen.XXX === true ...
        ...
        });
        tour.start();
      }, 500);
      return () => clearTimeout(timer);
    }, [toursSeen...]);
  */
  
  // They are complex, let's locate the toursSeen extraction.
  // HomeView.tsx
  if (viewPath.includes('HomeView')) {
    content = content.replace(/useEffect\(\(\) => \{\s*if \(toursSeen\.dashboard === true.*?\n.*?setTimeout\(\(\) => \{[\s\S]*?tour\.start\(\);[\s\S]*?\}, 500\);\n.*?\n.*?\n\s*\}, \[toursSeen.*?\n/m, 
    `// Using centralized robust hook
    useTour('dashboard', dashboardTourSteps, !isStatsLoading && !isRecsLoading);\n`);
    
    // make sure isStatsLoading and isRecsLoading are available (they are in HomeView)
  }

  // ExploreView.tsx
  if (viewPath.includes('ExploreView')) {
    content = content.replace(/useEffect\(\(\) => \{\s*if \(toursSeen\.explore === true.*?\n.*?setTimeout\(\(\) => \{[\s\S]*?tour\.start\(\);[\s\S]*?\}, 500\);\n.*?\n.*?\n\s*\}, \[toursSeen.*?\n/m, 
    `useTour('explore', exploreTourSteps, true);\n`);
  }

  // LessonPlanLibraryView.tsx
  if (viewPath.includes('LessonPlanLibraryView')) {
    content = content.replace(/useEffect\(\(\) => \{\s*if \(toursSeen\.library === true.*?\n.*?setTimeout\(\(\) => \{[\s\S]*?tour\.start\(\);[\s\S]*?\}, 500\);\n.*?\n.*?\n\s*\}, \[toursSeen.*?\n/m, 
    `useTour('library', libraryTourSteps, true);\n`);
  }

  // MaterialsGeneratorView.tsx
  if (viewPath.includes('MaterialsGeneratorView')) {
    // wait, this one might use steps = generatorTourSteps
    content = content.replace(/useEffect\(\(\) => \{\s*if \(\!generatorTourSteps \|\| toursSeen\.generator === true.*?\n.*?setTimeout\(\(\) => \{[\s\S]*?tour\.start\(\);[\s\S]*?\}, 500\);\n.*?\n.*?\n\s*\}, \[toursSeen.*?\n/m, 
    `useTour('generator', generatorTourSteps, !!generatorTourSteps);\n`);
  }

  // PlannerView.tsx
  if (viewPath.includes('PlannerView')) {
    content = content.replace(/useEffect\(\(\) => \{\s*if \(toursSeen\.planner === true.*?\n.*?setTimeout\(\(\) => \{[\s\S]*?tour\.start\(\);[\s\S]*?\}, 500\);\n.*?\n.*?\n\s*\}, \[toursSeen.*?\n/m, 
    `useTour('planner', plannerTourSteps, !isLoading);\n`);
  }

  // Remove `typeof introJs` and `introJs` usages
  content = content.replace(/typeof introJs === 'undefined' \|\| /g, '');

  fs.writeFileSync(viewPath, content);
});
