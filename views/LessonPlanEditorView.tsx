import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import type { LessonPlan, AIPedagogicalAnalysis, GenerationContext, Grade, Topic, Concept } from '../types';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import { useAuth } from '../contexts/AuthContext';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useNavigation } from '../contexts/NavigationContext';
import { AIContextSelector } from '../components/lesson-plan-editor/AIContextSelector';
import { AIPedagogicalAnalysisDisplay } from '../components/lesson-plan-editor/AIPedagogicalAnalysisDisplay';
import { LessonPlanFormFields } from '../components/lesson-plan-editor/LessonPlanFormFields';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
import { LessonPlanDisplay } from '../components/planner/LessonPlanDisplay';


interface LessonPlanEditorViewProps {
  id?: string;
}

const initialPlanState: Partial<LessonPlan> = {
  title: '',
  grade: 6,
  topicId: '',
  conceptIds: [],
  subject: 'Математика',
  theme: '',
  lessonNumber: 1,
  objectives: [],
  assessmentStandards: [],
  scenario: { introductory: '', main: [], concluding: '' },
  materials: [],
  progressMonitoring: [],
  differentiation: '',
  reflectionPrompt: '1. Што помина добро на часот и зошто?\n2. Каде учениците имаа најголеми потешкотии и зошто?\n3. Што би променил/а следниот пат кога ќе го предавам овој час?',
  selfAssessmentPrompt: '',
};

const stringToArray = (str: string = '') => str.split('\n').filter(line => line.trim() !== '');

export const LessonPlanEditorView: React.FC<LessonPlanEditorViewProps> = ({ id }) => {
  const { navigate } = useNavigation();
  const { getLessonPlan, addLessonPlan, updateLessonPlan } = usePlanner();
  const { curriculum, isLoading: isCurriculumLoading } = useCurriculum();
  const { addNotification } = useNotification();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const [plan, setPlan] = useState<Partial<LessonPlan>>(initialPlanState);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIPedagogicalAnalysis | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [enhancingField, setEnhancingField] = useState<string | null>(null);
  
  // Ref to track mounted status for async operations
  const isMounted = useRef(true);

  const isEditing = useMemo(() => id !== undefined, [id]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (isCurriculumLoading || !curriculum) return;

    if (isEditing) {
      const existingPlan = getLessonPlan(id!);
      if (existingPlan) {
        setPlan(existingPlan);
      } else {
        addNotification(`Подготовката со ID ${id} не е пронајдена.`, 'error');
        navigate('/my-lessons');
      }
    } else {
        setPlan((currentPlan: Partial<LessonPlan>) => {
            if (currentPlan.topicId === '' && curriculum && curriculum.grades.length > 0) {
                const defaultGrade = curriculum.grades[0];
                const defaultTopic = defaultGrade?.topics[0];
                return {
                    ...initialPlanState,
                    grade: defaultGrade?.level || 6,
                    topicId: defaultTopic?.id || '',
                    theme: defaultTopic?.title || '',
                };
            }
            return currentPlan;
        });
    }
  }, [id, isEditing, getLessonPlan, navigate, addNotification, curriculum, isCurriculumLoading]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
            setIsExportMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleGenerateWithAI = useCallback(async (context: GenerationContext) => {
    if (!isOnline) {
        addNotification('Нема интернет конекција. Оваа функција е недостапна.', 'error');
        return;
    }
    setIsGenerating(true);
    try {
        const generatedData = await geminiService.generateDetailedLessonPlan(context, user ?? undefined);
        
        if (isMounted.current) {
            setPlan((prev: Partial<LessonPlan>) => {
                const basePlan = { ...prev, ...generatedData };
                // Preserve key context fields depending on generation source
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
                            const relevantTopic = gradeData.topics.find((t: Topic) => t.concepts.some((c: Concept) => c.nationalStandardIds.includes(context.standard!.id)));
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
        if (isMounted.current) {
            addNotification((error as Error).message, 'error');
        }
    } finally {
        if (isMounted.current) {
            setIsGenerating(false);
        }
    }
  }, [user, curriculum, addNotification, isOnline]);

  const handleEnhanceField = useCallback(async (fieldName: string, currentText: string) => {
    if (!isOnline) {
        addNotification('Нема интернет конекција. Оваа функција е недостапна.', 'error');
        return;
    }
    if (!currentText || enhancingField) return;

    setEnhancingField(fieldName);
    try {
        const enhancedText = await geminiService.enhanceText(currentText, fieldName, plan.grade || 6, user ?? undefined);
        
        if (isMounted.current) {
            setPlan((prev: Partial<LessonPlan>) => {
                const newPlan = { ...prev };
                const isArrayField = ['objectives', 'assessmentStandards', 'materials', 'progressMonitoring'].includes(fieldName);

                if (fieldName.startsWith('scenario.')) {
                    const scenarioField = fieldName.split('.')[1] as keyof LessonPlan['scenario'];
                    const scenario = { ...(newPlan.scenario || { introductory: '', main: [], concluding: '' }) };
                    
                    if (scenarioField === 'main') {
                        scenario.main = stringToArray(enhancedText);
                    } else if (scenarioField === 'introductory' || scenarioField === 'concluding') {
                        scenario[scenarioField] = enhancedText;
                    }
                    newPlan.scenario = scenario;
                } else {
                    if (isArrayField) {
                        const key = fieldName as 'objectives' | 'assessmentStandards' | 'materials' | 'progressMonitoring';
                        newPlan[key] = stringToArray(enhancedText);
                    } else {
                        const key = fieldName as 'title' | 'subject' | 'theme' | 'differentiation' | 'reflectionPrompt' | 'selfAssessmentPrompt';
                        newPlan[key] = enhancedText;
                    }
                }
                return newPlan;
            });
            addNotification(`Полето е успешно подобрено со AI!`, 'success');
        }
    } catch (error) {
        if (isMounted.current) {
            addNotification((error as Error).message, 'error');
        }
    } finally {
        if (isMounted.current) {
            setEnhancingField(null);
        }
    }
  }, [plan.grade, user, addNotification, enhancingField, isOnline]);
  
  const handleAnalyze = useCallback(async () => {
    if (!isOnline) {
        addNotification('Нема интернет конекција. Оваа функција е недостапна.', 'error');
        return;
    }
    if (!plan || !plan.title) {
        addNotification("Ве молиме пополнете ја подготовката пред да побарате анализа.", 'warning');
        return;
    }
    setIsAnalyzing(true);
    setAiAnalysis(null);
    try {
        const analysisResult = await geminiService.analyzeLessonPlan(plan, user ?? undefined);
        if (isMounted.current) {
            setAiAnalysis(analysisResult);
        }
    } catch(error) {
        if (isMounted.current) {
            addNotification((error as Error).message, 'error');
        }
    } finally {
        if (isMounted.current) {
            setIsAnalyzing(false);
        }
    }
  }, [plan, user, addNotification, isOnline]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan.title) {
        addNotification('Насловот е задолжителен.', 'error');
        return;
    }
    
    setIsSaving(true);
    try {
        if (isEditing) {
            await updateLessonPlan(plan as LessonPlan);
            if (isMounted.current) {
                addNotification('Подготовката е успешно ажурирана!', 'success');
                navigate('/my-lessons');
            }
        } else {
            const newPlanId = await addLessonPlan(plan as Omit<LessonPlan, 'id'>);
            if (isMounted.current) {
                addNotification('Подготовката е успешно креирана!', 'success');
                navigate(`/planner/lesson/${newPlanId}`);
            }
        }
    } catch (error) {
        console.error("Failed to save lesson plan:", error);
        if (isMounted.current) {
            addNotification('Грешка при зачувување на подготовката.', 'error');
        }
    } finally {
        if (isMounted.current) {
            setIsSaving(false);
        }
    }
  };
  
    const arrayToLines = (arr: string[] = []) => arr.map(item => `- ${item}`).join('\n');

  const handleExport = (format: 'md' | 'pdf' | 'doc' | 'clipboard') => {
    if (!plan || !plan.title) {
        addNotification('Насловот е задолжителен за извоз.', 'error');
        return;
    };
    setIsExportMenuOpen(false);

    if (format === 'pdf') {
        // This relies on @media print styles which now correctly show the clean LessonPlanDisplay
        window.print();
        return;
    }
    
    const { title, grade, theme, objectives, assessmentStandards, scenario, materials, progressMonitoring, differentiation, reflectionPrompt } = plan;

    const fullText = `Наслов: ${title}\nОдделение: ${grade}\nТема: ${theme}\n\nЦЕЛИ:\n${(objectives || []).join('\n')}\n\nСТАНДАРДИ ЗА ОЦЕНУВАЊЕ:\n${(assessmentStandards || []).join('\n')}\n\nСЦЕНАРИО:\nВовед: ${scenario?.introductory}\nГлавни: ${(scenario?.main || []).join('; ')}\nЗавршна: ${scenario?.concluding}\n\nМАТЕРИЈАЛИ:\n${(materials || []).join('\n')}\n\nСЛЕДЕЊЕ НА НАПРЕДОК:\n${(progressMonitoring || []).join('\n')}\n`;
    
    if (format === 'clipboard') {
        navigator.clipboard.writeText(fullText)
            .then(() => addNotification('Подготовката е копирана како обичен текст.', 'success'))
            .catch(() => addNotification('Грешка при копирање.', 'error'));
        return;
    }
    
    let content = '';
    let mimeType = '';
    let extension = '';
    const filename = `${(title || 'plan').replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase()}`;
    const escapeHtml = (unsafe: string = '') => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    if (format === 'md') {
        content = `# ${title || 'Без наслов'}\n\n**Одделение:** ${grade || ''}\n**Тема:** ${theme || ''}\n\n---\n\n## Цели\n${arrayToLines(objectives)}\n\n## Стандарди за оценување\n${arrayToLines(assessmentStandards)}\n\n## Сценарио\n### Вовед\n${scenario?.introductory || ''}\n### Главни активности\n${arrayToLines(scenario?.main)}\n### Завршна активност\n${scenario?.concluding || ''}\n\n---\n\n## Материјали\n${arrayToLines(materials)}\n\n## Следење на напредокот\n${arrayToLines(progressMonitoring)}`;
        mimeType = 'text/markdown;charset=utf-8';
        extension = 'md';
    } else if (format === 'doc') {
        const listHtml = (items: string[] = []) => items.length ? `<ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '<p><i>Нема</i></p>';
        
        // Construct a full HTML document for Word with proper styling
        const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <title>${escapeHtml(title)}</title>
            <style>
                body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
                h1 { font-size: 18pt; color: #2E74B5; margin-bottom: 12px; border-bottom: 2px solid #2E74B5; padding-bottom: 4px; }
                h2 { font-size: 14pt; color: #1F4D78; margin-top: 18px; margin-bottom: 8px; border-bottom: 1px solid #ddd; }
                h3 { font-size: 12pt; font-weight: bold; margin-top: 12px; margin-bottom: 4px; color: #444; }
                p { margin-bottom: 10px; }
                ul, ol { margin-bottom: 10px; padding-left: 25px; }
                li { margin-bottom: 4px; }
                .meta { margin-bottom: 20px; padding: 10px; background-color: #f0f0f0; border: 1px solid #ccc; }
                .meta p { margin: 4px 0; font-weight: bold; color: #555; }
            </style>
        </head>
        <body>
            <h1>${escapeHtml(title || 'Без наслов')}</h1>
            <div class="meta">
                <p>Одделение: ${grade || ''}</p>
                <p>Тема: ${escapeHtml(theme || '')}</p>
                <p>Предмет: ${escapeHtml(plan.subject || 'Математика')}</p>
            </div>

            <h2>Наставни цели</h2>
            ${listHtml(objectives)}

            <h2>Стандарди за оценување</h2>
            ${listHtml(assessmentStandards)}

            <h2>Сценарио</h2>
            <h3>Воведна активност</h3>
            <p>${escapeHtml(scenario?.introductory)}</p>
            
            <h3>Главни активности</h3>
            <ol>
                ${(scenario?.main || []).map((m: string) => `<li>${escapeHtml(m)}</li>`).join('')}
            </ol>

            <h3>Завршна активност</h3>
            <p>${escapeHtml(scenario?.concluding)}</p>

            <h2>Средства и Материјали</h2>
            ${listHtml(materials)}

            <h2>Следење на напредокот</h2>
            ${listHtml(progressMonitoring)}

            ${differentiation ? `<h2>Диференцијација</h2><p>${escapeHtml(differentiation)}</p>` : ''}
            ${reflectionPrompt ? `<h2>Рефлексија за наставникот</h2><p>${escapeHtml(reflectionPrompt)}</p>` : ''}
        </body>
        </html>`;
        
        try {
            const blob = new Blob([htmlContent], { type: 'application/msword' }); // Use proper MIME type for Word or just text/html which Word opens fine
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.doc`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            addNotification('Документот е преземен.', 'success');
        } catch (error) {
            console.error('Export failed:', error);
            addNotification('Грешка при извоз на документот.', 'error');
        }
        return;

    } else {
        addNotification(`Извозот во .${format} формат не е имплементиран тука.`, 'info');
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  if (isCurriculumLoading) {
    return (
      <div className="p-8">
        <header className="mb-6 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded w-2/3"></div>
        </header>
        <Card>
          <SkeletonLoader type="paragraph" />
        </Card>
      </div>
    );
  }
  
  if (!curriculum) {
    return (
        <div className="p-8 text-center text-red-500">
            <h2 className="text-2xl font-bold">Податоците за наставната програма не можеа да се вчитаат.</h2>
            <p className="mt-2">Ве молиме обидете се повторно да ја вчитате страницата.</p>
        </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <header className="mb-6 no-print">
        <button onClick={() => navigate('/my-lessons')} className="text-brand-secondary hover:underline mb-2">
            &larr; Назад кон моите подготовки
        </button>
        <h1 className="text-4xl font-bold text-brand-primary">
            {isEditing ? 'Уреди подготовка за час' : 'Креирај нова подготовка'}
        </h1>
      </header>

      <div className="no-print">
        <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
            <div className={`${!isOnline ? 'opacity-50 pointer-events-none grayscale relative' : ''}`}>
                {!isOnline && <div className="absolute inset-0 z-10 bg-gray-100/20 cursor-not-allowed flex items-center justify-center"><span className="bg-white px-3 py-1 rounded shadow text-sm font-bold text-red-600">Офлајн</span></div>}
                <AIContextSelector
                    plan={plan}
                    onGenerate={handleGenerateWithAI}
                    isGenerating={isGenerating}
                />
            </div>
            
            <div className={`${!isOnline ? 'opacity-50 pointer-events-none grayscale relative' : ''}`}>
                {!isOnline && <div className="absolute inset-0 z-10 bg-gray-100/20 cursor-not-allowed flex items-center justify-center"><span className="bg-white px-3 py-1 rounded shadow text-sm font-bold text-red-600">Офлајн</span></div>}
                <AIPedagogicalAnalysisDisplay
                    analysis={aiAnalysis}
                    onAnalyze={handleAnalyze}
                    isAnalyzing={isAnalyzing}
                    planTitle={plan.title}
                />
            </div>

            <LessonPlanFormFields 
                plan={plan}
                setPlan={setPlan}
                onEnhanceField={handleEnhanceField}
                enhancingField={enhancingField}
            />
            
            <div className="flex justify-end items-center pt-4 gap-3 border-t mt-6">
                <div className="relative" ref={exportMenuRef}>
                    <button
                        type="button"
                        onClick={() => setIsExportMenuOpen((prev: boolean) => !prev)}
                        disabled={!plan.title}
                        className="flex items-center gap-2 bg-gray-600 text-white px-4 py-3 rounded-lg shadow hover:bg-gray-700 transition-colors font-semibold disabled:bg-gray-400"
                        title="Извези ја оваа нацрт-подготовка"
                    >
                        <ICONS.download className="w-5 h-5" />
                        Извези
                        <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                            <div className="py-1">
                                <button type="button" onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <ICONS.download className="w-5 h-5 mr-3" /> Сними како Markdown (.md)
                                </button>
                                <button type="button" onClick={() => handleExport('doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <ICONS.edit className="w-5 h-5 mr-3" /> Сними како Word (.doc)
                                </button>
                                <button type="button" onClick={() => handleExport('pdf')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <ICONS.printer className="w-5 h-5 mr-3" /> Печати/Сними како PDF
                                </button>
                                <button type="button" onClick={() => handleExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <ICONS.edit className="w-5 h-5 mr-3" /> Копирај како обичен текст
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center bg-brand-primary text-white px-6 py-3 rounded-lg shadow hover:bg-brand-secondary transition-colors font-semibold disabled:bg-gray-400"
                >
                    {isSaving ? (
                        <>
                            <ICONS.spinner className="w-5 h-5 mr-2 animate-spin" />
                            <span>Зачувувам...</span>
                        </>
                    ) : (
                        <>
                            <ICONS.check className="w-5 h-5 mr-2" />
                            {isEditing ? 'Зачувај промени' : 'Зачувај подготовка'}
                        </>
                    )}
                </button>
            </div>
            </form>
        </Card>
      </div>

      {/* Specialized print view - Hidden on screen, visible on print. 
          Uses ID="printable-area" to ensure only this is printed based on global CSS. */}
      <div id="printable-area" className="hidden print:block">
         {/* Print header */}
         <div className="mb-6 border-b pb-4">
             <p className="text-md text-gray-500">Предмет: {plan.subject}</p>
             <p className="text-md text-gray-500">Тема: {plan.theme}</p>
             <h1 className="text-2xl font-bold text-brand-primary mt-2">{plan.title}</h1>
             <p className="text-lg text-gray-600">{plan.grade}. Одделение</p>
        </div>
        <LessonPlanDisplay plan={plan as LessonPlan} />
      </div>
    </div>
  );
};