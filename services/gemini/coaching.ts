import {
    DEFAULT_MODEL, LITE_MODEL, MAX_RETRIES, generateAndParseJSON,
    checkDailyQuotaGuard, SAFETY_SETTINGS, callGeminiProxy,
    sanitizePromptInput, getAILanguageRule, Type,
} from './core';

export const coachingAPI = {

/**
 * Live-coached scratchpad — looks at a snapshot of the student's in-progress work and gives
 * one short Socratic hint, never the final answer. `hintsGivenCount` (0-indexed, how many hints
 * this student has already received for this problem) escalates specificity the same way
 * generateSocraticHint's hintLevel does, so a repeatedly-stuck student gets more concrete help
 * over time rather than the identical vague nudge on every check.
 */
async coachLiveWork(
  base64Image: string,
  mimeType: string,
  problemText: string,
  hintsGivenCount: number,
): Promise<{ hint: string }> {
    checkDailyQuotaGuard();
    const safeProblem = sanitizePromptInput(problemText, 500);
    const level = Math.min(hintsGivenCount + 1, 3) as 1 | 2 | 3;
    const levelInstructions: Record<1 | 2 | 3, string> = {
      1: 'Дај општа насока или прашање за она што го гледаш на сликата — не посочувај конкретен чекор.',
      2: 'Биди попрецизен: посочи го конкретниот дел од работата каде треба да се сврти внимание, без да го откриваш решението.',
      3: 'Ученикот веројатно е заглавен по неколку обиди. Дај поконкретна насока за конкретниот следен чекор (пр. кое правило или операција да примени), но сепак не го решавај целосно наместо него.',
    };

    const prompt = `Ти си Сократски наставник по математика кој набљудува работна тетратка во живо.

ЗАДАЧА: "${safeProblem}"

Погледни ја приложената слика од тетратката на ученикот (рачно напишана работа во тек).

Правила:
- Погледни ЦЕЛОСНО што е напишано или нацртано на сликата.
- Дај ЕДНА кратка забелешка или прашање (максимум 1-2 реченици) што го насочува ученикот кон следниот чекор.
- НИКОГАШ не го откривај конечниот одговор или целосното решение.
- Ако работата изгледа точна досега, охрабри го ученикот и упати го кон следниот чекор.
- Ако забележиш грешка, насочи го со прашање наместо директно да ја посочиш (пр. "Провери го знакот кога го пренесуваш членот на другата страна.").
- Ниво на насока (${level}/3): ${levelInstructions[level]}
- ЈАЗИК НА ОДГОВОР: ${getAILanguageRule()}`;

    const response = await callGeminiProxy({
      model: LITE_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }] }],
      safetySettings: SAFETY_SETTINGS,
      generationConfig: { temperature: 0.4, maxOutputTokens: 150 },
      skipTierOverride: true,
    });
    return { hint: response.text.trim() };
  },

/**
 * Extracts every distinct problem statement from a photographed worksheet, verbatim (LaTeX for
 * math notation) — feeds each into the existing solveSpecificProblemStepByStep for a self-study
 * "photograph your homework, get every problem solved" flow. Capped at 10 problems server-side
 * via the prompt; the caller further caps what it actually solves/displays.
 */
async extractProblemsFromImage(base64Image: string, mimeType: string): Promise<string[]> {
    checkDailyQuotaGuard();
    const prompt = `Ти си помошник кој ги извлекува задачите од фотографирана математичка работна листа.

Погледни ја приложената слика и извлечи ги сите одделни, нерешени задачи прикажани на неа —
дословниот текст на секоја задача, задржувајќи ги математичките изрази во LaTeX формат
($...$ или $$...$$).

Правила:
- Извлечи најмногу 10 задачи.
- Извлекувај само задачи кои сè уште не се решени на листата (ако ученикот веќе напишал
  одговор до некоја задача, сепак извлечи го само текстот на прашањето, не и одговорот).
- Ако задачата има повеќе делови (а, б, в...), третирај го секој дел како посебна задача.
- Ако сликата не содржи препознатливи математички задачи, врати празна листа.

Врати JSON точно по овој формат:
{ "problems": ["текст на задача 1", "текст на задача 2"] }`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        problems: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['problems'],
    };

    const result = await generateAndParseJSON<{ problems: string[] }>(
      [{ text: prompt }, { inlineData: { mimeType, data: base64Image } }],
      schema,
      DEFAULT_MODEL,
      undefined,
      MAX_RETRIES,
      false,
      undefined,
      undefined,
      { costKey: 'ASSESSMENT' },
    );
    return result.problems;
  },

};
