
// Schema type constants (matches @google/genai Type enum values, avoids bundling SDK on client)
const Type = {
  OBJECT: 'OBJECT' as const,
  STRING: 'STRING' as const,
  ARRAY: 'ARRAY' as const,
  INTEGER: 'INTEGER' as const,
  NUMBER: 'NUMBER' as const,
  BOOLEAN: 'BOOLEAN' as const,
};

interface Part {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

import { QuestionType } from '../types';
import type {
  ChatMessage,
  Concept,
  Topic,
  AIGeneratedAssessment,
  AIGeneratedIdeas,
  TeachingProfile,
  Grade,
  PlannerItem,
  LessonPlan,
  AIGeneratedThematicPlan,
  AIGeneratedRubric,
  GenerationContext,
  CoverageAnalysisReport,
  NationalStandard,
  AIRecommendation,
  DifferentiationLevel,
  StudentProfile,
  AIPedagogicalAnalysis,
  AIGeneratedLearningPaths,
  AIGeneratedIllustration,
  AIGeneratedPracticeMaterial,
} from '../types';
import { ApiError, AuthError, RateLimitError, ServerError } from "./apiErrors";
import { z } from 'zod';
import {
    AIGeneratedIdeasSchema,
    AIGeneratedAssessmentSchema,
    AIGeneratedRubricSchema,
    AIGeneratedLearningPathsSchema,
    AIGeneratedPracticeMaterialSchema,
    AIGeneratedThematicPlanSchema,
    CoverageAnalysisSchema,
    AIRecommendationSchema,
    LessonPlanSchema,
    AIPedagogicalAnalysisSchema,
    AnnualPlanSchema
} from '../utils/schemas';

// --- API PROXY ---
// All Gemini API calls go through server-side proxy.
// The API key NEVER reaches the client bundle.
// Every request is authenticated with Firebase ID token.
const PROXY_TIMEOUT_MS = 60_000; // 60 s – generous for Gemini thinking models

/**
 * Get a Firebase ID token for the currently signed-in user.
 * Lazily imports firebase/auth to avoid circular deps.
 */
async function getAuthToken(): Promise<string> {
  const { getAuth } = await import('firebase/auth');
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Не сте најавени. Ве молиме најавете се повторно.');
  }
  return user.getIdToken();
}

async function callGeminiProxy(params: { model: string; contents: any; config?: any }): Promise<{ text: string; candidates: any[] }> {
  const token = await getAuthToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Proxy error: ${response.status}` }));
      throw new Error(errorData.error || `Proxy error: ${response.status}`);
    }
    return response.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI барањето истече (timeout 60s). Обидете се повторно.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function* streamGeminiProxy(params: { model: string; contents: any; config?: any }): AsyncGenerator<string, void, unknown> {
  const token = await getAuthToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
  try {
    const response = await fetch('/api/gemini-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `Stream proxy error: ${response.status}` }));
      throw new Error(errorData.error || `Stream proxy error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Stream response body is null — streaming not supported in this environment');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      // Reset timeout on each chunk — stream is alive
      clearTimeout(timer);
      const chunkTimer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') { clearTimeout(chunkTimer); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) yield parsed.text;
          } catch (e) {
            if (e instanceof Error && e.message !== data) throw e;
          }
        }
      }
      clearTimeout(chunkTimer);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('AI stream истече (timeout 60s). Обидете се повторно.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Helper to handle and re-throw specific API errors
function handleGeminiError(error: unknown, customMessage?: string): never {
    console.error("Gemini Service Error:", error);
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";

    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) {
        throw new RateLimitError();
    }
    if (errorMessage.includes("api key not valid") || errorMessage.includes("permission denied") || errorMessage.includes("403")) {
        throw new AuthError();
    }
    if (errorMessage.includes("server error") || errorMessage.includes("500") || errorMessage.includes("overloaded")) {
        throw new ServerError();
    }
    
    const displayMessage = customMessage || (error instanceof Error ? error.message : "An unknown error occurred with the AI service.");
    throw new ApiError(displayMessage);
}

// Helper: Sanitizes the AI response string to ensure it is valid JSON
function cleanJsonString(text: string): string {
    if (!text) return "";
    
    // 1. Remove standard Markdown code blocks
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");

    // 2. Find the first '{' or '[' to ignore any introductory text
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIndex = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        startIndex = firstBrace;
    } else if (firstBracket !== -1) {
        startIndex = firstBracket;
    }

    if (startIndex !== -1) {
        cleaned = cleaned.substring(startIndex);
    }

    // 3. Find the last '}' or ']' to ignore any trailing text
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    let endIndex = -1;

    if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) {
        endIndex = lastBrace;
    } else if (lastBracket !== -1) {
        endIndex = lastBracket;
    }

    if (endIndex !== -1) {
        cleaned = cleaned.substring(0, endIndex + 1);
    }

    return cleaned.trim();
}

// Helper to strip heavy objects and ensure strings are safe
function minifyContext(context: GenerationContext): any {
    if (!context) return {};
    
    const safeString = (str: string | undefined, maxLength: number) => (str || '').substring(0, maxLength);

    return {
        type: context.type,
        gradeLevel: context.grade?.level,
        // Only send essential topic info
        topic: context.topic ? { 
            title: context.topic.title, 
            description: safeString(context.topic.description, 200)
        } : undefined,
        // Map concepts to essential fields and truncate descriptions
        concepts: context.concepts?.map(c => ({ 
            title: c.title, 
            description: safeString(c.description, 150),
            assessmentStandards: c.assessmentStandards?.slice(0, 5) // Limit standards to avoid token overflow
        })),
        // Only send standard code and description
        standard: context.standard ? { 
            code: context.standard.code, 
            description: safeString(context.standard.description, 200) 
        } : undefined,
        // Truncate scenario if it's very long
        scenario: safeString(context.scenario, 500),
    };
}

// --- SYSTEM INSTRUCTIONS ---

const TEXT_SYSTEM_INSTRUCTION = `
Ти си врвен експерт за методика на наставата по математика во Македонија.
Твојата цел е да генерираш креативни, ангажирачки и педагошки издржани содржини.

ПРАВИЛА ЗА ИЗЛЕЗ:
1. Јазик: Користи литературен македонски јазик.
2. Форматирање: Користи Markdown (наслови, листи, болд) за добра читливост.
3. Математички формули: 
   - Користи стандарден LaTeX за СИТЕ математички изрази, броеви и физички единици.
   - За инлајн формули користи: $ ... $ (на пр. $a^2+b^2=c^2$)
   - За блок формули користи: $$ ... $$
   - Вклучи ги и единиците мерки во LaTeX кога се дел од израз (пр. $11 \text{ km}$, $5 \text{ m/s}$).
   - НЕ користи долар знак за валути (користи "ден." или "EUR").
   - Специфично за Македонија: 
     - Користи \cdot за множење (пр. $3 \cdot 5 = 15$) наместо *.
     - Користи : за делење (пр. $15 : 3 = 5$) наместо /.
     - Користи децимална запирка (,) наместо точка (.) за децимални броеви (пр. 3,14).
4. Објаснувања: Секогаш кога е можно, објаснувај ги постапките чекор-по-чекор со јасен и разбирлив јазик за учениците.
`;

const JSON_SYSTEM_INSTRUCTION = `
Ти си API кое генерира строго валиден JSON за наставни материјали по математика.

ПРАВИЛА ЗА JSON ИЗЛЕЗ (КРИТИЧНО):
1. Врати САМО валиден JSON објект или низа. Без Markdown форматирање (без \`\`\`json), без воведен текст.
2. СТРУКТУРА: Следи ја точно побараната JSON шема. Сите полиња се задолжителни.

ПРАВИЛА ЗА LATEX ВО JSON (ЕКСТРЕМНО ВАЖНО):
Бидеји излезот е JSON стринг, сите backslashes во LaTeX командите мора да бидат "escaped" (дуплирани).
- За да добиеш \`\\frac{a}{b}\` во финалниот текст, во JSON стрингот мора да напишеш \`"\\\\frac{a}{b}"\`.
- За да добиеш \`\\sqrt{x}\`, во JSON мора да напишеш \`"\\\\sqrt{x}"\`.
- Користи единечни долари \`$\` за инлајн математика (пр. \`"$\\\\alpha + \\\\beta$"\`).
- Вклучи ги и единиците мерки во LaTeX кога се дел од израз (пр. \`"$11 \\\\text{ km}$"\`).
- Специфично за Македонија: 
  - Користи \`\\\\cdot\` за множење ($ \cdot $) наместо *.
  - Користи \`:\` за делење ($ : $) наместо /.
  - Користи децимална запирка (,) во математичките изрази за македонски стандард (пр. 2,5).
- РЕШЕНИЈА: Во полето "solution" секогаш давај детално објаснување чекор-по-чекор со користење на LaTeX каде што е соодветно.

ПЕДАГОШКИ НАСОКИ:
- Користи македонски јазик.
- Биди креативен и прецизен во содржината.
- Објаснувањата на задачите треба да бидат структурирани чекор-по-чекор за полесно разбирање.
`;

// Improved Safety Settings to prevent false-positive blocking of educational content
const SAFETY_SETTINGS = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_ONLY_HIGH' },
];


// Helper to safely parse JSON responses from the model with INTELLIGENT RETRY logic and Zod Validation
async function generateAndParseJSON<T>(contents: Part[], schema: any, model: string = "gemini-1.5-flash", zodSchema?: z.ZodTypeAny, retries = 3, useThinking = false): Promise<T> {
  try {
    console.log(`Generating content with model: ${model}... (Retries left: ${retries})`);
    
    // Configure Thinking for models that support it (like Gemini 2.5 Flash/Pro when requested)
    // Thinking budget allows the model to reason before outputting JSON, increasing accuracy for complex tasks.
    const config: any = {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: JSON_SYSTEM_INSTRUCTION,
        safetySettings: SAFETY_SETTINGS as any, 
    };

    const response = await callGeminiProxy({
      model,
      contents: [{ parts: contents }],
      config: config,
    });

    const rawText = response.text || "";
    
    const jsonString = cleanJsonString(rawText);
    
    if (!jsonString) {
        console.error("Received empty or invalid JSON string from AI:", rawText);
        throw new Error("AI returned an empty or unparseable response.");
    }
    
    let parsedJson;
    try {
        parsedJson = JSON.parse(jsonString);
    } catch (e) {
        console.error("JSON Parse Error on string:", jsonString);
        throw new Error("Невалиден JSON формат од AI.");
    }

    // Zod Validation
    if (zodSchema) {
        const validation = zodSchema.safeParse(parsedJson);
        if (!validation.success) {
            console.error("Zod Validation Failed:", validation.error);
            throw new Error(`Data validation failed: ${validation.error.message}`);
        }
        return validation.data as T;
    }

    return parsedJson as T;

  } catch (error: any) {
    const errorMessage = error.message?.toLowerCase() || "";
    const isFatal = errorMessage.includes("api key") || 
                    errorMessage.includes("permission") || 
                    errorMessage.includes("403"); 

    if (retries > 0 && !isFatal) {
        const delay = 1000 * Math.pow(2, 3 - retries); 
        console.warn(`AI Generation/Validation failed, retrying in ${delay}ms... Error:`, errorMessage);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateAndParseJSON<T>(contents, schema, model, zodSchema, retries - 1, useThinking);
    }
    
    handleGeminiError(error, `Грешка при генерирање податоци од AI: ${errorMessage.substring(0, 50)}...`);
  }
}

export const realGeminiService = {
  async generateLessonPlanIdeas(concepts: Concept[], topic: Topic, gradeLevel: number, profile?: TeachingProfile, options?: { focus: string; tone: string; learningDesign?: string; }, customInstruction?: string): Promise<AIGeneratedIdeas> {
    const conceptList = concepts.length > 0 ? concepts.map(c => c.title).join(', ') : "недефинирани";
    const topicTitle = topic?.title || "Општа математичка тема";
    
    let prompt = `Генерирај идеи за час на македонски јазик.
    Контекст: Одделение ${gradeLevel}, Тема: ${topicTitle}.
    Поими: ${conceptList}.
    
    Параметри:
    - Тон: ${options?.tone || 'Креативен'}
    - Фокус: ${options?.focus || 'Разбирање'}
    - Модел: ${options?.learningDesign || 'Стандарден'}
    `;

    if (customInstruction) {
        prompt += `\nДополнителна инструкција: ${customInstruction}`;
    }

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            openingActivity: { type: Type.STRING },
            mainActivity: { type: Type.STRING },
            differentiation: { type: Type.STRING },
            assessmentIdea: { type: Type.STRING },
        },
        required: ["title", "openingActivity", "mainActivity", "differentiation", "assessmentIdea"]
    };

    const contents: Part[] = [{ text: prompt }];

    return generateAndParseJSON<AIGeneratedIdeas>(contents, schema, "gemini-1.5-flash", AIGeneratedIdeasSchema);
  },

  // Enhanced with Attachment Support for RAG (Chat with your Data)
  async *getChatResponseStream(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }): AsyncGenerator<string, void, unknown> {
    try {
        const systemInstruction = `${TEXT_SYSTEM_INSTRUCTION}\nПрофил на наставник: ${JSON.stringify(profile || {})}\nДоколку корисникот прикачи слика, анализирај ја детално (текст, формули, дијаграми).`;
        
        // Transform history to Google GenAI format
        const contents = history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));

        // Inject attachment into the LAST user message if present
        if (attachment && contents.length > 0) {
            const lastMessage = contents[contents.length - 1];
            if (lastMessage.role === 'user') {
                lastMessage.parts.push({
                    inlineData: {
                        mimeType: attachment.mimeType,
                        data: attachment.base64
                    }
                } as any); // Cast as any because Typescript definitions for Part might be strict on union types
            }
        }

        const responseStream = streamGeminiProxy({
            model: "gemini-1.5-flash", 
            contents,
            config: {
                systemInstruction,
                safetySettings: SAFETY_SETTINGS,
            },
        });

        for await (const text of responseStream) {
            yield text;
        }
    } catch (error) {
        handleGeminiError(error, "Грешка при комуникација со AI асистентот.");
    }
  },

  async generateIllustration(prompt: string, image?: { base64: string, mimeType: string }): Promise<AIGeneratedIllustration> {
    try {
      const parts: Part[] = [{ text: prompt }];
      if (image) {
        parts.unshift({
          inlineData: {
            data: image.base64,
            mimeType: image.mimeType,
          },
        });
      }
      
      const response = await callGeminiProxy({
        model: 'gemini-1.5-flash',
        contents: [{ parts }],
        config: {
          responseModalities: ['IMAGE'],
          safetySettings: SAFETY_SETTINGS,
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64ImageBytes: string = part.inlineData.data;
          const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
          return { imageUrl, prompt };
        }
      }
      throw new Error("AI did not return an image.");
    } catch (error) {
      handleGeminiError(error, "Грешка при генерирање на илустрација.");
    }
  },

  async generateLearningPaths(context: GenerationContext, studentProfiles: StudentProfile[], profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedLearningPaths> {
    const prompt = `Креирај диференцирани патеки за учење.
    ${customInstruction ? `Инструкција: ${customInstruction}` : ''}
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            paths: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        profileName: { type: Type.STRING },
                        steps: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    stepNumber: { type: Type.INTEGER },
                                    activity: { type: Type.STRING },
                                    type: { type: Type.STRING, enum: ['Introductory', 'Practice', 'Consolidation', 'Assessment', 'Project'] },
                                },
                                required: ["stepNumber", "activity", "type"]
                            },
                        },
                    },
                    required: ["profileName", "steps"]
                },
            },
        },
        required: ["title", "paths"]
    };

    const contents: Part[] = [
      { text: prompt },
      { text: `Контекст:\n${JSON.stringify({ context: minifyContext(context), studentProfiles }, null, 2)}` },
    ];
    // Using Thinking mode here for deep personalization logic
    return generateAndParseJSON<AIGeneratedLearningPaths>(contents, schema, "gemini-1.5-flash", AIGeneratedLearningPathsSchema, 3, true);
  },

  async generateAssessment(type: 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS', questionTypes: QuestionType[], numQuestions: number, context: GenerationContext, profile?: TeachingProfile, differentiationLevel: DifferentiationLevel = 'standard', studentProfiles?: StudentProfile[], image?: { base64: string, mimeType: string }, customInstruction?: string, includeSelfAssessment?: boolean): Promise<AIGeneratedAssessment> {
    const prompt = `Генерирај ${type} со ${numQuestions} прашања.
    Типови прашања: ${questionTypes.join(', ')}.
    Ниво на диференцијација: ${differentiationLevel}.
    ${customInstruction ? `Дополнителна инструкција: ${customInstruction}` : ''}
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['TEST', 'WORKSHEET', 'QUIZ', 'FLASHCARDS'] },
            questions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        type: { type: Type.STRING },
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        answer: { type: Type.STRING },
                        solution: { type: Type.STRING, description: "Чекор-по-чекор објаснување на решението на македонски јазик" },
                        cognitiveLevel: { type: Type.STRING },
                        difficulty_level: { type: Type.STRING },
                        alignment_justification: { type: Type.STRING },
                        concept_evaluated: { type: Type.STRING },
                    },
                    required: ["type", "question", "answer"]
                }
            },
            selfAssessmentQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            differentiatedVersions: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        profileName: { type: Type.STRING },
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    type: { type: Type.STRING },
                                    question: { type: Type.STRING },
                                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                    answer: { type: Type.STRING },
                                    solution: { type: Type.STRING, description: "Чекор-по-чекор објаснување на решението на македонски јазик" },
                                },
                                required: ["type", "question", "answer"]
                            }
                        }
                    },
                    required: ["profileName", "questions"]
                }
            }
        },
        required: ["title", "type", "questions"]
    };
    
    const contents: Part[] = [
        { text: prompt },
        { text: `Контекст:\n${JSON.stringify({ context: minifyContext(context), studentProfiles }, null, 2)}` },
    ];
     if (image) {
        contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    }

    return generateAndParseJSON<AIGeneratedAssessment>(contents, schema, "gemini-1.5-flash", AIGeneratedAssessmentSchema);
  },
  
  async generateExitTicket(numQuestions: number, focus: string, context: GenerationContext, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedAssessment> {
      const instruction = `Фокус на прашањата: ${focus}. ${customInstruction || ''}`;
      return this.generateAssessment('ASSESSMENT', [QuestionType.SHORT_ANSWER], numQuestions, context, profile, 'standard', undefined, undefined, instruction);
  },

  async generateRubric(gradeLevel: number, activityTitle: string, activityType: string, criteriaHints: string, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedRubric> {
    const prompt = `Креирај рубрика за оценување.
    Активност: ${activityTitle} (${activityType}).
    Критериуми: ${criteriaHints}.
    ${customInstruction ? `Инструкција: ${customInstruction}` : ''}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            criteria: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        criterion: { type: Type.STRING },
                        levels: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    levelName: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    points: { type: Type.STRING },
                                },
                                required: ["levelName", "description", "points"]
                            }
                        }
                    },
                    required: ["criterion", "levels"]
                }
            }
        },
        required: ["title", "criteria"]
     };

    const contents: Part[] = [{ text: prompt }];
    return generateAndParseJSON<AIGeneratedRubric>(contents, schema, "gemini-1.5-flash", AIGeneratedRubricSchema);
  },

  async generateDetailedLessonPlan(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): Promise<Partial<LessonPlan>> {
      const prompt = `Генерирај детална подготовка за час.`;
      const contents: Part[] = [{text: prompt}, {text: `Контекст: ${JSON.stringify({context: minifyContext(context), profile})}`}];
       if (image) {
        contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      }
      
      const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
            assessmentStandards: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenario: {
                type: Type.OBJECT,
                properties: {
                    introductory: { type: Type.STRING },
                    main: { type: Type.ARRAY, items: { type: Type.STRING } },
                    concluding: { type: Type.STRING },
                },
                required: ["introductory", "main", "concluding"]
            },
            materials: { type: Type.ARRAY, items: { type: Type.STRING } },
            progressMonitoring: { type: Type.ARRAY, items: { type: Type.STRING } },
            differentiation: { type: Type.STRING },
            reflectionPrompt: { type: Type.STRING },
            selfAssessmentPrompt: { type: Type.STRING },
        },
        required: ["title", "objectives", "assessmentStandards", "scenario", "materials", "progressMonitoring", "differentiation"]
      };

      return generateAndParseJSON<Partial<LessonPlan>>(contents, schema, "gemini-1.5-flash", LessonPlanSchema.partial());
  },
  
  async enhanceText(textToEnhance: string, fieldType: string, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    const prompt = `Подобри го текстот за полето '${fieldType}' во подготовка за час (${gradeLevel} одд).
    Оригинален текст: "${textToEnhance}"`;
    
    const response = await callGeminiProxy({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { 
            systemInstruction: TEXT_SYSTEM_INSTRUCTION,
            safetySettings: SAFETY_SETTINGS
        } 
    });
    return response.text || "";
  },

  async analyzeLessonPlan(plan: Partial<LessonPlan>, profile?: TeachingProfile): Promise<AIPedagogicalAnalysis> {
    const prompt = `Направи педагошка анализа на следнава подготовка за час. Користи го својот "budget" за размислување за длабоко да ги оцениш усогласеноста, ангажманот и когнитивните нивоа пред да го генерираш финалниот JSON.`;
    const schema = {
        type: Type.OBJECT,
        properties: {
            pedagogicalAnalysis: {
                type: Type.OBJECT,
                properties: {
                    overallImpression: { type: Type.STRING },
                    alignment: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } }, required: ["status", "details"] },
                    engagement: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } }, required: ["status", "details"] },
                    cognitiveLevels: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } }, required: ["status", "details"] },
                },
                required: ["overallImpression", "alignment", "engagement", "cognitiveLevels"]
            }
        },
        required: ["pedagogicalAnalysis"]
    };
    
    // Using Thinking Config here to allow the model to reason about the pedagogical structure
    return generateAndParseJSON<AIPedagogicalAnalysis>([{text: prompt}, {text: `План: ${JSON.stringify(plan)}`}], schema, "gemini-1.5-flash", AIPedagogicalAnalysisSchema, 3, true);
  },

  async generateProactiveSuggestion(concept: Concept, profile?: TeachingProfile): Promise<string> {
      const prompt = `Генерирај краток, корисен и проактивен предлог за наставник кој ќе го предава концептот "${concept.title}". Предлогот треба да биде релевантен и да нуди конкретна акција. Заврши го предлогот со акција во загради [Пример: Сакаш да генерирам активност?].`;
      const response = await callGeminiProxy({ 
          model: "gemini-1.5-flash", 
          contents: prompt,
          config: { 
              systemInstruction: TEXT_SYSTEM_INSTRUCTION,
              safetySettings: SAFETY_SETTINGS
          }
      });
      return response.text || "";
  },
  
  async generateAnnualPlan(grade: Grade, startDate: string, endDate: string, holidays: string, winterBreak: {start: string, end: string}): Promise<Omit<PlannerItem, 'id'>[]> {
      const prompt = `Генерирај годишен распоред на темите во планерот за ${grade.title}.`;
      const schema = {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              properties: {
                  date: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
              },
              required: ["date", "title", "description"]
          }
       };
      
      return generateAndParseJSON<Omit<PlannerItem, 'id'>[]>([{text: prompt}, {text: `Контекст: ${JSON.stringify({startDate, endDate, holidays, winterBreak})}`}], schema, "gemini-1.5-flash", AnnualPlanSchema);
  },
  
  async generateThematicPlan(grade: Grade, topic: Topic): Promise<AIGeneratedThematicPlan> {
      const prompt = `Генерирај тематски план за темата "${topic.title}" за ${grade.level} одделение.`;
      const schema = {
          type: Type.OBJECT,
          properties: {
              thematicUnit: { type: Type.STRING },
              lessons: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          lessonNumber: { type: Type.INTEGER },
                          lessonUnit: { type: Type.STRING },
                          learningOutcomes: { type: Type.STRING },
                          keyActivities: { type: Type.STRING },
                          assessment: { type: Type.STRING },
                      },
                      required: ["lessonNumber", "lessonUnit", "learningOutcomes", "keyActivities", "assessment"]
                  }
              }
          },
          required: ["thematicUnit", "lessons"]
       };
      return generateAndParseJSON<AIGeneratedThematicPlan>([{text: prompt}, {text: `Контекст: ${JSON.stringify({grade: grade.level, topic: topic.title})}`}], schema, "gemini-1.5-flash", AIGeneratedThematicPlanSchema);
  },
  
  async analyzeReflection(wentWell: string, challenges: string, profile?: TeachingProfile): Promise<string> {
      const prompt = `Анализирај ја рефлексијата од часот и дај краток, концизен и корисен предлог за следниот час. Предлогот треба да заврши со акционо прашање во загради [Пример: Сакаш да генерирам активност?]. Рефлексија - Што помина добро: "${wentWell}". Предизвици: "${challenges}".`;
      const response = await callGeminiProxy({ 
          model: "gemini-1.5-flash", 
          contents: prompt,
          config: { 
              systemInstruction: TEXT_SYSTEM_INSTRUCTION,
              safetySettings: SAFETY_SETTINGS
          } 
      });
      return response.text || "";
  },
  
  async analyzeCoverage(lessonPlans: LessonPlan[], allNationalStandards: NationalStandard[]): Promise<CoverageAnalysisReport> {
      const prompt = `Анализирај ја покриеноста на националните стандарди врз основа на дадените подготовки за час.`;
      const schema = {
          type: Type.OBJECT,
          properties: {
              analysis: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          gradeLevel: { type: Type.INTEGER },
                          coveredStandardIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                          partiallyCoveredStandards: {
                              type: Type.ARRAY,
                              items: {
                                  type: Type.OBJECT,
                                  properties: {
                                      id: { type: Type.STRING },
                                      reason: { type: Type.STRING },
                                  },
                                  required: ["id", "reason"]
                              }
                          },
                          uncoveredStandardIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                          summary: { type: Type.STRING },
                          totalStandardsInGrade: { type: Type.INTEGER },
                      },
                      required: ["gradeLevel", "coveredStandardIds", "partiallyCoveredStandards", "uncoveredStandardIds", "summary", "totalStandardsInGrade"]
                  }
              }
          },
          required: ["analysis"]
       };
      const minifiedStandards = allNationalStandards.map(s => ({ id: s.id, code: s.code }));
      const minifiedPlans = lessonPlans.map(p => ({ grade: p.grade, assessmentStandards: p.assessmentStandards }));

      return generateAndParseJSON<CoverageAnalysisReport>([{text: prompt}, {text: `Податоци: ${JSON.stringify({lessonPlans: minifiedPlans, allNationalStandards: minifiedStandards})}`}], schema, "gemini-1.5-flash", CoverageAnalysisSchema);
  },
  
  async getPersonalizedRecommendations(profile: TeachingProfile, lessonPlans: LessonPlan[]): Promise<AIRecommendation[]> {
      const prompt = `Генерирај 3 персонализирани препораки за наставникот.
      Категориите треба да бидат една од: 'Нова Активност', 'Професионален Развој', 'Покриеност на Стандарди', 'Рефлексија', или слична соодветна категорија.`;
      const schema = {
          type: Type.ARRAY,
          items: {
              type: Type.OBJECT,
              properties: {
                  category: { type: Type.STRING }, // Relaxed from enum
                  title: { type: Type.STRING },
                  recommendationText: { type: Type.STRING },
                  action: {
                      type: Type.OBJECT,
                      properties: {
                          label: { type: Type.STRING },
                          path: { type: Type.STRING },
                          params: {
                              type: Type.OBJECT,
                              properties: {
                                  grade: { type: Type.STRING },
                                  topicId: { type: Type.STRING },
                                  conceptId: { type: Type.STRING },
                                  contextType: { type: Type.STRING },
                                  scenario: { type: Type.STRING },
                                  standardId: { type: Type.STRING },
                                  materialType: { type: Type.STRING },
                              }
                          }
                      }
                  }
              },
              required: ["category", "title", "recommendationText"]
          }
      };
      const minifiedPlans = lessonPlans.map(p => ({ title: p.title, grade: p.grade, topicId: p.topicId })).slice(0, 10);
      
      return generateAndParseJSON<AIRecommendation[]>([{text: prompt}, {text: `Податоци: ${JSON.stringify({profile, lessonPlans: minifiedPlans})}`}], schema, "gemini-1.5-flash", AIRecommendationSchema);
  },
  
  async generatePracticeMaterials(concept: Concept, gradeLevel: number, materialType: 'problems' | 'questions'): Promise<AIGeneratedPracticeMaterial> {
      const isProblem = materialType === 'problems';
      const typeValue = isProblem ? 'problem' : 'question';
      const task = isProblem ? 'задачи за вежбање (текстуални или нумерички)' : 'прашања за дискусија (кои поттикнуваат критичко размислување)';

      const prompt = `
      Генерирај 3 ${task} за концептот "${concept.title}" за ${gradeLevel} одделение.
      Вклучи и кратки одговори или насоки за наставникот.

      ВАЖНО: Врати JSON објект кој СТРОГО ја следи оваа структура (без Markdown). 
      Мора да има поле "items" кое е низа.
      `;

      // Strict Schema with required items
      const schema = {
          type: Type.OBJECT,
          properties: {
              title: { type: Type.STRING },
              items: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          type: { type: Type.STRING }, 
                          text: { type: Type.STRING },
                          answer: { type: Type.STRING },
                          solution: { type: Type.STRING, description: "Чекор-по-чекор објаснување на решението на македонски јазик" },
                      },
                      required: ["type", "text", "answer"]
                  }
              }
          },
          required: ["title", "items"] 
      };
      
      return generateAndParseJSON<AIGeneratedPracticeMaterial>([{text: prompt}], schema, "gemini-1.5-flash", AIGeneratedPracticeMaterialSchema);
  },
  
  async generateAnalogy(concept: Concept, gradeLevel: number): Promise<string> {
    const prompt = `Објасни го математичкиот поим "${concept.title}" за ${gradeLevel} одделение користејќи едноставна и лесно разбирлива аналогија.`;
    try {
      const response = await callGeminiProxy({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { 
            systemInstruction: TEXT_SYSTEM_INSTRUCTION,
            safetySettings: SAFETY_SETTINGS
        }
      });
      return response.text || "";
    } catch (error) {
      handleGeminiError(error, "Грешка при генерирање на аналогија.");
    }
  },
  
  async generatePresentationOutline(concept: Concept, gradeLevel: number): Promise<string> {
    const prompt = `Креирај кратка структура (outline) за презентација за математичкиот поим "${concept.title}" за ${gradeLevel} одделение.`;
    try {
      const response = await callGeminiProxy({
        model: "gemini-1.5-flash",
        contents: prompt,
        config: { 
            systemInstruction: TEXT_SYSTEM_INSTRUCTION,
            safetySettings: SAFETY_SETTINGS
        }
      });
      return response.text || "";
    } catch (error) {
      handleGeminiError(error, "Грешка при генерирање на структура за презентација.");
    }
  },

  // NEW: Parse natural language input from voice/text
  async parsePlannerInput(input: string): Promise<{ title: string; date: string; type: string; description: string }> {
    const prompt = `Extract the planner details from this text: "${input}".
    Today is ${new Date().toISOString().split('T')[0]}.
    Return JSON with:
    - title (string)
    - date (YYYY-MM-DD, infer next upcoming date if day name used)
    - type (one of: "LESSON", "EVENT", "HOLIDAY")
    - description (string, optional context)
    `;
    
    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            date: { type: Type.STRING },
            type: { type: Type.STRING, enum: ["LESSON", "EVENT", "HOLIDAY"] },
            description: { type: Type.STRING }
        },
        required: ["title", "date", "type", "description"]
    };

    return generateAndParseJSON<any>([{text: prompt}], schema, "gemini-1.5-flash");
  }
};
