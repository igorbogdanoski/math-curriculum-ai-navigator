import { assessmentAPI } from './gemini/assessment';
import { plansAPI } from './gemini/plans';
import {
    Type, Part, Content, getCached, setCached, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, streamGeminiProxy,
    checkDailyQuotaGuard, TEXT_SYSTEM_INSTRUCTION, SAFETY_SETTINGS, callGeminiProxy, callImagenProxy, IMAGEN_MODEL,
    CACHE_COLLECTION, minifyContext, callEmbeddingProxy, sanitizePromptInput,
    streamGeminiProxyRich, type StreamChunk, type ImagenProxyResponse
} from './gemini/core';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, storage } from '../firebaseConfig';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Concept, ChatMessage, TeachingProfile, AIGeneratedIllustration, AIGeneratedLearningPaths, GenerationContext, StudentProfile, AIGeneratedRubric, LessonPlan, AIPedagogicalAnalysis, CoverageAnalysisReport, NationalStandard, AIRecommendation, GeneratedTest, AssessmentQuestion, AIGeneratedWorkedExample, AdaptiveHomework , AIGeneratedAnnualPlan, AIGeneratedPresentation } from '../types';
import { AIGeneratedLearningPathsSchema, AIGeneratedRubricSchema, AIPedagogicalAnalysisSchema, CoverageAnalysisSchema, AIRecommendationSchema, GeneratedTestSchema, DailyBriefSchema, WorkedExampleSchema, ReflectionSummarySchema } from '../utils/schemas';

// Core exports
export { scheduleQuotaNotification, isDailyQuotaKnownExhausted, clearDailyQuotaFlag, getQuotaDiagnostics, isMacedonianContextEnabled, setMacedonianContextEnabled, buildDynamicSystemInstruction } from './gemini/core';

export const realGeminiService = {
  ...assessmentAPI,
  ...plansAPI,
  
async *getChatResponseStream(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }, ragContext?: string): AsyncGenerator<string, void, unknown> {
    checkDailyQuotaGuard(); // П30: block streaming if daily quota is exhausted
    let systemInstruction = `${TEXT_SYSTEM_INSTRUCTION}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;
    if (ragContext) {
        systemInstruction += `\n\n--- КОНТЕКСТ ОД БИБЛИОТЕКАТА НА НАСТАВНИКОТ ---\nСледните материјали се пронајдени како релевантни за прашањето. Користи ги при одговорот:\n\n${ragContext}\n--- КРАЈ НА БИБЛИОТЕЧЕН КОНТЕКСТ ---\n\nКога ги користиш овие материјали, споменувај ги по наслов и тип (пр. "Во вашиот зачуван квиз...").`;
    }
    const contents: Content[] = history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
    if (attachment && contents.length > 0) {
        const lastMessage = contents[contents.length - 1];
        if (lastMessage.role === 'user') lastMessage.parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } });
    }
    yield* streamGeminiProxy({
        model: DEFAULT_MODEL,
        contents,
        systemInstruction,
        safetySettings: SAFETY_SETTINGS
    });
  },

async *getChatResponseStreamWithThinking(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }, ragContext?: string): AsyncGenerator<StreamChunk, void, unknown> {
    checkDailyQuotaGuard();
    let systemInstruction = `${TEXT_SYSTEM_INSTRUCTION}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;
    if (ragContext) {
        systemInstruction += `\n\n--- КОНТЕКСТ ОД БИБЛИОТЕКАТА НА НАСТАВНИКОТ ---\nСледните материјали се пронајдени како релевантни за прашањето. Користи ги при одговорот:\n\n${ragContext}\n--- КРАЈ НА БИБЛИОТЕЧЕН КОНТЕКСТ ---\n\nКога ги користиш овие материјали, споменувај ги по наслов и тип (пр. "Во вашиот зачуван квиз...").`;
    }
    const contents: Content[] = history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
    if (attachment && contents.length > 0) {
        const lastMessage = contents[contents.length - 1];
        if (lastMessage.role === 'user') lastMessage.parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } });
    }
    yield* streamGeminiProxyRich({
        model: DEFAULT_MODEL,
        contents,
        systemInstruction,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: { thinkingConfig: { thinkingBudget: 8000 } },
        userTier: profile?.tier
    });
  },

async generateIllustration(prompt: string, image?: { base64: string, mimeType: string }, _profile?: TeachingProfile): Promise<AIGeneratedIllustration> {
    // Prompt-hash cache — skip re-calling Imagen for identical prompts (no image upload)
    if (!image) {
      const cacheKey = `img_cache_${prompt.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 120)}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { imageUrl: string; ts: number };
          // Cache TTL: 7 days
          if (Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000) {
            return { imageUrl: parsed.imageUrl, prompt };
          }
          localStorage.removeItem(cacheKey);
        }
      } catch { /* ignore storage errors */ }

      const response: ImagenProxyResponse = await callImagenProxy({ model: IMAGEN_MODEL, prompt });
      if (response.inlineData) {
        const { data: base64Data, mimeType } = response.inlineData;

        // О3 — Миграција на AI слики кон Firebase Storage (наместо base64)
        const storagePath = `ai_illustrations/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
        const storageRef = ref(storage, storagePath);

        await uploadString(storageRef, base64Data, 'base64', { contentType: mimeType });
        const imageUrl = await getDownloadURL(storageRef);

        try { localStorage.setItem(cacheKey, JSON.stringify({ imageUrl, ts: Date.now() })); } catch { /* quota exceeded — skip */ }
        return { imageUrl, prompt };
      }
      throw new Error("AI did not return image data");
    }

    const response: ImagenProxyResponse = await callImagenProxy({ model: IMAGEN_MODEL, prompt });
    if (response.inlineData) {
        const data = response.inlineData;
        const storagePath = `ai_illustrations/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, data.data, 'base64', { contentType: data.mimeType });
        const imageUrl = await getDownloadURL(storageRef);
        return { imageUrl, prompt };
    }
    throw new Error("AI did not return image");
  },

async generateLearningPaths(context: GenerationContext, studentProfiles: StudentProfile[], profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedLearningPaths> {
    const profileNames = studentProfiles.map(p => p.name).join(', ');
    const vertProgText = context.verticalProgression?.length
        ? `\nВЕРТИКАЛНА ПРОГРЕСИЈА (развој на концептот низ годините):\n${context.verticalProgression.map(vp => `- ${vp.title}: ${vp.progression.map(p => `${p.grade} одд. → "${p.conceptTitle}"`).join(' → ')}`).join('\n')}`
        : '';
    const prompt = `Креирај индивидуализирани патеки за учење за следните профили на ученици: ${profileNames || 'основно ниво'}.

БАРАЊА:
1. Секоја патека мора да има 5–7 конкретни чекори (активности).
2. Типови на чекори (МОРА да користиш ТОЧНО еден од овие): "Introductory" (воведно/загревање), "Practice" (вежбање), "Consolidation" (консолидација/утврдување), "Assessment" (самопроверка/оценување), "Project" (проект/примена).
3. Чекорите треба да бидат конкретни и изводливи — не само „реши задачи", туку опиши ЧТО конкретно прави ученикот.
4. Патеките треба да се диференцирани — различно темпо, сложеност и поддршка за секој профил.
5. Ако постои вертикална прогресија, поврзи го тековното знаење со претходното и идното учење.
${vertProgText}
${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, paths: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { profileName: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stepNumber: { type: Type.INTEGER }, activity: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["stepNumber", "activity"] } } }, required: ["profileName", "steps"] } } }, required: ["title", "paths"] };
    return generateAndParseJSON<AIGeneratedLearningPaths>([{ text: prompt }, { text: JSON.stringify(minifyContext(context)) }], schema, DEFAULT_MODEL, AIGeneratedLearningPathsSchema, MAX_RETRIES, false, undefined, profile?.tier);
  },

async generateInfographicLayout(plan: Partial<import('../types').LessonPlan>, profile?: TeachingProfile): Promise<import('../types').InfographicLayout> {
    const objectivesText = (plan.objectives || []).map(o => o.text).join('\n');
    const scenarioText = [
      plan.scenario?.introductory?.text || '',
      ...(plan.scenario?.main || []).map(s => s.text),
      plan.scenario?.concluding?.text || '',
    ].filter(Boolean).join('\n');

    const prompt = `Ти си дизајнер на образовни инфографики. Анализирај го следниов план за час и создај структуриран layout за висококвалитетен инфографик.

ПЛАН ЗА ЧАС:
Наслов: ${plan.title || ''}
Одделение: ${plan.grade || ''}
Тема: ${plan.theme || ''}
Цели: ${objectivesText}
Сценарио: ${scenarioText.substring(0, 1200)}

БАРАЊА:
- title: краток и привлечен наслов на инфографикот (макс 8 зборови)
- grade: "X. одделение"
- subject: "Математика"
- keyMessage: 1 реченица — главната порака/заклучок на часот
- objectives: 3–4 цели, секоја макс 10 зборови, конкретни и акциски
- sections: 2–3 содржински блока. Секој со: heading (2–4 збора), icon (1 emoji), points (2–4 кратки точки)
- vocabulary: 3–5 клучни термини со дефиниции (макс 12 збора секоја)
- palette: избери "blue" ако е алгебра/броеви, "green" ако е геометрија, "purple" ако е статистика/веројатност, "orange" ако е мерење/применета математика

Врати САМО JSON без markdown.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        grade: { type: Type.STRING },
        subject: { type: Type.STRING },
        keyMessage: { type: Type.STRING },
        objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
        sections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
          heading: { type: Type.STRING }, icon: { type: Type.STRING },
          points: { type: Type.ARRAY, items: { type: Type.STRING } }
        }, required: ['heading', 'icon', 'points'] }},
        vocabulary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
          term: { type: Type.STRING }, definition: { type: Type.STRING }
        }, required: ['term', 'definition'] }},
        palette: { type: Type.STRING },
      },
      required: ['title', 'grade', 'subject', 'keyMessage', 'objectives', 'sections', 'vocabulary', 'palette'],
    };
    return generateAndParseJSON<import('../types').InfographicLayout>(
      [{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined, profile?.tier
    );
  },

async generateAnalogy(concept: Concept, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    const cacheKey = `analogy_${concept.id}_g${gradeLevel}`;
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
        if (cachedDoc.exists()) return cachedDoc.data().content;
    } catch (e) { console.warn(e); }

    const prompt = `Објасни го поимот "${concept.title}" за ${gradeLevel} одделение преку аналогија.`;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS,
        userTier: profile?.tier
    });
    const text = response.text || "";
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: text, type: 'analogy', conceptId: concept.id, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return text;
  },

async generateStepByStepSolution(conceptTitle: string, gradeLevel: number, customInstruction?: string): Promise<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }> {
    // Cache is skipped when customInstruction is provided (user wants specific problem)
    const cacheKey = `solver_thinking_${conceptTitle.replace(/\s+/g, '_')}_g${gradeLevel}`;
    if (!customInstruction) {
      try {
          const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
          if (cachedDoc.exists()) return cachedDoc.data().content;
      } catch (e) { console.warn("Cache error:", e); }
    }

    const prompt = `
      Ти си експерт за математичка педагогија. Креирај една типична задача за "${conceptTitle}" за ${gradeLevel} одделение.
      Користи Tree of Thoughts (ToT) пристап: размисли за 2 различни методи на решавање и избери ја онаа која е најјасна за ученик.
      Реши ја задачата детално преку Chain of Thought (CoT) — секој чекор мора да биде логично поврзан.

      Внимавај на математичката точност! Направи само-проверка пред финалниот одговор.
      ${customInstruction ? `\nКонтекст од курикулумот:\n${customInstruction}` : ''}

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
            steps: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        expression: { type: Type.STRING }
                    },
                    required: ["explanation", "expression"]
                }
            }
        },
        required: ["problem", "steps", "strategy"]
    };

    // Standard model is sufficient and 3-5x cheaper on quota than thinking model
    const result = await generateAndParseJSON<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
    // Only cache non-custom results for community reuse
    if (!customInstruction && result) {
      await setDoc(doc(db, CACHE_COLLECTION, cacheKey), {
          content: result,
          type: 'solver',
          conceptTitle,
          gradeLevel,
          createdAt: serverTimestamp()
      }).catch(console.error);
    }
    return result;
  },

async solveSpecificProblemStepByStep(problemText: string): Promise<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }> {
    const prompt = `
      Ти си експерт за математичка педагогија. Ученикот не успеа да ја реши следнава задача:
      ЗАДАЧА: "${problemText}"

      За да му помогнеш:
      1. Реши ја задачата детално преку Chain of Thought (CoT) — секој чекор мора да биде логично поврзан и едноставен за следење.
      2. Во полето "strategy" напиши кратка, охрабрувачка реченица (на пр. "Ајде да ја разложиме оваа задача на неколку едноставни чекори!").
      
      Внимавај на математичката точност!
      
      Врати JSON точно по овој формат:
      {
        "problem": "${problemText.replace(/"/g, '\\"')}",
        "strategy": "почетна стратегија или охрабрување",
        "steps": [{"explanation": "зошто го правиме овој чекор", "expression": "LaTeX или чист текст"}]
      }
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            problem: { type: Type.STRING },
            strategy: { type: Type.STRING },
            steps: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        explanation: { type: Type.STRING },
                        expression: { type: Type.STRING }
                    },
                    required: ["explanation", "expression"]
                }
            }
        },
        required: ["problem", "steps"]
    };

    const result = await generateAndParseJSON<{ problem: string; strategy?: string; steps: Array<{ explanation: string; expression: string }> }>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
    return result;
  },

async diagnoseMisconception(question: string, correctAnswer: string, studentAnswer: string): Promise<string> {
    const prompt = `
      Ти си искусен наставник по математика кој се обидува да ја разбере логиката зад грешката на ученикот.
      
      Прашање: "${question}"
      Точен одговор: "${correctAnswer}"
      Одговор на ученикот: "${studentAnswer}"

      Твоја задача:
      Дијагностицирај каква концептуална или пресметковна грешка направил ученикот. 
      Ако е очигледна концептуална грешка (пр. ги собира именителите кај дропки, не ги разбира негативните броеви, ги меша периметар и плоштина), опиши ја кратко.
      Ако изгледа како обична пресметковна или случајна грешка, кажи "Пресметковна грешка или случајно погодување".
      
      Врати САМО една кратка реченица на македонски јазик која ја опишува грешката (без објаснувања и совети).
      Пример: "Ученикот ги собира именителите наместо да бара НЗС."
    `;

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    systemInstruction: "Врати само една кратка реченица со дијагноза на грешката.",
                    temperature: 0.1
                }
            })
        });

        if (!response.ok) return "Непозната грешка";
        
        const data = await response.json();
        return data.text ? data.text.trim().replace(/^"|"$/g, '') : "Непозната грешка";
    } catch (e) {
        console.error("Грешка при дијагностицирање:", e);
        return "Непозната грешка";
    }
  },

async explainSpecificStep(problem: string, stepExplanation: string, stepExpression: string, profile?: TeachingProfile): Promise<string> {
    const prompt = `
      Како наставник по математика, објасни му на ученик ЗОШТО го направивме овој чекор во контекст на задачата.
      Задача: ${problem}
      Чекор: ${stepExplanation} (${stepExpression})
      Објасни го математичкото правило во 2 кратки реченици на македонски јазик.
    `;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS,
        userTier: profile?.tier
    });
    return response.text || "";
  },

async generateRubric(gradeLevel: number, activityTitle: string, activityType: string, _criteriaHints: string, _profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedRubric> {
    const prompt = `Креирај рубрика за ${activityTitle} (${activityType}). ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, criteria: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { criterion: { type: Type.STRING }, levels: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { levelName: { type: Type.STRING }, description: { type: Type.STRING }, points: { type: Type.STRING } }, required: ["levelName", "description"] } } }, required: ["criterion", "levels"] } } }, required: ["title", "criteria"] };

    if (!customInstruction) {
        const cacheKey = `rubric_g${gradeLevel}_${activityTitle.replace(/\W/g, '_').toLowerCase().substring(0, 40)}`;
        const cached = await getCached<AIGeneratedRubric>(cacheKey);
        if (cached) return cached;
        
        const result = await generateAndParseJSON<AIGeneratedRubric>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedRubricSchema);
        await setCached(cacheKey, result, { type: 'rubric', gradeLevel });
        return result;
    }
    return generateAndParseJSON<AIGeneratedRubric>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedRubricSchema);
  },

async generatePresentationOutline(concept: Concept, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    const cacheKey = `outline_${concept.id}_g${gradeLevel}`;
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;

    const prompt = `Креирај структура за презентација за "${concept.title}" (${gradeLevel} одд.).`;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS,
        userTier: profile?.tier
    });
    const text = response.text || "";
    await setCached(cacheKey, text, { type: 'outline', conceptId: concept.id, gradeLevel });
    return text;
  },

async enhanceText(textToEnhance: string, action: string, fieldType: string, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    let promptText = `Подобри го текстот за '${fieldType}' (${gradeLevel} одд). Оригинален текст: "${textToEnhance}"`;
    
    switch(action) {
        case 'simplify':
            promptText = `Поедностави го следниот текст за '${fieldType}' (${gradeLevel} одд) за да биде полесен за разбирање: "${textToEnhance}"`;
            break;
        case 'shorten':
            promptText = `Скрати го и сумирај го следниот текст за '${fieldType}' (${gradeLevel} одд), задржувајќи ја клучната поента: "${textToEnhance}"`;
            break;
        case 'expand':
            promptText = `Направи го поинтересен, поопширен и подетален следниот текст за '${fieldType}' (${gradeLevel} одд): "${textToEnhance}"`;
            break;
        case 'inclusion':
            promptText = `Прилагоди го следниот текст за '${fieldType}' (${gradeLevel} одд) за ученици со попреченост (инклузија), додавајќи соодветни лесни чекори: "${textToEnhance}"`;
            break;
        case 'auto':
        default:
            promptText = `Професионализирај го и подобри го следниот текст за '${fieldType}' (${gradeLevel} одд) во контекст на наставна подготовка: "${textToEnhance}"`;
            break;
    }
    
    const prompt = `${promptText}. Врати САМО преработен текст, без дополнителни воведи или објаснувања.`;
    
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS,
        userTier: profile?.tier
    });
    return response.text || "";
  },

async analyzeConceptPedagogically(concept: Concept, priorTitles: string[], futureTitles: string[]): Promise<{
    bloomLevel: string;
    bloomDetails: string;
    misconceptions: string[];
    pedagogicalBridge: string;
    diagnosticQuestion: string;
  }> {
    checkDailyQuotaGuard();
    const priorStr = priorTitles.length ? priorTitles.join(', ') : 'нема дефинирани предуслови';
    const futureStr = futureTitles.length ? futureTitles.join(', ') : 'нема дефинирани следни теми';
    const prompt = `Си педагошки експерт за македонски основношколски наставни програми по математика.
Анализирај го следниот концепт и врати структуриран одговор на македонски јазик.

КОНЦЕПТ: "${concept.title}"
ОПИС: "${concept.description || 'нема опис'}"
ОДДЕЛЕНИЕ: ${'gradeLevel' in concept ? (concept as Concept & { gradeLevel: number }).gradeLevel : '?'}
ПРЕДЗНАЕЊЕ (мора да се знае пред): ${priorStr}
СЛЕДНИ ТЕМИ (се гради врз ова): ${futureStr}

Врати:
1. bloomLevel: Доминантното ниво на Блумовата таксономија (само едно: Знаење / Разбирање / Примена / Анализа / Синтеза / Вреднување)
2. bloomDetails: 2-3 реченици — конкретно ШТО треба да направи ученикот за да го демонстрира ова ниво
3. misconceptions: Листа од точно 3 специфични мисконцепции карактеристични за ОВА конкретно градиво (не генерички)
4. pedagogicalBridge: 2-3 реченици — конкретно ЗОШТО е важно ова градиво, какви проблеми прави ако се прескокне, и кон кои теми се надоврзува
5. diagnosticQuestion: Еден конкретен блиц прашање (1-2 реченици) кое наставникот може да го напише на табла пред часот за да провери предзнаење`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        bloomLevel: { type: Type.STRING },
        bloomDetails: { type: Type.STRING },
        misconceptions: { type: Type.ARRAY, items: { type: Type.STRING } },
        pedagogicalBridge: { type: Type.STRING },
        diagnosticQuestion: { type: Type.STRING },
      },
      required: ['bloomLevel', 'bloomDetails', 'misconceptions', 'pedagogicalBridge', 'diagnosticQuestion'],
    };
    return generateAndParseJSON<{ bloomLevel: string; bloomDetails: string; misconceptions: string[]; pedagogicalBridge: string; diagnosticQuestion: string }>(
      [{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined,
      (assessmentAPI as { _tier?: string })._tier
    );
  },

async analyzeLessonPlan(plan: Partial<LessonPlan>, _profile?: TeachingProfile): Promise<AIPedagogicalAnalysis> {
    const prompt = `Направи педагошка анализа на подготовка за час.`;
    const schema = { type: Type.OBJECT, properties: { pedagogicalAnalysis: { type: Type.OBJECT, properties: { overallImpression: { type: Type.STRING }, alignment: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, engagement: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, cognitiveLevels: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } } } } }, required: ["pedagogicalAnalysis"] };
    return generateAndParseJSON<AIPedagogicalAnalysis>([{ text: prompt }, { text: `План: ${JSON.stringify(plan)}` }], schema, DEFAULT_MODEL, AIPedagogicalAnalysisSchema, MAX_RETRIES, false);
  },

async generateProactiveSuggestion(concept: Concept, _profile?: TeachingProfile): Promise<string> {
      const prompt = `Генерирај проактивен предлог за "${concept.title}".`;
      const response = await callGeminiProxy({ 
          model: DEFAULT_MODEL, 
          contents: [{ parts: [{ text: prompt }] }], 
          systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
          safetySettings: SAFETY_SETTINGS 
      });
      return response.text || "";
  },

async analyzeReflection(wentWell: string, challenges: string, _profile?: TeachingProfile): Promise<string> {
      const prompt = `Анализирај рефлексија: "${wentWell}". Предизвици: "${challenges}".`;
      const response = await callGeminiProxy({ 
          model: DEFAULT_MODEL, 
          contents: [{ parts: [{ text: prompt }] }], 
          systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
          safetySettings: SAFETY_SETTINGS 
      });
      return response.text || "";
  },

async generateReflectionQuestions(lessonTitle: string, grade: number, theme: string): Promise<{ wentWell: string; challenges: string; nextSteps: string }> {
      const prompt = `Наставникот штотуку одржа час "${lessonTitle}" (${grade} одд., тема: ${theme}).
Генерирај конкретни рефлексивни прашања кои ќе му помогнат да размисли за часот.
Секое поле треба да биде 1-2 насочувачки прашања (не одговори).
Врати JSON: { "wentWell": "Кои активности беа успешни?...", "challenges": "Кај кои концепти учениците имаа потешкотии?...", "nextSteps": "Кои конкретни промени би ги направиле следниот пат?..." }`;
      const schema = { type: Type.OBJECT, properties: { wentWell: { type: Type.STRING }, challenges: { type: Type.STRING }, nextSteps: { type: Type.STRING } }, required: ["wentWell", "challenges", "nextSteps"] };
      return generateAndParseJSON<{ wentWell: string; challenges: string; nextSteps: string }>([{ text: prompt }], schema, DEFAULT_MODEL, ReflectionSummarySchema);
  },

async analyzeCoverage(_lessonPlans: LessonPlan[], _allNationalStandards: NationalStandard[]): Promise<CoverageAnalysisReport> {
      const prompt = `Анализирај ја покриеноста на националните стандарди.`;
      const schema = { type: Type.OBJECT, properties: { analysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { gradeLevel: { type: Type.INTEGER }, coveredStandardIds: { type: Type.ARRAY, items: { type: Type.STRING } }, summary: { type: Type.STRING } }, required: ["gradeLevel", "coveredStandardIds", "summary"] } } }, required: ["analysis"] };
      return generateAndParseJSON<CoverageAnalysisReport>([{ text: prompt }], schema, DEFAULT_MODEL, CoverageAnalysisSchema);
  },

async getPersonalizedRecommendations(_profile: TeachingProfile, _lessonPlans: LessonPlan[]): Promise<AIRecommendation[]> {
      const prompt = `Генерирај 3 персонализирани препораки.`;
      const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, title: { type: Type.STRING }, recommendationText: { type: Type.STRING } }, required: ["category", "title", "recommendationText"] } };
      return generateAndParseJSON<AIRecommendation[]>([{ text: prompt }], schema, DEFAULT_MODEL, AIRecommendationSchema);
  },

async parsePlannerInput(input: string): Promise<{ title: string; date: string; type: string; description: string }> {
    const prompt = `Extract details: "${input}".`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["title", "date", "type"] };
    return generateAndParseJSON<{ title: string; date: string; type: string; description: string }>([{ text: prompt }], schema);
  },

async generateClassRecommendations(analyticsData: {
    totalAttempts: number;
    avgScore: number;
    passRate: number;
    weakConcepts: Array<{ conceptId: string; title: string; avgPct: number; attempts: number }>;
    masteredCount: number;
    inProgressCount: number;
    strugglingCount: number;
    uniqueStudentCount: number;
  }): Promise<Array<{
    priority: number;
    icon: string;
    title: string;
    explanation: string;
    actionLabel: string;
    differentiationLevel: 'support' | 'standard' | 'advanced';
    conceptId?: string;
    conceptTitle?: string;
  }>> {
    const weakList = analyticsData.weakConcepts.slice(0, 3)
      .map(c => `"${c.title}" (просек ${c.avgPct}%, ${c.attempts} обид${c.attempts === 1 ? '' : 'и'})`)
      .join('; ') || 'нема идентификувани слаби концепти';

    const prompt = `Ти си педагошки советник за математика (одд. 6-9, Македонија).
Класата има следните реални резултати:
- Вкупно обиди: ${analyticsData.totalAttempts}
- Просечен резултат: ${analyticsData.avgScore.toFixed(1)}%
- Стапка на положување (≥70%): ${analyticsData.passRate.toFixed(1)}%
- Слаби концепти (под 70%): ${weakList}
- Совладани концепти: ${analyticsData.masteredCount}
- Во напредок (streak): ${analyticsData.inProgressCount}
- Потребна помош (повеќе обиди, нема напредок): ${analyticsData.strugglingCount}
- Различни ученици: ${analyticsData.uniqueStudentCount}

Генерирај точно 3 конкретни, акциски педагошки препораки за СЛЕДНИОТ ЧАС/НЕДЕЛА.
Секоја препорака мора:
- Да е директно базирана на горните бројки (не генерички совети)
- Да предложи конкретна акција (генерирај материјал, изведи активност, ремедијација)
- Да укаже на ниво на диференцијација: support/standard/advanced
- icon: само еден емоџи
- priority: 1=итно, 2=важно, 3=препорачано

Врати JSON array со 3 елементи.`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          priority: { type: Type.INTEGER },
          icon: { type: Type.STRING },
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          actionLabel: { type: Type.STRING },
          differentiationLevel: { type: Type.STRING },
          conceptId: { type: Type.STRING },
          conceptTitle: { type: Type.STRING },
        },
        required: ['priority', 'icon', 'title', 'explanation', 'actionLabel', 'differentiationLevel'],
      },
    };

    return generateAndParseJSON<Array<{ priority: number; icon: string; title: string; explanation: string; actionLabel: string; differentiationLevel: 'support' | 'standard' | 'advanced'; conceptId?: string; conceptTitle?: string }>>([{ text: prompt }], schema, DEFAULT_MODEL);
  },

async suggestNextLessons(
    recentLessons: Array<{ title: string; date: string; description?: string }>
  ): Promise<Array<{ title: string; description: string; conceptHint: string }>> {
    if (recentLessons.length === 0) {
      return [];
    }

    const lessonsText = recentLessons
      .map(l => `- ${l.date}: ${l.title}${l.description ? ` (${l.description.slice(0, 80)})` : ''}`)
      .join('\n');

    const prompt = `Си наставник по математика. Последните лекции во планот беа:
${lessonsText}

Врз основа на оваа прогресија, предложи 3 логични теми за следната недела.
За секоја тема дај:
- Краток наслов на лекцијата (на македонски)
- Кратко опис (2-3 реченици, на македонски)
- Совет за поврзан концепт или вештина (conceptHint, 1 реченица)

Одговори само во JSON формат.`;

    const schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title:       { type: Type.STRING },
          description: { type: Type.STRING },
          conceptHint: { type: Type.STRING },
        },
        required: ['title', 'description', 'conceptHint'],
      },
    };

    try {
      const result = await generateAndParseJSON<Array<{ title: string; description: string; conceptHint: string }>>(
        [{ text: prompt }],
        schema,
        DEFAULT_MODEL
      );
      return Array.isArray(result) ? result.slice(0, 3) : [];
    } catch {
      return [];
    }
  },

async explainConcept(conceptTitle: string, gradeLevel?: number): Promise<string> {
    const cacheKey = `explanation_${conceptTitle.replace(/\s+/g, '_').toLowerCase()}_${gradeLevel || 'gen'}`;
    const cached = await getCached<string>(cacheKey);
    if (cached) return cached;

    const prompt = `Објасни го математичкиот концепт „${conceptTitle}"${gradeLevel ? ` за ученик во ${gradeLevel}. одделение` : ''} на едноставен, детски македонски јазик. Максимум 3 кратки реченици. Без математички формули — само со зборови и секојдневни примери.`;

    try {
      const result = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
      });
      const text = result.text?.trim() ?? '';
      if (text) {
        await setCached(cacheKey, text, { type: 'explanation', conceptTitle, gradeLevel });
      }
      return text;
    } catch {
      return '';
    }
  },

async generateParallelTest(
    topic: string,
    gradeLevel: number,
    questionCount: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): Promise<GeneratedTest> {
    const cacheKey = `test_parallel_${topic.replace(/\s+/g, '_').toLowerCase()}_g${gradeLevel}_n${questionCount}_${difficulty}`;
    const cached = await getCached<GeneratedTest>(cacheKey);
    if (cached) return cached;

    const gradeLevelPrompt = gradeLevel <= 3
      ? 'ЗАБЕЛЕШКА: Ова е за рана училишна возраст (1-3 одд). Користи многу едноставни зборови и секојдневни предмети во текстуалните задачи.' 
      : 'Вклучи и текстуални задачи.';

    const prompt = `Генерирај тест по математика за "${topic}" (одделение ${gradeLevel}).
Тестот треба да има ДВЕ ГРУПИ (Група А и Група Б).
  Вкупно прашања по група: ТОЧНО ${questionCount} прашања. СТРОГО ГЕНЕРИРАЈ ${questionCount} ПРАШАЊА ВО СЕКОЈА ГРУПА!
ВАЖНО:
- Прашањата во Група А и Група Б мора да бидат "паралелни" (исти по тип и тежина, но со различни бројки или примери).
- Пр: Ако 1. задача во А е "2+3", во Б треба да биде "4+5".
  - Типот на прашањето ("type") МОРА ДА БИДЕ ЕДНО ОД СЛЕДНИВЕ: "multiple-choice", "short-answer", ИЛИ "word-problem". Строго забрането е користење други типови.
  - ${gradeLevelPrompt}
  - МАТЕМАТИЧКИ ЗАПИС (КРИТИЧНО): Строго е забрането користење на ASCII знаци за математика! НИКОГАШ не користи '*' за множење (секогаш користи '\\cdot'). НИКОГАШ не користи 'a/b' за дропки (секогаш користи '\\frac{a}{b}'). За корени користи '\\sqrt{}'. Сите математички изрази, броеви и равенки во 'text' и 'options' мора да бидат форматирани како чист LaTeX опкружен со '$', на пр. $5 \\cdot 3$, $\\frac{1}{2}$, $\\sqrt{16}$.

Врати JSON:
{
  "title": "Тест по Математика: ${topic}",
  "groups": [
    { "groupName": "Group A", "questions": [ ... ] },
    { "groupName": "Group B", "questions": [ ... ] }
  ]
}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            groups: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        groupName: { type: Type.STRING },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    text: { type: Type.STRING },
                                    type: { type: Type.STRING, description: "Must be 'multiple-choice', 'short-answer', or 'word-problem'" },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    correctAnswer: { type: Type.STRING },
                                    points: { type: Type.NUMBER },
                                    cognitiveLevel: { type: Type.STRING }
                                },
                                required: ["id", "text", "correctAnswer", "points"]
                            }
                        }
                    },
                    required: ["groupName", "questions"]
                }
            }
        },
        required: ["title", "groups"]
    };

    const result = await generateAndParseJSON<GeneratedTest>([{ text: prompt }], schema, DEFAULT_MODEL, GeneratedTestSchema);

    // Enrich with metadata not returned by AI
    const enrichedResult: GeneratedTest = {
        ...result,
        topic,
        gradeLevel,
        createdAt: new Date().toISOString(),
        groups: result.groups.map((g: GeneratedTest['groups'][number]) => ({
            ...g,
            questions: g.questions.map((q: GeneratedTest['groups'][number]['questions'][number]) => ({
                ...q,
                difficulty: difficulty, // Assign the requested difficulty to all questions
                type: q.type === 'multiple-choice' ? 'multiple-choice' : 'open-ended' // Normalize types
            }))
        }))
    };

    await setCached(cacheKey, enrichedResult, { type: 'test_parallel', gradeLevel, topic });
    return enrichedResult;
  },

async generateParallelQuestions(originalQuestions: AssessmentQuestion[]): Promise<AssessmentQuestion[]> {
    const prompt = `Дадени ти се следниве прашања од математички квиз:
${JSON.stringify(originalQuestions, null, 2)}

Твојата задача е да генерираш ПАРАЛЕЛНИ прашања (Mastery Learning). 
Секое ново прашање треба да има ИСТА ТЕЖИНА, ИСТ ОЧЕКУВАН НАЧИН НА РЕШАВАЊЕ и ИСТ ФОРМАТ како оригиналот, но со РАЗЛИЧНИ БРОЈКИ или РАЗЛИЧЕН КОНТЕКСТ (пр. сменети имиња, предмети).
Врати JSON формат строго копирајќи го property-структурирањето на оригиналот, 
и генерирај точно ${originalQuestions.length} прашања.`;

    const schema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.NUMBER },
                type: { type: Type.STRING },
                question: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                answer: { type: Type.STRING },
                solution: { type: Type.STRING }
            },
            required: ["type", "question", "answer"]
        }
    };

    const newQuestions = await generateAndParseJSON<AssessmentQuestion[]>([{ text: prompt }], schema);
    return newQuestions;
  },

async askTutor(message: string, history: Array<{role: string, content: string}>): Promise<string> {
    const systemPrompt = `Ти си безбеден AI тутор по математика за ученици во основно образование. Твојата главна цел е да им помогнеш да ги разберат концептите, НЕ да им ги решаваш задачите.
    
ПРАВИЛА КОИ МОРА ДА ГИ СЛЕДИШ:
1. НИКОГАШ не го давај конечниот одговор на задача пред ученикот да се обиде сам.
2. Постави му прашање на ученикот за да го насочиш да размислува.
3. Доколку ученикот згреши, немој да го критикуваш - објасни му каде згрешил и обиди се повторно.
4. Користи јасен, едноставен јазик прилагоден за основци (на македонски јазик).
5. Разложувај ги проблемите на помали, полесни чекори.
6. Ако изгледа дека ученикот сака само да препише решение, потсети го дека твојата улога е да објаснуваш, а не да решаваш.`;

    const contents = [
      ...history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })),
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    try {
      const response = await callGeminiProxy({
          model: DEFAULT_MODEL,
          contents: contents,
          systemInstruction: systemPrompt,
          safetySettings: SAFETY_SETTINGS
      });
      return response.text || "Извини, се појави проблем при генерирањето на одговорот.";
    } catch (e) {
      console.error("Tutor API error:", e);
      return "Настана грешка при комуникацијата со туторот. Обиди се повторно.";
    }
  },

async refineMaterialJSON(originalMaterial: Record<string, unknown>, tweakInstruction: string, _materialType?: string): Promise<Record<string, unknown>> {
    const prompt = `You are an expert educational AI assistant.

The teacher has already generated the following educational material (in JSON format):
\`\`\`json
${JSON.stringify(originalMaterial, null, 2)}
\`\`\`

The teacher wants to modify/refine this material with the following instructional request:
"${tweakInstruction}"

Please modify the JSON to incorporate exactly what the teacher requested.
IMPORTANT: You must return the updated material EXACTLY in the same generic JSON schema/structure as the input. Do not add any conversational text or markdown wrappers outside of the JSON block if it can be avoided. Return ONLY the raw JSON object.`;

    try {
      const response = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
        systemInstruction: 'You are a helpful AI that strictly outputs valid JSON that matches the format of the provided input document, just with modified values based on the prompt.',
        safetySettings: SAFETY_SETTINGS
      });
      return JSON.parse(response.text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
      console.error('Refine material error:', e);
      throw e;
    }
  },

async analyzeHandwriting(
    base64Image: string,
    mimeType: string,
    conceptContext?: string
  ): Promise<string> {
    checkDailyQuotaGuard();
    const contextLine = conceptContext
      ? `Контекст: ученикот работи на концептот „${conceptContext}".`
      : '';
    const prompt = `${contextLine}
Ти си искусен македонски наставник по математика. Анализирај ја оваа слика од рачно напишана математичка домашна работа или тест.

Твојата анализа треба да содржи:
1. **Точни делови** — наведи ги сите точно решени задачи (пофали ученикот конкретно).
2. **Грешки и корекции** — за секоја грешка: прикажи го точниот чекор-по-чекор пат на решавање.
3. **Општ совет** — еден краток совет за подобрување.
4. **Проценка** — дај процентуална оценка (пр. 75%) врз основа на точноста.

Пишувај топло и охрабрувачки. Одговори на македонски јазик.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Image } }
        ]
      }],
      systemInstruction: TEXT_SYSTEM_INSTRUCTION,
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

async generateParentReport(
    studentName: string,
    results: Array<{ quizTitle: string; percentage: number; conceptId?: string }>,
    mastery: Array<{ conceptTitle?: string; conceptId: string; mastered: boolean; bestScore: number; attempts: number }>
  ): Promise<string> {
    const mastered = mastery.filter(m => m.mastered);
    const struggling = mastery.filter(m => !m.mastered && m.attempts > 0).sort((a, b) => a.bestScore - b.bestScore);
    const totalQuizzes = results.length;
    const avgPct = totalQuizzes > 0
      ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / totalQuizzes)
      : 0;
    const passed = results.filter(r => r.percentage >= 70).length;

    const safeStudentName = sanitizePromptInput(studentName, 80);
    const prompt = `Ти си педагошки советник. Напиши кратко (5-7 параграфи), топло и охрабрувачко родителско писмо на македонски јазик за ученикот „${safeStudentName}".

Податоци за учениковите перформанси:
- Вкупно одиграни квизови: ${totalQuizzes}
- Положени (≥70%): ${passed}/${totalQuizzes}
- Просечен резултат: ${avgPct}%
- Совладани концепти (${mastered.length}): ${mastered.map(m => m.conceptTitle || m.conceptId).join(', ') || 'Нема'}
- Области кои треба подобрување (${struggling.length}): ${struggling.slice(0, 5).map(m => `${m.conceptTitle || m.conceptId} (${m.bestScore}%)`).join(', ') || 'Нема'}

Структура на писмото:
1. Поздравен пасус до родителот
2. Силни страни на ученикот — пофали конкретни совладани концепти
3. Области кои треба работа — деликатно, без критика
4. Конкретни препораки за учење дома (2-3 совети)
5. Охрабрувачки заклучок

Тон: топол, стручен, позитивен. НЕ употребувај клише. Пишувај конкретно.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'Ти си педагошки советник кој пишува родителски извештаи на македонски јазик.',
      safetySettings: SAFETY_SETTINGS,
    });
    return response.text.trim();
  },

  // П2 — Teacher Daily Brief
  async generateDailyBrief(stats: {
    totalQuizzes: number;
    weakConcepts: { conceptId?: string; title: string; avg: number; count: number }[];
    strugglingCount: number;
  }): Promise<{ summary: string; priority: 'high' | 'medium' | 'low'; primaryAction?: { label: string; conceptId?: string; conceptTitle?: string } }> {
    checkDailyQuotaGuard();
    const weakList = stats.weakConcepts.slice(0, 3)
      .map(c => `„${c.title}" (просек ${c.avg}%, ${c.count} обиди)`)
      .join('; ');

    const contents: Part[] = [{ text:
      `Ти си педагошки асистент. Генерирај КРАТКО дневно резиме за наставник.
ПОДАТОЦИ ОД ПОСЛЕДНИТЕ 48 ЧАСА:
- Решени квизови: ${stats.totalQuizzes}
- Слаби концепти (avg<70%): ${weakList || 'Нема'}
- Ученици со avg<50%: ${stats.strugglingCount}

Врати JSON по оваа структура:
{
  "summary": "<2-3 реченици на македонски. Конкретно: кои концепти, колку ученици, акциска препорака за денес>",
  "priority": "<high ако avg<60% или strugglingCount>3, medium ако avg<70%, иначе low>",
  "primaryAction": {
    "label": "<кратка акциска реченица, пр. Генерирај ремедијал за Делење>",
    "conceptId": "<id на најслабиот концепт или null>",
    "conceptTitle": "<наслов на концептот или null>"
  }
}` }];

    const schema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
        primaryAction: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            conceptId: { type: 'string' },
            conceptTitle: { type: 'string' },
          },
        },
      },
      required: ['summary', 'priority'],
    };

    return generateAndParseJSON<{ summary: string; priority: 'high' | 'medium' | 'low'; primaryAction?: { label: string; conceptId?: string; conceptTitle?: string } }>(contents, schema, DEFAULT_MODEL, DailyBriefSchema);
  },

  // П1 — AI персонализирана повратна информација по квиз
  async generateQuizFeedback(
    studentName: string,
    percentage: number,
    conceptTitle: string,
    correctCount: number,
    totalQuestions: number,
    misconceptions?: { question: string; studentAnswer: string; misconception: string }[],
  ): Promise<string> {
    checkDailyQuotaGuard();
    const safeStudentName = sanitizePromptInput(studentName, 80);
    const wrongParts = misconceptions?.slice(0, 2).map(m =>
      `- Прашање: "${sanitizePromptInput(m.question, 200)}" → Одговорено: "${sanitizePromptInput(m.studentAnswer, 100)}"`
    ).join('\n') ?? '';

    const toneHint = percentage >= 80
      ? 'Тонот е позитивен и охрабрувачки — ученикот се справил одлично.'
      : percentage >= 60
      ? 'Тонот е поддржувачки — ученикот е на добар пат, но треба уште вежбање.'
      : 'Тонот е топол и поддржувачки — ученикот треба помош, не критика.';

    const prompt = `Ученикот ${safeStudentName} завршил квиз за концептот „${conceptTitle}".
Резултат: ${correctCount}/${totalQuestions} (${percentage}%).
${wrongParts ? `Грешни прашања:\n${wrongParts}\n` : ''}
${toneHint}

Напиши САМО 2-3 реченици персонализирана повратна информација на македонски јазик.
Биди конкретен: спомни го концептот и дај еден практичен совет за подобрување.
НЕ започнувај со „Здраво", „Браво" или генерички пофалби. Биди директен и корисен.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'Ти си пријателски педагог кој дава кратки, конкретни повратни информации на македонски јазик.',
      safetySettings: SAFETY_SETTINGS,
      generationConfig: { maxOutputTokens: 150 },
    });
    return response.text.trim();
  },

  // П6 — Worked Examples со Scaffolded Fading (I do → We do → You do)
  async generateWorkedExample(conceptTitle: string, gradeLevel: number): Promise<AIGeneratedWorkedExample> {
    checkDailyQuotaGuard();
    const schema = {
      type: Type.OBJECT,
      properties: {
        concept: { type: Type.STRING },
        gradeLevel: { type: Type.INTEGER },
        steps: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              phase: { type: Type.STRING },
              title: { type: Type.STRING },
              problem: { type: Type.STRING },
              solution: { type: Type.ARRAY, items: { type: Type.STRING } },
              partialPlaceholder: { type: Type.STRING },
            },
            required: ['phase', 'title', 'problem'],
          },
        },
      },
      required: ['concept', 'gradeLevel', 'steps'],
    };
    const prompt = `Креирај Worked Example со Scaffolded Fading за концептот „${conceptTitle}", ${gradeLevel}. одделение.

Врати JSON со точно 3 чекори (steps):

1. phase: "solved" — Целосно решен пример (I do):
   - Задача со реални македонски бројки
   - solution: низа од 4-6 чекори, секој чекор е 1 реченица + пресметка
   - title: „Погледни — решено заедно"

2. phase: "partial" — Делумно решен пример (We do):
   - Иста или слична структура на задача
   - solution: само првите 2-3 чекори се дадени
   - partialPlaceholder: „Твој ред — заврши го решението"
   - title: „Заврши го ти"

3. phase: "quiz" — Самостојна задача (You do):
   - Нова задача, ист концепт, без помош
   - title: „Самостојно!"
   - НЕ давај solution

Сите текстови на македонски јазик. Задачите мора да се математички точни.`;

    return generateAndParseJSON<AIGeneratedWorkedExample>(
      [{ text: prompt }],
      schema,
      DEFAULT_MODEL,
      WorkedExampleSchema,
      MAX_RETRIES,
      false,
    );
  },

  // Ж7.5 — AI нарација за Студентско Портфолио
  async generateStudentNarrative(
    studentName: string,
    masteredCount: number,
    avgPercentage: number,
    totalQuizzes: number,
    topConcepts: string[],
    weakConcepts: string[],
    metacognitiveNotes: string[],
  ): Promise<string> {
    checkDailyQuotaGuard();
    const safeStudentName = sanitizePromptInput(studentName, 80);
    const topStr = topConcepts.slice(0, 3).join(', ') || 'нема';
    const weakStr = weakConcepts.slice(0, 2).join(', ') || 'нема';
    const notesSample = metacognitiveNotes.slice(0, 3)
      .map(n => `"${sanitizePromptInput(n, 200)}"`)
      .join('; ');
    const prompt = `Напиши кратка (3–4 параграфи) персонализирана нарација за учениковото портфолио на македонски јазик.

Ученик: ${safeStudentName}
Совладани концепти: ${masteredCount}
Просечен резултат: ${Math.round(avgPercentage)}%
Вкупно квизови: ${totalQuizzes}
Најдобри концепти: ${topStr}
Концепти за подобрување: ${weakStr}
${notesSample ? `Рефлексивни белешки на ученикот: ${notesSample}` : ''}

Структура:
1. Општа оценка на напредокот
2. Силни страни (кои концепти се совладани добро)
3. Области за раст (со конкретен совет)
4. Охрабрување и следен чекор

Пишувај топло, конкретно и мотивирачки. НЕ пишувај „Здраво" или формален поздрав.`;

    const response = await callGeminiProxy({
      model: DEFAULT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'Ти си педагог кој пишува персонализирани нарации за ученичко портфолио на македонски јазик.',
      safetySettings: SAFETY_SETTINGS,
      generationConfig: { maxOutputTokens: 400 },
    });
    return response.text.trim();
  },

  // Г1 — Адаптивна домашна задача по квиз
  // Е2 — AI Годишна Програма
  async generateAnnualPlan(
    grade: string,
    subject: string,
    totalWeeks: number,
    curriculumContext: string,
    profile?: TeachingProfile,
    customInstruction?: string
  ): Promise<AIGeneratedAnnualPlan> {
    const prompt = `
Вие сте врвен експерт за планирање на наставата по ${subject} за ${grade} во македонскиот образовен систем.
Ваша задача е да креирате детална, практична и изводлива предлог-годишна програма.

ПАРАМЕТРИ:
- Вкупно недели на располагање: ${totalWeeks}.

ОФИЦИЈАЛНА ПРОГРАМА (МОРА да се придржувате до овие теми и нивните специфики):
${curriculumContext}

УПАТСТВА:
1. Строго базирајте го вашиот план на официалните теми дадени погоре.
2. Распределете ги темите низ неделите така што сумата од сите недели да биде ТОЧНО ${totalWeeks}.
3. Конвертирајте ги "Препорачани часови" (suggested hours) во реални недели на настава (претпоставувајќи просечно 4-5 часа неделно за математика).
4. За секоја тема, извлечете ги примарните цели и предложете 2-3 креативни, модерни активности погодни за тоа одделение.
5. КАЛЕНДАРСКИ ИНТЕЛИГЕНТНО ПЛАНИРАЊЕ: Земете ги предвид македонските државни празници (како 8 Септември, 11 Октомври, 23 Октомври, 8 Декември, 1 Мај, 24 Мај) и училишните зимски распусти (обично јануари). Прилагодете ја тежината или времетраењето на темите што паѓаат во овие периоди (наведете во активностите доколку некоја недела е скратена поради празник).
${customInstruction ? `\nДОПОЛНИТЕЛНИ ИНСТРУКЦИИ ОД НАСТАВНИКОТ: ${customInstruction}` : ''}

Вратете ВАЛИДЕН JSON според шемата, без дополнителен текст.
    `.trim();

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
      undefined,
      profile?.tier
    );
  },

  async generateAdaptiveHomework(
    conceptTitle: string,
    gradeLevel: number,
    percentage: number,
    misconceptions?: { question: string; studentAnswer: string; misconception: string }[],
    profile?: TeachingProfile,
  ): Promise<AdaptiveHomework> {
    checkDailyQuotaGuard();

    const level = percentage < 60 ? 'remedial' : percentage < 80 ? 'standard' : 'challenge';
    const levelLabel = level === 'remedial' ? 'Ремедијална' : level === 'standard' ? 'Стандардна' : 'Предизвик';
    const difficultyInstruction = level === 'remedial'
      ? 'лесни задачи со чекор-по-чекор помош (hint). Задачите треба да ги покриваат истите концепти каде ученикот греши, со помали бројки и поедноставен контекст.'
      : level === 'standard'
      ? 'средно тешки задачи. Мешај директна примена и мал трансфер. Hint само за 2 задачи.'
      : 'предизвик задачи — нови контексти, примена на концептот на нов начин, проширување. Без hints.';

    const misconceptionContext = misconceptions && misconceptions.length > 0
      ? `\nУченикот специфично греши кај:\n${misconceptions.slice(0, 3).map(m => `- „${m.question}" → дал „${m.studentAnswer}" (грешка: ${m.misconception})`).join('\n')}`
      : '';

    const prompt = `Генерирај адаптивна домашна задача за ученик ${gradeLevel}. одделение.
Концепт: „${conceptTitle}"
Резултат на квизот: ${percentage}%
Ниво на домашна: ${levelLabel}${misconceptionContext}

Генерирај точно 5 ${difficultyInstruction}

Врати JSON со:
- conceptTitle: стрингот „${conceptTitle}"
- gradeLevel: ${gradeLevel}
- level: „${level}"
- levelLabel: „${levelLabel}"
- encouragement: 1 реченица охрабрување прилагодена на резултатот (${percentage}%)
- exercises: низа од 5 задачи, секоја со:
  - number: реден број (1-5)
  - problem: формулација на задачата (само текст, без решение)
  - hint: краток совет (само ако е remedial или standard ниво, иначе null)

Сите текстови на македонски јазик. Задачите мора да бидат математички точни.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        conceptTitle: { type: Type.STRING },
        gradeLevel: { type: Type.INTEGER },
        level: { type: Type.STRING },
        levelLabel: { type: Type.STRING },
        encouragement: { type: Type.STRING },
        exercises: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              number: { type: Type.INTEGER },
              problem: { type: Type.STRING },
              hint: { type: Type.STRING },
            },
            required: ['number', 'problem'],
          },
        },
      },
      required: ['conceptTitle', 'gradeLevel', 'level', 'levelLabel', 'encouragement', 'exercises'],
    };

    return generateAndParseJSON<AdaptiveHomework>(
      [{ text: prompt }],
      schema,
      DEFAULT_MODEL,
      undefined,
      MAX_RETRIES,
      false,
      undefined,
      profile?.tier
    );
  },

  async generatePresentation(topic: string, gradeLevel: number, concepts: string[], customInstruction?: string, profile?: TeachingProfile): Promise<AIGeneratedPresentation> {
    checkDailyQuotaGuard();
    return plansAPI.generatePresentation(topic, gradeLevel, concepts, customInstruction, profile);
  },

  async generateEmbedding(text: string): Promise<number[]> {
    return callEmbeddingProxy(text);
  },

  // П-Ј — Smart Quiz Title: generate a concise, descriptive title from quiz content
  async generateSmartQuizTitle(material: Record<string, unknown>): Promise<string> {
    try {
      checkDailyQuotaGuard();
      const questions: string[] = [];
      const nestedContent = typeof material?.content === 'object' && material.content !== null
        ? (material.content as Record<string, unknown>).questions
        : undefined;
      const content = material?.questions ?? material?.items ?? nestedContent ?? [];
      for (const q of Array.isArray(content) ? content.slice(0, 5) : []) {
        const text = q?.question || q?.text || '';
        if (text) questions.push(text);
      }
      if (questions.length === 0) return '';

      const snippet = questions.slice(0, 3).join(' | ');
      const prompt = `Дадени се прашања од квиз за математика:\n${snippet}\n\nНапиши само кус наслов (максимум 8 зборови) на македонски, кој го опишува темата на квизот. НЕ пишувај ништо друго — само насловот.`;

      const response = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 30 },
      });
      const title = response.text.trim().replace(/^["'„]|["'"]$/g, '').trim();
      return title.length > 3 ? title : '';
    } catch {
      return '';
    }
  },

  /** П-Б: Generate a targeted remedial quiz for specific misconceptions.
   *  Returns an AIGeneratedAssessment-compatible object with 6 MC questions. */
  async generateTargetedRemedialQuiz(
    conceptTitle: string,
    misconceptions: { text: string; count: number }[],
    gradeLevel: number,
  ): Promise<{ title: string; type: 'QUIZ'; questions: AssessmentQuestion[] }> {
    checkDailyQuotaGuard();

    const topMisc = misconceptions.slice(0, 4)
      .map((m, i) => `${i + 1}. „${m.text}" (${m.count} ученик${m.count === 1 ? '' : 'и'})`)
      .join('\n');

    const prompt = `Си искусен наставник по математика. Генерирај ремедијален квиз за ${gradeLevel}. одделение за концептот „${conceptTitle}".

Идентификувани концептуални грешки кај учениците:
${topMisc}

Генерирај точно 6 прашања со повеќекратен избор (4 опции) кои ДИРЕКТНО ги адресираат овие грешки. За секоја грешка направи барем 1 прашање кое ја разоткрива погрешната идеја и го води ученикот кон точното разбирање. Прашањата да бидат јасни, со македонска терминологија и математички точни.`;

    const schema = {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              type: { type: Type.STRING },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              answer: { type: Type.STRING },
              cognitiveLevel: { type: Type.STRING },
              difficulty_level: { type: Type.STRING },
            },
            required: ['id', 'type', 'question', 'options', 'answer', 'cognitiveLevel'],
          },
        },
      },
      required: ['title', 'questions'],
    };

    const result = await generateAndParseJSON<{ title: string; questions: AssessmentQuestion[] }>(
      [{ text: prompt }],
      schema,
      DEFAULT_MODEL,
      undefined,
      MAX_RETRIES,
      false,
    );

    return { title: result.title || `Ремедијација: ${conceptTitle}`, type: 'QUIZ', questions: result.questions };
  },
};
