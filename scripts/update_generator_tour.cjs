const fs = require('fs');

let content = fs.readFileSync('views/MaterialsGeneratorView.tsx', 'utf8');

const hookStr = `    useTour('generator', generatorTourSteps, !!generatorTourSteps && !isCurriculumLoading);`;
const replacement = `    const handleGeneratorTourStep = React.useCallback((targetElement: HTMLElement) => {
        const tourStep = targetElement.getAttribute('data-tour');      
        if (tourStep === 'generator-step-1') setCurrentStep(1);        
        else if (tourStep === 'generator-step-2') setCurrentStep(2);   
        else if (tourStep === 'generator-step-3' || tourStep === 'generator-generate-button') setCurrentStep(3);                                       
    }, []);

    useTour('generator', generatorTourSteps, !!generatorTourSteps && !isCurriculumLoading, handleGeneratorTourStep);`;

// Wait, the hook needs `setCurrentStep` which doesn't exist? Wait, `MaterialsGeneratorView` uses `dispatch` or `setCurrentStep`? Let's check `MaterialsGeneratorView.tsx`.
