const fs = require('fs');

// Update geminiService.real.ts
const geminiFile = 'services/geminiService.real.ts';
let geminiCode = fs.readFileSync(geminiFile, 'utf8');

// Add import
const importRegex = /import\s+\{([^}]+)\}\s+from\s+'\.\.\/types';/;
geminiCode = geminiCode.replace(importRegex, (match, p1) => {
    if (!p1.includes('AIGeneratedAnnualPlan')) {
        return `import {${p1}, AIGeneratedAnnualPlan } from '../types';`;
    }
    return match;
});

// Add function
if (!geminiCode.includes('async generateAnnualPlan(')) {
    const anchor = '  async generateAdaptiveHomework(';
    const replacement = `  // Е2 \u2014 AI Годишна Програма
  async generateAnnualPlan(
    grade: string,
    subject: string,
    totalWeeks: number,
    profile?: TeachingProfile,
    customInstruction?: string
  ): Promise<AIGeneratedAnnualPlan> {
    const prompt = \`
Вие сте експерт наставник и советник по \${subject} за \${grade} во македонскиот образовен систем.
Ваша задача е да генерирате предлог-годишна програма за наставата.
Вкупно недели на располагање: \${totalWeeks}.
Распределете ги темите низ неделите така што вкупниот број на недели ќе биде точно \${totalWeeks}.
За секоја тема, напишете наслов, времетраење во недели, клучни цели (objectives), и предложени активности.
\${customInstruction ? \`\\nДополнителни инструкции: \${customInstruction}\` : ''}
Вратете ВАЛИДЕН JSON според шемата.
    \`.trim();

    const schema = {
      type: Type.OBJECT,
      properties: {
        grade: { type: Type.STRING },
        subject: { type: Type.STRING },
        totalWeeks: { type: Type.NUMBER },
        topics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              durationWeeks: { type: Type.NUMBER },
              objectives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              suggestedActivities: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['title', 'durationWeeks', 'objectives', 'suggestedActivities'],
          },
        },
      },
      required: ['grade', 'subject', 'totalWeeks', 'topics'],
    };

    return generateAndParseJSON<AIGeneratedAnnualPlan>(
      [{ text: prompt }],
      schema,
      DEFAULT_MODEL,
      undefined,
      MAX_RETRIES,
      false,
    );
  },

  async generateAdaptiveHomework(`;

    geminiCode = geminiCode.replace(anchor, replacement);
}

fs.writeFileSync(geminiFile, geminiCode, 'utf8');
console.log('Patched geminiService.real.ts');

