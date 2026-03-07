const fs = require('fs');
const gradeFile = process.argv[2];
const gradeNum = process.argv[3];

if (!gradeFile || !gradeNum) {
  console.error("Usage: node process_mixed_grade_json.cjs <file.json> <gradeNum>");
  process.exit(1);
}

const raw = fs.readFileSync(gradeFile, 'utf8');

// Find all JSON blocks
const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
let match;
let activities = [];
let curriculum = null;

while ((match = jsonRegex.exec(raw)) !== null) {
  try {
    const parsed = JSON.parse(match[1]);
    
    // Check if it's the curriculum block
    if (parsed.наставна_програма && parsed.тематски_целини) {
      curriculum = parsed;
    } 
    
    // Check for `теми` or `активности_по_теми` blocks even within the same object
    const themes = parsed.теми || parsed.активности_по_теми || [];
    if (themes.length > 0) {
      themes.forEach(tema => {
        const title = tema.тема;
        let existingTema = activities.find(t => t.тема === title);
        if (!existingTema) {
          existingTema = { тема: title, активности: [] };
          activities.push(existingTema);
        }
        if (tema.активности && Array.isArray(tema.активности)) {
          existingTema.активности.push(...tema.активности);
        }
      });
    }
  } catch (e) {
    console.error("Failed to parse a JSON block", e);
  }
}

// If there's any stray JSON with plain array, though unlikely here based on our observation
if (curriculum) {
  fs.writeFileSync(`data/grade${gradeNum}.json`, JSON.stringify(curriculum, null, 2));
  console.log(`Saved curriculum to data/grade${gradeNum}.json`);
} else {
  console.error('No curriculum found');
}

if (activities.length > 0) {
  fs.writeFileSync(`grade${gradeNum}_activities.json.cleaned.json`, JSON.stringify(activities, null, 2));
  console.log(`Saved ${activities.length} activities to grade${gradeNum}_activities.json.cleaned.json`);
} else {
  console.error('No activities found');
}
