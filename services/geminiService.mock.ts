
import type { ChatMessage, Concept, Topic, AIGeneratedAssessment, AIGeneratedIdeas, TeachingProfile, Grade, PlannerItem, LessonPlan, AIGeneratedThematicPlan, AIGeneratedRubric, GenerationContext, CoverageAnalysisReport, NationalStandard, AIRecommendation, DifferentiationLevel, AssessmentQuestion, LessonReflection, StudentProfile, AIPedagogicalAnalysis, AIGeneratedLearningPaths, AIGeneratedIllustration, AIGeneratedPracticeMaterial, LearningPathStep } from '../types';
// FIX: Changed import from 'import type' to a value import for enums used as values.
import { PlannerItemType, QuestionType } from '../types';

// NOTE: This is a mock implementation for frontend demonstration purposes.

const MOCK_LATENCY = 1500;

const pythagoreanQuestions: AssessmentQuestion[] = [
    { type: "MULTIPLE_CHOICE", question: "Која страна е наспроти правиот агол во правоаголен триаголник?", options: ["Катета", "Хипотенуза", "Тежишна линија"], answer: "Хипотенуза", cognitiveLevel: 'Remembering', difficulty_level: 'Easy', concept_evaluated: 'Дефиниција на хипотенуза', alignment_justification: 'Прашањето директно го проверува препознавањето на клучните елементи на правоаголниот триаголник.'},
    { type: "SHORT_ANSWER", question: "Во правоаголен триаголник, хипотенузата е $c=13$, а едната катета е $a=5$. Пресметај ја должината на другата катета $b$.", answer: "$b=12$", cognitiveLevel: 'Applying', difficulty_level: 'Medium', concept_evaluated: 'Примена на Питагорова теорема', alignment_justification: 'Бара директна примена на формулата за наоѓање на катета.' },
    { type: "TRUE_FALSE", question: "Формулата $a^2 + b^2 = c^2$ важи за секој триаголник.", answer: "false", cognitiveLevel: 'Understanding', difficulty_level: 'Easy', concept_evaluated: 'Услов за Питагорова теорема', alignment_justification: 'Проверува дали ученикот го разбира основниот услов за примена на теоремата.' },
    { type: "SHORT_ANSWER", question: "Ако катетите се $a=8$ и $b=15$, колку е хипотенузата $c$?", answer: "$c=17$", cognitiveLevel: 'Applying', difficulty_level: 'Medium', concept_evaluated: 'Примена на Питагорова теорема', alignment_justification: 'Стандардна задача за пресметување на хипотенуза.' },
    { type: "MULTIPLE_CHOICE", question: "Кој од следниве триаголници НЕ Е правоаголен?", options: ["Страни: 3, 4, 5", "Страни: 5, 12, 13", "Страни: 6, 7, 8"], answer: "Страни: 6, 7, 8", cognitiveLevel: 'Analyzing', difficulty_level: 'Hard', concept_evaluated: 'Обратна Питагорова теорема', alignment_justification: 'Бара од ученикот да ја анализира и провери теоремата за повеќе случаи.' },
    { type: "ESSAY", question: "Објасни со свои зборови зошто Питагоровата теорема важи само за правоаголни триаголници. Вклучи и цртеж во твоето објаснување.", answer: "Одговорот треба да вклучува дискусија за дефиницијата на катети и хипотенуза и визуелен доказ кој покажува дека збирот на плоштините на квадратите над катетите е еднаков на плоштината на квадратот над хипотенузата.", cognitiveLevel: 'Evaluating', difficulty_level: 'Hard', concept_evaluated: 'Длабоко разбирање на Питагорова теорема', alignment_justification: 'Бара од ученикот да синтетизира знаење и да го објасни концептот, што е повисоко когнитивно ниво.'},
    { type: "FILL_IN_THE_BLANK", question: "Во правоаголен триаголник, збирот од квадратите на __________ е еднаков на квадратот на __________.", answer: "катетите, хипотенузата", cognitiveLevel: 'Remembering', difficulty_level: 'Easy', concept_evaluated: 'Формулација на Питагорова теорема', alignment_justification: 'Директна проверка на познавањето на теоремата.' }
];

const roundingQuestions: AssessmentQuestion[] = [
    { type: "SHORT_ANSWER", question: "Заокружи го бројот 7,86 на една децимала.", answer: "7,9", cognitiveLevel: 'Applying', difficulty_level: 'Easy', alignment_justification: 'Прашањето ја тестира способноста за заокружување на децимални броеви на одреден степен на прецизност.' },
    { type: "TRUE_FALSE", question: "Бројот 149 заокружен на најблиската стотка е 200.", answer: "false", cognitiveLevel: 'Understanding', difficulty_level: 'Easy', alignment_justification: 'Проверува разбирање на правилата за заокружување на цели броеви.' },
    { type: "MULTIPLE_CHOICE", question: "Кој број е најблиску до 1000?", options: ["995", "1004", "990"], answer: "995", cognitiveLevel: 'Analyzing', difficulty_level: 'Medium', alignment_justification: 'Бара споредба на апсолутни разлики за да се најде најблискиот број.' },
    { type: "SHORT_ANSWER", question: "Заокружи го бројот 2453 на најблиската илјадарка.", answer: "2000", cognitiveLevel: 'Applying', difficulty_level: 'Medium', alignment_justification: 'Тестира заокружување на поголеми броеви.' },
];

const setsQuestions: AssessmentQuestion[] = [
    { type: "MULTIPLE_CHOICE", question: "Што претставува симболот $A \\cup B$?", options: ["Пресек на множества", "Унија на множества", "Разлика на множества"], answer: "Унија на множества", cognitiveLevel: 'Remembering', difficulty_level: 'Easy', alignment_justification: 'Го проверува познавањето на основните симболи за операции со множества.' },
    { type: "SHORT_ANSWER", question: "Ако $A = \\{1, 2, 3\\}$ и $B = \\{3, 4, 5\\}$, кое е множеството $A \\cap B$?", answer: "$\\{3\\}$", cognitiveLevel: 'Applying', difficulty_level: 'Easy', alignment_justification: 'Бара примена на дефиницијата за пресек на множества.' },
    { type: "TRUE_FALSE", question: "Празното множество е подмножество на секое множество.", answer: "true", cognitiveLevel: 'Understanding', difficulty_level: 'Medium', alignment_justification: 'Проверува разбирање на фундаментално својство на множествата.' },
];

async function* streamText(text: string) {
    const chunkSize = 20;
    for (let i = 0; i < text.length; i += chunkSize) {
        yield text.substring(i, i + chunkSize);
        await new Promise(res => setTimeout(res, 20)); // short delay for simulation
    }
}


/** Helper function to generate a mock assessment object */
function generateMockAssessment(context: any, numQuestions: number, type: 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS' | 'EXIT_TICKET', differentiationLevel: DifferentiationLevel, studentProfiles?: StudentProfile[], includeSelfAssessment?: boolean): Omit<AIGeneratedAssessment, 'error'> {
    let title = `Тест за ${context?.concepts?.map((c: Concept) => c.title).join(', ') || 'поимот'} (${context?.grade?.level} одд.)`;
    if (type === 'QUIZ') title = `Квиз за ${context?.concepts?.map((c: Concept) => c.title).join(', ') || 'поимот'}`;
    if (type === 'FLASHCARDS') title = `Флеш-картички за ${context?.concepts?.map((c: Concept) => c.title).join(', ') || 'поимот'}`;
    if (type === 'EXIT_TICKET') title = `Излезна картичка за ${context?.concepts?.map((c: Concept) => c.title).join(', ') || 'поимот'}`;
    
    let sampleQuestions: AssessmentQuestion[] = pythagoreanQuestions; // Default
    
    const contextString = JSON.stringify(context).toLowerCase();

    if (contextString.includes("заокружува") || contextString.includes("rounding")) {
        sampleQuestions = roundingQuestions;
        title = `Материјал за заокружување на броеви`;
    } else if (contextString.includes("питагор") || contextString.includes("pythagor")) {
        sampleQuestions = pythagoreanQuestions;
        title = `Материјал за Питагорова теорема`;
    } else if (contextString.includes("множеств") || contextString.includes("sets")) {
        sampleQuestions = setsQuestions;
        title = `Материјал за множества`;
    }

    if (context?.type === 'STANDARD') {
        title = `Материјал усогласен со стандард: ${context?.standard?.code}`;
    }
    if (context?.type === 'SCENARIO') {
        title = `Материјал за сценарио од час`;
    }
    if (context?.type === 'TOPIC') {
        title = `Тематски материјал за ${context?.topic?.title}`;
    }
    
    const questions = Array.from({ length: numQuestions }, (_, i) => sampleQuestions[i % sampleQuestions.length]);

    const result: AIGeneratedAssessment = {
        title: title,
        type: type === 'FLASHCARDS' ? 'FLASHCARDS' : type === 'QUIZ' ? 'QUIZ' : 'TEST',
        alignment_goal: `Проверка на знаењата за ${context?.concepts?.map((c: Concept) => c.title).join(', ') || 'поимот'}`,
        differentiationLevel: differentiationLevel,
        totalQuestions: numQuestions,
        questions: questions,
    };
    
    if (includeSelfAssessment) {
        result.selfAssessmentQuestions = [
            "Кое прашање ти беше најтешко и зошто?",
            "Што научи ново додека го решаваше овој тест?",
        ];
    }

    if (studentProfiles && studentProfiles.length > 0) {
        result.differentiatedVersions = studentProfiles.map(profile => {
            const differentiatedQuestions = JSON.parse(JSON.stringify(questions)); // Deep copy
            if (profile.description.toLowerCase().includes('поддршка')) {
                differentiatedQuestions[1].question = `(Полесна верзија) Хипотенузата е $c=5$, а катетата $a=3$. Колку е катетата $b$?`;
                differentiatedQuestions[1].answer = '$b=4$';
            }
            if (profile.description.toLowerCase().includes('визуелен')) {
                differentiatedQuestions[0].question = `(Визуелна верзија) Погледни го триаголникот. Како се вика најдолгата страна, означена со 'c'?`;
            }
            return {
                profileName: profile.name,
                questions: differentiatedQuestions,
            };
        });
    }

    return result;
}


/** Helper function to generate mock lesson ideas */
function generateMockLessonIdeas(context: any): Omit<AIGeneratedIdeas, 'error'> {
    return {
        title: `Предлог идеи за час за "${context?.conceptTitle || 'поимот'}" (${context?.gradeLevel} одд.)`,
        openingActivity: "Започнете го часот со брза игра „Најди го правоаголниот триаголник“ во училницата. Учениците бараат предмети што формираат правоаголни триаголници (агол на табла, книга, прозорец).",
        mainActivity: "Поделете ги учениците во групи и дајте им различни димензии на правоаголни триаголници исечени од картон. Нивна задача е да ја проверат Питагоровата теорема ($a^2 + b^2 = c^2$) со мерење на страните и пресметување.",
        differentiation: "За учениците на кои им треба поддршка, обезбедете работни листови со веќе нацртани триаголници и дадени должини на две страни. За напредните ученици, дајте им проблем од реалниот живот, на пр. „Колку е долга дијагоналата на еден ТВ екран од 50 инчи?“.",
        assessmentIdea: "Како излезна картичка, секој ученик добива задача да нацрта правоаголен триаголник со страни по свој избор и да докаже дека Питагоровата теорема важи за него."
    };
}

/** Helper function to generate a mock rubric */
function generateMockRubric(context: any): Omit<AIGeneratedRubric, 'error'> {
    return {
        title: `Рубрика за ${context?.activityTitle || 'Проектна задача'}`,
        criteria: [
            {
                criterion: "Математичка точност",
                levels: [
                    { levelName: "Напредно (5)", description: "Сите пресметки се точни и јасно прикажани.", points: "9-10" },
                    { levelName: "Развиено (3-4)", description: "Повеќето пресметки се точни, со мали грешки.", points: "6-8" },
                    { levelName: "Почетно (1-2)", description: "Има значителни грешки во пресметките.", points: "1-5" }
                ]
            },
            {
                criterion: "Примена на концепти",
                levels: [
                    { levelName: "Напредно (5)", description: "Концептите се применети правилно и во комплексен контекст.", points: "9-10" },
                    { levelName: "Развиено (3-4)", description: "Концептите се главно правилно применети.", points: "6-8" },
                    { levelName: "Почетно (1-2)", description: "Постои неразбирање во примената на концептите.", points: "1-5" }
                ]
            }
        ]
    };
}


// This is a simplified mock that doesn't need the full Gemini SDK.
const mockApiCall = async (prompt: string, context?: any): Promise<{ text: string }> => {
    console.log("Mock Gemini Call:", prompt, context);
    await new Promise(res => setTimeout(res, MOCK_LATENCY));

    if (prompt.includes("патеки за учење")) {
        const conceptTitle = context?.concepts?.[0] || context?.topic || 'избраниот концепт';
        const learningPaths: AIGeneratedLearningPaths = {
            title: `Патеки за учење за "${conceptTitle}"`,
            paths: context?.studentProfiles.map((p: StudentProfile) => {
                const steps: LearningPathStep[] = [
                    { stepNumber: 1, type: 'Introductory', activity: `Започни со краток воведен разговор за ${conceptTitle}.` },
                    { stepNumber: 2, type: 'Practice', activity: 'Реши 5 едноставни задачи од работниот лист.' },
                    { stepNumber: 3, type: 'Consolidation', activity: 'Направи резиме на наученото во 3 реченици.' },
                    { stepNumber: 4, type: 'Assessment', activity: 'Одговори на излезна картичка со 2 прашања.' }
                ];
                
                if (p.description.toLowerCase().includes('визуелен')) {
                    steps[0].activity = `Погледни кратко видео (2 мин) кое го објаснува ${conceptTitle} со анимации.`;
                    steps[1].activity = 'Нацртај дијаграм или мисловна мапа што го претставува концептот.';
                }
                if (p.description.toLowerCase().includes('поддршка')) {
                    steps[1].activity = 'Реши 3 задачи со дадени чекори и еден решен пример.';
                    steps[3].activity = 'Објасни го концептот на својот другар од клупата.';
                }
                if (p.description.toLowerCase().includes('напреден')) {
                     steps[2].activity = 'Истражи и најди еден реален проблем каде се применува овој концепт.';
                     steps[3].type = 'Project';
                     steps[3].activity = 'Креирај кратка презентација (1 слајд) за твојот истражен проблем.';
                }
    
                return {
                    profileName: p.name,
                    steps: steps
                };
            })
        };
        return { text: JSON.stringify(learningPaths) };
    }

    if (prompt.includes("тест") || prompt.includes("работен лист") || prompt.includes("квиз") || prompt.includes("флеш-картички") || prompt.includes("излезна картичка")) {
        const type = prompt.includes("квиз") ? 'QUIZ' : prompt.includes("флеш-картички") ? 'FLASHCARDS' : prompt.includes("излезна картичка") ? 'EXIT_TICKET' : 'ASSESSMENT';
        const assessment = generateMockAssessment(context, context?.numQuestions || 3, type, context?.differentiationLevel || 'standard', context?.studentProfiles, context?.includeSelfAssessment);
        return { text: JSON.stringify(assessment) };
    }
     if (prompt.includes("идеи за час")) {
        const ideas = generateMockLessonIdeas(context);
        return { text: JSON.stringify(ideas) };
    }
     if (prompt.includes("рубрика за оценување")) {
        const rubric = generateMockRubric(context);
        return { text: JSON.stringify(rubric) };
    }
     if (prompt.includes("задачи за вежбање") || prompt.includes("прашања за дискусија")) {
        const materialType = prompt.includes("задачи") ? 'problem' : 'question';
        const title = materialType === 'problem' ? `Задачи за вежбање за ${context.concept.title}` : `Прашања за дискусија за ${context.concept.title}`;
        const practiceMaterial: AIGeneratedPracticeMaterial = {
            title,
            items: [
                { type: materialType, text: `(Лесно) ${materialType === 'problem' ? 'Која е формулата за Питагорова теорема?' : 'Зошто Питагоровата теорема е важна?'}`, answer: materialType === 'problem' ? '$a^2 + b^2 = c^2$' : 'Се користи за мерење растојанија.' },
                { type: materialType, text: `(Средно) ${materialType === 'problem' ? 'Пресметај ја хипотенузата ако катетите се 5 и 12.' : 'Како би ја објасниле теоремата на помал ученик?'}`, answer: materialType === 'problem' ? '13' : 'Со цртање квадрати на страните.' },
                { type: materialType, text: `(Тешко) ${materialType === 'problem' ? 'Скалило долго 5м е потпрено на ѕид. Основата е 3м од ѕидот. Колку е високо?' : 'Дали теоремата важи во 3Д простор?'}`, answer: materialType === 'problem' ? '4м' : 'Да, за дијагонала на квадар.' }
            ]
        };
        return { text: JSON.stringify(practiceMaterial) };
    }

    if (prompt.includes("персонализирани препораки")) {
        const recommendations: AIRecommendation[] = [
            {
                category: "Нова Активност",
                title: "Интерактивна Геометрија",
                recommendationText: "Забележавме дека често предавате Геометрија. Пробајте ја активноста 'Лов на форми' надвор од училницата за да ја зголемите ангажираноста.",
                action: { label: "Генерирај идеја за час", path: "/generator?grade=8&topicId=g8-topic-geometry" }
            },
            {
                category: "Професионален Развој",
                title: "Истражувачка Настава",
                recommendationText: "Вашиот 'Конструктивистички' стил е одличен за истражувачка настава. Размислете за воведување на кратки истражувачки проекти за темата 'Работа со податоци'.",
            },
            {
                category: "Покриеност на Стандарди",
                title: "Фокус на Веројатност",
                recommendationText: "Според анализата, стандардот M-7-III-A.24 за веројатност е делумно покриен. Можеме да генерираме едноставен тест за да го проверите знаењето на учениците.",
                action: { label: "Креирај тест", path: "/generator?materialType=TEST" }
            }
        ];
        return { text: JSON.stringify(recommendations) };
    }

    return { text: `Како AI асистент за математика, подготвен сум да ви помогнам. Формулата за плоштина на круг е $A = \\pi r^2$. Забележав дека вашиот стил на настава е ${context?.profile?.style || 'недефиниран'}.` };
};


export const mockGeminiService = {
  generateLessonPlanIdeas: async function(concepts: Concept[], topic: Topic, gradeLevel: number, profile?: TeachingProfile, options?: { focus: string; tone: string; learningDesign?: string; }, customInstruction?: string): Promise<AIGeneratedIdeas> {
    const conceptTitle = concepts.map(c => c.title).join(', ');
    const context = { conceptTitle, gradeLevel };
    const ideas = generateMockLessonIdeas(context);
    await new Promise(res => setTimeout(res, 1000));
    return ideas;
  },
  generatePracticeMaterials: async function(concept: Concept, gradeLevel: number, materialType: 'problems' | 'questions'): Promise<AIGeneratedPracticeMaterial> {
    const prompt = materialType === 'problems' ? "Генерирај задачи за вежбање" : "Генерирај прашања за дискусија";
    const response = await mockApiCall(prompt, { concept, gradeLevel });
     try {
        return JSON.parse(response.text) as AIGeneratedPracticeMaterial;
    } catch(e) {
        return { 
            title: "Грешка", 
            items: [],
            error: "Не успеав да генерирам материјали. Ве молиме обидете се повторно." 
        };
    }
  },
  generateLearningPaths: async function(context: GenerationContext, studentProfiles: StudentProfile[], profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedLearningPaths> {
    const prompt = `Генерирај патеки за учење...`;
    const response = await mockApiCall(prompt, { ...context, studentProfiles, profile, customInstruction });
    try {
        return JSON.parse(response.text) as AIGeneratedLearningPaths;
    } catch(e) {
        return { 
            title: "Грешка", 
            paths: [],
            error: "Не успеав да генерирам патеки за учење. Ве молиме обидете се повторно." 
        };
    }
  },
  enhanceText: async function(textToEnhance: string, fieldType: string, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    console.log("Mocking text enhancement for:", { textToEnhance, fieldType, gradeLevel });
    await new Promise(res => setTimeout(res, 1200));
    const lines = textToEnhance.split('\n');
    const enhancedLines = lines.map(line => `[AI ПОДОБРЕНО]: ${line}`);
    return enhancedLines.join('\n');
  },
  
  async getChatResponse(history: ChatMessage[], profile?: TeachingProfile): Promise<string> {
    const lastMessage = history[history.length - 1]?.text || '';
    const response = await mockApiCall(lastMessage, { profile });
    return response.text;
  },

  async *getChatResponseStream(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }): AsyncGenerator<string, void, unknown> {
    const lastMessage = history[history.length - 1]?.text || '';
    // Mock processing attachment if present
    if (attachment) {
        console.log("Mock received attachment:", attachment.mimeType);
        yield "Примив слика. ";
        await new Promise(res => setTimeout(res, 500));
        yield "Анализирам... ";
        await new Promise(res => setTimeout(res, 500));
    }
    const response = await mockApiCall(lastMessage, { profile });
    yield* streamText(response.text);
  },
  
  async *generateDetailedLessonPlanStream(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): AsyncGenerator<string, void, unknown> {
    console.log("Mocking Streamed Detailed Lesson Plan Generation with context:", context);
    await new Promise(res => setTimeout(res, 500));
    
    let titlePrefix = '# [ГЕНЕРИРАНО]';
    if (context.type === 'CONCEPT') {
        titlePrefix += ` План за ${context.concepts?.map(c => c.title).join(', ')}`;
    } else if (context.type === 'STANDARD') {
        titlePrefix += ` План за стандард ${context.standard?.code}`;
    } else if (context.type === 'SCENARIO') {
        titlePrefix += ' План од твоја идеја';
    }
    
    const mockPlanText = `
${titlePrefix}

## Цели
- Учениците да ја разберат врската помеѓу страните на правоаголен триаголник (генерирано).
- Учениците да можат да ја формулираат Питагоровата теорема (генерирано).

## Сценарио
### Вовед
- Кратка дискусија за правоаголни триаголници (генерирано).
### Главни активности
- Визуелен доказ со сечење квадрати (генерирано).
- Решавање примери на табла (генерирано).
### Завршна активност
- Излезна картичка со една задача (генерирано).
`;
    yield* streamText(mockPlanText);
  },
  // FIX: Added mocks for functions that were missing and causing tests to fail.
  generateAssessment: async function(type: 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS', questionTypes: QuestionType[], numQuestions: number, context: GenerationContext, profile?: TeachingProfile, differentiationLevel: DifferentiationLevel = 'standard', studentProfiles?: StudentProfile[], image?: { base64: string, mimeType: string }, customInstruction?: string, includeSelfAssessment?: boolean): Promise<AIGeneratedAssessment> {
    const response = await mockApiCall(`генерирај ${type}`, { ...context, numQuestions, differentiationLevel, studentProfiles, includeSelfAssessment });
    try {
        return JSON.parse(response.text) as AIGeneratedAssessment;
    } catch(e) {
        return { title: 'Грешка', type: 'TEST', questions: [], error: 'Не успеав да генерирам assessment. Обидете се повторно.' };
    }
  },
  generateProactiveSuggestion: async function(concept: Concept, profile?: TeachingProfile): Promise<string> {
    return `За концептот "${concept.title}", пробајте да користите визуелна аналогија со скалило за да ја објасните Питагоровата теорема. [Сакаш да генерирам активност?]`;
  },
  generateAnnualPlan: async function(grade: Grade, startDate: string, endDate: string, holidays: string, winterBreak: {start: string, end: string}): Promise<Omit<PlannerItem, 'id'>[]> {
    console.log("Mock generating annual plan for grade", grade.level);
    await new Promise(res => setTimeout(res, 1000));
    return [
      {
        date: '2024-09-02',
        title: grade.topics[0].title,
        type: PlannerItemType.LESSON,
        description: `Почеток на темата ${grade.topics[0].title}`
      },
      {
        date: '2024-10-15',
        title: grade.topics[1].title,
        type: PlannerItemType.LESSON,
        description: `Почеток на темата ${grade.topics[1].title}`
      }
    ];
  },
  generateDetailedLessonPlan: async function(context: GenerationContext, profile?: TeachingProfile, image?: { base64: string, mimeType: string }): Promise<Partial<LessonPlan>> {
    console.log("Mocking Detailed Lesson Plan Generation with context:", context);
    await new Promise(res => setTimeout(res, 500));
    let title = `[ГЕНЕРИРАНО] План за ${context.concepts?.[0]?.title || context.topic?.title || 'час'}`;
    return {
      title: title,
      objectives: ['Цел 1 (генерирана)', 'Цел 2 (генерирана)'],
      assessmentStandards: ['Стандард 1 (генериран)'],
      scenario: {
          introductory: 'Вовед (генериран)',
          main: ['Главна активност 1 (генерирана)'],
          concluding: 'Заклучок (генериран)'
      },
      materials: ['Материјал 1 (генериран)'],
      progressMonitoring: ['Следење (генерирано)']
    };
  },
  generateThematicPlan: async function(grade: Grade, topic: Topic): Promise<AIGeneratedThematicPlan> {
    await new Promise(res => setTimeout(res, 1000));
    return {
        thematicUnit: topic.title,
        lessons: [
            { lessonNumber: 1, lessonUnit: `Вовед во ${topic.title}`, learningOutcomes: 'Учениците се запознаваат со основните поими.', keyActivities: 'Дискусија и примери.', assessment: 'Усно одговарање.'},
            { lessonNumber: 2, lessonUnit: `Продлабочување на ${topic.concepts[0]?.title || 'првиот поим'}`, learningOutcomes: 'Примена на концептот.', keyActivities: 'Работа во групи.', assessment: 'Работен лист.'},
        ]
    };
  },
  generateRubric: async function(gradeLevel: number, activityTitle: string, activityType: string, criteriaHints: string, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedRubric> {
    const context = { activityTitle };
    const rubric = generateMockRubric(context);
    await new Promise(res => setTimeout(res, 1000));
    return rubric;
  },
  analyzeLessonPlan: async function(plan: Partial<LessonPlan>, profile?: TeachingProfile): Promise<AIPedagogicalAnalysis> {
    await new Promise(res => setTimeout(res, 1000));
    return {
      pedagogicalAnalysis: {
        overallImpression: 'Подготовката е многу добро осмислена и ги следи модерните педагошки практики.',
        alignment: { status: 'Одлична', details: 'Целите, активностите и оценувањето се добро усогласени.' },
        engagement: { status: 'Високо ниво', details: 'Активностите се интерактивни и поттикнуваат ангажман.' },
        cognitiveLevels: { status: 'Добро избалансирани', details: 'Вклучени се прашања од различни когнитивни нивоа според Блумовата таксономија.' }
      }
    };
  },
  generateIllustration: async function(prompt: string, image?: { base64: string, mimeType: string }): Promise<AIGeneratedIllustration> {
      await new Promise(res => setTimeout(res, 1000));
      return {
          imageUrl: `https://via.placeholder.com/512x512.png?text=${encodeURIComponent(prompt.slice(0, 50))}`,
          prompt: prompt,
      };
  },
  analyzeReflection: async function(wentWell: string, challenges: string, profile?: TeachingProfile): Promise<string> {
    await new Promise(res => setTimeout(res, 1000));
    return `Одлична рефлексија! За предизвикот "${challenges}", пробајте да ја поделите задачата на помали чекори. [Сакаш да генерирам активност?]`;
  },
  analyzeCoverage: async function(lessonPlans: LessonPlan[], allNationalStandards: NationalStandard[]): Promise<CoverageAnalysisReport> {
    await new Promise(res => setTimeout(res, 1000));
    const grade6Standards = allNationalStandards.filter(s => s.gradeLevel === 6);
    return {
        analysis: [
            {
                gradeLevel: 6,
                coveredStandardIds: [grade6Standards[0]?.id].filter(Boolean) as string[],
                partiallyCoveredStandards: [{ id: grade6Standards[1]?.id, reason: 'Само вовед' }].filter(s => s.id) as any,
                uncoveredStandardIds: grade6Standards.slice(2).map(s => s.id),
                summary: 'Добра покриеност, но има простор за подобрување.',
                totalStandardsInGrade: grade6Standards.length
            }
        ]
    };
  },
  getPersonalizedRecommendations: async function(profile: TeachingProfile, lessonPlans: LessonPlan[]): Promise<AIRecommendation[]> {
    const response = await mockApiCall("персонализирани препораки", { profile, lessonPlans });
    return JSON.parse(response.text);
  },
  generateAnalogy: async function(concept: Concept, gradeLevel: number): Promise<string> {
    await new Promise(res => setTimeout(res, 1000));
    return `Замисли ја Питагоровата теорема како градење на куќа. Катетите $a$ и $b$ се темелите, а хипотенузата $c$ е покривот. Не можеш да го ставиш покривот ако немаш цврсти темели!`;
  },
  generatePresentationOutline: async function(concept: Concept, gradeLevel: number): Promise<string> {
    await new Promise(res => setTimeout(res, 1000));
    return `### Слајд 1: Вовед во ${concept.title}\\n- Што е тоа?\\n- Каде се користи?\\n\\n### Слајд 2: Формула\\n- $a^2 + b^2 = c^2$\\n- Објаснување на катети и хипотенуза\\n\\n### Слајд 3: Пример\\n- Решавање на едноставна задача`;
  },
  generateExitTicket: async function(numQuestions: number, focus: string, context: GenerationContext, profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedAssessment> {
    const assessment = generateMockAssessment(context, numQuestions, 'EXIT_TICKET', 'standard');
    return assessment;
  },
  // Added parsePlannerInput mock to match real service signature for consistency
  parsePlannerInput: async function(input: string): Promise<{ title: string; date: string; type: string; description: string }> {
    await new Promise(res => setTimeout(res, 500));
    return {
        title: "Mock Event from Voice",
        date: new Date().toISOString().split('T')[0],
        type: PlannerItemType.EVENT,
        description: `Transcribed text: ${input}`
    };
  }
};
