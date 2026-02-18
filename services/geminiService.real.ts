import { getAuth } from 'firebase/auth';
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
    Concept, 
    Topic, 
    Grade,
    ChatMessage, 
    TeachingProfile, 
    StudentProfile, 
    QuestionType, 
    DifferentiationLevel,
    GenerationContext,
    AIGeneratedIdeas,
    AIGeneratedAssessment,
    AIGeneratedPracticeMaterial,
    AIGeneratedThematicPlan,
    AIGeneratedRubric,
    AIGeneratedIllustration,
    AIGeneratedLearningPaths,
    CoverageAnalysisReport,
    AIRecommendation,
    AIPedagogicalAnalysis,
    LessonPlan,
    PlannerItem,
    NationalStandard
} from '../types';
import { 
    AIGeneratedIdeasSchema,
    AIGeneratedAssessmentSchema,
    AIGeneratedPracticeMaterialSchema,
    AIGeneratedThematicPlanSchema,
    AIGeneratedRubricSchema,
    AIGeneratedLearningPathsSchema,
    CoverageAnalysisSchema,
    AIRecommendationSchema,
    AIPedagogicalAnalysisSchema,
    AnnualPlanSchema
} from '../utils/schemas';
import { ApiError, RateLimitError, AuthError, ServerError } from './apiErrors';

// --- CONSTANTS ---
const CACHE_COLLECTION = 'cached_ai_materials';
const DEFAULT_MODEL = 'gemini-1.5-flash';
const PROXY_TIMEOUT_MS = 60000;

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

// --- TYPES FOR INTERNAL USE ---
export enum Type {
    OBJECT = "object",
    ARRAY = "array",
    STRING = "string",
    INTEGER = "integer",
    NUMBER = "number",
}

interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

interface Content {
    role: 'user' | 'model';
    parts: Part[];
}

interface SafetySetting {
    category: string;
    threshold: string;
}

// --- QUEUE SYSTEM ---
let lastRequest = Promise.resolve();
async function queueRequest<T>(fn: () => Promise<T>): Promise<T> {
  const result = lastRequest.then(fn);
  lastRequest = result.catch(() => {});
  return result;
}

// --- AUTH HELPER ---
async function getAuthToken(): Promise<string> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Не сте најавени. Ве молиме најавете се повторно.');
  }
  return user.getIdToken();
}

// --- DIRECT SDK HELPERS ---
function normalizeContents(contents: any): any[] {
  if (!Array.isArray(contents)) {
    return [{ role: 'user', parts: [{ text: String(contents) }] }];
  }
  if (contents.length > 0 && (contents[0].parts || contents[0].role)) {
    return contents.map(c => ({
      role: c.role || 'user',
      parts: Array.isArray(c.parts) ? c.parts : [{ text: String(c.text || '') }]
    }));
  }
  return [{ role: 'user', parts: contents }];
}

async function callGeminiProxy(params: { 
  model: string; 
  contents: any; 
  generationConfig?: any; 
  systemInstruction?: string; 
  safetySettings?: any;
}): Promise<{ text: string; candidates: any[] }> {
  return queueRequest(async () => {
    try {
      const model = genAI.getGenerativeModel({ 
        model: params.model,
        safetySettings: params.safetySettings
      }, { apiVersion: 'v1beta' });

      let normalized = normalizeContents(params.contents);
      
      if (params.systemInstruction) {
         const instructionText = `SYSTEM INSTRUCTIONS:\n${params.systemInstruction}\n\nUSER REQUEST:\n`;
         if (normalized.length > 0 && normalized[0].parts && normalized[0].parts[0]) {
             if (typeof normalized[0].parts[0].text === 'string') {
                 normalized[0].parts[0].text = instructionText + normalized[0].parts[0].text;
             }
         }
      }

      const safeConfig = {
        temperature: params.generationConfig?.temperature ?? 0.7,
        topP: params.generationConfig?.topP ?? 0.95,
        maxOutputTokens: params.generationConfig?.maxOutputTokens ?? 8192,
      };

      const result = await model.generateContent({
        contents: normalized,
        generationConfig: safeConfig
      });

      const response = await result.response;
      const text = response.text();
      
      return { 
        text, 
        candidates: response.candidates || [] 
      };
    } catch (err: any) {
      console.error("Gemini Critical Error:", err.message || err);
      throw err;
    }
  });
}

async function* streamGeminiProxy(params: { 
  model: string; 
  contents: any; 
  generationConfig?: any;
  systemInstruction?: string;
  safetySettings?: any;
}): AsyncGenerator<string, void, unknown> {
  const model = genAI.getGenerativeModel({ 
    model: params.model,
    safetySettings: params.safetySettings
  }, { apiVersion: 'v1beta' });

  let normalized = normalizeContents(params.contents);
  if (params.systemInstruction) {
    const instructionText = `SYSTEM INSTRUCTIONS:\n${params.systemInstruction}\n\nUSER REQUEST:\n`;
    if (normalized.length > 0 && normalized[0].parts && normalized[0].parts[0]) {
      if (typeof normalized[0].parts[0].text === 'string') {
        normalized[0].parts[0].text = instructionText + normalized[0].parts[0].text;
      }
    }
  }

  const safeConfig = {
    temperature: params.generationConfig?.temperature ?? 0.7,
    topP: params.generationConfig?.topP ?? 0.95,
    maxOutputTokens: params.generationConfig?.maxOutputTokens ?? 8192,
  };

  const result = await model.generateContentStream({
    contents: normalized,
    generationConfig: safeConfig
  });

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    yield chunkText;
  }
}

// --- UTILS ---
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

function cleanJsonString(text: string): string {
    if (!text) return "";
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIndex = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) startIndex = firstBrace;
    else if (firstBracket !== -1) startIndex = firstBracket;
    if (startIndex !== -1) cleaned = cleaned.substring(startIndex);
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    let endIndex = -1;
    if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) endIndex = lastBrace;
    else if (lastBracket !== -1) endIndex = lastBracket;
    if (endIndex !== -1) cleaned = cleaned.substring(0, endIndex + 1);
    cleaned = cleaned.replace(/\\(?![^"nrtbf\/u\\])/g, '\\\\');
    return cleaned.trim();
}

function minifyContext(context: GenerationContext): any {
    if (!context) return {};
    const safeString = (str: string | undefined, maxLength: number) => (str || '').substring(0, maxLength);
    return {
        type: context.type,
        gradeLevel: context.grade?.level,
        topic: context.topic ? { title: context.topic.title, description: safeString(context.topic.description, 200) } : undefined,
        concepts: context.concepts?.map(c => ({ title: c.title, description: safeString(c.description, 150), assessmentStandards: c.assessmentStandards?.slice(0, 5) })),
        standard: context.standard ? { code: context.standard.code, description: safeString(context.standard.description, 200) } : undefined,
        scenario: safeString(context.scenario, 500),
    };
}

// --- SYSTEM INSTRUCTIONS ---
const TEXT_SYSTEM_INSTRUCTION = `
Ти си врвен експерт за методика на наставата по математика во Македонија.
Твојата цел е да генерираш креативни, ангажирачки и педагошки издржани содржини.

ПРАВИЛА ЗА ИЗЛЕЗ:
1. Јазик: Користи литературен македонски јазик.
2. Форматирање: Користи Markdown за добра читливост.
3. Математички формули: Користи стандарден LaTeX со $ за инлајн и $$ за блок. Користи \\cdot за множење и : за делење. Користи децимална запирка (,).
`;

const JSON_SYSTEM_INSTRUCTION = `Ти си API кое генерира строго валиден JSON за наставни материјали по математика. 
ОДГОВОРИ ИСКЛУЧИВО СО RAW JSON ОБЈЕКТ. БЕЗ MARKDOWN (\`\`\`json) И БЕЗ ДОПОЛНИТЕЛЕН ТЕКСТ.`;

const SAFETY_SETTINGS: SafetySetting[] = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_ONLY_HIGH' },
];

// --- CORE JSON HELPER ---
async function generateAndParseJSON<T>(contents: Part[], schema: any, model: string = DEFAULT_MODEL, zodSchema?: z.ZodTypeAny, retries = 7, useThinking = false): Promise<T> {
  const activeModel = useThinking ? 'gemini-2.0-flash-thinking-exp' : model;
  try {
    // 1. ЕКСТРЕМНО ЧИСТА КОНФИГУРАЦИЈА (Whitelist-от во callGeminiProxy ќе ги тргне сите не-дирекни полиња)
    const generationConfig: any = { 
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192
    };
    
    if (useThinking) {
        generationConfig.thinkingConfig = { thinkingBudget: 16000 };
    }

    // JSON ENFORCEMENT: Додаваме експлицитно барање за JSON во содржината
    const jsonEnforcement = "\n\nIMPORTANT: Return the result as a raw JSON object only. No Markdown code blocks. Use the following schema: " + JSON.stringify(schema);
    const enrichedContents = [...contents];
    if (enrichedContents.length > 0 && enrichedContents[0].text) {
        enrichedContents[0].text += jsonEnforcement;
    } else {
        enrichedContents.push({ text: jsonEnforcement });
    }

    // 2. ПОВИК
    const response = await callGeminiProxy({ 
      model: activeModel, 
      contents: enrichedContents,
      generationConfig,
      systemInstruction: JSON_SYSTEM_INSTRUCTION,
      safetySettings: SAFETY_SETTINGS
    });

    const jsonString = cleanJsonString(response.text || "");
    if (!jsonString) throw new Error("AI returned empty response");
    
    const parsedJson = JSON.parse(jsonString);

    if (zodSchema) {
        const validation = zodSchema.safeParse(parsedJson);
        if (!validation.success) throw new Error(`Validation failed: ${validation.error.message}`);
        return validation.data as T;
    }
    return parsedJson as T;
  } catch (error: any) {
    const errorMessage = error.message?.toLowerCase() || "";
    
    // Ако е структурна грешка 400, нема смисла да пробаме пак
    if (errorMessage.includes("400") || errorMessage.includes("invalid")) {
        console.error("Critical structural error (400):", error);
        throw error;
    }

    if (retries > 0 && !errorMessage.includes("api key") && !errorMessage.includes("permission")) {
        let delay = 2000;
        const match = errorMessage.match(/retry in (\d+(\.\d+)?)s/i);
        if (match) delay = (parseFloat(match[1]) + 2) * 1000;
        else delay = 1000 * Math.pow(2, 8 - retries);
        await new Promise(r => setTimeout(r, delay));
        return generateAndParseJSON<T>(contents, schema, model, zodSchema, retries - 1, useThinking);
    }
    handleGeminiError(error);
  }
}

// --- SERVICE IMPLEMENTATION ---
export const realGeminiService = {
  async generateLessonPlanIdeas(concepts: Concept[], topic: Topic, gradeLevel: number, profile?: TeachingProfile, options?: { focus: string; tone: string; learningDesign?: string; }, customInstruction?: string): Promise<AIGeneratedIdeas> {
    const conceptId = concepts[0].id;
    const cacheKey = `ideas_${conceptId}_g${gradeLevel}`;
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
        if (cachedDoc.exists()) return cachedDoc.data().content as AIGeneratedIdeas;
    } catch (e) { console.warn(e); }

    const conceptList = concepts.map(c => c.title).join(', ');
    const topicTitle = topic?.title || "Општа математичка тема";
    let prompt = `Генерирај идеи за час на македонски јазик. Контекст: Одделение ${gradeLevel}, Тема: ${topicTitle}. Поими: ${conceptList}.`;
    if (customInstruction) prompt += `\nДополнителна инструкција: ${customInstruction}`;

    const schema = {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            openingActivity: { type: Type.STRING },
            mainActivity: { 
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING },
                        bloomsLevel: { type: Type.STRING, enum: ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'] }
                    },
                    required: ["text", "bloomsLevel"]
                }
            },
            differentiation: { type: Type.STRING },
            assessmentIdea: { type: Type.STRING },
        },
        required: ["title", "openingActivity", "mainActivity", "differentiation", "assessmentIdea"]
    };

    const result = await generateAndParseJSON<AIGeneratedIdeas>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedIdeasSchema);
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: result, type: 'ideas', conceptId, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return result;
  },

  async *getChatResponseStream(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }): AsyncGenerator<string, void, unknown> {
    const systemInstruction = `${TEXT_SYSTEM_INSTRUCTION}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;
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

  async generateIllustration(prompt: string, image?: { base64: string, mimeType: string }): Promise<AIGeneratedIllustration> {
    const contents: Part[] = [{ text: prompt }];
    if (image) contents.unshift({ inlineData: { data: image.base64, mimeType: image.mimeType } });
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: contents }], 
        generationConfig: { responseModalities: ['IMAGE'] }, 
        safetySettings: SAFETY_SETTINGS 
    });
    const candidate = response.candidates[0];
    if (candidate && candidate.content.parts[0].inlineData) {
        const data = candidate.content.parts[0].inlineData;
        return { imageUrl: `data:${data.mimeType};base64,${data.data}`, prompt };
    }
    throw new Error("AI did not return image");
  },

  async generateLearningPaths(context: GenerationContext, studentProfiles: StudentProfile[], profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedLearningPaths> {
    const prompt = `Креирај диференцирани патеки за учење. ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, paths: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { profileName: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stepNumber: { type: Type.INTEGER }, activity: { type: Type.STRING }, type: { type: Type.STRING } }, required: ["stepNumber", "activity"] } } }, required: ["profileName", "steps"] } } }, required: ["title", "paths"] };
    return generateAndParseJSON<AIGeneratedLearningPaths>([{ text: prompt }, { text: JSON.stringify(minifyContext(context)) }], schema, DEFAULT_MODEL, AIGeneratedLearningPathsSchema, 3, true);
  },

  async generateAnalogy(concept: Concept, gradeLevel: number): Promise<string> {
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
        safetySettings: SAFETY_SETTINGS 
    });
    const text = response.text || "";
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: text, type: 'analogy', conceptId: concept.id, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return text;
  },

  async generateStepByStepSolution(conceptTitle: string, gradeLevel: number): Promise<{ problem: string, strategy?: string, steps: any[] }> {
    const cacheKey = `solver_${conceptTitle.replace(/\s+/g, '_')}_g${gradeLevel}`;
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
        if (cachedDoc.exists()) return cachedDoc.data().content;
    } catch (e) { console.warn("Cache error:", e); }

    const prompt = `
      Ти си експерт за математичка педагогија. Креирај една типична задача за "${conceptTitle}" за ${gradeLevel} одделение.
      Користи Tree of Thoughts (ToT) пристап: разгледај 2 методи и избери ја најјасната.
      Реши ја задачата преку Chain of Thought (CoT).
      
      Внимавај на точноста! Направи само-корекција пред да го пратиш одговорот.

      ВРАТИ ГИ ПОДАТОЦИТЕ ИСКЛУЧИВО ВО ОВОЈ JSON ФОРМАТ:
      {
        "problem": "текст на задачата",
        "strategy": "зошто ја избравме оваа метода",
        "steps": [{"explanation": "чекор", "expression": "LaTeX"}]
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
    
    const result = await generateAndParseJSON<any>([{ text: prompt }], schema);
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { 
        content: result, 
        type: 'solver', 
        conceptTitle,
        gradeLevel,
        createdAt: serverTimestamp() 
    }).catch(console.error);
    return result;
  },

  async explainSpecificStep(problem: string, stepExplanation: string, stepExpression: string): Promise<string> {
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
        safetySettings: SAFETY_SETTINGS 
    });
    return response.text || "";
  },

  async generatePracticeMaterials(concept: Concept, gradeLevel: number, materialType: 'problems' | 'questions'): Promise<AIGeneratedPracticeMaterial> {
    const typeKey = materialType === 'problems' ? 'quiz' : 'discussion';
    const cacheKey = `${typeKey}_${concept.id}_g${gradeLevel}`;
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
        if (cachedDoc.exists()) return cachedDoc.data().content as AIGeneratedPracticeMaterial;
    } catch (e) { console.warn(e); }

    const task = materialType === 'problems' ? 'quiz with 5 multiple-choice problems' : 'discussion guide with 5 questions';
    const prompt = `Create a ${task} for "${concept.title}" (${gradeLevel} od.). Врати JSON: { "title": "...", "items": [{"text": "...", "answer": "...", "solution": "...", "options": ["...", "..."]}] }`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["text", "answer"] } } }, required: ["title", "items"] };
    const result = await generateAndParseJSON<AIGeneratedPracticeMaterial>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedPracticeMaterialSchema);
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: result, type: typeKey, conceptId: concept.id, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return result;
  },

  async generateAssessment(type: 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS', questionTypes: QuestionType[], numQuestions: number, context: GenerationContext, profile?: TeachingProfile, differentiationLevel: DifferentiationLevel = 'standard', studentProfiles?: StudentProfile[], image?: { base64: string, mimeType: string }, customInstruction?: string): Promise<AIGeneratedAssessment> {
    const prompt = `Генерирај ${type} со ${numQuestions} прашања. Типови: ${questionTypes.join(', ')}. Диференцијација: ${differentiationLevel}. ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, solution: { type: Type.STRING } }, required: ["type", "question", "answer"] } } }, required: ["title", "questions"] };
    const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
    if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    return generateAndParseJSON<AIGeneratedAssessment>(contents, schema, DEFAULT_MODEL, AIGeneratedAssessmentSchema);
  },

  async generateExitTicket(numQuestions: number, focus: string, context: GenerationContext, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedAssessment> {
      return this.generateAssessment('ASSESSMENT', [QuestionType.SHORT_ANSWER], numQuestions, context, profile, 'standard', undefined, undefined, `Фокус: ${focus}. ${customInstruction || ''}`);
  },

  async generateRubric(gradeLevel: number, activityTitle: string, activityType: string, criteriaHints: string, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedRubric> {
    const prompt = `Креирај рубрика за ${activityTitle} (${activityType}). ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, criteria: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { criterion: { type: Type.STRING }, levels: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { levelName: { type: Type.STRING }, description: { type: Type.STRING }, points: { type: Type.STRING } }, required: ["levelName", "description"] } } }, required: ["criterion", "levels"] } } }, required: ["title", "criteria"] };
    return generateAndParseJSON<AIGeneratedRubric>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedRubricSchema);
  },

  async generatePresentationOutline(concept: Concept, gradeLevel: number): Promise<string> {
    const cacheKey = `outline_${concept.id}_g${gradeLevel}`;
    try {
        const cachedDoc = await getDoc(doc(db, CACHE_COLLECTION, cacheKey));
        if (cachedDoc.exists()) return cachedDoc.data().content;
    } catch (e) { console.warn(e); }

    const prompt = `Креирај структура за презентација за "${concept.title}" (${gradeLevel} одд.).`;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS 
    });
    const text = response.text || "";
    await setDoc(doc(db, CACHE_COLLECTION, cacheKey), { content: text, type: 'outline', conceptId: concept.id, gradeLevel, createdAt: serverTimestamp() }).catch(console.error);
    return text;
  },

  async generateDetailedLessonPlan(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): Promise<Partial<LessonPlan>> {
      const prompt = `Генерирај детална подготовка за час на македонски јазик.`;
      const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, objectives: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, bloomsLevel: { type: Type.STRING } }, required: ["text"] } }, scenario: { type: Type.OBJECT, properties: { introductory: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } }, main: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } }, concluding: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } } } }, required: ["title", "objectives", "scenario"] };
      const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
      if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
      return generateAndParseJSON<Partial<LessonPlan>>(contents, schema);
  },

  async enhanceText(textToEnhance: string, fieldType: string, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    const prompt = `Подобри го текстот за '${fieldType}' (${gradeLevel} одд). Оригинален текст: "${textToEnhance}"`;
    const response = await callGeminiProxy({ 
        model: DEFAULT_MODEL, 
        contents: [{ parts: [{ text: prompt }] }], 
        systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
        safetySettings: SAFETY_SETTINGS 
    });
    return response.text || "";
  },

  async analyzeLessonPlan(plan: Partial<LessonPlan>, profile?: TeachingProfile): Promise<AIPedagogicalAnalysis> {
    const prompt = `Направи педагошка анализа на подготовка за час.`;
    const schema = { type: Type.OBJECT, properties: { pedagogicalAnalysis: { type: Type.OBJECT, properties: { overallImpression: { type: Type.STRING }, alignment: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, engagement: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, cognitiveLevels: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } } } } }, required: ["pedagogicalAnalysis"] };
    return generateAndParseJSON<AIPedagogicalAnalysis>([{ text: prompt }, { text: `План: ${JSON.stringify(plan)}` }], schema, DEFAULT_MODEL, AIPedagogicalAnalysisSchema, 3, true);
  },

  async generateProactiveSuggestion(concept: Concept, profile?: TeachingProfile): Promise<string> {
      const prompt = `Генерирај проактивен предлог за "${concept.title}".`;
      const response = await callGeminiProxy({ 
          model: DEFAULT_MODEL, 
          contents: [{ parts: [{ text: prompt }] }], 
          systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
          safetySettings: SAFETY_SETTINGS 
      });
      return response.text || "";
  },

  async generateAnnualPlan(grade: Grade, startDate: string, endDate: string, holidays: string, winterBreak: {start: string, end: string}): Promise<Omit<PlannerItem, 'id'>[]> {
      const prompt = `Генерирај годишен распоред за ${grade.title}.`;
      const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { date: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["date", "title"] } };
      return generateAndParseJSON<Omit<PlannerItem, 'id'>[]>([{ text: prompt }, { text: `Датуми: ${startDate} до ${endDate}` }], schema, DEFAULT_MODEL, AnnualPlanSchema);
  },

  async generateThematicPlan(grade: Grade, topic: Topic): Promise<AIGeneratedThematicPlan> {
      const prompt = `Генерирај тематски план за "${topic.title}" (${grade.level} одд.).`;
      const schema = { type: Type.OBJECT, properties: { thematicUnit: { type: Type.STRING }, lessons: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { lessonNumber: { type: Type.INTEGER }, lessonUnit: { type: Type.STRING }, learningOutcomes: { type: Type.STRING }, keyActivities: { type: Type.STRING }, assessment: { type: Type.STRING } }, required: ["lessonNumber", "lessonUnit"] } } }, required: ["thematicUnit", "lessons"] };
      return generateAndParseJSON<AIGeneratedThematicPlan>([{ text: prompt }, { text: `Тема: ${topic.title}` }], schema, DEFAULT_MODEL, AIGeneratedThematicPlanSchema);
  },

  async analyzeReflection(wentWell: string, challenges: string, profile?: TeachingProfile): Promise<string> {
      const prompt = `Анализирај рефлексија: "${wentWell}". Предизвици: "${challenges}".`;
      const response = await callGeminiProxy({ 
          model: DEFAULT_MODEL, 
          contents: [{ parts: [{ text: prompt }] }], 
          systemInstruction: TEXT_SYSTEM_INSTRUCTION, 
          safetySettings: SAFETY_SETTINGS 
      });
      return response.text || "";
  },

  async analyzeCoverage(lessonPlans: LessonPlan[], allNationalStandards: NationalStandard[]): Promise<CoverageAnalysisReport> {
      const prompt = `Анализирај ја покриеноста на националните стандарди.`;
      const schema = { type: Type.OBJECT, properties: { analysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { gradeLevel: { type: Type.INTEGER }, coveredStandardIds: { type: Type.ARRAY, items: { type: Type.STRING } }, summary: { type: Type.STRING } }, required: ["gradeLevel", "coveredStandardIds", "summary"] } } }, required: ["analysis"] };
      return generateAndParseJSON<CoverageAnalysisReport>([{ text: prompt }], schema, DEFAULT_MODEL, CoverageAnalysisSchema);
  },

  async getPersonalizedRecommendations(profile: TeachingProfile, lessonPlans: LessonPlan[]): Promise<AIRecommendation[]> {
      const prompt = `Генерирај 3 персонализирани препораки.`;
      const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, title: { type: Type.STRING }, recommendationText: { type: Type.STRING } }, required: ["category", "title", "recommendationText"] } };
      return generateAndParseJSON<AIRecommendation[]>([{ text: prompt }], schema, DEFAULT_MODEL, AIRecommendationSchema);
  },

  async parsePlannerInput(input: string): Promise<{ title: string; date: string; type: string; description: string }> {
    const prompt = `Extract details: "${input}".`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["title", "date", "type"] };
    return generateAndParseJSON<any>([{ text: prompt }], schema);
  }
};
