import { Type, Part, getCached, setCached, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, buildDynamicSystemInstruction, JSON_SYSTEM_INSTRUCTION, minifyContext, sanitizePromptInput } from './core';
import { Concept, QuestionType, GenerationContext, TeachingProfile, DifferentiationLevel, StudentProfile, AIGeneratedAssessment, AIGeneratedPracticeMaterial } from '../../types';
import { AIGeneratedAssessmentSchema, AIGeneratedPracticeMaterialSchema } from '../../utils/schemas';
import { fetchFewShotExamples } from './ragService';

const FRACTION_KEYWORDS = ['дропка', 'собирање', 'одземање'];

function isFractionContext(context: GenerationContext): boolean {
  const topicText = `${context.topic?.id ?? ''} ${context.topic?.title ?? ''}`.toLowerCase();
  const conceptText = (context.concepts ?? []).map(c => `${c.id ?? ''} ${c.title ?? ''}`.toLowerCase()).join(' ');
  return topicText.includes('дропк') || conceptText.includes('дропк') || conceptText.includes('fraction');
}

function includesAnyKeyword(text: string, keywords: string[]): boolean {
  const source = (text ?? '').toLowerCase();
  return keywords.some((kw) => source.includes(kw.toLowerCase()));
}

function reinforceFractionKeywords(result: AIGeneratedAssessment, context: GenerationContext): AIGeneratedAssessment {
  if (!isFractionContext(context) || !Array.isArray(result.questions)) {
    return result;
  }

  return {
    ...result,
    questions: result.questions.map((q) => {
      const combined = `${q.question ?? ''} ${q.answer ?? ''}`;
      if (includesAnyKeyword(combined, FRACTION_KEYWORDS)) {
        return q;
      }
      return {
        ...q,
        question: `${q.question ?? ''} (Користи дропка и образложи собирање или одземање.)`.trim(),
      };
    }),
  };
}

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

async generateAssessment(type: 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS', questionTypes: QuestionType[], numQuestions: number, context: GenerationContext, profile?: TeachingProfile, differentiationLevel: DifferentiationLevel = 'standard', studentProfiles?: StudentProfile[], image?: { base64: string, mimeType: string }, customInstruction?: string, includeSelfAssessment?: boolean, includeWorkedExamples?: boolean, dokTarget?: 1 | 2 | 3 | 4 | 'mixed'): Promise<AIGeneratedAssessment> {
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
      : context.grade.level && context.grade.level >= 10
      ? ` ЗАБЕЛЕШКА ЗА НИВО: Ова е за средно образование (${context.grade.level - 9}. година гимназија/стручно). Користи напреден математички јазик и нотација. Прашањата може да бараат повеќечекорни докази, апстрактно мислење и формална математичка аргументација соодветна за средношколско ниво.`
      : '';
    const safeCustomInstruction = sanitizePromptInput(customInstruction);

    // DoK targeting
    const dokPart = dokTarget === 'mixed'
      ? ' DOK РАСПРЕДЕЛБА (Webb\'s Depth of Knowledge): Генерирај 25% DoK-1 (recall), 35% DoK-2 (skill/concept), 30% DoK-3 (strategic thinking), 10% DoK-4 (extended thinking). За секое прашање постави го полето dokLevel (1/2/3/4).'
      : dokTarget
      ? ` DOK НИВО: Сите прашања треба да бидат на Webb's DoK ниво ${dokTarget} (${dokTarget === 1 ? 'Recall & Reproduction — директни процедури и факти' : dokTarget === 2 ? 'Skills & Concepts — примена на концепти, интерпретација' : dokTarget === 3 ? 'Strategic Thinking — доказ, анализа, повеќечекорно стратешко решавање' : 'Extended Thinking — истражување, проектни задачи, интердисциплинарни врски'}). За секое прашање постави го полето dokLevel (${dokTarget}).`
      : ' За секое прашање постави го полето dokLevel (Webb\'s DoK: 1=Recall, 2=Skill/Concept, 3=Strategic Thinking, 4=Extended Thinking).';

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

      // @prompt-start: assessment_test
    const prompt = `Генерирај ${type} со ${numQuestions} прашања. Типови: ${questionTypes.join(', ')}. Ниво на диференцијација: ${diffDesc}.${bloomPart}${selfAssessmentPart}${workedExamplePart}${gradeLevelPrompt}${geometryPart}${statisticsPart}${dokPart} За секое прашање задолжително наведи 'cognitiveLevel' (Remembering/Understanding/Applying/Analyzing/Evaluating/Creating) и 'difficulty_level' (Easy/Medium/Hard). Ако темата е за дропки, барем еден од следниве термини мора експлицитно да се појави во прашањето или одговорот: "дропка", "собирање", "одземање".${safeCustomInstruction ? ` ${safeCustomInstruction}` : ''}`;
      // @prompt-end: assessment_test
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, alignment_goal: { type: Type.STRING }, selfAssessmentQuestions: { type: Type.ARRAY, items: { type: Type.STRING } }, questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, question: { type: Type.STRING }, options: { type: Type.ARRAY, items: { type: Type.STRING } }, answer: { type: Type.STRING }, solution: { type: Type.STRING }, svgDiagram: { type: Type.STRING }, tableData: { type: Type.OBJECT, properties: { headers: { type: Type.ARRAY, items: { type: Type.STRING } }, rows: { type: Type.ARRAY, items: { type: Type.ARRAY, items: {} } }, caption: { type: Type.STRING } } }, isWorkedExample: { type: Type.BOOLEAN }, workedExampleType: { type: Type.STRING }, cognitiveLevel: { type: Type.STRING }, difficulty_level: { type: Type.STRING }, concept_evaluated: { type: Type.STRING }, dokLevel: { type: Type.INTEGER } }, required: ["type", "question", "answer", "cognitiveLevel", "dokLevel"] } } }, required: ["title", "questions"] };

    const canCache = !customInstruction && !studentProfiles?.length && differentiationLevel === 'standard' && !image && !isGeometry && !isStatistics;
    const conceptCacheId = context.concepts?.[0]?.id || 'gen';
    const cacheKey = canCache ? `assessment_${type}_${conceptCacheId}_g${context.grade.level}_${[...questionTypes].sort().join('_')}_n${numQuestions}` : '';
    
    if (canCache && cacheKey) {
        const cached = await getCached<AIGeneratedAssessment>(cacheKey);
        if (cached) return cached;
    }

    const fewShotPart = await fetchFewShotExamples(conceptCacheId, context.grade.level, context.topic?.id);

    const contents: Part[] = [{ text: prompt }, { text: `Контекст: ${JSON.stringify(minifyContext(context))}` }];
    if (fewShotPart) contents.push({ text: fewShotPart });
    if (image) contents.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } });

    // RAG INJECTION + Vector RAG semantic enrichment + secondary track context
    const vectorRagQuery = context.concepts?.length
        ? `${context.topic?.title ?? ''} ${context.concepts.map(c => `${c.title} ${c.description ?? ''}`).join(' ')}`.trim()
        : undefined;

    const systemInstr = await buildDynamicSystemInstruction(
        JSON_SYSTEM_INSTRUCTION,
        context.grade.level,
        conceptCacheId !== 'gen' ? conceptCacheId : undefined,
        context.topic?.id,
        profile?.secondaryTrack,
        vectorRagQuery,
    );

    const result = await generateAndParseJSON<AIGeneratedAssessment>(
        contents, 
        schema, 
        DEFAULT_MODEL, 
        AIGeneratedAssessmentSchema, 
        MAX_RETRIES, 
        false, 
        systemInstr,
      profile?.tier,
      { temperature: 0.2, topP: 0.9 }
    );
    const hardenedResult = reinforceFractionKeywords(result, context);
    
    if (canCache && cacheKey) {
      await setCached(cacheKey, hardenedResult, { type: 'assessment', conceptId: conceptCacheId !== 'gen' ? conceptCacheId : undefined, gradeLevel: context.grade.level });
    }
    return hardenedResult;
  },

async generateABCTest(
  numQuestions: number,
  context: GenerationContext,
  profile?: TeachingProfile,
): Promise<{ a: AIGeneratedAssessment; b: AIGeneratedAssessment; c: AIGeneratedAssessment }> {
  const [a, b, c] = await Promise.all([
    this.generateAssessment(
      'ASSESSMENT',
      [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER],
      numQuestions,
      context,
      profile,
      'support',
      undefined,
      undefined,
      'ВАРИЈАНТА А — ПОДДРШКА: Едноставни прашања со детални упатства. Нека бидат постепени, со многу структура.',
    ),
    this.generateAssessment(
      'ASSESSMENT',
      [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER],
      numQuestions,
      context,
      profile,
      'standard',
      undefined,
      undefined,
      'ВАРИЈАНТА Б — СТАНДАРДНО: Прашања на просечно ниво без дополнителни помагала.',
    ),
    this.generateAssessment(
      'ASSESSMENT',
      [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER, QuestionType.ESSAY],
      numQuestions,
      context,
      profile,
      'advanced',
      undefined,
      undefined,
      'ВАРИЈАНТА В — НАПРЕДНО: Предизвикувачки прашања со повеќечекорно решавање, апликација во реален контекст и критичко размислување.',
    ),
  ]);
  return { a, b, c };
},

async generateExitTicket(numQuestions: number, focus: string, context: GenerationContext, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedAssessment> {
    const safeFocus = sanitizePromptInput(focus, 200);
    const safeExtra = sanitizePromptInput(customInstruction);
    return this.generateAssessment('ASSESSMENT', [QuestionType.SHORT_ANSWER], numQuestions, context, profile, 'standard', undefined, undefined, `Фокус: ${safeFocus}.${safeExtra ? ` ${safeExtra}` : ''}`);
  },

async generateExamVariants(
  numQuestions: number,
  context: GenerationContext,
  profile?: TeachingProfile,
): Promise<{ A: AIGeneratedAssessment; B: AIGeneratedAssessment; V: AIGeneratedAssessment; G: AIGeneratedAssessment }> {
  const variantInstructions = [
    'ВАРИЈАНТА А: Стандардно ниво. Различен редослед на прашањата и различни броеви/вредности.',
    'ВАРИЈАНТА Б: Стандардно ниво. Различен редослед на прашањата и различни броеви/вредности.',
    'ВАРИЈАНТА В: Стандардно ниво. Различен редослед на прашањата и различни броеви/вредности.',
    'ВАРИЈАНТА Г: Стандардно ниво. Различен редослед на прашањата и различни броеви/вредности.',
  ];
  const [A, B, V, G] = await Promise.all(
    variantInstructions.map(instr =>
      this.generateAssessment(
        'ASSESSMENT',
        [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER, QuestionType.ESSAY],
        numQuestions,
        context,
        profile,
        'standard',
        undefined,
        undefined,
        instr,
      ),
    ),
  );
  return { A, B, V, G };
},

async gradeExamResponses(
  questions: Array<{ id: string; question: string; answer: string; points: number }>,
  answers: Record<string, string>,
): Promise<{ questionId: string; correct: boolean; points: number; feedback: string }[]> {
  const pairs = questions.map((q, i) => ({
    questionId: q.id,
    questionIndex: i,
    question: q.question,
    correctAnswer: q.answer,
    studentAnswer: answers[`q${i}`] ?? '',
    maxPoints: q.points,
  }));

  const prompt = `Оцени ги следните одговори на ученикот на матемтички испит. За секој одговор врати: correct (boolean), points (0 до maxPoints), feedback (кратко 1 реченица на македонски). Одговори само со валиден JSON array.

Прашања и одговори:
${JSON.stringify(pairs, null, 2)}`;

  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        questionId: { type: Type.STRING },
        correct: { type: Type.BOOLEAN },
        points: { type: Type.NUMBER },
        feedback: { type: Type.STRING },
      },
      required: ['questionId', 'correct', 'points', 'feedback'],
    },
  };

  try {
    const result = await generateAndParseJSON<{ questionId: string; correct: boolean; points: number; feedback: string }[]>(
      [{ text: prompt }],
      schema,
      DEFAULT_MODEL,
      undefined,
      2,
    );
    return Array.isArray(result) ? result : [];
  } catch {
    return questions.map(q => ({ questionId: q.id, correct: false, points: 0, feedback: 'Не може да се оцени автоматски.' }));
  }
},
};
