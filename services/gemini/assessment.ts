import { Type, Part, Content, getCached, setCached, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, buildDynamicSystemInstruction, JSON_SYSTEM_INSTRUCTION, minifyContext } from './core';
import { Concept, QuestionType, GenerationContext, TeachingProfile, DifferentiationLevel, StudentProfile, AIGeneratedAssessment, AIGeneratedPracticeMaterial } from '../../types';
import { AIGeneratedAssessmentSchema, AIGeneratedPracticeMaterialSchema } from '../../utils/schemas';

export const assessmentAPI = {
async generatePracticeMaterials(concept: Concept, gradeLevel: number, materialType: 'problems' | 'questions'): Promise<AIGeneratedPracticeMaterial> {
    const typeKey = materialType === 'problems' ? 'quiz' : 'discussion';
    const cacheKey = `${typeKey}_${concept.id}_g${gradeLevel}`;
    
    const cached = await getCached<AIGeneratedPracticeMaterial>(cacheKey);
    if (cached) return cached;

    const task = materialType === 'problems' ? 'quiz with 5 multiple-choice problems' : 'discussion guide with 5 questions';
    const prompt = `Create a ${task} for "${concept.title}" (${gradeLevel} od.). Врати JSON: { "title": "...", "items": [{"type": "multiple-choice", "text": "...", "answer": "...", "solution": "...", "options": ["...", "..."]}] }`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, text: { type: Type.STRING }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["text", "answer"] } } }, required: ["title", "items"] };
    const result = await generateAndParseJSON<AIGeneratedPracticeMaterial>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedPracticeMaterialSchema, undefined, undefined, undefined, (assessmentAPI as any)._tier);
    await setCached(cacheKey, result, { type: typeKey, conceptId: concept.id, gradeLevel });
    return result;
  },

async generateAssessment(type: 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS', questionTypes: QuestionType[], numQuestions: number, context: GenerationContext, profile?: TeachingProfile, differentiationLevel: DifferentiationLevel = 'standard', studentProfiles?: StudentProfile[], image?: { base64: string, mimeType: string }, customInstruction?: string, includeSelfAssessment?: boolean, includeWorkedExamples?: boolean): Promise<AIGeneratedAssessment> {
    const bloomDist = context.bloomDistribution;
    const hasBloom = bloomDist && Object.keys(bloomDist).length > 0;
    let bloomPart = '';
    if (hasBloom) {
      // Normalize to 100% so AI always gets valid percentages regardless of slider totals
      const rawTotal = Object.values(bloomDist!).reduce((s, v) => s + (v ?? 0), 0);
      const normFactor = rawTotal > 0 ? 100 / rawTotal : 1;
      const normalized = Object.entries(bloomDist!)
        .filter(([, v]) => (v ?? 0) > 0)
        .map(([k, v]) => `${k} ${Math.round((v ?? 0) * normFactor)}%`)
        .join(', ');
      bloomPart = ` BLOOM РАСПРЕДЕЛБА (придржувај се строго): ${normalized}.`;
    }
    const selfAssessmentPart = includeSelfAssessment ? ' Додај 2-3 метакогнитивни прашања за само-оценување на крајот.' : '';
      const workedExamplePart = includeWorkedExamples ? ' Првите 1 или 2 прашања нека бидат решени примери (Worked Examples) за учење (Scaffolding). На нив постави го полето isWorkedExample на true, а во workedExampleType стави "full". Објаснувањето на решението напиши го во полето solution, а answer да биде точниот одговор.' : '';
    const diffDescriptions: Record<string, string> = {
      support: 'ПОДДРШКА: Поедноставени прашања со детални упатства, помал вокабулар, насочување низ решавање чекор по чекор',
      standard: 'ОСНОВНО: Стандардни прашања соодветни за просечен ученик',
      advanced: 'ЗБОГАТУВАЊЕ: Предизвикувачки прашања со отворен крај, критичко размислување, меѓупредметни врски и примена во реален контекст',
    };
    const diffDesc = diffDescriptions[differentiationLevel] || diffDescriptions.standard;
    const gradeLevelPrompt = context.grade.level && context.grade.level <= 3 
      ? ' ЗАБЕЛЕШКА ЗА ВОЗРАСТА: Ова е за рана училишна возраст (1-3 одд). Користи МНОГУ ЕДНОСТАВЕН јазик, кратки реченици и примери со конкретни предмети (на пр. јаболка, играчки). Бројките да соодветствуваат на нивото.' 
      : '';
    const prompt = `Генерирај ${type} со ${numQuestions} прашања на македонски. Типови: ${questionTypes.join(', ')}. Ниво на диференцијација: ${diffDesc}.${bloomPart}${selfAssessmentPart}${workedExamplePart}${gradeLevelPrompt} За секое прашање задолжително наведи 'cognitiveLevel' (Remembering/Understanding/Applying/Analyzing/Evaluating/Creating) и 'difficulty_level' (лесно/средно/тешко). ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, alignment_goal: { type: Type.STRING }, selfAssessmentQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, isWorkedExample: { type: Type.BOOLEAN }, workedExampleType: { type: Type.STRING }, cognitiveLevel: { type: Type.STRING }, difficulty_level: { type: Type.STRING }, concept_evaluated: { type: Type.STRING } }, required: ["type", "question", "answer", "cognitiveLevel"] } } }, required: ["title", "questions"] };

    const canCache = !customInstruction && !studentProfiles?.length && differentiationLevel === 'standard' && !image;
    const conceptCacheId = context.concepts?.[0]?.id || 'gen';
    const cacheKey = canCache ? `assessment_${type}_${conceptCacheId}_g${context.grade.level}_${[...questionTypes].sort().join('_')}_n${numQuestions}` : '';
    
    if (canCache && cacheKey) {
        const cached = await getCached<AIGeneratedAssessment>(cacheKey);
        if (cached) return cached;
    }

    const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
    if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });
    
    // RAG INJECTION
    const systemInstr = await buildDynamicSystemInstruction(
        JSON_SYSTEM_INSTRUCTION, 
        context.grade.level, 
        conceptCacheId !== 'gen' ? conceptCacheId : undefined, 
        context.topic?.id
    );

    const result = await generateAndParseJSON<AIGeneratedAssessment>(
        contents, 
        schema, 
        DEFAULT_MODEL, 
        AIGeneratedAssessmentSchema, 
        MAX_RETRIES, 
        false, 
        systemInstr,
        profile?.tier
    );
    
    if (canCache && cacheKey) {
        await setCached(cacheKey, result, { type: 'assessment', conceptId: conceptCacheId !== 'gen' ? conceptCacheId : undefined, gradeLevel: context.grade.level });
    }
    return result;
  },

async generateExitTicket(numQuestions: number, focus: string, context: GenerationContext, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedAssessment> {
      return this.generateAssessment('ASSESSMENT', [QuestionType.SHORT_ANSWER], numQuestions, context, profile, 'standard', undefined, undefined, `Фокус: ${focus}. ${customInstruction || ''}`);
  }
};
