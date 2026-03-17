import { Type, Part, getCached, setCached, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, buildDynamicSystemInstruction, JSON_SYSTEM_INSTRUCTION, minifyContext, sanitizePromptInput } from './core';
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
    const result = await generateAndParseJSON<AIGeneratedPracticeMaterial>([{ text: prompt }], schema, DEFAULT_MODEL, AIGeneratedPracticeMaterialSchema);
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
    const safeCustomInstruction = sanitizePromptInput(customInstruction);

    // Detect domain from topic/concept for visual enrichment
    const topicId = (context.topic?.id || '').toLowerCase();
    const conceptTitles = (context.concepts || []).map(c => (c.title || '').toLowerCase()).join(' ');
    const isGeometry = topicId.includes('geom') || conceptTitles.includes('геометрија') || conceptTitles.includes('триаголник') || conceptTitles.includes('агол') || conceptTitles.includes('правоаголник') || conceptTitles.includes('кружница') || conceptTitles.includes('трансформац') || conceptTitles.includes('координат');
    const isStatistics = topicId.includes('stat') || conceptTitles.includes('статистик') || conceptTitles.includes('средна вредност') || conceptTitles.includes('медијана') || conceptTitles.includes('мод') || conceptTitles.includes('честота') || conceptTitles.includes('дијаграм') || conceptTitles.includes('податоц');

    const geometryPart = isGeometry
      ? ' ГЕОМЕТРИЈА — ВИЗУЕЛНИ ДИЈАГРАМИ: За секое прашање поврзано со геометриска фигура, агол, координати или трансформација, генерирај SVG дијаграм во полето "svgDiagram". SVG правила: viewBox="0 0 220 180", width="220" height="180", само безбедни елементи (line, circle, polygon, polyline, rect, path, text, g), без скрипти, без надворешни ресурси. Користи stroke="#4f46e5" за линии, fill="none" за фигури, fill="#1e1b4b" за текст (font-size 12), fill="#e0e7ff" за попребоени површини. Означи темиња со букви (A, B, C...) и димензии каде е релевантно.'
      : '';
    const statisticsPart = isStatistics
      ? ' СТАТИСТИКА — ТАБЕЛА СО ПОДАТОЦИ: За прашања со статистички податоци, генерирај структурирана табела во полето "tableData" со формат: {"headers": ["Вредност", "Честота"], "rows": [[...], [...]], "caption": "..."}. Корисни реалистични броеви соодветни за нивото. Прашањето нека бара конкретна пресметка (средна вредност, медијана, мод, опсег) врз основа на табелата.'
      : '';

    const prompt = `Генерирај ${type} со ${numQuestions} прашања на македонски. Типови: ${questionTypes.join(', ')}. Ниво на диференцијација: ${diffDesc}.${bloomPart}${selfAssessmentPart}${workedExamplePart}${gradeLevelPrompt}${geometryPart}${statisticsPart} За секое прашање задолжително наведи 'cognitiveLevel' (Remembering/Understanding/Applying/Analyzing/Evaluating/Creating) и 'difficulty_level' (лесно/средно/тешко).${safeCustomInstruction ? ` ${safeCustomInstruction}` : ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, alignment_goal: { type: Type.STRING }, selfAssessmentQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, svgDiagram: { type: Type.STRING }, tableData: { type: Type.OBJECT, properties: { headers: { type: Type.ARRAY, items: { type: Type.STRING } }, rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: {} } }, caption: { type: Type.STRING } } }, isWorkedExample: { type: Type.BOOLEAN }, workedExampleType: { type: Type.STRING }, cognitiveLevel: { type: Type.STRING }, difficulty_level: { type: Type.STRING }, concept_evaluated: { type: Type.STRING } }, required: ["type", "question", "answer", "cognitiveLevel"] } } }, required: ["title", "questions"] };

    const canCache = !customInstruction && !studentProfiles?.length && differentiationLevel === 'standard' && !image && !isGeometry && !isStatistics;
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
    const safeFocus = sanitizePromptInput(focus, 200);
    const safeExtra = sanitizePromptInput(customInstruction);
    return this.generateAssessment('ASSESSMENT', [QuestionType.SHORT_ANSWER], numQuestions, context, profile, 'standard', undefined, undefined, `Фокус: ${safeFocus}.${safeExtra ? ` ${safeExtra}` : ''}`);
  }
};
