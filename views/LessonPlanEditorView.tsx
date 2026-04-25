import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';
import { usePlanner } from '../contexts/PlannerContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import type { LessonPlan } from '../types';
import { InfographicPreviewModal } from '../components/ai/InfographicPreviewModal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ICONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useNavigation } from '../contexts/NavigationContext';
import { AIContextSelector } from '../components/lesson-plan-editor/AIContextSelector';
import { AIPedagogicalAnalysisDisplay } from '../components/lesson-plan-editor/AIPedagogicalAnalysisDisplay';
import { MathToolsPanel } from '../components/common/MathToolsPanel';
import { LessonPlanFormFields } from '../components/lesson-plan-editor/LessonPlanFormFields';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
import { LessonPlanDisplay } from '../components/planner/LessonPlanDisplay';
import { usePersistentState } from '../hooks/usePersistentState';
import { PedagogicalDashboard } from '../components/lesson-plan-editor/PedagogicalDashboard';
import { AILessonAssistant } from '../components/lesson-plan-editor/AILessonAssistant';
import { GeneratedIllustration } from '../components/ai/GeneratedIllustration';
import { initialPlanState } from '../components/lesson-plan-editor/lessonPlanEditorHelpers';
import { useLessonPlanAIActions } from '../components/lesson-plan-editor/useLessonPlanAIActions';
import { useLessonPlanExport } from '../components/lesson-plan-editor/useLessonPlanExport';
import { LessonPlanExportMenu } from '../components/lesson-plan-editor/LessonPlanExportMenu';
import { LessonPlanDifferentiationPanel } from '../components/lesson-plan-editor/LessonPlanDifferentiationPanel';


interface LessonPlanEditorViewProps {
  id?: string;
  prefillTopic?: string;
  prefillGrade?: string;
  prefillSubject?: string;
}

export const LessonPlanEditorView: React.FC<LessonPlanEditorViewProps> = ({ id, prefillTopic, prefillGrade, prefillSubject }) => {
  const { navigate } = useNavigation();
  const { getLessonPlan, addLessonPlan, updateLessonPlan } = usePlanner();
  const { curriculum, isLoading: isCurriculumLoading } = useCurriculum();
  const { addNotification } = useNotification();
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();

  const [plan, setPlan, clearDraft, lastSaved] = usePersistentState<Partial<LessonPlan>>(
    id ? `lesson-plan-draft-${id}` : 'lesson-plan-new-draft',
    initialPlanState
  );

  const [showMathTools, setShowMathTools] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; title?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void } | null>(null);

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
          if (prefillTopic) {
            const gradeNum = prefillGrade ? parseInt(prefillGrade, 10) || 6 : 6;
            const gradeData = curriculum.grades.find(g => g.level === gradeNum)
              ?? curriculum.grades.find(g => prefillGrade?.includes(String(g.level)))
              ?? curriculum.grades[0];
            const matchedTopic = gradeData?.topics.find(t =>
              t.title.toLowerCase().includes(prefillTopic.toLowerCase()) ||
              prefillTopic.toLowerCase().includes(t.title.toLowerCase())
            ) ?? gradeData?.topics[0];
            return {
              ...initialPlanState,
              grade: gradeData?.level || gradeNum,
              topicId: matchedTopic?.id || '',
              theme: prefillTopic,
              subject: prefillSubject || 'Математика',
              title: `${prefillSubject || 'Математика'} — ${prefillTopic}`,
            };
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing, getLessonPlan, navigate, addNotification, curriculum, isCurriculumLoading]);

  const ai = useLessonPlanAIActions({
    plan, setPlan, user, curriculum, isOnline, isMounted, addNotification,
  });

  const exporter = useLessonPlanExport({ plan, user, addNotification });

  const handleSave = useCallback(async () => {
    if (!plan.title) {
      addNotification('Насловот е задолжителен.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing) {
        await updateLessonPlan(plan as LessonPlan);
        clearDraft();
        if (isMounted.current) {
          addNotification('Подготовката е успешно ажурирана!', 'success');
          navigate('/my-lessons');
        }
      } else {
        const newPlanId = await addLessonPlan(plan as Omit<LessonPlan, 'id'>);
        clearDraft();
        if (isMounted.current) {
          addNotification('Подготовката е успешно креирана!', 'success');
          navigate(`/planner/lesson/${newPlanId}`);
        }
      }
    } catch (error) {
      logger.error('Failed to save lesson plan:', error);
      if (isMounted.current) {
        addNotification('Грешка при зачувување на подготовката.', 'error');
      }
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  }, [plan, isEditing, addNotification, clearDraft, navigate, addLessonPlan, updateLessonPlan]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving) handleSave();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleSave, isSaving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave();
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
      <header className="mb-6 no-print flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button onClick={() => navigate('/my-lessons')} className="text-brand-secondary hover:underline mb-2">
            &larr; Назад кон моите подготовки
          </button>
          <h1 className="text-4xl font-bold text-brand-primary">
            {isEditing ? 'Уреди подготовка за час' : 'Креирај нова подготовка'}
          </h1>
        </div>

        {lastSaved && (
          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex items-center text-gray-500 gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border">
              <ICONS.check className="w-4 h-4 text-green-500" />
              <span>Автоматски зачувано во {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button
              onClick={() => {
                setConfirmDialog({
                  message: 'Дали сте сигурни дека сакате да го отфрлите нацртот? Сите промени ќе бидат изгубени.',
                  variant: 'danger',
                  onConfirm: () => { setConfirmDialog(null); clearDraft(); }
                });
              }}
              className="text-red-600 hover:text-red-700 hover:underline transition-colors flex items-center gap-1"
            >
              <ICONS.trash className="w-3.5 h-3.5" />
              Отфрли нацрт
            </button>
          </div>
        )}
      </header>

      <div className="no-print">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <Card>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className={`${!isOnline ? 'opacity-50 pointer-events-none grayscale relative' : ''}`}>
                  {!isOnline && <div className="absolute inset-0 z-10 bg-gray-100/20 cursor-not-allowed flex items-center justify-center"><span className="bg-white px-3 py-1 rounded shadow text-sm font-bold text-red-600">Офлајн</span></div>}
                  <AIContextSelector
                    plan={plan}
                    onGenerate={ai.handleGenerateWithAI}
                    isGenerating={ai.isGenerating}
                  />
                </div>

                <div className={`${!isOnline ? 'opacity-50 pointer-events-none grayscale relative' : ''}`}>
                  {!isOnline && <div className="absolute inset-0 z-10 bg-gray-100/20 cursor-not-allowed flex items-center justify-center"><span className="bg-white px-3 py-1 rounded shadow text-sm font-bold text-red-600">Офлајн</span></div>}
                  <AIPedagogicalAnalysisDisplay
                    analysis={ai.aiAnalysis}
                    onAnalyze={ai.handleAnalyze}
                    isAnalyzing={ai.isAnalyzing}
                    planTitle={plan.title}
                  />
                </div>

                <LessonPlanFormFields
                  plan={plan}
                  setPlan={setPlan}
                  onEnhanceField={ai.handleEnhanceField}
                  onRegenerateSection={ai.handleRegenerateSection}
                  onGenerateIllustration={ai.handleGenerateIllustration}
                  enhancingField={ai.enhancingField}
                  isRegenerating={ai.isRegeneratingSection || (ai.isGeneratingIllustration ? 'illustration' : null)}
                />

                {ai.isGeneratingIllustration && (
                  <div className="flex flex-col items-center justify-center p-8 bg-teal-50 rounded-xl border-2 border-dashed border-teal-200 animate-pulse">
                    <ICONS.spinner className="w-10 h-10 text-teal-500 animate-spin mb-3" />
                    <p className="text-teal-700 font-semibold text-lg">Генерирам илустрација за вашата активност...</p>
                  </div>
                )}

                {ai.generatedIllustration && (
                  <div className="mt-6 relative">
                    <button
                      onClick={() => ai.setGeneratedIllustration(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
                    >
                      <ICONS.close className="w-4 h-4" />
                    </button>
                    <GeneratedIllustration material={ai.generatedIllustration} />
                  </div>
                )}

                <div className="flex justify-end items-center pt-4 gap-3 border-t mt-6 flex-wrap">
                  {(user?.tier === 'Pro' || user?.tier === 'Unlimited') && plan?.title && (
                    <button
                      type="button"
                      onClick={ai.handleGenerateInfographic}
                      disabled={ai.isGeneratingInfographic}
                      className="flex items-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-lg shadow hover:bg-purple-700 transition-colors font-semibold disabled:bg-purple-300 text-sm"
                      title="Генерирај инфографик за овој час (Premium)"
                    >
                      {ai.isGeneratingInfographic
                        ? <><ICONS.spinner className="w-4 h-4 animate-spin" /> Генерирам…</>
                        : <>🎨 Инфографик</>}
                    </button>
                  )}
                  <LessonPlanExportMenu
                    disabled={!plan.title}
                    isOpen={exporter.isExportMenuOpen}
                    setIsOpen={exporter.setIsExportMenuOpen}
                    isGeneratingWord={exporter.isGeneratingWord}
                    onExport={exporter.handleExport}
                  />
                  <button
                    type="submit"
                    disabled={isSaving}
                    title="Зачувај (Ctrl+S)"
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

          <aside className="w-full lg:w-80 space-y-4">
            <PedagogicalDashboard activities={plan.scenario?.main || []} />

            <AILessonAssistant
              onApply={(suggestion) => {
                setPlan(prev => ({
                  ...prev,
                  differentiation: prev.differentiation
                    ? `${prev.differentiation}\n\n--- AI Assistant ---\n${suggestion}`
                    : suggestion,
                }));
              }}
            />

            <LessonPlanDifferentiationPanel
              diffActivities={ai.diffActivities}
              isGenerating={ai.isGeneratingDiff}
              canGenerate={!!(plan.title || plan.theme)}
              onGenerate={ai.handleGenerateDifferentiation}
            />
          </aside>
        </div>
      </div>

      <div id="printable-area" className="hidden print:block">
        <div className="mb-6 border-b pb-4">
          <p className="text-md text-gray-500">Предмет: {plan.subject}</p>
          <p className="text-md text-gray-500">Тема: {plan.theme}</p>
          <h1 className="text-2xl font-bold text-brand-primary mt-2">{plan.title}</h1>
          <p className="text-lg text-gray-600">{plan.grade}. Одделение</p>
        </div>
        <LessonPlanDisplay plan={plan as LessonPlan} />
      </div>

      {showMathTools && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] md:h-[80vh] relative flex flex-col overflow-hidden border border-gray-200 mt-4 md:mt-0">
            <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-700 flex items-center justify-center gap-2"><ICONS.math className="w-5 h-5" />Математички Алатки</h3>
              <button type="button" title="Затвори алатки" onClick={() => setShowMathTools(false)} className="text-gray-500 hover:text-red-500 bg-white border p-1 rounded-md transition-colors"><ICONS.close className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 relative overflow-hidden bg-slate-50">
              <MathToolsPanel
                onClose={() => setShowMathTools(false)}
                className="h-full"
                onExportImage={(dataUrl, tool) => {
                  setPlan(prev => ({
                    ...prev,
                    mathEmbeds: [
                      ...(prev.mathEmbeds ?? []),
                      { tool, dataUrl, createdAt: new Date().toISOString() },
                    ],
                  }));
                  addNotification(`${tool === 'geogebra' ? 'GeoGebra' : 'Desmos'} сликата е додадена во планот.`, 'success');
                }}
              />
            </div>
          </div>
        </div>
      )}

      {ai.infographicLayout && (
        <InfographicPreviewModal
          layout={ai.infographicLayout}
          onClose={() => ai.setInfographicLayout(null)}
        />
      )}

      <button
        type="button"
        onClick={() => setShowMathTools(true)}
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl transition-all z-40 flex items-center justify-center group no-print hover:scale-110 active:scale-95"
        title="Математички Алатки (GeoGebra, Desmos...)"
      >
        <ICONS.math className="w-6 h-6 group-hover:animate-pulse" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap pl-0 group-hover:pl-2 font-black tracking-wide text-sm">Алатки за креирање</span>
      </button>
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          title={confirmDialog.title}
          variant={confirmDialog.variant ?? 'warning'}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};
