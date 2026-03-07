const fs = require('fs');

const extractAndReplaceIntroJs = (viewPath, tourName, stepsVar, extraCondition) => {
    let content = fs.readFileSync(viewPath, 'utf8');

    // 1. Remove "declare var introJs: any;" if present
    content = content.replace(/declare var introJs: any;\n?/g, '');

    // 2. Remove the old useEffect that contains introJs()
    const regex = new RegExp(
        `\\s*useEffect\\(\\(\\) => \\{[\\s\\S]*?introJs\\(\\)[\\s\\S]*?\\}, \\[[^\\]]*\\]\\);`,
        'm'
    );
    
    content = content.replace(regex, '');

    // 3. Inject useTour
    // Find where to put it. Best place: right after the component declaration
    // Specifically, if it's already using useTour, we don't need to add the import, we already did
    // Let's add the useTour call right before `return (` or after `const { toursSeen ...`.
    const insertAnchor = `const { toursSeen`;
    if (content.includes(insertAnchor)) {
        content = content.replace(insertAnchor, `useTour('${tourName}', ${stepsVar}, ${extraCondition});\n  ${insertAnchor}`);
    }

    fs.writeFileSync(viewPath, content);
};

extractAndReplaceIntroJs('views/HomeView.tsx', 'dashboard', 'dashboardTourSteps', '!isStatsLoading && !isRecsLoading');
extractAndReplaceIntroJs('views/ExploreView.tsx', 'explore', 'exploreTourSteps', 'true');
extractAndReplaceIntroJs('views/LessonPlanLibraryView.tsx', 'library', 'libraryTourSteps', 'lessonPlans.length > 0 && !isLoading');
extractAndReplaceIntroJs('views/MaterialsGeneratorView.tsx', 'generator', 'generatorTourSteps', '!!generatorTourSteps && !isCurriculumLoading');
extractAndReplaceIntroJs('views/PlannerView.tsx', 'planner', 'plannerTourSteps', '!isLoading');

