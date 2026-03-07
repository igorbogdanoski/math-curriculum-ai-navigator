const fs = require('fs');

const file = process.argv[2];
if (!file) {
    console.error("Please provide a file path");
    process.exit(1);
}

let text = fs.readFileSync(file, 'utf8');

// Find all JSON blocks
const jsonRegex = /```json\s*([\s\S]*?)\s*```/g;
let matches;
let allTopics = [];
let hasMatches = false;

while ((matches = jsonRegex.exec(text)) !== null) {
  hasMatches = true;
  try {
    let contentStr = matches[1];
    let parsed = JSON.parse(contentStr);
    
    // Some structures use "теми", some use "активности_по_теми"
    const topicsArr = parsed['активности_по_теми'] || parsed['теми'] || (Array.isArray(parsed) ? parsed : []);
    
    if (Array.isArray(topicsArr)) {
        allTopics = allTopics.concat(topicsArr);
    }
  } catch(e) {
    console.error("Error parsing a JSON block in " + file, e.message);
  }
}

// If no markdown blocks, try finding the first { and last }
if (!hasMatches) {
  try {
     const startIndex = text.indexOf('{');
     const endIndex = text.lastIndexOf('}');
     if (startIndex !== -1 && endIndex !== -1) {
         let parsed = JSON.parse(text.substring(startIndex, endIndex + 1));
         const topicsArr = parsed['активности_по_теми'] || parsed['теми'] || (Array.isArray(parsed) ? parsed : []);
         allTopics = allTopics.concat(topicsArr);
     }
  } catch(e) {
      console.error("Fallback parsing failed for " + file, e.message);
  }
}

// Wrap it back into the format auto_inject expects
const result = {
  "активности_по_теми": allTopics
};

fs.writeFileSync(file + '.cleaned.json', JSON.stringify(result, null, 2), 'utf8');
console.log("Cleaned " + file + " and saved to " + file + ".cleaned.json");
