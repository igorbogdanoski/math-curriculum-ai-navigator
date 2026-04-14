import { logger } from '../utils/logger';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import { RateLimitError } from '../services/apiErrors';
import type { AIGeneratedIdeas, AIGeneratedPracticeMaterial, AIGeneratedPresentation } from '../types';
import { GammaModeModal } from '../components/ai/GammaModeModal';
import { SilentErrorBoundary } from '../components/common/SilentErrorBoundary';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useAuth } from '../contexts/AuthContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { MathRenderer } from '../components/common/MathRenderer';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useLastVisited } from '../contexts/LastVisitedContext';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { CachedResourcesBrowser } from '../components/common/CachedResourcesBrowser';
import { ForumCTA } from '../components/common/ForumCTA';
import { StepByStepSolver } from '../components/StepByStepSolver';
import { GeometryExplorer } from '../components/GeometryExplorer';
import { useReactToPrint } from 'react-to-print';
import { Printer, Share2, Brain, GraduationCap, Sparkles, Lightbulb, Zap, MonitorPlay, Loader2 } from 'lucide-react';
import { QuickToolsPanel } from '../components/common/QuickToolsPanel';
import { DokBadge, DokDistributionBar } from '../components/common/DokBadge';
import { firestoreService } from '../services/firestoreService';
import type { SavedQuestion, DokLevel } from '../types';

const DOK_LEVELS: DokLevel[] = [1, 2, 3, 4];

const InteractiveQuizPlayer = React.lazy(() => import('../components/ai/InteractiveQuizPlayer').then(m => ({ default: m.InteractiveQuizPlayer })));

// ─── MaturaQuestionsBlock (B1/N2) ─────────────────────────────────────────────

interface MatBankQuestion {
  questionNumber: number;
  part: 1 | 2;
  questionType: 'mc' | 'open';
  questionText: string;
  choices?: Record<string, string> | null;
  correctAnswer: string;
  topicArea: string;
  dokLevel: DokLevel;
  conceptIds: string[];
}

function MaturaQuestionsBlock({ conceptId }: { conceptId: string }) {
  const [open,     setOpen]     = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [matches,  setMatches]  = useState<MatBankQuestion[]>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const loaded = useRef(false);

  function toggle() {
    if (!open && !loaded.current) {
      loaded.current = true;
      setLoading(true);
      import('../data/matura/raw/internal-matura-bank-gymnasium-mk.json')
        .then((mod) => {
          const bank = mod.default as unknown as { questions: MatBankQuestion[] };
          setMatches(bank.questions.filter(q => q.conceptIds.includes(conceptId)));
        })
        .catch(() => {/* non-fatal */})
        .finally(() => setLoading(false));
    }
    setOpen(o => !o);
  }

  function toggleReveal(n: number) {
    setRevealed(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  }

  const count = matches.length;

  return (
    <div className="mt-6 border border-rose-100 rounded-2xl overflow-hidden bg-white">
      {/* Header toggle */}
      <button type="button" onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-rose-50 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="text-base">📝</span>
          <span className="font-bold text-sm text-gray-800">Матурски прашања</span>
          {!loading && loaded.current && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${count > 0 ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-500'}`}>
              {count}
            </span>
          )}
          {loading && <span className="text-xs text-gray-400 animate-pulse">се вчитува…</span>}
        </div>
        <span className="text-gray-400 text-sm font-bold">{open ? '▲' : '▼'}</span>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-rose-100 px-4 pb-4 pt-3 space-y-3">
          {loading ? (
            <div className="text-xs text-gray-400 py-2 text-center animate-pulse">Се вчитуваат прашањата…</div>
          ) : count === 0 ? (
            <div className="text-xs text-gray-400 py-3 text-center">
              Нема матурски прашања поврзани со овој концепт.
            </div>
          ) : (
            matches.map(q => {
              const isRev = revealed.has(q.questionNumber);
              const isMC  = q.questionType === 'mc';
              return (
                <div key={q.questionNumber}
                  className="border border-gray-100 rounded-xl p-3.5 space-y-2 hover:border-rose-200 transition-colors">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isMC ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isMC ? 'MC' : 'Отворено'}
                    </span>
                    <DokBadge level={q.dokLevel} size="compact" />
                    <span className="text-[11px] text-gray-400 ml-auto">Училишна матура</span>
                  </div>
                  <div className="text-sm text-gray-800 leading-relaxed">
                    <MathRenderer text={q.questionText} />
                  </div>
                  {isMC && q.choices && !isRev && (
                    <div className="grid grid-cols-2 gap-1">
                      {(['А','Б','В','Г'] as const).map(ch => q.choices![ch] ? (
                        <div key={ch} className="text-[11px] px-2 py-1 bg-gray-50 rounded-lg text-gray-600">
                          <span className="font-semibold">{ch}. </span><MathRenderer text={q.choices![ch]!} />
                        </div>
                      ) : null)}
                    </div>
                  )}
                  {isRev && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <p className="text-[11px] font-semibold text-emerald-700 mb-0.5">Точен одговор:</p>
                      <div className="text-xs text-gray-800"><MathRenderer text={q.correctAnswer} /></div>
                    </div>
                  )}
                  <button type="button" onClick={() => toggleReveal(q.questionNumber)}
                    className="text-[11px] text-rose-600 hover:underline">
                    {isRev ? '🙈 Скриј одговор' : '👁 Прикажи одговор'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

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
  const { user, firebaseUser } = useAuth();
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
    ideas: false, analogy: false, quiz: false, solver: false, gamma: false
  });
  const [dokQuestions, setDokQuestions] = useState<SavedQuestion[]>([]);
  const [gammaPresentation, setGammaPresentation] = useState<AIGeneratedPresentation | null>(null);
  const [gammaOpen, setGammaOpen] = useState(false);

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

  const handleOpenGenerator = () => {
    if (!concept || !topic || !grade) return;
    const standardsText = concept.assessmentStandards?.length
        ? `Цели на учење:\n${concept.assessmentStandards.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`
        : '';
    const activitiesText = concept.activities?.length
        ? `\n\nПредложени активности од програмата:\n${concept.activities.slice(0, 5).map((a: string) => `• ${a}`).join('\n')}`
        : '';
    openGeneratorPanel({
        selectedGrade: grade.id,
        selectedTopic: topic.id,
        selectedConcepts: [concept.id],
        contextType: 'CONCEPT',
        customInstruction: `${standardsText}${activitiesText}`.trim(),
    });
  };

  // Helper: extract a user-friendly message from any caught error
  const aiErrMsg = (e: unknown, fallback: string): string => {
    if (e instanceof RateLimitError) return "AI квотата е исцрпена. Обидете се повторно утре.";
    if (e instanceof Error && e.message) return e.message;
    return fallback;
  };

  // Build curriculum context string for AI Tutor (same as generator panel)
  const conceptCustomInstruction = useMemo(() => {
    if (!concept) return '';
    const standardsText = concept.assessmentStandards?.length
        ? `Цели на учење:\n${concept.assessmentStandards.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n')}`
        : '';
    const activitiesText = concept.activities?.length
        ? `\nПредложени активности:\n${concept.activities.slice(0, 4).map((a: string) => `• ${a}`).join('\n')}`
        : '';
    return `${standardsText}${activitiesText}`.trim();
  }, [concept]);

  const handleGenerateIdeas = async () => {
    if (!concept || !topic || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, ideas: true }));
    try {
      const ideas = await geminiService.generateLessonPlanIdeas([concept], topic, grade.level, user ?? undefined, undefined, conceptCustomInstruction || undefined);
      setAiSuggestions(ideas);
    } catch(e) {
      logger.error("[AI Ideas]", e);
      addNotification(aiErrMsg(e, "Грешка при генерирање идеи."), 'error');
    }
    finally { setLoadingState(p => ({ ...p, ideas: false })); }
  };

  const handleGenerateAnalogy = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, analogy: true }));
    try {
      const res = await geminiService.generateAnalogy(concept, grade.level);
      setAnalogy(res);
    } catch(e) {
      logger.error("[AI Analogy]", e);
      addNotification(aiErrMsg(e, "Грешка при генерирање аналогија."), 'error');
    }
    finally { setLoadingState(p => ({ ...p, analogy: false })); }
  };

  const handleGenerateQuiz = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, quiz: true }));
    try {
      const res = await geminiService.generatePracticeMaterials(concept, grade.level, 'problems');
      setPracticeMaterial(res);
    } catch(e) {
      logger.error("[AI Quiz]", e);
      addNotification(aiErrMsg(e, "Грешка при креирање квиз."), 'error');
    }
    finally { setLoadingState(p => ({ ...p, quiz: false })); }
  };

  const handleGenerateGamma = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, gamma: true }));
    try {
      const presentation = await geminiService.generatePresentation(
        concept.title,
        grade.level,
        [concept.title],
        conceptCustomInstruction || undefined,
        user ?? undefined,
      );
      setGammaPresentation(presentation);
      setGammaOpen(true);
    } catch (e) {
      logger.error('[AI Gamma]', e);
      addNotification(aiErrMsg(e, 'Грешка при генерирање презентација.'), 'error');
    } finally {
      setLoadingState(p => ({ ...p, gamma: false }));
    }
  };

  const handleGenerateSolver = async () => {
    if (!concept || !grade || checkThrottle()) return;
    setLoadingState(p => ({ ...p, solver: true }));
    try {
      // Pass curriculum context so AI Tutor generates a problem relevant to the specific concept goals
      const res = await geminiService.generateStepByStepSolution(concept.title, grade.level, conceptCustomInstruction || undefined);
      setSolverData(res);
    } catch(e) {
      logger.error("[AI Solver]", e);
      addNotification(aiErrMsg(e, "Грешка во AI Туторот."), "error");
    }
    finally { setLoadingState(p => ({ ...p, solver: false })); }
  };

  useEffect(() => {
    if (concept) setLastVisited({ path: `/concept/${id}`, label: concept.title, type: 'concept' });
  }, [concept, id, setLastVisited]);

  // Fetch DoK coverage from teacher's question bank for this concept
  useEffect(() => {
    if (!firebaseUser?.uid || !concept) return;
    firestoreService.fetchSavedQuestions(firebaseUser.uid).then(qs => {
      setDokQuestions(qs.filter(q => q.conceptId === concept.id && q.dokLevel));
    }).catch(() => {/* non-fatal */});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, concept?.id]);

  if (!concept || !topic || !grade) {
      return (
        <div className="relative">
            <SkeletonLoader type="page" />
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-yellow-50 p-4 border border-yellow-200 rounded-lg shadow-lg text-center max-w-md">
                <h3 className="font-bold text-yellow-700 mb-2">Статус на вчитување</h3>
                <div className="text-sm text-left font-mono bg-white p-2 rounded border space-y-1">
                    <p><strong>ID:</strong> {id}</p>
                    <p><strong>Grade:</strong> {grade?.id || 'MISSING'}</p>
                    <p><strong>Topic:</strong> {topic?.id || 'MISSING'}</p>
                    <p><strong>Concept:</strong> {concept?.id || 'MISSING'}</p>
                </div>
                <p className="text-xs text-gray-500 mt-2">Ако оваа порака стои повеќе од 2 секунди, можно е податоците да недостасуваат или ID-то да е погрешно.</p>
                <button 
                  onClick={() => navigate('/explore')}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Врати се назад
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="p-4 md:p-8 animate-fade-in pb-24 text-left">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-4 flex-wrap">
            <button type="button" onClick={() => navigate('/explore')} className="hover:text-brand-primary transition-colors">Програма</button>
            <ICONS.chevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <button type="button" onClick={() => navigate(`/topic/${topic.id}`)} className="hover:text-brand-primary transition-colors max-w-[180px] truncate">{topic.title}</button>
            <ICONS.chevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-brand-primary font-semibold max-w-[180px] truncate">{concept.title}</span>
        </nav>
        <header className="mb-8 md:mb-10">
              <div className="flex items-center gap-4">
                <h1 className="text-4xl font-black text-brand-primary tracking-tight">
                  <MathRenderer text={concept.title} />
                </h1>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => toggleFavoriteConcept(concept.id)} aria-label={isFavoriteConcept(concept.id) ? 'Отстрани од омилени' : 'Додај во омилени'} className="text-yellow-500 hover:scale-110 transition">
                    {isFavoriteConcept(concept.id) ? <ICONS.starSolid className="w-8 h-8" /> : <ICONS.star className="w-8 h-8" />}
                  </button>
                  <button type="button" onClick={handleShare} aria-label="Сподели со ученици" className="text-blue-500 hover:scale-110 transition p-2 rounded-full hover:bg-blue-50">
                    <Share2 className="w-8 h-8" />
                  </button>
                  <ForumCTA context={concept.title} variant="inline" />
                  <button
                    onClick={handleOpenGenerator}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:bg-brand-secondary transition active:scale-95"
                    title="Отвори го Генераторот за овој поим"
                  >
                    <Zap className="w-4 h-4" />
                    Генерирај Материјали
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateGamma}
                    disabled={loadingState.gamma}
                    title="Направи Gamma презентација за овој поим"
                    className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-md hover:opacity-90 transition active:scale-95 disabled:opacity-60"
                  >
                    {loadingState.gamma
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерирам слајдови...</>
                      : <><MonitorPlay className="w-4 h-4" /> Gamma Презентација</>
                    }
                  </button>
                </div>
              </div>
              <p className="text-xl text-gray-400 font-bold mt-2 uppercase tracking-wide">
                {grade.title} • {topic.title}
              </p>
        </header>

        {/* Навигација низ табови */}
        <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-4 mb-8 md:mb-10">
            {([
                { id: 'overview',    icon: GraduationCap, label: 'Преглед',     color: 'bg-blue-600' },
                { id: 'activities',  icon: Lightbulb,     label: 'Активности',  color: 'bg-emerald-600' },
                { id: 'analogy',     icon: Brain,         label: 'Аналогија',   color: 'bg-purple-600' },
                { id: 'quiz',        icon: ICONS.quiz,    label: 'Квиз',        color: 'bg-indigo-600' },
            ] as const).map(t => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id as typeof activeTab)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all ${activeTab === t.id ? `${t.color} text-white shadow-lg` : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 hover:text-gray-700 hover:shadow-sm'}`}
                >
                    <t.icon className="w-4 h-4" />
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
                             <Brain className="w-7 h-7 text-indigo-600" /> AI Тутор — Решавање чекор по чекор
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
                        <button
                            type="button"
                            onClick={() => { setAiSuggestions(null); handleGenerateIdeas(); }}
                            disabled={loadingState.ideas}
                            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition disabled:opacity-60"
                        >
                            {loadingState.ideas ? 'Се генерира...' : aiSuggestions ? 'Регенерирај' : 'Креирај идеи'}
                        </button>
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
                        <button
                            type="button"
                            onClick={() => { setAnalogy(null); handleGenerateAnalogy(); }}
                            disabled={loadingState.analogy}
                            className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-60"
                        >
                            {loadingState.analogy ? 'Размислувам...' : analogy ? 'Регенерирај' : 'Направи аналогија'}
                        </button>
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
                        {!isPlayingQuiz && (
                            <button
                                type="button"
                                onClick={() => { setPracticeMaterial(null); handleGenerateQuiz(); }}
                                disabled={loadingState.quiz}
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-60"
                            >
                                {loadingState.quiz ? 'Се подготвува...' : practiceMaterial ? 'Нов квиз' : 'Креирај квиз'}
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
                            <React.Suspense fallback={<div className="p-8 text-center bg-white rounded-3xl m-6 animate-pulse"><div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-slate-500 font-bold">Се вчитува квизот...</p></div>}>
                                <InteractiveQuizPlayer
                                    title={practiceMaterial.title}
                                    questions={practiceMaterial.items.map((item: any) => ({
                                        question: item.text,
                                        options: item.options || [item.answer, "Грешка 1", "Грешка 2", "Грешка 3"].sort(() => Math.random() - 0.5),
                                        answer: item.answer,
                                        explanation: item.solution
                                    }))}
                                    onClose={() => setIsPlayingQuiz(false)}
                                />
                            </React.Suspense>
                        </div>
                    )}
                  </Card>
                )}
            </div>

            {/* ДЕСНА КОЛОНА */}
            <aside className="space-y-8">
                {/* DoK Coverage Ring */}
                <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-violet-50/40">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg font-black text-indigo-700">DoK Покриеност</span>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Банка прашања</span>
                  </div>
                  {dokQuestions.length > 0 ? (
                    <div className="space-y-3">
                      <DokDistributionBar questions={dokQuestions} />
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {DOK_LEVELS.map(lvl => {
                          const cnt = dokQuestions.filter(q => q.dokLevel === lvl).length;
                          return (
                            <div key={lvl} className="flex items-center gap-2">
                              <DokBadge level={lvl} size="compact" showTooltip />
                              <span className="text-xs font-bold text-gray-500">{cnt} прашање{cnt !== 1 ? 'а' : ''}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-gray-400 font-medium">Нема прашања со DoK ниво</p>
                      <p className="text-[10px] text-gray-300 mt-1">Додај DoK нивоа во Банката на прашања за овој концепт</p>
                    </div>
                  )}
                </Card>
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
        
        {/* Матурски прашања (B1/N2) */}
        <div className="max-w-4xl mx-auto px-4">
          <MaturaQuestionsBlock conceptId={concept.id} />
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

      <QuickToolsPanel
        gradeId={grade.id}
        topicId={topic.id}
        conceptIds={[concept.id]}
        gradeName={grade.title}
        topicName={topic.title}
      />

      {gammaOpen && gammaPresentation && (
        <SilentErrorBoundary name="GammaModeConcept" fallback={
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 text-white cursor-pointer" onClick={() => setGammaOpen(false)}>
            <p className="text-slate-400">Gamma Mode не можеше да се вчита. Кликни за да затвориш.</p>
          </div>
        }>
          <GammaModeModal data={gammaPresentation} onClose={() => setGammaOpen(false)} />
        </SilentErrorBoundary>
      )}
    </div>
  );
};
