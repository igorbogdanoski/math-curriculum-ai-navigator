import { logger } from '../../utils/logger';
import { Concept, TeachingProfile } from '../../types';
import {
    DEFAULT_MODEL, LITE_MODEL, MAX_RETRIES, generateAndParseJSON, CACHE_COLLECTION,
    checkDailyQuotaGuard, SAFETY_SETTINGS, callGeminiProxy, getCached, setCached,
    sanitizePromptInput, getResolvedTextSystemInstruction, Type,
} from './core';
import { shouldUseLiteModel, logRouterDecision } from './intentRouter';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

export const tutorAPI = {

async generateAnalogy(concept: Concept, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    const cacheKey = `analogy_${concept.id}_g${gradeLevel}`;
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
        if (cachedDoc.exists()) return cachedDoc.data().content;
    } catch (e) { logger.warn('Cache read error', e); }

    const prompt = `Објасни го поимот "${concept.title}" за ${gradeLevel} одделение преку аналогија.`;
    const useLiteAnalogy = shouldUseLiteModel('analogy');
    const analogyModel = useLiteAnalogy ? LITE_MODEL : DEFAULT_MODEL;
    logRouterDecision('analogy', analogyModel);
    const response = await callGeminiProxy({
        model: analogyModel,
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: getResolvedTextSystemInstruction(),
        safetySettings: SAFETY_SETTINGS,
        userTier: profile?.tier,
        skipTierOverride: useLiteAnalogy,
    });
    const text = response.text || '';
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: text, type: 'analogy', conceptId: concept.id, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return text;
  },

async generateStepByStepSolution(conceptTitle: string, gradeLevel: number, customInstruction?: string): Promise<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }> {
    const safeConceptTitle = sanitizePromptInput(conceptTitle, 120);
    const safeCustomInstruction = sanitizePromptInput(customInstruction, 800);
    const cacheKey = `solver_thinking_${safeConceptTitle.replace(/\s+/g, '_')}_g${gradeLevel}`;
    if (!customInstruction) {
      try {
          const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
          if (cachedDoc.exists()) return cachedDoc.data().content;
      } catch (e) { logger.warn('Cache error:', e); }
    }

    const prompt = `
      Ти си експерт за математичка педагогија. Креирај една типична задача за "${safeConceptTitle}" за ${gradeLevel} одделение.
      Користи Tree of Thoughts (ToT) пристап: размисли за 2 различни методи на решавање и избери ја онаа која е најјасна за ученик.
      Реши ја задачата детално преку Chain of Thought (CoT) — секој чекор мора да биде логично поврзан.

      Внимавај на математичката точност! Направи само-проверка пред финалниот одговор.
      ${safeCustomInstruction ? `\nКонтекст од курикулумот:\n${safeCustomInstruction}` : ''}

      Врати JSON точно по овој формат:
      {
        "problem": "текст на задачата",
        "strategy": "зошто ја избравме оваа метода наспроти алтернативата",
        "steps": [{"explanation": "зошто го правиме овој чекор", "expression": "LaTeX или чист текст"}]
      }
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            problem: { type: Type.STRING },
            strategy: { type: Type.STRING },
            steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { explanation: { type: Type.STRING }, expression: { type: Type.STRING } }, required: ['explanation', 'expression'] } },
        },
        required: ['problem', 'steps', 'strategy'],
    };

    const result = await generateAndParseJSON<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
    if (!customInstruction && result) {
      await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: result, type: 'solver', conceptTitle: safeConceptTitle, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    }
    return result;
  },

async solveSpecificProblemStepByStep(problemText: string): Promise<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }> {
    const safeProblemText = sanitizePromptInput(problemText, 500);
    const prompt = `
      Ти си експерт за математичка педагогија. Ученикот не успеа да ја реши следнава задача:
      ЗАДАЧА: "${safeProblemText}"

      За да му помогнеш:
      1. Реши ја задачата детално преку Chain of Thought (CoT) — секој чекор мора да биде логично поврзан и едноставен за следење.
      2. Во полето "strategy" напиши кратка, охрабрувачка реченица (на пр. "Ајде да ја разложиме оваа задача на неколку едноставни чекори!").

      Внимавај на математичката точност!

      Врати JSON точно по овој формат:
      {
        "problem": "${safeProblemText.replace(/"/g, '\\"')}",
        "strategy": "почетна стратегија или охрабрување",
        "steps": [{"explanation": "зошто го правиме овој чекор", "expression": "LaTeX или чист текст"}]
      }
    `;
    const schema = {
        type: Type.OBJECT,
        properties: {
            problem: { type: Type.STRING },
            strategy: { type: Type.STRING },
            steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { explanation: { type: Type.STRING }, expression: { type: Type.STRING } }, required: ['explanation', 'expression'] } },
        },
        required: ['problem', 'steps'],
    };
    return generateAndParseJSON<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
  },

async diagnoseMisconception(question: string, correctAnswer: string, studentAnswer: string, topicTitle?: string): Promise<string> {
    const safeQuestion = sanitizePromptInput(question, 500);
    const safeCorrectAnswer = sanitizePromptInput(correctAnswer, 250);
    const safeStudentAnswer = sanitizePromptInput(studentAnswer, 250);

    let misconceptionContext = '';
    if (topicTitle) {
      const { getMisconceptionsForTopic } = await import('../../data/misconceptions');
      const known = getMisconceptionsForTopic(topicTitle);
      if (known.length > 0) {
        misconceptionContext = `\n\nПознати мисконцепции за темата „${topicTitle}":\n${known.slice(0, 4).map((m, i) => `${i + 1}. ${m}`).join('\n')}\nАко ученикот направил некоја од горните грешки, именувај ја директно.`;
      }
    }

    const prompt = `
      Ти си искусен наставник по математика кој се обидува да ја разбере логиката зад грешката на ученикот.

      Прашање: "${safeQuestion}"
      Точен одговор: "${safeCorrectAnswer}"
      Одговор на ученикот: "${safeStudentAnswer}"${misconceptionContext}

      Твоја задача:
      Дијагностицирај каква концептуална или пресметковна грешка направил ученикот.
      Ако е очигледна концептуална грешка (пр. ги собира именителите кај дропки, не ги разбира негативните броеви, ги меша периметар и плоштина), опиши ја кратко.
      Ако изгледа како обична пресметковна или случајна грешка, кажи "Пресметковна грешка или случајно погодување".

      Врати САМО една кратка реченица на македонски јазик која ја опишува грешката (без објаснувања и совети).
      Пример: "Ученикот ги собира именителите наместо да бара НЗС."
    `;

    try {
        const useLiteMisconception = shouldUseLiteModel('misconception');
        const misconceptionModel = useLiteMisconception ? LITE_MODEL : DEFAULT_MODEL;
        logRouterDecision('misconception', misconceptionModel);
        const response = await callGeminiProxy({
            model: misconceptionModel,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            systemInstruction: 'Врати само една кратка реченица со дијагноза на грешката.',
            generationConfig: { temperature: 0.1 },
            safetySettings: SAFETY_SETTINGS,
            skipTierOverride: useLiteMisconception,
        });
        return response.text ? response.text.trim().replace(/^"|"$/g, '') : 'Непозната грешка';
    } catch (e) {
        logger.error('Грешка при дијагностицирање:', e);
        return 'Непозната грешка';
    }
  },

async explainMisconception(
  conceptTitle: string,
  misconceptionDesc: string,
  gradeLevel: number,
): Promise<{ steps: [string, string, string]; commonMistake: string }> {
  const safeConcept = sanitizePromptInput(conceptTitle, 120);
  const safeMisconception = sanitizePromptInput(misconceptionDesc, 300);
  const prompt = `
Ти си педагошки асистент по математика. Ученик во ${gradeLevel}. одделение направил грешка при задача за концептот „${safeConcept}".

Дијагноза на грешката: ${safeMisconception}

Креирај кратка 3-чекорна мини-лекција. Правила:
- Секој чекор е максимум 2-3 реченици на едноставен македонски
- Без сложени LaTeX формули — само зборови и прости изрази
- Чекор 1: Зошто е честа оваа грешка (охрабрувачки тон)
- Чекор 2: Точниот пристап — чекор по чекор
- Чекор 3: Конкретен едноставен пример со решение

Врати JSON:
{
  "commonMistake": "кратко именување (пр. 'Мешање периметар и плоштина')",
  "step1": "зошто е честа...",
  "step2": "точен пристап...",
  "step3": "конкретен пример..."
}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      commonMistake: { type: Type.STRING },
      step1: { type: Type.STRING },
      step2: { type: Type.STRING },
      step3: { type: Type.STRING },
    },
    required: ['commonMistake', 'step1', 'step2', 'step3'],
  };

  try {
    const r = await generateAndParseJSON<{
      commonMistake: string; step1: string; step2: string; step3: string;
    }>([{ text: prompt }], schema, LITE_MODEL, undefined, 2, false);
    return { steps: [r.step1, r.step2, r.step3], commonMistake: r.commonMistake };
  } catch {
    return {
      steps: [
        'Оваа грешка е многу честа — не се грижи, многу ученици минуваат низ ова.',
        'Обиди се да го прочиташ прашањето уште еднаш и да идентификуваш точно што е побарано.',
        'Следниот пат, запиши го решението чекор по чекор и провери секој чекор поединечно.',
      ],
      commonMistake: 'Честа концептуална грешка',
    };
  }
},

async generateSocraticHint(question: string, hintLevel: 1 | 2 | 3): Promise<string> {
    checkDailyQuotaGuard();
    const safeQ = sanitizePromptInput(question, 600);
    const levelInstructions: Record<1 | 2 | 3, string> = {
        1: `Дај САМО општа насока: кој тип задача е ова (пр. линеарна равенка, дропки, геометрија…) и зошто тоа е важно.\nНЕ давај формули, НЕ давај чекори. 1-2 реченици.`,
        2: `Ученикот веќе знае дека е задача од типот. Дај конкретна насока:\nкој метод / правило / формула треба да го примени, но НЕ покажувај го пресметувањето.\nЗаврши со прашање кое го насочува кон следниот чекор. 2 реченици.`,
        3: `Ученикот е блиску до решението. Покажи ЕДН КОнкретен критичен чекор\n(пр. „Почни со изолирање на x" или „Применете ја формулата a²+b²=c²") но НЕ го завршувај решението.\nИзразена поддршка + 1 конкретен чекор. 2 реченици.`,
    };
    const prompt = `Ти си Сократски ментор по математика. Ученикот е заглавен на ова прашање:\n\n„${safeQ}"\n\nНиво на насока: ${hintLevel}/3\n${levelInstructions[hintLevel]}\n\nВАЖНО: Никогаш не го давај точниот одговор. Пишувај на македонски јазик.`;
    const response = await callGeminiProxy({
        model: LITE_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: 'Ти си Сократски педагог. Водиш со прашања и насоки, никогаш не го откриваш одговорот.',
        safetySettings: SAFETY_SETTINGS,
        generationConfig: { temperature: 0.4, maxOutputTokens: 120 },
        skipTierOverride: true,
    });
    return response.text.trim();
  },

async explainSpecificStep(problem: string, stepExplanation: string, stepExpression: string, profile?: TeachingProfile): Promise<string> {
    const safeProblem = sanitizePromptInput(problem, 500);
    const safeStepExplanation = sanitizePromptInput(stepExplanation, 500);
    const safeStepExpression = sanitizePromptInput(stepExpression, 300);
    const prompt = `
      Како наставник по математика, објасни му на ученик ЗОШТО го направивме овој чекор во контекст на задачата.
      Задача: ${safeProblem}
      Чекор: ${safeStepExplanation} (${safeStepExpression})
      Објасни го математичкото правило во 2 кратки реченици на македонски јазик.
    `;
    const response = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: getResolvedTextSystemInstruction(),
        safetySettings: SAFETY_SETTINGS,
        userTier: profile?.tier,
    });
    return response.text || '';
  },

async verifyUserStep(
  problem: string,
  completedSteps: Array<{ explanation: string; expression: string }>,
  userAttempt: string,
  correctNextStep: { explanation: string; expression: string },
): Promise<{ correct: boolean; feedback: string; hint: string }> {
  const safeProblem = sanitizePromptInput(problem, 400);
  const safeAttempt = sanitizePromptInput(userAttempt, 300);
  const completedSummary = completedSteps
    .map((s, i) => `${i + 1}. ${s.explanation}: ${s.expression}`)
    .join('\n');

  const prompt = `Ти си AI наставник по математика. Ученикот решава задача чекор по чекор.

ЗАДАЧА: "${safeProblem}"

ДОСЕГА ЗАВРШЕНИ ЧЕКОРИ:
${completedSummary || '(Ова е прв чекор)'}

ПРЕДЛОГ НА УЧЕНИКОТ ЗА СЛЕДНИОТ ЧЕКОР:
"${safeAttempt}"

ТОЧНИОТ СЛЕДЕН ЧЕКОР (НЕ ГО ОТКРИВАЈ ДИРЕКТНО):
Objасни: "${correctNextStep.explanation}" | Израз: "${correctNextStep.expression}"

Твоја задача:
1. Оцени дали ученичкиот чекор е математички точен и во правилна насока.
2. Ако е точен: потврди и охрабри.
3. Ако е делумно точен: укажи што е добро, а што треба да се поправи.
4. Ако е погрешен: дај педагошки hint без да го откриеш точниот одговор.

Врати JSON:
{"correct": true/false, "feedback": "реченица за оценка (1-2 реченици)", "hint": "сократски hint ако е грешно, или следна насока ако е точно"}`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      correct: { type: Type.BOOLEAN },
      feedback: { type: Type.STRING },
      hint: { type: Type.STRING },
    },
    required: ['correct', 'feedback', 'hint'],
  };

  try {
    const result = await generateAndParseJSON<{ correct: boolean; feedback: string; hint: string }>(
      [{ text: prompt }],
      schema,
      LITE_MODEL,
      undefined,
      2,
      false,
    );
    return result;
  } catch {
    return { correct: false, feedback: 'Не можев да го оценам чекорот.', hint: 'Обиди се повторно или побарај помош.' };
  }
},

async explainConcept(conceptTitle: string, gradeLevel?: number): Promise<string> {
    const safeConceptTitle = sanitizePromptInput(conceptTitle, 120);
    const cacheKey = `explanation_${safeConceptTitle.replace(/\s+/g, '_').toLowerCase()}_${gradeLevel || 'gen'}`;
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;

    const prompt = `Објасни го математичкиот концепт „${safeConceptTitle}"${gradeLevel ? ` за ученик во ${gradeLevel}. одделение` : ''} на едноставен, детски македонски јазик. Максимум 3 кратки реченици. Без математички формули — само со зборови и секојдневни примери.`;

    try {
      const useLiteExplain = shouldUseLiteModel('concept_explain');
      const explainModel = useLiteExplain ? LITE_MODEL : DEFAULT_MODEL;
      logRouterDecision('concept_explain', explainModel);
      const result = await callGeminiProxy({
        model: explainModel,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
        skipTierOverride: useLiteExplain,
      });
      const text = result.text?.trim() ?? '';
      if (text) await setCached(cacheKey, text, { type: 'explanation', conceptTitle: safeConceptTitle, gradeLevel });
      return text;
    } catch {
      return '';
    }
  },

};
