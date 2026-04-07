import fs from 'fs';
import path from 'path';

function enrichFile(sourceFile, targetFile) {
    const sourcePath = path.resolve(sourceFile);
    const targetPath = path.resolve(targetFile);

    if (!fs.existsSync(sourcePath) || !fs.existsSync(targetPath)) {
        console.log(`Missing file: ${sourcePath} or ${targetPath}`);
        return;
    }

    const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf-8'));
    const targetData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));

    let enrichedCount = 0;

    targetData.questions.forEach((targetQ, index) => {
        const sourceQ = sourceData.questions.find(q => q.questionNumber === targetQ.questionNumber);
        if (!sourceQ) return;

        // Pattern to match placeholders
        const placeholderRegex = /\[(resim\/formül|fotografi\/formulë|слика\/формула)\]/g;

        // Enrich questionText
        if (targetQ.questionText.match(placeholderRegex)) {
            // Try to find the formula in sourceQ.questionText
            // Usually formulas are between $ $
            const formulas = sourceQ.questionText.match(/\$.*?\$/g);
            if (formulas && formulas.length > 0) {
                let text = targetQ.questionText;
                formulas.forEach(f => {
                    text = text.replace(/\[(resim\/formül|fotografi\/formulë|слика\/формула)\]/, f);
                });
                targetQ.questionText = text;
                enrichedCount++;
            }
        }

        // Enrich choices
        if (targetQ.choices) {
            Object.keys(targetQ.choices).forEach(key => {
                if (targetQ.choices[key].match(placeholderRegex)) {
                    if (sourceQ.choices && sourceQ.choices[key]) {
                        targetQ.choices[key] = sourceQ.choices[key];
                        enrichedCount++;
                    }
                }
            });
        }
        
        // Always copy correct answer if target is null/empty and source is filled
        if (!targetQ.correctAnswer && sourceQ.correctAnswer) {
            targetQ.correctAnswer = sourceQ.correctAnswer;
        }
        
        // Copy concepts if missing
        if ((!targetQ.conceptIds || targetQ.conceptIds.length === 0) && sourceQ.conceptIds) {
            targetQ.conceptIds = sourceQ.conceptIds;
        }
    });

    fs.writeFileSync(targetPath, JSON.stringify(targetData, null, 2));
    console.log(`Enriched ${targetFile}: ${enrichedCount} placeholders fixed.`);
}

// June 2023
enrichFile('data/matura/raw/dim-gymnasium-2023-june-mk.json', 'data/matura/raw/dim-gymnasium-2023-june-tr.json');
enrichFile('data/matura/raw/dim-gymnasium-2023-june-mk.json', 'data/matura/raw/dim-gymnasium-2023-june-al.json');

// August 2022 (already mostly done, but good to check)
enrichFile('data/matura/raw/dim-gymnasium-2022-august-mk.json', 'data/matura/raw/dim-gymnasium-2022-august-al.json');
