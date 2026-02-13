import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import type { AIGeneratedIdeas, AIGeneratedPracticeMaterial, LessonPlan } from '../types';
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
import { StepByStepSolver } from '../components/StepByStepSolver';
import { GeometryExplorer } from '../components/GeometryExplorer';
import { useReactToPrint } from 'react-to-print';
import { Printer, Share2, Brain, GraduationCap, Sparkles, Lightbulb } from 'lucide-react';

// --- Помошни функции ---
const formatIdeasToText = (ideas: AIGeneratedIdeas) => {
    const mainActivities = Array.isArray(ideas.mainActivity)
        ? ideas.mainActivity.map(a => `- ${a.text} [${a.bloomsLevel}]`).join('\n')
        : ideas.mainActivity;
    return `### ${ideas.title}\n\n**Вовед:** ${ideas.openingActivity}\n\n**Главна активност:**\n${mainActivities}\n\n**Диференцијација:** ${ideas.differentiation}\n\n**Оценување:** ${ideas.assessmentIdea}`;
};

interface ConceptDetailViewProps {
  id: string;
}

export const ConceptDetailView: React.FC<ConceptDetailViewProps> = ({ id }) => {
  // 1. Hooks (Подредени за стабилност)
  const { navigate } = useNavigation();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { getConceptDetails } = useCurriculum();
  const { user } = useAuth();
  const { isFavoriteConcept, toggleFavoriteConcept } = useUserPreferences();
  const { addNotification } = useNotification();
  const { setLastVisited } = useLastVisited();

  const { grade, topic, concept } = useMemo(() => getConceptDetails(id), [getConceptDetails, id]);
  
  // 2. State
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'analogy' | 'quiz'>('overview');
  const [aiSuggestions, setAiSuggestions] = useState<AIGeneratedIdeas | null>(null);
  const [analogy, setAnalogy] = useState<string | null>(null);
  const [practiceMaterial, setPracticeMaterial] = useState<AIGeneratedPracticeMaterial | null>(null);
  const [solverData, setSolverData] = useState<any>(null);
  const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);
  const [isThrottled, setIsThrottled] = useState(false);
  
  const [loadingState, setLoadingState] = useState({
    ideas: false, analogy: false, quiz: false, solver: false
  });

  const printComponentRef = useRef<HTMLDivElement>(null);

  // 3. Handlers
  const checkThrottle = () => {
    if (isThrottled) {
      addNotification("Ве молиме почекајте 3 секунди меѓу барањата.", 'warning');
      return true;
    }
    setIsThrottled(true);
    setTimeout(() => setIsThrottled(false), 3000);
    return false;
  };

  const handlePrint = useReactToPrint({
    contentRef: printComponentRef,
    documentTitle: concept ? `Kviz_${concept.title}` : 'Kviz',
  });

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/#/play/${id}`;
    navigator.clipboard.writeText(shareUrl);
    addNotification('Линкот за споделување е копиран!', 'success');
  };

  const handleGenerateIdeas = async () => {
    if (!concept || !topic || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, ideas: true }));
    try {
      const ideas = await geminiService.generateLessonPlanIdeas([concept], topic, grade.level, user ?? undefined);
      setAiSuggestions(ideas);
    } catch(e) { addNotification("Грешка при генерирање идеи.", 'error'); }
    finally { setLoadingState(p => ({ ...p, ideas: false })); }
  };

  const handleGenerateAnalogy = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, analogy: true }));
    try {
      const res = await geminiService.generateAnalogy(concept, grade.level);
      setAnalogy(res);
    } catch(e) { addNotification("Грешка при генерирање аналогија.", 'error'); }
    finally { setLoadingState(p => ({ ...p, analogy: false })); }
  };

  const handleGenerateQuiz = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, quiz: true }));
    try {
      const res = await geminiService.generatePracticeMaterials(concept, grade.level, 'problems');
      setPracticeMaterial(res);
    } catch(e) { addNotification("Грешка при креирање квиз.", 'error'); }
    finally { setLoadingState(p => ({ ...p, quiz: false })); }
  };

  const handleGenerateSolver = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, solver: true }));
    try {
      const res = await geminiService.generateStepByStepSolution(concept.title, grade.level);
      setSolverData(res);
    } catch(e) { addNotification("Грешка во AI Туторот.", "error"); }
    finally { setLoadingState(p => ({ ...p, solver: false })); }
  };

  useEffect(() => {
    if (concept) setLastVisited({ path: `/concept/${id}`, label: concept.title, type: 'concept' });
  }, [concept, id, setLastVisited]);

  if (!concept || !topic || !grade) return <SkeletonLoader type="page" />;

  return (
    <div className="p-8 animate-fade-in pb-24 text-left">
        <header className="mb-10">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-black text-brand-primary tracking-tight">
                  <MathRenderer text={concept.title} />
                </h1>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFavoriteConcept(concept.id)} className="text-yellow-500 hover:scale-110 transition">
                    {isFavoriteConcept(concept.id) ? <ICONS.starSolid className="w-8 h-8" /> : <ICONS.star className="w-8 h-8" />}
                  </button>
                  <button onClick={handleShare} className="text-blue-500 hover:scale-110 transition p-2 rounded-full hover:bg-blue-50" title="Сподели со ученици">
                    <Share2 className="w-8 h-8" />
                  </button>
                </div>
              </div>
              <p className="text-xl text-gray-400 font-bold mt-2 uppercase tracking-wide">
                {grade.title} • {topic.title}
              </p>
        </header>

        {/* Навигација низ табови */}
        <div className="flex flex-wrap gap-3 border-b border-gray-100 pb-5 mb-10">
            {[
                { id: 'overview', label: '📖 Преглед', color: 'bg-blue-600' },
                { id: 'activities', label: '💡 Активности', color: 'bg-emerald-600' },
                { id: 'analogy', label: '🧠 Аналогија', color: 'bg-purple-600' },
                { id: 'quiz', label: '🎮 Квиз', color: 'bg-indigo-600' }
            ].map(t => (
                <button 
                    key={t.id}
                    onClick={() => setActiveTab(t.id as any)}
                    className={`px-8 py-3 rounded-2xl text-sm font-black transition-all transform hover:scale-105 ${activeTab === t.id ? `${t.color} text-white shadow-xl` : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'}`}
                >
                    {t.label}
                </button>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-10">
                {/* ТАБ: ПРЕГЛЕД */}
                {activeTab === 'overview' && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="shadow-sm border-none">
                        <h2 className="text-2xl font-black text-blue-600 mb-6 flex items-center gap-3">
                           <GraduationCap className="w-7 h-7" /> Дефиниција и опис
                        </h2>
                        <div className="text-lg leading-relaxed text-gray-700">
                          <MathRenderer text={concept.description} />
                        </div>
                    </Card>
                    
                    <GeometryExplorer />

                    <Card className="border-indigo-100 bg-indigo-50/20 ring-1 ring-indigo-100">
                        <div className="flex justify-between items-center mb-8">
                          <h2 className="text-2xl font-black text-indigo-900 flex items-center gap-3">
                             <Brain className="w-7 h-7 text-indigo-600" /> AI Тутор (ToT + CoT)
                          </h2>
                          {!solverData && (
                            <button onClick={handleGenerateSolver} disabled={loadingState.solver} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-black shadow-lg hover:bg-indigo-700 transition active:scale-95">
                              {loadingState.solver ? '⏳ Смислувам...' : '🪄 Генерирај задача'}
                            </button>
                          )}
                        </div>
                        {solverData && <StepByStepSolver problem={solverData.problem} steps={solverData.steps} strategy={solverData.strategy} />}
                    </Card>
                  </div>
                )}

                {/* ТАБ: АКТИВНОСТИ */}
                {activeTab === 'activities' && (
                  <Card className="animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-emerald-700 flex items-center gap-3">
                          <Lightbulb className="w-7 h-7" /> Предлози за часот
                        </h2>
                        {!aiSuggestions && (
                            <button onClick={handleGenerateIdeas} disabled={loadingState.ideas} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black shadow-md">
                                {loadingState.ideas ? '⏳ Се генерира...' : '✨ Креирај идеи'}
                            </button>
                        )}
                    </div>
                    {aiSuggestions && (
                      <div className="bg-emerald-50 p-8 rounded-3xl border-l-8 border-emerald-400">
                        <MathRenderer text={formatIdeasToText(aiSuggestions)} />
                      </div>
                    )}
                  </Card>
                )}

                {/* ТАБ: АНАЛОГИЈА */}
                {activeTab === 'analogy' && (
                  <Card className="animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-purple-700 flex items-center gap-3">
                           <Sparkles className="w-7 h-7" /> Едноставно објаснување
                        </h2>
                        {!analogy && (
                            <button onClick={handleGenerateAnalogy} disabled={loadingState.analogy} className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-black">
                                {loadingState.analogy ? '⏳ Размислувам...' : '🧠 Направи аналогија'}
                            </button>
                        )}
                    </div>
                    {analogy && (
                      <div className="bg-purple-50 p-8 rounded-3xl text-purple-900 font-medium text-lg italic leading-relaxed shadow-inner">
                        <MathRenderer text={analogy} />
                      </div>
                    )}
                  </Card>
                )}

                {/* ТАБ: КВИЗ */}
                {activeTab === 'quiz' && (
                  <Card className="animate-in fade-in duration-500">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-black text-indigo-700">Интерактивно Вежбање</h2>
                        {!practiceMaterial && (
                            <button onClick={handleGenerateQuiz} disabled={loadingState.quiz} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black">
                                {loadingState.quiz ? '⏳ Се подготвува...' : '🎲 Креирај квиз'}
                            </button>
                        )}
                    </div>
                    {practiceMaterial && !isPlayingQuiz && (
                        <div className="flex flex-col items-center py-16 bg-slate-50 rounded-3xl border-4 border-dashed border-slate-200">
                            <h3 className="text-3xl font-black text-slate-800 mb-8 tracking-tighter">{practiceMaterial.title}</h3>
                            <div className="flex flex-wrap justify-center gap-4">
                                <button onClick={() => setIsPlayingQuiz(true)} className="bg-green-600 text-white px-10 py-5 rounded-3xl font-black text-xl shadow-xl hover:scale-105 transition">▶️ ИГРАЈ</button>
                                <button onClick={handlePrint} className="bg-slate-800 text-white px-8 py-5 rounded-3xl font-black flex items-center gap-2 hover:bg-black transition shadow-lg">
                                    <Printer className="w-6 h-6" /> ПЕЧАТИ PDF
                                </button>
                            </div>
                        </div>
                    )}
                    {isPlayingQuiz && practiceMaterial && (
                        <div className="relative pt-10">
                            <button onClick={() => setIsPlayingQuiz(false)} className="absolute top-0 right-0 bg-red-50 text-red-500 font-black px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition">ЗАТВОРИ ✕</button>
                            <InteractiveQuizPlayer 
                                title={practiceMaterial.title}
                                questions={practiceMaterial.items.map((item: any) => ({
                                    question: item.text,
                                    options: item.options || [item.answer, "Грешка 1", "Грешка 2", "Грешка 3"].sort(() => Math.random() - 0.5),
                                    answer: item.answer,
                                    explanation: item.solution
                                }))}
                            />
                        </div>
                    )}
                  </Card>
                )}
            </div>

            {/* ДЕСНА КОЛОНА */}
            <aside className="space-y-8">
                <Card className="bg-slate-900 border-none text-white overflow-hidden ring-4 ring-blue-500/20">
                    <div className="flex items-center gap-2 mb-6">
                       <Sparkles className="w-5 h-5 text-blue-400" />
                       <h3 className="font-black text-blue-400 uppercase tracking-widest text-xs">Дигитална Архива</h3>
                    </div>
                    <CachedResourcesBrowser 
                        conceptId={concept.id} 
                        onSelect={(content) => {
                            if (typeof content === 'string') {
                                if (activeTab === 'analogy') setAnalogy(content);
                                else if (activeTab === 'activities') setAiSuggestions(JSON.parse(content));
                            } else {
                                if (content.items || content.questions) setPracticeMaterial(content);
                                else if (content.steps) setSolverData(content);
                                else if (content.openingActivity) setAiSuggestions(content);
                            }
                            addNotification("Материјалот е преземен од архивата!", "success");
                        }} 
                    />
                </Card>
            </aside>
        </div>
        
        {/* СКРИЕН ДЕЛ ЗА PDF ЕКСПОРТ (Оптимизиран) */}
        <div style={{ display: 'none' }}>
            <div ref={printComponentRef} className="p-16 text-black bg-white">
                <div className="border-b-8 border-black pb-6 mb-12">
                    <h1 className="text-5xl font-black uppercase tracking-tighter">{concept.title}</h1>
                    <p className="text-2xl font-bold text-gray-500 mt-2">Наставен лист за вежбање • {grade.title}</p>
                </div>
                {practiceMaterial?.items.map((q: any, i: number) => (
                    <div key={i} className="mb-14 break-inside-avoid">
                        <p className="text-2xl font-bold mb-6">{i+1}. {q.text}</p>
                        <div className="h-40 border-4 border-black/5 rounded-3xl"></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
