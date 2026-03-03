import fs from 'fs';
import https from 'https';
import path from 'path';

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("Error: GEMINI_API_KEY environment variable is not set. Please set it before running this script.");
  process.exit(1);
}

// Helper to interact with Gemini API
async function mapActivityToConcept(themeTitle, concepts, activityText) {
  const prompt = `You are a curriculum mapping assistant for the Macedonian educational system.
I have a math activity and a list of curriculum Sub-themes/Concepts.
I need you to tell me WHICH concept this activity matches best.

Theme: ${themeTitle}

Candidate Concepts:
${concepts.map((c, i) => `[ID: ${i}]
  Title: ${c.title}
  Description: ${c.description}
  Content: ${c.content ? c.content.join(', ') : ''}
`).join('\n')}

Activity to map: "${activityText}"

Return JUST the numerical ID of the candidate concept that best matches this activity (e.g. 0, 1, 2). Do not include any other text, quotes, or formatting.`;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1 }
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
              console.error("API Rate limit or error hit:", json.error.message);
              resolve(0);
              return;
          }
          let text = json.candidates[0].content.parts[0].text.trim();
          // Extract just the number
          const match = text.match(/\d+/);
          if (match) {
            resolve(parseInt(match[0], 10));
          } else {
            resolve(0); // fallback to the first concept
          }
        } catch (e) {
          console.error("Failed parsing internal JSON payload.", String(e), data.substring(0, 100));
          resolve(0); // fallback
        }
      });
    });
    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function normalizeText(t) {
  return t.replace(/[^а-шА-Шa-zA-Z0-9]/g, '').toLowerCase();
}

async function main() {
  const gradeFile = process.argv[2];
  const activitiesFile = process.argv[3];

  if (!gradeFile || !activitiesFile) {
    console.log("Usage: node auto_inject_activities.js <path_to_grade_ts> <path_to_activities_json>");
    console.log("Example: node auto_inject_activities.js data/grade9.ts new_activities.json");
    process.exit(1);
  }

  console.log(`Loading grade data from ${gradeFile}...`);
  let tsText = fs.readFileSync(gradeFile, 'utf8');
  
  // Need to extract the variable name if we are rewriting the export
  const exportMatch = tsText.match(/export const (\w+): Grade =/);
  const exportVarName = exportMatch ? exportMatch[1] : 'data';

  // Parse the object notation from the TS file
  const startIndex = tsText.indexOf('{', tsText.indexOf('export'));
  let objectText = tsText.substring(startIndex).trim();
  if (objectText.endsWith(';')) objectText = objectText.slice(0, -1);
  
  let gradeData = eval('(' + objectText + ')');

  console.log(`Loading activities from ${activitiesFile}...`);
  let activitiesInput = JSON.parse(fs.readFileSync(activitiesFile, 'utf8'));
  const activityThemes = activitiesInput['активности_по_теми'] || activitiesInput;

  let addedCount = 0;
  let existCount = 0;

  for (const themeData of activityThemes) {
    const rawThemeTitle = themeData['тема'];
    const currentActivities = themeData['активности'];
    
    // Find the closest topic in gradeData
    let topicToUpdate = gradeData.topics.find(t => normalizeText(t.title) === normalizeText(rawThemeTitle));
    
    if (!topicToUpdate) {
      console.log(`Warning: Could not strictly find topic matching ${rawThemeTitle}. Doing partial match...`);
      topicToUpdate = gradeData.topics.find(t => normalizeText(t.title).includes(normalizeText(rawThemeTitle).substring(0, 10)));
    }

    if (!topicToUpdate || !topicToUpdate.concepts) {
      console.log(`Could not find topic or concepts for ${rawThemeTitle}. Skipping.`);
      continue;
    }

    for (const activityText of currentActivities) {
      // Check if it already exists in the entire topic to avoid duplicates
      let exists = false;
      for (const concept of topicToUpdate.concepts) {
          if (concept.activities) {
              for (const existingAct of concept.activities) {
                  if (normalizeText(existingAct).includes(normalizeText(activityText).substring(0, 20))) {
                      exists = true;
                      break;
                  }
              }
          }
      }

      if (exists) {
        existCount++;
        continue;
      }

      // Map to best concept using AI
      console.log(`Mapping activity: "${activityText.substring(0, 50)}..."`);
      let bestConceptIndex = 0;
      
      // Only call AI if there's more than 1 concept
      if (topicToUpdate.concepts.length > 1) {
        bestConceptIndex = await mapActivityToConcept(topicToUpdate.title, topicToUpdate.concepts, activityText);
      }
      
      if (bestConceptIndex < 0 || bestConceptIndex >= topicToUpdate.concepts.length) {
        bestConceptIndex = 0;
      }

      const selectedConcept = topicToUpdate.concepts[bestConceptIndex];
      // console.log(`   -> Mapped to Concept: ${selectedConcept.title}`);
      
      if (!selectedConcept.activities) {
        selectedConcept.activities = [];
      }
      selectedConcept.activities.push(activityText);
      addedCount++;
      
      // A small delay to respect API rate limits
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\nRun complete: Added ${addedCount} activities. Skipped ${existCount} existing.`);
  
  // Reconstruct the file
  const newTsText = `import { type Grade } from '../types';\n\nexport const ${exportVarName}: Grade = ${JSON.stringify(gradeData, null, 2)};\n`;
  fs.writeFileSync(gradeFile, newTsText);
  console.log(`Successfully updated ${gradeFile}`);
}

main().catch(console.error);