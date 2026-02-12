import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import type { AIGeneratedIdeas, LessonPlan, AIGeneratedPracticeMaterial, Concept, NationalStandard } from '../types';
import { PlannerItemType } from '../types';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { MathRenderer } from '../components/common/MathRenderer';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useLastVisited } from '../contexts/LastVisitedContext';
import { usePlanner } from '../contexts/PlannerContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { CachedResourcesBrowser } from '../components/common/CachedResourcesBrowser';
import { InteractiveQuizPlayer } from '../components/ai/InteractiveQuizPlayer';
import { QuestionType, type AssessmentQuestion } from '../types';

declare global {
    interface Window {
        PptxGenJS: any;
        pptxgen: any;
    }
}

const convertToStandardLatex = (text: string | undefined): string => {
    if (!text) return '';
    return text.replace(/\\\\/g, '\\');
};

// Helper to strip Markdown and LaTeX for plain text formats like PPTX
const cleanTextForPresentation = (text: string): string => {
    if (!text) return '';
    let clean = text;
    
    // Remove bold/italic markdown
    clean = clean.replace(/\*\*(.*?)\*\*/g, '$1');
    clean = clean.replace(/\*(.*?)\*/g, '$1');
    
    // Simple LaTeX replacements for readability in plain text
    clean = clean.replace(/\$\$\\frac\{(.*?)\}\{(.*?)\}\$\$/g, '($1)/($2)');
    clean = clean.replace(/\$\\frac\{(.*?)\}\{(.*?)\}\$/g, '($1)/($2)');
    clean = clean.replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '($1)/($2)');
    clean = clean.replace(/\\sqrt\{(.*?)\}/g, 'sqrt($1)');
    clean = clean.replace(/\\cdot/g, '*');
    clean = clean.replace(/\\le/g, '<=');
    clean = clean.replace(/\\ge/g, '>=');
    clean = clean.replace(/\\pi/g, 'π');
    clean = clean.replace(/\$/g, ''); // Remove remaining dollar signs
    
    return clean.trim();
};

// Helper to dynamically load the library if missing
const ensurePptxLib = async (): Promise<any> => {
    // Check if already loaded globally
    if (window.PptxGenJS) return window.PptxGenJS;
    // Some versions attach as window.pptxgen
    if (window.pptxgen) return window.pptxgen;

    // If not found, try to load it dynamically
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/gh/gitbrent/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
        script.onload = () => {
            if (window.PptxGenJS) resolve(window.PptxGenJS);
            else if (window.pptxgen) resolve(window.pptxgen);
            else reject(new Error("Библиотеката е вчитана но конструкторот не е пронајден."));
        };
        script.onerror = () => reject(new Error("Неуспешно преземање на библиотеката за PowerPoint. Проверете ја интернет конекцијата."));
        document.head.appendChild(script);
    });
};


interface ConceptDetailViewProps {
  id: string;
}

export const ConceptDetailView: React.FC<ConceptDetailViewProps> = ({ id }) => {
  const { navigate } = useNavigation();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { getConceptDetails, allConcepts, getStandardsByIds } = useCurriculum();
  const { user } = useAuth();
  const { isFavoriteConcept, toggleFavoriteConcept } = useUserPreferences();
  const { addNotification } = useNotification();
  const { setLastVisited } = useLastVisited();
  const { addItem, addLessonPlan } = usePlanner();

  const { grade, topic, concept } = useMemo(() => getConceptDetails(id), [getConceptDetails, id]);
  
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIGeneratedIdeas | null>(null);
  const [isGeneratingAnalogy, setIsGeneratingAnalogy] = useState(false);
  const [analogy, setAnalogy] = useState<string | null>(null);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [presentationOutline, setPresentationOutline] = useState<string | null>(null);
  
  const [isGeneratingProblems, setIsGeneratingProblems] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);
  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [isThrottled, setIsThrottled] = useState(false);
  
  const [practiceMaterial, setPracticeMaterial] = useState<AIGeneratedPracticeMaterial | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (concept) {
      setLastVisited({ path: `/concept/${id}`, label: concept.title, type: 'concept' });
    }
  }, [concept, id, setLastVisited]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
            setIsExportMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const conceptStandards = useMemo(() => {
    if (!concept) return [];
    return getStandardsByIds(concept.nationalStandardIds);
  }, [concept, getStandardsByIds]);

  const checkThrottle = () => {
    if (isThrottled) {
      addNotification("Ве молиме почекајте малку пред следното барање.", 'warning');
      return true;
    }
    setIsThrottled(true);
    setTimeout(() => setIsThrottled(false), 3000); // 3s throttle
    return false;
  };

  const handleGenerateIdeas = async () => {
    if (!concept || !topic || !grade || checkThrottle()) return;
    setIsLoadingIdeas(true);
    try {
      const ideas = await geminiService.generateLessonPlanIdeas([concept], topic, grade.level, user ?? undefined);
      setAiSuggestions(ideas);
    } catch(e) {
      addNotification((e as Error).message, 'error');
    } finally {
      setIsLoadingIdeas(false);
    }
  };
  
  const handleGenerateAnalogy = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setIsGeneratingAnalogy(true);
    setAnalogy(null); 
    try {
      const result = await geminiService.generateAnalogy(concept, grade.level);
      setAnalogy(result);
    } catch(e) {
      addNotification((e as Error).message, 'error');
    } finally {
      setIsGeneratingAnalogy(false);
    }
  };

  const handleGenerateOutline = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setIsGeneratingOutline(true);
    setPresentationOutline(null);
    try {
      const result = await geminiService.generatePresentationOutline(concept, grade.level);
      setPresentationOutline(result);
    } catch(e) {
        addNotification((e as Error).message, 'error');
    } finally {
        setIsGeneratingOutline(false);
    }
  };
  
  const handleGeneratePracticeMaterial = async (type: 'problems' | 'questions') => {
    if (!concept || !grade || checkThrottle()) return;
    
    if (type === 'problems') setIsGeneratingProblems(true);
    else setIsGeneratingQuestions(true);
    
    try {
        const result = await geminiService.generatePracticeMaterials(concept, grade.level, type);
        setPracticeMaterial(result);
    } catch(e) {
        addNotification((e as Error).message, 'error');
    } finally {
        if (type === 'problems') setIsGeneratingProblems(false);
        else setIsGeneratingQuestions(false);
    }
  };

  const handleSaveAsNote = async (title: string, content: string) => {
    if (!content) return;
    try {
      await addItem({
        title: `Белешка: ${title}`,
        date: new Date().toISOString().split('T')[0],
        type: PlannerItemType.EVENT,
        description: content,
      });
      addNotification('Содржината е успешно зачувана како белешка во планерот!', 'success');
    } catch (error) {
      addNotification('Грешка при зачувување на белешката.', 'error');
    }
  };

  const formatIdeasToText = (ideas: AIGeneratedIdeas) => {
    const mainActivities = Array.isArray(ideas.mainActivity)
        ? ideas.mainActivity.map(a => `- ${a.text} [${a.bloomsLevel}]`).join('\n')
        : ideas.mainActivity;
    return `### ${ideas.title}\n\n**Вовед:** ${ideas.openingActivity}\n\n**Главна активност:**\n${mainActivities}\n\n**Диференцијација:** ${ideas.differentiation}\n\n**Оценување:** ${ideas.assessmentIdea}`;
  };

  const handleSaveAsPlan = async () => {
    if (!aiSuggestions || !grade || !topic || !concept) return;

    const newPlan: Omit<LessonPlan, 'id'> = {
        title: aiSuggestions.title,
        grade: grade.level,
        topicId: topic.id,
        conceptIds: [concept.id],
        subject: 'Математика',
        theme: topic.title,
        objectives: [],
        assessmentStandards: [],
        scenario: {
            introductory: { text: aiSuggestions.openingActivity },
            main: Array.isArray(aiSuggestions.mainActivity) 
                ? aiSuggestions.mainActivity.map(item => ({
                    text: item.text,
                    bloomsLevel: item.bloomsLevel
                }))
                : [{ text: String(aiSuggestions.mainActivity) }],
            concluding: { text: aiSuggestions.assessmentIdea },
        },
        materials: [],
        progressMonitoring: [aiSuggestions.assessmentIdea].filter(Boolean),
        differentiation: aiSuggestions.differentiation,
    };

    try {
        const newPlanId = await addLessonPlan(newPlan);
        addNotification('Подготовката е успешно зачувана! Сега можете да ја доуредите.', 'success');
        navigate(`/planner/lesson/${newPlanId}`);
    } catch (error) {
        addNotification('Грешка при зачувување на подготовката.', 'error');
    }
  };

    const handleExportOutline = async (format: 'pptx' | 'md' | 'txt' | 'doc') => {
        if (!presentationOutline || !concept) return;
        setIsExportMenuOpen(false);

        const cleanTitle = concept.title.replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase();

        if (format === 'doc') {
            const outlineElement = document.getElementById('presentation-outline-content');
            if (!outlineElement) {
                addNotification('Нема генерирана содржина за извоз.', 'error');
                return;
            }
            const renderedHtml = outlineElement.innerHTML;
            const fullHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: Calibri, sans-serif; font-size: 11pt; }
                        h1, h2, h3, h4 { font-family: 'Calibri Light', sans-serif; }
                    </style>
                </head>
                <body>
                    <h3>Структура за презентација: ${concept.title}</h3>
                    ${renderedHtml}
                </body>
                </html>
            `;
            try {
                const blob = new Blob([fullHtml], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                navigator.clipboard.write([clipboardItem]).then(() => {
                    addNotification('Структурата е копирана со форматирање за Word.', 'success');
                }).catch(() => addNotification('Грешка при копирање.', 'error'));
            } catch (error) {
                addNotification('Копирањето со форматирање не е поддржано.', 'error');
            }
            return;
        }

        if (format === 'pptx') {
            setIsExportingPptx(true);
            try {
                // Dynamic import check with robust error handling
                let PptxGenJS;
                try {
                    PptxGenJS = await ensurePptxLib();
                } catch (libError) {
                    console.error("Failed to load PptxGenJS:", libError);
                    addNotification('Грешка: Библиотеката за PowerPoint не можеше да се вчита. Обидете се повторно подоцна.', 'error');
                    setIsExportingPptx(false);
                    return;
                }

                const pptx = new PptxGenJS();
                
                // Set metadata
                pptx.title = `Презентација: ${concept.title}`;
                pptx.author = user?.name || 'Math Curriculum AI';
                pptx.layout = 'LAYOUT_16x9';

                // 1. Title Slide
                let slide = pptx.addSlide();
                slide.addText(cleanTextForPresentation(concept.title), { 
                    x: 0.5, y: 1.5, w: '90%', h: 1.5, 
                    fontSize: 44, bold: true, color: '0D47A1', align: 'center', fontFace: 'Arial' 
                });
                slide.addText(`${grade?.title || ''} | ${topic?.title || ''}`, {
                    x: 0.5, y: 3.2, w: '90%', h: 0.5,
                    fontSize: 18, color: '666666', align: 'center', fontFace: 'Arial'
                });

                // 2. Content Slides
                // Better splitting logic: look for Markdown headings (### or ##)
                const slidesContent = presentationOutline.split(/(?:\r?\n|^)(?=#{2,3}\s)/).filter((s: string) => s.trim().length > 0);
                
                slidesContent.forEach((slideContent: string) => {
                    if (!slideContent.trim()) return;
                    
                    const lines = slideContent.trim().split('\n');
                    // Extract title (remove #, ##, ###)
                    let titleLine = lines[0].replace(/^#+\s*/, '').trim();
                    // Optional: Remove "Slide X:" prefix if AI generated it
                    titleLine = titleLine.replace(/^Слајд \d+:\s*/i, '').replace(/^Slide \d+:\s*/i, '').trim();
                    
                    const bodyLines = lines.slice(1)
                        .map((line: string) => cleanTextForPresentation(line.replace(/^- \s*/, '').replace(/^\* \s*/, '').trim()))
                        .filter((line: string) => line.length > 0);

                    if (!titleLine && bodyLines.length === 0) return;

                    const contentSlide = pptx.addSlide();
                    
                    // Slide Title
                    contentSlide.addText(titleLine, { 
                        x: 0.5, y: 0.3, w: '90%', h: 0.8, 
                        fontSize: 28, bold: true, color: '0D47A1', fontFace: 'Arial',
                        border: { pt: 0, pb: 0, b: { pt: 2, color: '0077CC' } } // Bottom border for title
                    });
                    
                    // Slide Body
                    if (bodyLines.length > 0) {
                        const textObjects = bodyLines.map((line: string) => ({ 
                            text: line, 
                            options: { 
                                bullet: true, 
                                fontSize: 18, 
                                color: '333333', 
                                fontFace: 'Arial', 
                                breakLine: true 
                            } 
                        }));
                        
                        contentSlide.addText(textObjects, {
                            x: 0.5, y: 1.3, w: '90%', h: '75%', 
                            align: 'left', valign: 'top'
                        });
                    }
                    
                    // Footer
                    contentSlide.addText('Math Curriculum AI Navigator', {
                        x: 0.5, y: 5.3, w: '90%', h: 0.3,
                        fontSize: 10, color: 'AAAAAA', align: 'right'
                    });
                });

                await pptx.writeFile({ fileName: `Презентација_${cleanTitle}.pptx` });
                addNotification('Презентацијата е успешно генерирана!', 'success');
            } catch (error) {
                console.error("PPTX Export Error:", error);
                addNotification('Грешка при креирање на PowerPoint фајл. Проверете ја конзолата за детали.', 'error');
            } finally {
                setIsExportingPptx(false);
            }
            return;
        }

        let content = convertToStandardLatex(presentationOutline);
        let mimeType = 'text/plain';
        let extension = 'txt';

        if (format === 'md') {
            mimeType = 'text/markdown';
            extension = 'md';
        }

        const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Структура_${cleanTitle}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


  const handleStandardClick = (standardText: string) => {
    if (!grade || !topic || !concept) return;
    openGeneratorPanel({
        grade: String(grade.level),
        topicId: topic.id,
        conceptId: concept.id,
        contextType: 'SCENARIO', // Use SCENARIO to pass free text
        scenario: standardText
    });
  };

  const handleActivityClick = (activityText: string) => {
    if (!grade || !topic || !concept) return;
    openGeneratorPanel({
        grade: String(grade.level),
        topicId: topic.id,
        conceptId: concept.id,
        contextType: 'SCENARIO',
        scenario: activityText,
        materialType: 'SCENARIO'
    });
  };

  if (!concept || !topic || !grade) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600">Поимот не е пронајден.</h2>
        <button onClick={() => navigate('/explore')} className="mt-4 px-4 py-2 bg-brand-primary text-white rounded">
          Назад кон истражување
        </button>
      </div>
    );
  }
  
  const isAnyGenerating = isLoadingIdeas || isGeneratingAnalogy || isGeneratingOutline || isGeneratingProblems || isGeneratingQuestions || isExportingPptx;
  const priorKnowledgeConcepts = concept.priorKnowledgeIds.map((pkId: string) => allConcepts.find((c: Concept & { gradeLevel: number; topicId: string }) => c.id === pkId)).filter(Boolean);
  const isFavorite = isFavoriteConcept(concept.id);

  return (
    <div className="p-8 animate-fade-in">
        <header className="mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-bold text-brand-primary"><MathRenderer text={concept.title} /></h1>
              <button 
                onClick={() => toggleFavoriteConcept(concept.id)} 
                title={isFavorite ? 'Отстрани од омилени' : 'Додади во омилени'} 
                aria-label={isFavorite ? 'Отстрани од омилени' : 'Додади во омилени'}
                className="text-yellow-500 hover:text-yellow-600"
              >
                {isFavorite ? <ICONS.starSolid className="w-7 h-7" /> : <ICONS.star className="w-7 h-7" />}
              </button>
            </div>
            <p className="text-xl text-gray-500">{grade.title}</p>
            <p className="text-md text-gray-600 mt-2 max-w-3xl"><MathRenderer text={concept.description} /></p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                {concept.content && concept.content.length > 0 && (
                    <Card>
                        <h2 className="text-2xl font-semibold text-brand-primary mb-3">Детални содржини</h2>
                        <ul className="list-disc list-inside text-gray-700 space-y-1">
                            {concept.content.map((item: string, i: number) => <li key={i}><MathRenderer text={item} /></li>)}
                        </ul>
                    </Card>
                )}
                <Card>
                    <h2 className="text-2xl font-semibold text-brand-primary mb-3">Стандарди за оценување</h2>
                     <ul className="space-y-1">
                        {concept.assessmentStandards.map((standard: string, i: number) => (
                            <li key={i}>
                                <button 
                                    onClick={() => handleStandardClick(standard)}
                                    className="w-full text-left p-2 rounded-md hover:bg-blue-50 transition-colors flex items-start group"
                                    title="Генерирај материјали за овој стандард"
                                >
                                    <ICONS.check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-brand-secondary" />
                                    <span className="text-gray-700 group-hover:text-brand-primary flex-1">
                                        <MathRenderer text={standard} />
                                    </span>
                                    <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ICONS.sparkles className="w-4 h-4 text-brand-accent flex-shrink-0" />
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Card>

                {concept.activities && concept.activities.length > 0 && (
                    <Card>
                        <h2 className="text-2xl font-semibold text-brand-primary mb-3">Предлог активности од програмата</h2>
                        <ul className="space-y-1">
                            {concept.activities.map((activity: string, i: number) => (
                                <li key={i}>
                                    <button 
                                        onClick={() => handleActivityClick(activity)}
                                        className="w-full text-left p-2 rounded-md hover:bg-blue-50 transition-colors flex items-start group"
                                        title="Генерирај материјали за оваа активност"
                                    >
                                        <ICONS.lightbulb className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-500" />
                                        <span className="text-gray-700 group-hover:text-brand-primary flex-1">
                                            <MathRenderer text={activity} />
                                        </span>
                                        <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ICONS.sparkles className="w-4 h-4 text-brand-accent flex-shrink-0" />
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}

                {priorKnowledgeConcepts.length > 0 && (
                     <Card>
                        <h2 className="text-2xl font-semibold text-brand-primary mb-3">Потребни предзнаења</h2>
                        <ul className="space-y-2">
                           {priorKnowledgeConcepts.map((pkConcept: any) => pkConcept && (
                                <li key={pkConcept.id} className="flex items-start">
                                    <ICONS.link className="w-4 h-4 mr-2 mt-1 flex-shrink-0 text-gray-500" />
                                    <a onClick={() => navigate(`/concept/${pkConcept.id}`)} className="text-brand-secondary hover:underline cursor-pointer">
                                        <MathRenderer text={pkConcept.title} />
                                    </a>
                                </li>
                           ))}
                        </ul>
                    </Card>
                )}
            </div>

            <div className="space-y-6">
                 <Card>
                    <h2 className="text-2xl font-semibold text-brand-primary mb-3">Поврзани национални стандарди</h2>
                    <div className="space-y-2">
                        {conceptStandards.map((std: NationalStandard) => (
                            <button
                                key={std.id}
                                onClick={() => openGeneratorPanel({ contextType: 'STANDARD', standardId: std.id })}
                                className="w-full text-left p-3 rounded-md bg-blue-50 hover:bg-blue-100 transition-colors group"
                                title="Генерирај материјали за овој стандард"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="font-bold text-blue-800 text-sm">{std.code}</p>
                                        <p className="text-blue-900 text-sm"><MathRenderer text={std.description} /></p>
                                    </div>
                                    <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <ICONS.sparkles className="w-5 h-5 text-brand-accent flex-shrink-0" />
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>

                <Card>
                    <h2 className="text-2xl font-semibold text-brand-primary mb-3 flex items-center">
                        <ICONS.explore className="w-6 h-6 mr-2 text-brand-primary" />
                        Библиотека на ресурси
                    </h2>
                    <p className="text-sm text-gray-500 mb-4 italic">
                        Проверете ги веќе генерираните материјали од други наставници за да заштедите време и AI кредити.
                    </p>
                    <CachedResourcesBrowser 
                        conceptId={concept.id} 
                        onSelect={(content) => {
                            // Automatically handle based on the content type if possible, 
                            // but for now, we just copy it and notify.
                            navigator.clipboard.writeText(content);
                            addNotification('Содржината е копирана. Можете да ја зачувате како белешка или да ја користите во подготовка.', 'success');
                        }} 
                    />
                </Card>

                <Card>
                    <h2 className="text-2xl font-semibold text-brand-primary mb-3 flex items-center">
                        <ICONS.sparkles className="w-6 h-6 mr-2 text-brand-accent" />
                        AI Предлози
                    </h2>
                    <div className="space-y-2">
                        <button 
                            onClick={handleGenerateIdeas}
                            disabled={isAnyGenerating}
                            className="w-full flex items-center justify-center bg-brand-secondary text-white px-4 py-2 rounded-lg disabled:bg-gray-400 hover:bg-brand-primary transition-colors font-semibold"
                        >
                            {isLoadingIdeas ? <ICONS.spinner className="animate-spin w-5 h-5 mr-2" /> : <ICONS.lightbulb className="w-5 h-5 mr-2" />}
                            Генерирај предлог активности
                        </button>
                         <button 
                            onClick={handleGenerateAnalogy}
                            disabled={isAnyGenerating}
                            className="w-full flex items-center justify-center bg-purple-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400 hover:bg-purple-700 transition-colors font-semibold"
                        >
                            {isGeneratingAnalogy ? <ICONS.spinner className="animate-spin w-5 h-5 mr-2" /> : <ICONS.chatBubble className="w-5 h-5 mr-2" />}
                            Објасни со аналогија
                        </button>
                        <button
                            onClick={handleGenerateOutline}
                            disabled={isAnyGenerating}
                            className="w-full flex items-center justify-center bg-teal-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400 hover:bg-teal-700 transition-colors font-semibold"
                        >
                            {isGeneratingOutline ? <ICONS.spinner className="animate-spin w-5 h-5 mr-2" /> : <ICONS.myLessons className="w-5 h-5 mr-2" />}
                            Креирај структура за презентација
                        </button>
                        <div className="border-t my-2"></div>
                        <button
                            onClick={() => handleGeneratePracticeMaterial('problems')}
                            disabled={isAnyGenerating}
                            className="w-full flex items-center justify-center bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400 hover:bg-indigo-700 transition-colors font-semibold"
                        >
                            {isGeneratingProblems ? <ICONS.spinner className="animate-spin w-5 h-5 mr-2" /> : <ICONS.generator className="w-5 h-5 mr-2" />}
                            Генерирај задачи за вежбање
                        </button>
                        <button
                            onClick={() => handleGeneratePracticeMaterial('questions')}
                            disabled={isAnyGenerating}
                            className="w-full flex items-center justify-center bg-pink-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-400 hover:bg-pink-700 transition-colors font-semibold"
                        >
                            {isGeneratingQuestions ? <ICONS.spinner className="animate-spin w-5 h-5 mr-2" /> : <ICONS.assistant className="w-5 h-5 mr-2" />}
                            Генерирај прашања за дискусија
                        </button>
                    </div>

                    {aiSuggestions && (
                        <div className="mt-4 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg animate-fade-in">
                            <div className="prose prose-sm max-w-none">
                                {aiSuggestions.error ? <p className="text-red-500">{aiSuggestions.error}</p> : (
                                    <MathRenderer text={formatIdeasToText(aiSuggestions)} />
                                )}
                            </div>
                            {!aiSuggestions.error && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button onClick={handleSaveAsPlan} className="flex items-center text-sm bg-green-600 text-white px-3 py-1 rounded-lg shadow hover:bg-green-700"><ICONS.plus className="w-4 h-4 mr-1"/> Зачувај како подготовка</button>
                                    <button onClick={() => handleSaveAsNote(aiSuggestions.title, formatIdeasToText(aiSuggestions))} className="flex items-center text-sm bg-yellow-500 text-white px-3 py-1 rounded-lg shadow hover:bg-yellow-600"><ICONS.edit className="w-4 h-4 mr-1"/> Зачувај како белешка</button>
                                </div>
                            )}
                        </div>
                    )}

                    {analogy && (
                        <Card className="mt-4 bg-purple-50 border-purple-200 animate-fade-in">
                            <h4 className="font-bold text-md mb-2 text-purple-800 flex items-center">
                                <ICONS.chatBubble className="w-5 h-5 mr-2" />
                                AI Аналогија
                            </h4>
                            <div className="prose prose-sm max-w-none text-gray-800">
                                <MathRenderer text={analogy} />
                            </div>
                             <div className="mt-3">
                                <button onClick={() => handleSaveAsNote(`Аналогија за ${concept.title}`, analogy)} className="flex items-center text-sm bg-yellow-500 text-white px-3 py-1 rounded-lg shadow hover:bg-yellow-600"><ICONS.edit className="w-4 h-4 mr-1"/> Зачувај како белешка</button>
                            </div>
                        </Card>
                    )}

                    {presentationOutline && (
                        <Card className="mt-4 bg-teal-50 border-teal-200 animate-fade-in">
                             <div className="flex justify-between items-start">
                                <h4 className="font-bold text-md mb-2 text-teal-800 flex items-center">
                                    <ICONS.myLessons className="w-5 h-5 mr-2" />
                                    Структура за презентација
                                </h4>
                                <div className="relative" ref={exportMenuRef}>
                                    <button type="button" onClick={() => setIsExportMenuOpen((p: boolean) => !p)} className="flex items-center gap-1 text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full hover:bg-teal-200">
                                        <ICONS.download className="w-4 h-4" /> Извези
                                    </button>
                                    {isExportMenuOpen && (
                                        <div className="absolute right-0 mt-2 w-72 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                                            <div className="py-1">
                                                <button onClick={() => handleExportOutline('pptx')} disabled={isExportingPptx} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                    {isExportingPptx ? <ICONS.spinner className="w-5 h-5 mr-3 animate-spin"/> : <ICONS.download className="w-5 h-5 mr-3"/>} 
                                                    PowerPoint (.pptx)
                                                </button>
                                                <button onClick={() => handleExportOutline('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                    <ICONS.download className="w-5 h-5 mr-3"/> Markdown (.md)
                                                </button>
                                                <button onClick={() => handleExportOutline('txt')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                    <ICONS.download className="w-5 h-5 mr-3"/> Текст (.txt)
                                                </button>
                                                <button onClick={() => handleExportOutline('doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                                    <ICONS.edit className="w-5 h-5 mr-3"/> Копирај за Word (форматирано)
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                             </div>
                            <div id="presentation-outline-content" className="prose prose-sm max-w-none text-gray-800">
                                <MathRenderer text={presentationOutline} />
                            </div>
                            <div className="mt-3">
                                <button onClick={() => handleSaveAsNote(`Презентација за ${concept.title}`, presentationOutline)} className="flex items-center text-sm bg-yellow-500 text-white px-3 py-1 rounded-lg shadow hover:bg-yellow-600"><ICONS.edit className="w-4 h-4 mr-1"/> Зачувај како белешка</button>
                            </div>
                        </Card>
                    )}
                    
                    {practiceMaterial && (
                        <Card className="mt-4 bg-indigo-50 border-indigo-200 animate-fade-in">
                             <h4 className="font-bold text-md mb-2 text-indigo-800 flex items-center">
                                <ICONS.generator className="w-5 h-5 mr-2" />
                                {practiceMaterial.title}
                            </h4>
                             <div className="prose prose-sm max-w-none text-gray-800 space-y-4">
                                {practiceMaterial.items.map((item: any, index: number) => (
                                    <div key={index} className="pb-3 border-b last:border-b-0 border-indigo-100">
                                        <p className="mb-1"><strong>{index + 1}. <MathRenderer text={item.text} /></strong></p>
                                        {item.answer && (
                                            <p className="text-sm bg-indigo-100 p-1 rounded inline-block">
                                                <span className="font-semibold">Одговор:</span> <MathRenderer text={item.answer} />
                                            </p>
                                        )}
                                        {item.solution && (
                                            <div className="mt-2 p-2 bg-blue-50 border-l-2 border-blue-400 text-xs italic">
                                                <span className="font-semibold text-blue-800">Решение:</span>
                                                <div className="mt-1"><MathRenderer text={item.solution} /></div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                             <div className="mt-3 flex gap-2">
                                <button onClick={() => handleSaveAsNote(practiceMaterial.title, practiceMaterial.items.map((it: any) => `${it.text} (Одг: ${it.answer || 'N/A'})`).join('\n'))} className="flex items-center text-sm bg-yellow-500 text-white px-3 py-1 rounded-lg shadow hover:bg-yellow-600"><ICONS.edit className="w-4 h-4 mr-1"/> Зачувај како белешка</button>
                                <button onClick={() => setIsPlayingQuiz(true)} className="flex items-center text-sm bg-brand-primary text-white px-3 py-1 rounded-lg shadow hover:bg-brand-secondary"><ICONS.play className="w-4 h-4 mr-1"/> Интерактивен квиз</button>
                            </div>
                        </Card>
                    )}
                </Card>
            </div>
        </div>
        {isPlayingQuiz && practiceMaterial && (
            <InteractiveQuizPlayer 
                title={practiceMaterial.title}
                questions={practiceMaterial.items.map((item: any, i: number) => ({
                    id: i,
                    type: QuestionType.SHORT_ANSWER,
                    question: item.text,
                    answer: item.answer,
                    solution: item.solution,
                    cognitiveLevel: 'Applying'
                }))}
                onClose={() => setIsPlayingQuiz(false)}
            />
        )}
    </div>
  );
};