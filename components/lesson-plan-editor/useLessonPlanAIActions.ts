import { useCallback, useState, type RefObject } from 'react';
import type {
  LessonPlan, LessonScenario, AIPedagogicalAnalysis,
  GenerationContext, Grade, Topic, Concept,
  AIGeneratedIllustration, InfographicLayout, Curriculum, TeachingProfile,
} from '../../types';
import { geminiService } from '../../services/geminiService';
import { saveAICache, getAICache } from '../../services/indexedDBService';

interface Params {
  plan: Partial<LessonPlan>;
  setPlan: (updater: (prev: Partial<LessonPlan>) => Partial<LessonPlan>) => void;
  user: TeachingProfile | null;
  curriculum: Curriculum | null | undefined;
  isOnline: boolean;
  isMounted: RefObject<boolean>;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useLessonPlanAIActions({
  plan,
  setPlan,
  user,
  curriculum,
  isOnline,
  isMounted,
  addNotification,
}: Params) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIPedagogicalAnalysis | null>(null);
  const [isGeneratingIllustration, setIsGeneratingIllustration] = useState(false);
  const [generatedIllustration, setGeneratedIllustration] = useState<AIGeneratedIllustration | null>(null);
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
  const [infographicLayout, setInfographicLayout] = useState<InfographicLayout | null>(null);
  const [enhancingField, setEnhancingField] = useState<string | null>(null);
  const [diffActivities, setDiffActivities] = useState<{ support: string[]; standard: string[]; advanced: string[] } | null>(null);
  const [isGeneratingDiff, setIsGeneratingDiff] = useState(false);
  const [isRegeneratingSection, setIsRegeneratingSection] = useState<'introductory' | 'main' | 'concluding' | null>(null);

  const handleGenerateWithAI = useCallback(async (context: GenerationContext) => {
    if (!isOnline) { addNotification('Нема интернет конекција. Оваа функција е недостапна.', 'error'); return; }
    setIsGenerating(true);
    try {
      const generatedData = await geminiService.generateDetailedLessonPlan(context, user ?? undefined);
      if (isMounted.current) {
        setPlan((prev) => {
          const basePlan = { ...prev, ...generatedData };
          if (context.type === 'CONCEPT' || context.type === 'ACTIVITY') {
            basePlan.grade = prev.grade;
            basePlan.topicId = prev.topicId;
            basePlan.conceptIds = prev.conceptIds;
            basePlan.theme = prev.theme;
          } else if (context.type === 'STANDARD') {
            if (context.standard?.gradeLevel) {
              basePlan.grade = context.standard.gradeLevel;
              const gradeData = curriculum?.grades.find((g: Grade) => g.level === context.standard!.gradeLevel);
              if (gradeData) {
                const relevantTopic = gradeData.topics.find((t: Topic) => t.concepts.some((c: Concept) => c.nationalStandardIds?.includes(context.standard!.id)));
                basePlan.topicId = relevantTopic?.id || gradeData.topics[0]?.id || '';
                basePlan.theme = relevantTopic?.title || gradeData.topics[0]?.title || '';
              }
            }
          }
          return basePlan;
        });
        addNotification('AI успешно генерираше нацрт-подготовку!', 'success');
      }
    } catch (error) {
      if (isMounted.current) addNotification((error as Error).message, 'error');
    } finally {
      if (isMounted.current) setIsGenerating(false);
    }
  }, [user, curriculum, addNotification, isOnline, setPlan, isMounted]);

  const handleGenerateDifferentiation = useCallback(async () => {
    if (!plan.title && !plan.theme) return;
    setIsGeneratingDiff(true);
    setDiffActivities(null);
    try {
      const result = await geminiService.generateDifferentiationActivities(
        plan.title ?? '',
        plan.grade ?? 6,
        plan.theme ?? '',
        (plan.objectives ?? []).map(o => typeof o === 'string' ? o : o.text),
      );
      if (isMounted.current) setDiffActivities(result);
    } catch {
      // non-fatal
    } finally {
      if (isMounted.current) setIsGeneratingDiff(false);
    }
  }, [plan.title, plan.grade, plan.theme, plan.objectives, isMounted]);

  const handleEnhanceField = useCallback(async (
    fieldName: string,
    currentText: string,
    action: string = 'auto',
    selection?: { start: number; end: number },
  ) => {
    if (!isOnline) { addNotification('Нема интернет конекција. Оваа функција е недостапна.', 'error'); return; }
    if (!currentText || enhancingField) return;

    setEnhancingField(fieldName);
    try {
      const textToEnhance = selection ? currentText.substring(selection.start, selection.end) : currentText;
      const aiResult = await geminiService.enhanceText(textToEnhance, action, fieldName, plan.grade || 6, user ?? undefined);
      const enhancedText = selection ? currentText.substring(0, selection.start) + aiResult + currentText.substring(selection.end) : aiResult;

      if (isMounted.current) {
        setPlan((prev) => {
          const newPlan = { ...prev };
          if (fieldName === 'objectives') {
            newPlan.objectives = enhancedText.split('\n').filter(line => line.trim() !== '').map(text => ({ text }));
          } else if (fieldName === 'assessmentStandards' || fieldName === 'materials' || fieldName === 'progressMonitoring') {
            const key = fieldName as 'assessmentStandards' | 'materials' | 'progressMonitoring';
            newPlan[key] = enhancedText.split('\n').filter(line => line.trim() !== '');
          } else if (fieldName.startsWith('scenario.')) {
            const scenarioField = fieldName.split('.')[1] as keyof LessonPlan['scenario'];
            const scenario = { ...(newPlan.scenario || { introductory: { text: '' }, main: [], concluding: { text: '' } }) };
            if (scenarioField === 'main') {
              scenario.main = enhancedText.split('\n').filter(line => line.trim() !== '').map(text => ({ text, bloomsLevel: 'Understanding' }));
            } else if (scenarioField === 'introductory' || scenarioField === 'concluding') {
              scenario[scenarioField] = { text: enhancedText };
            }
            newPlan.scenario = scenario;
          } else {
            const key = fieldName as 'title' | 'subject' | 'theme' | 'differentiation' | 'reflectionPrompt' | 'selfAssessmentPrompt';
            newPlan[key] = enhancedText;
          }
          return newPlan;
        });
        addNotification(`Полето е успешно подобрено со AI!`, 'success');
      }
    } catch (error) {
      if (isMounted.current) addNotification((error as Error).message, 'error');
    } finally {
      if (isMounted.current) setEnhancingField(null);
    }
  }, [plan.grade, user, addNotification, enhancingField, isOnline, setPlan, isMounted]);

  const handleRegenerateSection = useCallback(async (section: 'introductory' | 'main' | 'concluding') => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }

    const cacheKey = `regen-${section}-${plan.topicId}-${plan.grade}`;
    const cachedData = await getAICache(cacheKey);

    if (cachedData) {
      setPlan((prev) => {
        const newPlan = { ...prev };
        const scenario = { ...(newPlan.scenario || { introductory: { text: '' }, main: [], concluding: { text: '' } }) };
        if (section === 'main') scenario.main = cachedData;
        else scenario[section] = cachedData;
        newPlan.scenario = scenario;
        return newPlan;
      });
      addNotification(`Вчитано од кеш!`, 'info');
      return;
    }

    setIsRegeneratingSection(section);
    try {
      const newData = await geminiService.regenerateLessonPlanSection(section, plan, '');
      await saveAICache(cacheKey, newData);
      if (isMounted.current) {
        setPlan((prev) => {
          const newPlan = { ...prev };
          const scenario = { ...(newPlan.scenario || { introductory: { text: '' }, main: [], concluding: { text: '' } }) };
          if (section === 'main') scenario.main = newData as LessonScenario['main'];
          else scenario[section] = newData as LessonScenario['introductory'];
          newPlan.scenario = scenario;
          return newPlan;
        });
        addNotification(`Секцијата е успешно регенерирана!`, 'success');
      }
    } catch (error) {
      if (isMounted.current) addNotification((error as Error).message, 'error');
    } finally {
      if (isMounted.current) setIsRegeneratingSection(null);
    }
  }, [plan, addNotification, isOnline, setPlan, isMounted]);

  const handleGenerateIllustration = useCallback(async (prompt: string) => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    setIsGeneratingIllustration(true);
    setGeneratedIllustration(null);
    try {
      const illustration = await geminiService.generateIllustration(`Наставна илустрација за математика: ${prompt}`);
      if (isMounted.current) {
        setGeneratedIllustration(illustration);
        setPlan((prev) => ({ ...prev, illustrationUrl: illustration.imageUrl }));
        addNotification('Илустрацијата е успешно генерирана!', 'success');
      }
    } catch (error) {
      if (isMounted.current) addNotification((error as Error).message, 'error');
    } finally {
      if (isMounted.current) setIsGeneratingIllustration(false);
    }
  }, [addNotification, isOnline, setPlan, isMounted]);

  const handleGenerateInfographic = useCallback(async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (user?.tier !== 'Pro' && user?.tier !== 'Unlimited') { addNotification('Инфографиците се достапни само за Pro корисници.', 'warning'); return; }
    if (!plan?.title) { addNotification('Прво генерирајте подготовка пред да направите инфографик.', 'warning'); return; }
    setIsGeneratingInfographic(true);
    try {
      const layout = await geminiService.generateInfographicLayout(plan, user ?? undefined);
      if (isMounted.current) setInfographicLayout(layout);
    } catch (_error) {
      if (isMounted.current) addNotification('Грешка при генерирање на инфографикот.', 'error');
    } finally {
      if (isMounted.current) setIsGeneratingInfographic(false);
    }
  }, [plan, user, addNotification, isOnline, isMounted]);

  const handleAnalyze = useCallback(async () => {
    if (!isOnline) { addNotification('Нема интернет конекција. Оваа функција е недостапна.', 'error'); return; }
    if (!plan || !plan.title) { addNotification('Ве молиме пополнете ја подготовката пред да побарате анализа.', 'warning'); return; }
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
      const analysisResult = await geminiService.analyzeLessonPlan(plan, user ?? undefined);
      if (isMounted.current) setAiAnalysis(analysisResult);
    } catch (error) {
      if (isMounted.current) addNotification((error as Error).message, 'error');
    } finally {
      if (isMounted.current) setIsAnalyzing(false);
    }
  }, [plan, user, addNotification, isOnline, isMounted]);

  return {
    isGenerating,
    isAnalyzing,
    aiAnalysis,
    isGeneratingIllustration,
    generatedIllustration,
    setGeneratedIllustration,
    isGeneratingInfographic,
    infographicLayout,
    setInfographicLayout,
    enhancingField,
    diffActivities,
    isGeneratingDiff,
    isRegeneratingSection,
    handleGenerateWithAI,
    handleGenerateDifferentiation,
    handleEnhanceField,
    handleRegenerateSection,
    handleGenerateIllustration,
    handleGenerateInfographic,
    handleAnalyze,
  };
}
