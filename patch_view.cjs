const fs = require('fs');

const viewFile = 'views/AnnualPlanGeneratorView.tsx';
let code = fs.readFileSync(viewFile, 'utf8');

// The replacement code updates handleGenerate to extract logic
const handleGenerateOld = `    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            // Note: generateAnnualPlan needs to be added to geminiService
            if (geminiService.generateAnnualPlan) {
                const generated = await geminiService.generateAnnualPlan(curriculum?.grades.find(g => g.id === selectedGradeId)?.name || selectedGradeId, subject, weeks);`;

const handleGenerateNew = `    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            // Extract curriculum data to inject into prompt
            const gradeData = curriculum?.grades.find(g => g.id === selectedGradeId);
            const gradeName = gradeData?.name || gradeData?.title || selectedGradeId;
            let curriculumContext = '';
            
            if (gradeData && gradeData.topics && gradeData.topics.length > 0) {
                curriculumContext = gradeData.topics.map((t, idx) => {
                    let desc = \`- Тема \${idx + 1}: \${t.title}\`;
                    if (t.suggestedHours) desc += \` (Препорачани часови: \${t.suggestedHours} часа)\`;
                    if (t.topicLearningOutcomes && t.topicLearningOutcomes.length > 0) {
                        desc += \`\\n  Очекувани резултати: \${t.topicLearningOutcomes.slice(0, 3).join('; ')}...\`;
                    }
                    return desc;
                }).join('\\n\\n');
            } else {
                curriculumContext = "Нема специфични теми во системот за ова одделение. Генерирајте општи теми по математика.";
            }

            if (geminiService.generateAnnualPlan) {
                const generated = await geminiService.generateAnnualPlan(gradeName, subject, weeks, curriculumContext);`;

if (code.includes('const handleGenerate = async () => {')) {
    code = code.replace(handleGenerateOld, handleGenerateNew);
    if (!code.includes('curriculumContext')) {
        console.error('Failed to replace handleGenerate.');
    }
}

fs.writeFileSync(viewFile, code, 'utf8');
console.log('Successfully updated component context injection.');
