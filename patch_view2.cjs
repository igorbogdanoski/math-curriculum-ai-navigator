const fs = require('fs');
const viewFile = 'views/AnnualPlanGeneratorView.tsx';
let code = fs.readFileSync(viewFile, 'utf8');

const anchor = "const handleGenerate = async () => {\n        setIsGenerating(true);\n        try {\n            // Note: generateAnnualPlan";
const fullReplacement = `const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            // Extract curriculum data to inject into prompt
            const gradeData = curriculum?.grades.find(g => g.id === selectedGradeId);
            const gradeName = gradeData?.title || gradeData?.id || selectedGradeId;
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

// Let's use a regex replacement to grab the whole block down to await geminiService.generateAnnualPlan(...)
code = code.replace(/const handleGenerate = async \(\) => {[\s\S]*?await geminiService\.generateAnnualPlan\([^;]+\);/m, fullReplacement + '\n                setPlan(generated);');

fs.writeFileSync(viewFile, code, 'utf8');
console.log('Successfully replaced via regex.');
