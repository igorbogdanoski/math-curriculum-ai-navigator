const fs = require('fs');
let c = fs.readFileSync('views/MaterialsGeneratorView.tsx', 'utf8');
c = c.replace(
  "useTour('generator', generatorTourSteps, !!generatorTourSteps && !isCurriculumLoading);",
  `const handleTourStep = React.useCallback((el: HTMLElement) => {
    const step = el.getAttribute('data-tour');
    if (step === 'generator-step-1') setCurrentStep(1);
    else if (step === 'generator-step-2') setCurrentStep(2);
    else if (step === 'generator-step-3' || step === 'generator-generate-button') setCurrentStep(3);
}, []);
    useTour('generator', generatorTourSteps, !!generatorTourSteps && !isCurriculumLoading, handleTourStep);`
);
fs.writeFileSync('views/MaterialsGeneratorView.tsx', c);
