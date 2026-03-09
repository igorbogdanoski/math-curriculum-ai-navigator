const fs = require('fs');

const geminiFile = 'services/geminiService.real.ts';
let code = fs.readFileSync(geminiFile, 'utf8');

const oldFuncRegex = /async generateAnnualPlan\([\s\S]*?async generateAdaptiveHomework/m;

const newFunc = `async generateAnnualPlan(
    grade: string,
    subject: string,
    totalWeeks: number,
    curriculumContext: string,
    profile?: TeachingProfile,
    customInstruction?: string
  ): Promise<AIGeneratedAnnualPlan> {
    const prompt = \`
Вие сте врвен експерт за планирање на наставата по \${subject} за \${grade} во македонскиот образовен систем.
Ваша задача е да креирате детална, практична и изводлива предлог-годишна програма.

ПАРАМЕТРИ:
- Вкупно недели на располагање: \${totalWeeks}.

ОФИЦИЈАЛНА ПРОГРАМА (МОРА да се придржувате до овие теми и нивните специфики):
\${curriculumContext}

УПАТСТВА:
1. Строго базирајте го вашиот план на официалните теми дадени погоре.
2. Распределете ги темите низ неделите така што сумата од сите недели да биде ТОЧНО \${totalWeeks}.
3. Доколку се дадени "Препорачани часови" (suggested hours) во контекстот, конвертирајте ги во реални недели на настава (претпоставувајќи просечно 4-5 часа неделно за математика, но прилагодете го вкупноот фонд да резултира во точно \${totalWeeks} недели).
4. За секоја тема, извлечете ги примарните цели (врз основа на "Очекувани резултати"/learning outcomes доколку ги има) и предложете 2-3 креативни, модерни активности погодни за тоа одделение.
\${customInstruction ? \`\\nДОПОЛНИТЕЛНИ ИНСТРУКЦИИ ОД НАСТАВНИКОТ: \${customInstruction}\` : ''}

Вратете ВАЛИДЕН JSON според шемата, без дополнителен текст.
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

  async generateAdaptiveHomework`;

if (oldFuncRegex.test(code)) {
    code = code.replace(oldFuncRegex, newFunc);
    fs.writeFileSync(geminiFile, code, 'utf8');
    console.log('Successfully updated generateAnnualPlan prompt.');
} else {
    console.error('Could not find existing generateAnnualPlan function.');
}
