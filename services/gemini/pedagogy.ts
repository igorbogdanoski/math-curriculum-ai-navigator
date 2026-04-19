import { logger } from '../../utils/logger';
import {
    Concept, TeachingProfile, AIGeneratedIllustration, AIGeneratedLearningPaths,
    GenerationContext, StudentProfile, AIGeneratedRubric, LessonPlan,
    AIPedagogicalAnalysis, CoverageAnalysisReport, NationalStandard, AIRecommendation,
} from '../../types';
import {
    Type, DEFAULT_MODEL, LITE_MODEL, MAX_RETRIES, generateAndParseJSON, CACHE_COLLECTION,
    SAFETY_SETTINGS, callGeminiProxy, callImagenProxy, IMAGEN_MODEL,
    getCached, setCached, minifyContext, sanitizePromptInput,
    getResolvedTextSystemInstruction, getSecondaryTrackContext,
} from './core';
import {
    AIGeneratedLearningPathsSchema, AIGeneratedRubricSchema, AIPedagogicalAnalysisSchema,
    CoverageAnalysisSchema, AIRecommendationSchema, ReflectionSummarySchema,
} from '../../utils/schemas';
import { shouldUseLiteModel, logRouterDecision } from './intentRouter';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebaseConfig';
import { AIServiceError } from '../../utils/errors';

export const pedagogyAPI = {

async generateIllustration(prompt: string, image?: { base64: string, mimeType: string }, _profile?: TeachingProfile): Promise<AIGeneratedIllustration> {
    const safePrompt = sanitizePromptInput(prompt, 500);
    if (!image) {
      const cacheKey = `img_cache_${safePrompt.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 120)}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { imageUrl: string; ts: number };
          if (Date.now() - parsed.ts < 7 * 24 * 60 * 60 * 1000) return { imageUrl: parsed.imageUrl, prompt: safePrompt };
          localStorage.removeItem(cacheKey);
        }
      } catch { /* ignore storage errors */ }

      const response = await callImagenProxy({ model: IMAGEN_MODEL, prompt: safePrompt });
      if (response.inlineData) {
        const { data: base64Data, mimeType } = response.inlineData;
        const storagePath = `ai_illustrations/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, base64Data, 'base64', { contentType: mimeType });
        const imageUrl = await getDownloadURL(storageRef);
        try { localStorage.setItem(cacheKey, JSON.stringify({ imageUrl, ts: Date.now() })); } catch { /* quota exceeded */ }
        return { imageUrl, prompt: safePrompt };
      }
      throw new AIServiceError('AI did not return image data (Gemini Flash path)');
    }

    const response = await callImagenProxy({ model: IMAGEN_MODEL, prompt: safePrompt });
    if (response.inlineData) {
        const data = response.inlineData;
        const storagePath = `ai_illustrations/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.png`;
        const storageRef = ref(storage, storagePath);
        await uploadString(storageRef, data.data, 'base64', { contentType: data.mimeType });
        const imageUrl = await getDownloadURL(storageRef);
        return { imageUrl, prompt: safePrompt };
    }
    throw new AIServiceError('AI did not return image (Imagen path)');
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
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, paths: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { profileName: { type: Type.STRING }, steps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { stepNumber: { type: Type.INTEGER }, activity: { type: Type.STRING }, type: { type: Type.STRING } }, required: ['stepNumber', 'activity'] } } }, required: ['profileName', 'steps'] } } }, required: ['title', 'paths'] };
    return generateAndParseJSON<AIGeneratedLearningPaths>([{ text: prompt }, { text: JSON.stringify(minifyContext(context)) }], schema, DEFAULT_MODEL, AIGeneratedLearningPathsSchema, MAX_RETRIES, false, undefined, profile?.tier);
  },

async generateInfographicLayout(plan: Partial<LessonPlan>, profile?: TeachingProfile): Promise<import('../../types').InfographicLayout> {
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
        title: { type: Type.STRING }, grade: { type: Type.STRING }, subject: { type: Type.STRING },
        keyMessage: { type: Type.STRING },
        objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
        sections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { heading: { type: Type.STRING }, icon: { type: Type.STRING }, points: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['heading', 'icon', 'points'] } },
        vocabulary: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { term: { type: Type.STRING }, definition: { type: Type.STRING } }, required: ['term', 'definition'] } },
        palette: { type: Type.STRING },
      },
      required: ['title', 'grade', 'subject', 'keyMessage', 'objectives', 'sections', 'vocabulary', 'palette'],
    };
    return generateAndParseJSON<import('../../types').InfographicLayout>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false, undefined, profile?.tier);
  },

async generateRubric(gradeLevel: number, activityTitle: string, activityType: string, _criteriaHints: string, _profile?: TeachingProfile, customInstruction?: string): Promise<AIGeneratedRubric> {
    const prompt = `Креирај рубрика за ${activityTitle} (${activityType}). ${customInstruction || ''}`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, criteria: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { criterion: { type: Type.STRING }, levels: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { levelName: { type: Type.STRING }, description: { type: Type.STRING }, points: { type: Type.STRING } }, required: ['levelName', 'description'] } } }, required: ['criterion', 'levels'] } } }, required: ['title', 'criteria'] };

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
    const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ parts: [{ text: prompt }] }], systemInstruction: getResolvedTextSystemInstruction(), safetySettings: SAFETY_SETTINGS, userTier: profile?.tier });
    const text = response.text || '';
    await setCached(cacheKey, text, { type: 'outline', conceptId: concept.id, gradeLevel });
    return text;
  },

async enhanceText(textToEnhance: string, action: string, fieldType: string, gradeLevel: number, profile?: TeachingProfile): Promise<string> {
    const safeText = sanitizePromptInput(textToEnhance, 1500);
    const safeFieldType = sanitizePromptInput(fieldType, 60);
    const safeAction = sanitizePromptInput(action, 30).toLowerCase();
    let promptText = `Подобри го текстот за '${safeFieldType}' (${gradeLevel} одд). Оригинален текст: "${safeText}"`;
    switch (safeAction) {
        case 'simplify':  promptText = `Поедностави го следниот текст за '${safeFieldType}' (${gradeLevel} одд) за да биде полесен за разбирање: "${safeText}"`; break;
        case 'shorten':   promptText = `Скрати го и сумирај го следниот текст за '${safeFieldType}' (${gradeLevel} одд), задржувајќи ја клучната поента: "${safeText}"`; break;
        case 'expand':    promptText = `Направи го поинтересен, поопширен и подетален следниот текст за '${safeFieldType}' (${gradeLevel} одд): "${safeText}"`; break;
        case 'inclusion': promptText = `Прилагоди го следниот текст за '${safeFieldType}' (${gradeLevel} одд) за ученици со попреченост (инклузија), додавајќи соодветни лесни чекори: "${safeText}"`; break;
        default:          promptText = `Професионализирај го и подобри го следниот текст за '${safeFieldType}' (${gradeLevel} одд) во контекст на наставна подготовка: "${safeText}"`; break;
    }
    const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ parts: [{ text: `${promptText}. Врати САМО преработен текст, без дополнителни воведи или објаснувања.` }] }], systemInstruction: getResolvedTextSystemInstruction(), safetySettings: SAFETY_SETTINGS, userTier: profile?.tier });
    return response.text || '';
  },

async analyzeConceptPedagogically(concept: Concept, priorTitles: string[], futureTitles: string[]): Promise<{ bloomLevel: string; bloomDetails: string; misconceptions: string[]; pedagogicalBridge: string; diagnosticQuestion: string }> {
    const { checkDailyQuotaGuard: guard } = await import('./core');
    guard();
    const priorStr = priorTitles.length ? priorTitles.join(', ') : 'нема дефинирани предуслови';
    const futureStr = futureTitles.length ? futureTitles.join(', ') : 'нема дефинирани следни теми';
    const prompt = `Си педагошки експерт за македонски основношколски наставни програми по математика.
Анализирај го следниот концепт и врати структуриран одговор на македонски јазик.

КОНЦЕПТ: "${concept.title}"
ОПИС: "${concept.description || 'нема опис'}"
ПРЕДЗНАЕЊЕ (мора да се знае пред): ${priorStr}
СЛЕДНИ ТЕМИ (се гради врз ова): ${futureStr}

Врати структуриран JSON со: bloomLevel, bloomDetails, misconceptions (array), pedagogicalBridge, diagnosticQuestion.`;
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
    return generateAndParseJSON<{ bloomLevel: string; bloomDetails: string; misconceptions: string[]; pedagogicalBridge: string; diagnosticQuestion: string }>([{ text: prompt }], schema, DEFAULT_MODEL, undefined, MAX_RETRIES, false);
  },

async analyzeLessonPlan(plan: Partial<LessonPlan>, _profile?: TeachingProfile): Promise<AIPedagogicalAnalysis> {
    const prompt = `Направи педагошка анализа на подготовка за час.`;
    const schema = { type: Type.OBJECT, properties: { pedagogicalAnalysis: { type: Type.OBJECT, properties: { overallImpression: { type: Type.STRING }, alignment: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, engagement: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } }, cognitiveLevels: { type: Type.OBJECT, properties: { status: { type: Type.STRING }, details: { type: Type.STRING } } } } } }, required: ['pedagogicalAnalysis'] };
    return generateAndParseJSON<AIPedagogicalAnalysis>([{ text: prompt }, { text: `План: ${JSON.stringify(plan)}` }], schema, DEFAULT_MODEL, AIPedagogicalAnalysisSchema, MAX_RETRIES, false);
  },

async generateProactiveSuggestion(concept: Concept, _profile?: TeachingProfile): Promise<string> {
    const prompt = `Генерирај проактивен предлог за "${concept.title}".`;
    const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ parts: [{ text: prompt }] }], systemInstruction: getResolvedTextSystemInstruction(), safetySettings: SAFETY_SETTINGS });
    return response.text || '';
  },

async analyzeReflection(wentWell: string, challenges: string, _profile?: TeachingProfile): Promise<string> {
    const safeWentWell = sanitizePromptInput(wentWell, 800);
    const safeChallenges = sanitizePromptInput(challenges, 800);
    const prompt = `Анализирај рефлексија: "${safeWentWell}". Предизвици: "${safeChallenges}".`;
    const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ parts: [{ text: prompt }] }], systemInstruction: getResolvedTextSystemInstruction(), safetySettings: SAFETY_SETTINGS });
    return response.text || '';
  },

async generateReflectionQuestions(lessonTitle: string, grade: number, theme: string): Promise<{ wentWell: string; challenges: string; nextSteps: string }> {
    const safeLessonTitle = sanitizePromptInput(lessonTitle, 160);
    const safeTheme = sanitizePromptInput(theme, 160);
    const prompt = `Наставникот штотуку одржа час "${safeLessonTitle}" (${grade} одд., тема: ${safeTheme}).\nГенерирај конкретни рефлексивни прашања кои ќе му помогнат да размисли за часот.\nСекое поле треба да биде 1-2 насочувачки прашања (не одговори).\nВрати JSON: { "wentWell": "Кои активности беа успешни?...", "challenges": "Кај кои концепти учениците имаа потешкотии?...", "nextSteps": "Кои конкретни промени би ги направиле следниот пат?..." }`;
    const schema = { type: Type.OBJECT, properties: { wentWell: { type: Type.STRING }, challenges: { type: Type.STRING }, nextSteps: { type: Type.STRING } }, required: ['wentWell', 'challenges', 'nextSteps'] };
    return generateAndParseJSON<{ wentWell: string; challenges: string; nextSteps: string }>([{ text: prompt }], schema, DEFAULT_MODEL, ReflectionSummarySchema);
  },

async analyzeCoverage(_lessonPlans: LessonPlan[], _allNationalStandards: NationalStandard[]): Promise<CoverageAnalysisReport> {
    const prompt = `Анализирај ја покриеноста на националните стандарди.`;
    const schema = { type: Type.OBJECT, properties: { analysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { gradeLevel: { type: Type.INTEGER }, coveredStandardIds: { type: Type.ARRAY, items: { type: Type.STRING } }, summary: { type: Type.STRING } }, required: ['gradeLevel', 'coveredStandardIds', 'summary'] } } }, required: ['analysis'] };
    return generateAndParseJSON<CoverageAnalysisReport>([{ text: prompt }], schema, DEFAULT_MODEL, CoverageAnalysisSchema);
  },

async getPersonalizedRecommendations(_profile: TeachingProfile, _lessonPlans: LessonPlan[]): Promise<AIRecommendation[]> {
    const prompt = `Генерирај 3 персонализирани препораки.`;
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, title: { type: Type.STRING }, recommendationText: { type: Type.STRING } }, required: ['category', 'title', 'recommendationText'] } };
    return generateAndParseJSON<AIRecommendation[]>([{ text: prompt }], schema, DEFAULT_MODEL, AIRecommendationSchema);
  },

async parsePlannerInput(input: string): Promise<{ title: string; date: string; type: string; description: string }> {
    const safeInput = sanitizePromptInput(input, 600);
    const prompt = `Extract details: "${safeInput}".`;
    const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, date: { type: Type.STRING }, type: { type: Type.STRING }, description: { type: Type.STRING } }, required: ['title', 'date', 'type'] };
    const plannerModel = shouldUseLiteModel('planner_parse') ? LITE_MODEL : DEFAULT_MODEL;
    logRouterDecision('planner_parse', plannerModel);
    return generateAndParseJSON<{ title: string; date: string; type: string; description: string }>([{ text: prompt }], schema, plannerModel);
  },

async generateClassRecommendations(analyticsData: { totalAttempts: number; avgScore: number; passRate: number; weakConcepts: Array<{ conceptId: string; title: string; avgPct: number; attempts: number }>; masteredCount: number; inProgressCount: number; strugglingCount: number; uniqueStudentCount: number }): Promise<Array<{ priority: number; icon: string; title: string; explanation: string; actionLabel: string; differentiationLevel: 'support' | 'standard' | 'advanced'; conceptId?: string; conceptTitle?: string }>> {
    const weakList = analyticsData.weakConcepts.slice(0, 3).map(c => `"${c.title}" (просек ${c.avgPct}%, ${c.attempts} обид${c.attempts === 1 ? '' : 'и'})`).join('; ') || 'нема идентификувани слаби концепти';
    const prompt = `Ти си педагошки советник за математика (одд. 6-9, Македонија).\nКласата има следните реални резултати:\n- Вкупно обиди: ${analyticsData.totalAttempts}\n- Просечен резултат: ${analyticsData.avgScore.toFixed(1)}%\n- Стапка на положување (≥70%): ${analyticsData.passRate.toFixed(1)}%\n- Слаби концепти (под 70%): ${weakList}\n- Совладани концепти: ${analyticsData.masteredCount}\n- Во напредок (streak): ${analyticsData.inProgressCount}\n- Потребна помош (повеќе обиди, нема напредок): ${analyticsData.strugglingCount}\n- Различни ученици: ${analyticsData.uniqueStudentCount}\n\nГенерирај точно 3 конкретни, акциски педагошки препораки за СЛЕДНИОТ ЧАС/НЕДЕЛА.\nВрати JSON array со 3 елементи.`;
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { priority: { type: Type.INTEGER }, icon: { type: Type.STRING }, title: { type: Type.STRING }, explanation: { type: Type.STRING }, actionLabel: { type: Type.STRING }, differentiationLevel: { type: Type.STRING }, conceptId: { type: Type.STRING }, conceptTitle: { type: Type.STRING } }, required: ['priority', 'icon', 'title', 'explanation', 'actionLabel', 'differentiationLevel'] } };
    return generateAndParseJSON<Array<{ priority: number; icon: string; title: string; explanation: string; actionLabel: string; differentiationLevel: 'support' | 'standard' | 'advanced'; conceptId?: string; conceptTitle?: string }>>([{ text: prompt }], schema, DEFAULT_MODEL);
  },

async generateDifferentiationActivities(title: string, grade: number, theme: string, objectives: string[]): Promise<{ support: string[]; standard: string[]; advanced: string[] }> {
    const { checkDailyQuotaGuard: guard } = await import('./core');
    guard();
    const safeTitle = sanitizePromptInput(title, 200);
    const safeTheme = sanitizePromptInput(theme, 200);
    const objList = objectives.slice(0, 5).map(o => `- ${sanitizePromptInput(o, 150)}`).join('\n') || '- (без цели)';
    const prompt = `Ти си искусен наставник по математика во македонско основно образование.\nПодготвуваш час за одделение ${grade}:\nНаслов: „${safeTitle}"\nТема: „${safeTheme}"\nЦели:\n${objList}\n\nГенерирај 3 конкретни активности за секое ниво на диференцијација.\nВрати JSON со клучеви "support", "standard", "advanced" — секој е низа од 3 стринга.`;
    const schema = { type: Type.OBJECT, properties: { support: { type: Type.ARRAY, items: { type: Type.STRING } }, standard: { type: Type.ARRAY, items: { type: Type.STRING } }, advanced: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['support', 'standard', 'advanced'] };
    const result = await generateAndParseJSON<{ support: string[]; standard: string[]; advanced: string[] }>([{ text: prompt }], schema, LITE_MODEL);
    return { support: result.support?.slice(0, 3) ?? [], standard: result.standard?.slice(0, 3) ?? [], advanced: result.advanced?.slice(0, 3) ?? [] };
  },

async suggestNextLessons(recentLessons: Array<{ title: string; date: string; description?: string }>): Promise<Array<{ title: string; description: string; conceptHint: string }>> {
    if (recentLessons.length === 0) return [];
    const lessonsText = recentLessons.map(l => `- ${l.date}: ${l.title}${l.description ? ` (${l.description.slice(0, 80)})` : ''}`).join('\n');
    const prompt = `Си наставник по математика. Последните лекции во планот беа:\n${lessonsText}\n\nВрз основа на оваа прогресија, предложи 3 логични теми за следната недела.\nОдговори само во JSON формат.`;
    const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, conceptHint: { type: Type.STRING } }, required: ['title', 'description', 'conceptHint'] } };
    try {
      const result = await generateAndParseJSON<Array<{ title: string; description: string; conceptHint: string }>>([{ text: prompt }], schema, DEFAULT_MODEL);
      return Array.isArray(result) ? result.slice(0, 3) : [];
    } catch {
      return [];
    }
  },

async generateSmartQuizTitle(material: Record<string, unknown>): Promise<string> {
    try {
      const { checkDailyQuotaGuard: guard } = await import('./core');
      guard();
      const questions: string[] = [];
      const nestedContent = typeof material?.content === 'object' && material.content !== null ? (material.content as Record<string, unknown>).questions : undefined;
      const content = material?.questions ?? material?.items ?? nestedContent ?? [];
      for (const q of Array.isArray(content) ? content.slice(0, 5) : []) {
        const text = (q as Record<string, unknown>)?.question || (q as Record<string, unknown>)?.text || '';
        if (text) questions.push(text as string);
      }
      if (questions.length === 0) return '';
      const snippet = questions.slice(0, 3).join(' | ');
      const prompt = `Дадени се прашања од квиз за математика:\n${snippet}\n\nНапиши само кус наслов (максимум 8 зборови) на македонски, кој го опишува темата на квизот. НЕ пишувај ништо друго — само насловот.`;
      const useLite = shouldUseLiteModel('quiz_title');
      const titleModel = useLite ? LITE_MODEL : DEFAULT_MODEL;
      logRouterDecision('quiz_title', titleModel);
      const response = await callGeminiProxy({ model: titleModel, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 30 }, skipTierOverride: useLite });
      const title = response.text.trim().replace(/^["'„]|["'"]$/g, '').trim();
      return title.length > 3 ? title : '';
    } catch {
      return '';
    }
  },

async generateEmbedding(text: string): Promise<number[]> {
    const { callEmbeddingProxy } = await import('./core');
    return callEmbeddingProxy(text);
  },

async translateLibraryEntry(entry: { question: string; options?: string[]; answer: string; solution?: string }, targetLang: 'sq' | 'tr' | 'en'): Promise<{ question: string; options?: string[]; answer: string; solution?: string }> {
    const LANG_NAMES: Record<string, string> = {
      sq: 'Albanian (Shqip) — with cultural adaptation for Albanian-speaking students in North Macedonia',
      tr: 'Turkish (Türkçe) — with cultural adaptation for Turkish-speaking students in North Macedonia',
      en: 'English — standard international mathematical English',
    };
    const payload = { question: entry.question, ...(entry.options?.length ? { options: entry.options } : {}), answer: entry.answer, ...(entry.solution ? { solution: entry.solution } : {}) };
    const prompt = `Translate this math question from Macedonian to ${LANG_NAMES[targetLang]}.\nKeep mathematical notation, numbers, and formulas exactly as-is.\nReturn ONLY a valid JSON object with the same keys as the input, translated values only.\n\nInput:\n${JSON.stringify(payload, null, 2)}`;
    const result = await callGeminiProxy({ model: DEFAULT_MODEL, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } });
    const parsed = JSON.parse(result.text || '{}') as typeof payload;
    if (!parsed.question || !parsed.answer) throw new Error('Incomplete translation response');
    return { question: parsed.question, options: parsed.options, answer: parsed.answer, solution: parsed.solution };
  },

};
