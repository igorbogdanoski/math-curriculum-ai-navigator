const fs = require('fs');

const gradeNumber = process.argv[2]; // e.g. "1"
const jsonFile = process.argv[3];    // e.g. "data/grade1.json"

if (!gradeNumber || !jsonFile) {
    console.log("Usage: node generate_grade_ts.cjs <grade_number> <path_to_json>");
    process.exit(1);
}

const rawText = fs.readFileSync(jsonFile, 'utf8').replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');
const data = JSON.parse(rawText);

const tsData = {
    id: `grade-${gradeNumber}`,
    level: parseInt(gradeNumber),
    title: data.наставна_програма.одделение + " Одделение",
    topics: []
};


let topicCounter = 1;
for (const tema of data.тематски_целини) {
    const topicId = `g${gradeNumber}-topic-${topicCounter}`;
    
    let concepts = [];
    let conceptCounter = 1;
    
    for (const [conceptName, standards] of Object.entries(tema["стандарди_за_оценување"] || {})) {
        const readableName = conceptName.replace(/_/g, ' ');
        concepts.push({
            id: `g${gradeNumber}-concept-${topicCounter}-${conceptCounter}`,
            title: readableName,
            description: `Цели за: ${readableName}`,
            assessmentStandards: standards,
            activities: [] 
        });
        conceptCounter++;
    }

    tsData.topics.push({
        id: topicId,
        title: tema.тема,
        suggestedHours: tema.број_на_часови,
        topicLearningOutcomes: tema.резултати_од_учење || [],
        concepts: concepts
    });
    
    topicCounter++;
}

const outputFile = `data/grade${gradeNumber}.ts`;
const tsContent = `import { type Grade } from '../types';\n\nexport const grade${gradeNumber}Data: Grade = ${JSON.stringify(tsData, null, 2)};\n`;

fs.writeFileSync(outputFile, tsContent, 'utf8');
console.log(`Successfully generated ${outputFile}`);