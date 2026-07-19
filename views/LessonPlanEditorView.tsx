import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
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
import { publishScenario, updateScenarioMetadata } from '../services/firestoreService.scenarioBank';
import { PublishScenarioDialog } from '../components/scenario-bank/PublishScenarioDialog';
import type { PublishScenarioOptions } from '../components/scenario-bank/PublishScenarioDialog';
import { AIContextSelector } from '../components/lesson-plan-editor/AIContextSelector';
import { AIPedagogicalAnalysisDisplay } from '../components/lesson-plan-editor/AIPedagogicalAnalysisDisplay';
import { MathToolsPanel } from '../components/common/MathToolsPanel';
import { LessonPlanFormFields } from '../components/lesson-plan-editor/LessonPlanFormFields';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
import { LessonPlanDisplay } from '../components/planner/LessonPlanDisplay';
import { usePersistentState } from '../hooks/usePersistentState';
import { GeneratedIllustration } from '../components/ai/GeneratedIllustration';
import { initialPlanState } from '../components/lesson-plan-editor/lessonPlanEditorHelpers';
import { LessonExecutionOverlay } from '../components/classroom/LessonExecutionOverlay';
import { useLessonPlanAIActions } from '../components/lesson-plan-editor/useLessonPlanAIActions';
import { useLessonPlanExport } from '../components/lesson-plan-editor/useLessonPlanExport';
import { LessonPlanExportMenu } from '../components/lesson-plan-editor/LessonPlanExportMenu';
import { PlanningBreadcrumb } from '../components/planner/PlanningBreadcrumb';
import { PlanningChainBar } from '../components/planner/PlanningChainBar';
import { CoachBubble } from '../components/common/CoachBubble';
import type { ScenarioBankEntry } from '../services/firestoreService.scenarioBank';
import { UploadedScenarioBanner } from '../components/lesson-plan-editor/UploadedScenarioBanner';
import { DraftMergeDialog } from '../components/lesson-plan-editor/DraftMergeDialog';
import { ConfirmScenarioGradeModal } from '../components/lesson-plan-editor/ConfirmScenarioGradeModal';
import { loadAndClearUploadDraft } from '../services/uploadDraftService';
import { resolveGradeByLabel, findTopicByFuzzyTitle } from '../utils/gradeMatch';
import type { SecondaryTrack } from '../types';
import { ReflectionModal, type ReflectionState } from '../components/lesson-plan-editor/ReflectionModal';
import { OfficialLessonFormModal } from '../components/lesson-plan-editor/OfficialLessonFormModal';
import { LessonPlanSidebar } from '../components/lesson-plan-editor/LessonPlanSidebar';
import { usePlanEditorModals } from '../components/lesson-plan-editor/usePlanEditorModals';
import { useLanguage } from '../i18n/LanguageContext';


interface LessonPlanEditorViewProps {
  id?: string;
  prefillTopic?: string;
  prefillGrade?: string;
  prefillSubject?: string;
  prefillLessonUnit?: string;
  prefillLessonNumber?: string;
}

export const LessonPlanEditorView: React.FC<LessonPlanEditorViewProps> = ({ id, prefillTopic, prefillGrade, prefillSubject, prefillLessonUnit, prefillLessonNumber }) => {
  const { navigate } = useNavigation();
  const { getLessonPlan, addLessonPlan, updateLessonPlan } = usePlanner();
  const { curriculum, isLoading: isCurriculumLoading } = useCurriculum();
  const { addNotification } = useNotification();
  const { user, firebaseUser } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { t } = useLanguage();

  const [plan, setPlan, clearDraft, lastSaved] = usePersistentState<Partial<LessonPlan>>(
    id ? `lesson-plan-draft-${id}` : 'lesson-plan-new-draft',
    initialPlanState
  );

  const modals = usePlanEditorModals({ id });
  const [isSaving, setIsSaving] = useState(false);
  const [savedPlanForCoach, setSavedPlanForCoach] = useState<{ plan: typeof plan; key: string; navigateTo: string } | null>(null);
  const [autoShareToBank, setAutoShareToBank] = useState(false);

  const [showUploadBanner, setShowUploadBanner] = useState(false);
  const [pendingUpload, setPendingUpload] = useState<{ parsed: Partial<LessonPlan>; fileName: string } | null>(null);
  // Forces explicit grade + education-track confirmation before an uploaded scenario is
  // ever applied to plan state — grade must never be silently defaulted (e.g. to initialPlanState's 6).
  const [pendingGradeConfirm, setPendingGradeConfirm] = useState<{
    initialGrade?: number;
    initialTrack?: SecondaryTrack;
    commit: (grade: number, track?: SecondaryTrack) => void;
  } | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [reflection, setReflection] = useState<ReflectionState>({ wentWell: '', challenges: '', nextSteps: '' });
  const [postSaveNav, setPostSaveNav] = useState<{ plan: Partial<LessonPlan>; key: string; navigateTo: string } | null>(null);

  const isMounted = useRef(true);
  const isEditing = useMemo(() => id !== undefined, [id]);
  const [isDirty, setIsDirty] = useState(false);
  const isInitialLoad = useRef(true);

  const { setConfirmDialog } = modals;

  // S96.2 — Scenario Bank → Lesson Plan Bridge
  const handleImportScenario = useCallback((entry: ScenarioBankEntry) => {
    setConfirmDialog({
      message: t('lessonPlan.confirmImportScenario.message'),
      title: t('lessonPlan.confirmImportScenario.title'),
      variant: 'warning',
      onConfirm: () => {
        setPlan(prev => ({
          ...prev,
          scenario: {
            introductory: { text: entry.scenarioIntro, bloomsLevel: undefined, dokLevel: undefined },
            main: entry.scenarioMain.map(text => ({ text, bloomsLevel: undefined, dokLevel: undefined })),
            concluding: { text: entry.scenarioConcluding, bloomsLevel: undefined, dokLevel: undefined },
          },
        }));
        setConfirmDialog(null);
        addNotification(t('lessonPlan.scenarioImported'), 'success');
      },
    });
  }, [addNotification, setPlan, setConfirmDialog, t]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Track dirty state — skip the first render/load so editing an existing plan
  // doesn't immediately show the unsaved-changes warning.
  useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    if (plan.title || plan.topicId) setIsDirty(true);
  }, [plan]);

  // Warn user before closing tab if they have unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isSaving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isSaving]);

  useEffect(() => {
    if (isCurriculumLoading || !curriculum) return;

    // S106-Г — Cloud draft sync: load uploaded scenario from Firestore (replaces sessionStorage)
    if (!isEditing && firebaseUser?.uid) {
      void (async () => {
        try {
          const draft = await loadAndClearUploadDraft(firebaseUser.uid!);
          if (!draft) return;
          const hasExistingContent = plan.title || plan.scenario?.introductory?.text || (plan.scenario?.main?.length ?? 0) > 0;
          if (hasExistingContent) {
            // S106-Б — DraftMergeDialog: non-empty draft conflicts with upload
            setPendingUpload(draft);
          } else {
            // Auto-match curriculum topicId from the extracted theme text
            const parsed = draft.parsed;
            let autoTopicId = '';
            if (parsed.theme && curriculum && parsed.grade) {
              const gradeData = curriculum.grades.find(g => g.level === parsed.grade);
              const themeNorm = parsed.theme.toLowerCase().trim();
              const matchedTopic = gradeData?.topics.find(t => {
                const tNorm = t.title.toLowerCase().trim();
                return tNorm.includes(themeNorm) || themeNorm.includes(tNorm) ||
                  // word-level overlap: ≥2 common words ≥4 chars
                  themeNorm.split(/\s+/).filter(w => w.length >= 4 && tNorm.includes(w)).length >= 2;
              });
              if (matchedTopic) autoTopicId = matchedTopic.id;
            }
            setPendingGradeConfirm({
              initialGrade: parsed.grade,
              initialTrack: parsed.secondaryTrack,
              commit: (grade, secondaryTrack) => {
                setPlan({ ...initialPlanState, ...parsed, grade, secondaryTrack, ...(autoTopicId ? { topicId: autoTopicId } : {}) });
                setShowUploadBanner(true);
              },
            });
          }
          // Notify about remaining queued scenarios
          if (draft.remaining > 0) {
            addNotification(`${t('lessonPlan.queuedScenariosPrefix')} ${draft.remaining} ${t('lessonPlan.queuedScenariosSuffix')}`, 'info');
          }
        } catch { /* silently ignore — non-critical */ }
      })();
    }

    if (isEditing) {
      const existingPlan = getLessonPlan(id!);
      if (existingPlan) {
        setPlan(existingPlan);
      } else {
        addNotification(`${t('lessonPlan.notFound.prefix')} ${id} ${t('lessonPlan.notFound.suffix')}`, 'error');
        navigate('/my-lessons');
      }
    } else {
      setPlan((currentPlan: Partial<LessonPlan>) => {
        if (currentPlan.topicId === '' && curriculum && curriculum.grades.length > 0) {
          if (prefillTopic) {
            const gradeData = resolveGradeByLabel(curriculum.grades, prefillGrade) ?? curriculum.grades[0];
            const matchedTopic = gradeData ? findTopicByFuzzyTitle(gradeData.topics, prefillTopic) : undefined;
            const unitTitle = prefillLessonUnit ?? prefillTopic;
            return {
              ...initialPlanState,
              grade: gradeData?.level ?? 6,
              topicId: matchedTopic?.id || '',
              theme: prefillTopic,
              subject: prefillSubject || t('lessonPlan.defaultSubject'),
              title: unitTitle,
              ...(prefillLessonNumber ? { lessonNumber: parseInt(prefillLessonNumber, 10) || undefined } : {}),
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
      addNotification(t('lessonPlan.titleRequired'), 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (isEditing) {
        await updateLessonPlan(plan as LessonPlan);
        clearDraft();
        if (isMounted.current) {
          setIsDirty(false);
          addNotification(t('lessonPlan.updateSuccess'), 'success');
          setPostSaveNav({ plan, key: `lesson_${Date.now()}`, navigateTo: '/my-lessons' });
          setShowReflection(true);
        }
      } else {
        const newPlanId = await addLessonPlan(plan as Omit<LessonPlan, 'id'>);
        clearDraft();
        if (isMounted.current) {
          setIsDirty(false);
          addNotification(t('lessonPlan.createSuccess'), 'success');
          setPostSaveNav({ plan, key: `lesson_${newPlanId}`, navigateTo: `/planner/lesson/${newPlanId}` });
          // Auto-share to Scenario Bank if opted in
          if (autoShareToBank && firebaseUser?.uid && user) {
            publishScenario({
              plan: { ...(plan as LessonPlan), id: newPlanId },
              authorUid: firebaseUser.uid,
              authorName: user.name ?? t('common.teacher'),
              schoolName: user.schoolName,
              isPublic: true,
              // Preserve the real author's name when this plan was uploaded from a
              // colleague's document — otherwise the bank card would only ever show
              // whoever clicked "publish", not who actually wrote it.
              originalAuthorName: plan.originalAuthor || undefined,
            }).then((bankId) => {
              addNotification(t('lessonPlan.autoSharedToBank'), 'success');
              // So a later "Уреди педагошки модел" edits this same entry instead of duplicating it.
              setPlan(prev => ({ ...prev, scenarioBankId: bankId }));
            }).catch(() => {});
          }
          setShowReflection(true);
          // navigate happens via postSaveNav after reflection dismissed
        }
      }
    } catch (error) {
      logger.error('Failed to save lesson plan:', error);
      if (isMounted.current) {
        addNotification(t('lessonPlan.saveError'), 'error');
      }
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  }, [plan, isEditing, addNotification, clearDraft, navigate, addLessonPlan, updateLessonPlan, t]);

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

  const handlePublishToBank = () => {
    if (!plan.title) { addNotification(t('lessonPlan.needTitleToShare'), 'error'); return; }
    if (!firebaseUser?.uid || !user) { addNotification(t('lessonPlan.needLogin'), 'error'); return; }
    modals.setShowPublishDialog(true);
  };

  const handleConfirmPublish = async (opts: PublishScenarioOptions) => {
    if (!firebaseUser?.uid || !user) return;
    modals.setIsPublishingToBank(true);
    try {
      const bankId = await publishScenario({
        plan: plan as import('../types').LessonPlan,
        authorUid: firebaseUser.uid,
        authorName: user.name ?? t('common.teacher'),
        schoolName: user.schoolName,
        teachingModel: opts.teachingModel ?? undefined,
        dokLevel: opts.dokLevel ?? undefined,
        isPublic: opts.isPublic,
        authorNotes: opts.authorNotes,
        // Preserve the real author's name when this plan was uploaded from a
        // colleague's document — otherwise the bank card would only ever show
        // whoever clicked "publish", not who actually wrote it.
        originalAuthorName: plan.originalAuthor || undefined,
      });
      setPlan(prev => ({ ...prev, scenarioBankId: bankId }));
      modals.setShowPublishDialog(false);
      addNotification(opts.isPublic ? t('lessonPlan.publishedPublic') : t('lessonPlan.publishedPrivate'), 'success');
      navigate('/scenario-bank');
    } catch {
      addNotification(t('lessonPlan.shareError'), 'error');
    } finally {
      modals.setIsPublishingToBank(false);
    }
  };

  const handleConfirmEditMetadata = async (opts: PublishScenarioOptions) => {
    if (!plan.scenarioBankId) return;
    modals.setIsPublishingToBank(true);
    try {
      await updateScenarioMetadata(plan.scenarioBankId, {
        teachingModel: opts.teachingModel,
        dokLevel: opts.dokLevel,
        authorNotes: opts.authorNotes,
      });
      modals.setShowEditMetadataDialog(false);
      addNotification(t('lessonPlan.metadataUpdated'), 'success');
    } catch {
      addNotification(t('lessonPlan.metadataUpdateError'), 'error');
    } finally {
      modals.setIsPublishingToBank(false);
    }
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
        <h2 className="text-2xl font-bold">{t('lessonPlan.curriculumLoadError.heading')}</h2>
        <p className="mt-2">{t('lessonPlan.curriculumLoadError.desc')}</p>
      </div>
    );
  }

  return (
    <div className="p-8 animate-fade-in">
      <Helmet>
        <title>{plan.title ? `${plan.title} — Подготовка | MisMath AI` : 'Подготовка за час — MisMath AI'}</title>
        <meta name="description" content="Создај или уреди детална подготовка за час по математика со AI поддршка — цели, активности, диференцијација, Bloom анализа." />
      </Helmet>
      <PlanningChainBar currentStep="lesson" />
      <PlanningBreadcrumb />

      {/* S106-Б DraftMergeDialog */}
      {pendingUpload && (
        <DraftMergeDialog
          existingDraft={plan}
          uploadedPlan={pendingUpload.parsed}
          fileName={pendingUpload.fileName}
          onReplace={() => {
            const up = pendingUpload!.parsed;
            setPendingGradeConfirm({
              initialGrade: up.grade,
              initialTrack: up.secondaryTrack,
              commit: (grade, secondaryTrack) => {
                setPlan({ ...initialPlanState, ...up, grade, secondaryTrack });
                setShowUploadBanner(true);
              },
            });
            setPendingUpload(null);
          }}
          onMerge={() => {
            const up = pendingUpload!.parsed;
            setPendingGradeConfirm({
              initialGrade: plan.grade || up.grade,
              initialTrack: plan.secondaryTrack || up.secondaryTrack,
              commit: (grade, secondaryTrack) => {
                setPlan((prev: Partial<LessonPlan>) => ({
                  ...prev,
                  title: prev.title || up.title,
                  theme: prev.theme || up.theme,
                  grade,
                  secondaryTrack,
                  subject: prev.subject || up.subject,
                  objectives: (prev.objectives?.length ?? 0) > 0 ? prev.objectives : up.objectives,
                  scenario: {
                    introductory: { text: prev.scenario?.introductory?.text || up.scenario?.introductory?.text || '' },
                    main: (prev.scenario?.main?.length ?? 0) > 0 ? prev.scenario!.main! : (up.scenario?.main ?? []),
                    concluding: { text: prev.scenario?.concluding?.text || up.scenario?.concluding?.text || '' },
                  },
                  materials: (prev.materials?.length ?? 0) > 0 ? prev.materials : up.materials,
                }));
                setShowUploadBanner(true);
              },
            });
            setPendingUpload(null);
          }}
          onKeepDraft={() => setPendingUpload(null)}
        />
      )}

      {/* Force explicit grade + education-track confirmation before any uploaded scenario is applied */}
      {pendingGradeConfirm && curriculum && (
        <ConfirmScenarioGradeModal
          curriculum={curriculum}
          initialGrade={pendingGradeConfirm.initialGrade}
          initialTrack={pendingGradeConfirm.initialTrack}
          profileDefaultTrack={user?.secondaryTrack}
          onConfirm={(grade, secondaryTrack) => {
            pendingGradeConfirm.commit(grade, secondaryTrack);
            setPendingGradeConfirm(null);
          }}
          onCancel={() => setPendingGradeConfirm(null)}
        />
      )}

      {/* B3 — Metacognitive Reflection Prompt (appears after save) */}
      {showReflection && postSaveNav && (
        <ReflectionModal
          reflection={reflection}
          onChange={(field, value) => setReflection(prev => ({ ...prev, [field]: value }))}
          onSkip={() => {
            setShowReflection(false);
            setSavedPlanForCoach(postSaveNav);
            setPostSaveNav(null);
          }}
          onSaveAndContinue={async () => {
            if (reflection.wentWell || reflection.challenges || reflection.nextSteps) {
              const planWithRef = { ...postSaveNav.plan, teacherReflection: reflection } as LessonPlan;
              await updateLessonPlan(planWithRef).catch(() => {});
            }
            setShowReflection(false);
            setSavedPlanForCoach(postSaveNav);
            setPostSaveNav(null);
          }}
        />
      )}

      {savedPlanForCoach && (
        <div className="mb-4">
          <CoachBubble
            plan={savedPlanForCoach.plan as any}
            planType="lesson"
            dismissKey={savedPlanForCoach.key}
            onDismiss={() => {
              const dest = savedPlanForCoach.navigateTo;
              setSavedPlanForCoach(null);
              navigate(dest);
            }}
          />
        </div>
      )}
      {/* S106-Д Upload-Aware Pedagogical Banner */}
      {showUploadBanner && !isEditing && (
        <div className="mb-4">
          <UploadedScenarioBanner
            plan={plan}
            onDismiss={() => setShowUploadBanner(false)}
            onEnrich={(merged) => setPlan(prev => ({ ...prev, ...merged }))}
          />
        </div>
      )}

      <header className="mb-6 no-print flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button type="button" onClick={() => navigate('/my-lessons')} className="text-brand-secondary hover:underline mb-2">
            {t('lessonPlan.backToMyLessons')}
          </button>
          <h1 className="text-4xl font-bold text-brand-primary">
            {isEditing ? t('lessonPlan.title.edit') : t('lessonPlan.title.new')}
          </h1>
        </div>

        {lastSaved && (
          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex items-center text-gray-500 gap-1.5 bg-gray-50 px-3 py-1.5 rounded-full border">
              <ICONS.check className="w-4 h-4 text-green-500" />
              <span>{t('lessonPlan.autoSavedAt')} {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                modals.setConfirmDialog({
                  message: t('lessonPlan.discardDraft.confirm'),
                  variant: 'danger',
                  onConfirm: () => { modals.setConfirmDialog(null); clearDraft(); }
                });
              }}
              className="text-red-600 hover:text-red-700 hover:underline transition-colors flex items-center gap-1"
            >
              <ICONS.trash className="w-3.5 h-3.5" />
              {t('lessonPlan.discardDraft.button')}
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
                  {!isOnline && <div className="absolute inset-0 z-10 bg-gray-100/20 cursor-not-allowed flex items-center justify-center"><span className="bg-white px-3 py-1 rounded shadow text-sm font-bold text-red-600">{t('lessonPlan.offline')}</span></div>}
                  <AIContextSelector
                    plan={plan}
                    onGenerate={ai.handleGenerateWithAI}
                    isGenerating={ai.isGenerating}
                  />
                </div>

                <div className={`${!isOnline ? 'opacity-50 pointer-events-none grayscale relative' : ''}`}>
                  {!isOnline && <div className="absolute inset-0 z-10 bg-gray-100/20 cursor-not-allowed flex items-center justify-center"><span className="bg-white px-3 py-1 rounded shadow text-sm font-bold text-red-600">{t('lessonPlan.offline')}</span></div>}
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
                    <p className="text-teal-700 font-semibold text-lg">{t('lessonPlan.generatingIllustration')}</p>
                  </div>
                )}

                {ai.generatedIllustration && (
                  <div className="mt-6 relative">
                    <button
                      type="button"
                      title={t('lessonPlan.removeIllustration')}
                      onClick={() => ai.setGeneratedIllustration(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors z-10"
                    >
                      <ICONS.close className="w-4 h-4" />
                    </button>
                    <GeneratedIllustration material={ai.generatedIllustration} />
                  </div>
                )}

                <div className="flex justify-end items-center pt-4 gap-3 border-t mt-6 flex-wrap">
                  {(user?.tier === 'Pro' || user?.tier === 'School' || user?.tier === 'Unlimited') && plan?.title && (
                    <button
                      type="button"
                      onClick={ai.handleGenerateInfographic}
                      disabled={ai.isGeneratingInfographic}
                      className="flex items-center gap-2 bg-purple-600 text-white px-4 py-3 rounded-lg shadow hover:bg-purple-700 transition-colors font-semibold disabled:bg-purple-300 text-sm"
                      title={t('lessonPlan.generateInfographicTitle')}
                    >
                      {ai.isGeneratingInfographic
                        ? <><ICONS.spinner className="w-4 h-4 animate-spin" /> {t('lessonPlan.generating')}</>
                        : <>{t('lessonPlan.infographicButton')}</>}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => modals.setShowOfficialLessonForm(true)}
                    disabled={!plan.title}
                    className="flex items-center gap-2 bg-white border border-blue-300 text-blue-700 px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors font-semibold disabled:opacity-40 text-sm"
                    title={t('lessonPlan.officialFormTitle')}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    {t('lessonPlan.officialFormButton')}
                  </button>
                  <LessonPlanExportMenu
                    disabled={!plan.title}
                    isOpen={exporter.isExportMenuOpen}
                    setIsOpen={exporter.setIsExportMenuOpen}
                    isGeneratingWord={exporter.isGeneratingWord}
                    onExport={exporter.handleExport}
                  />
                  <button
                    type="button"
                    disabled={modals.isPublishingToBank || !plan.title}
                    onClick={handlePublishToBank}
                    title={t('lessonPlan.shareToBankTitle')}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-lg shadow transition-colors font-semibold disabled:bg-gray-400"
                  >
                    {modals.isPublishingToBank ? (
                      <ICONS.spinner className="w-4 h-4 animate-spin" />
                    ) : (
                      <ICONS.share className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{t('lessonPlan.shareToBankButton')}</span>
                  </button>
                  {plan.scenarioBankId && (
                    <button
                      type="button"
                      onClick={() => modals.setShowEditMetadataDialog(true)}
                      title={t('lessonPlan.editMetadataTitle')}
                      className="flex items-center gap-2 bg-white border border-emerald-300 text-emerald-700 px-4 py-3 rounded-lg hover:bg-emerald-50 transition-colors font-semibold text-sm"
                    >
                      <ICONS.sparkles className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('lessonPlan.editMetadataButton')}</span>
                    </button>
                  )}
                  {!isEditing && (
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none shrink-0">
                      <input
                        type="checkbox"
                        checked={autoShareToBank}
                        onChange={e => setAutoShareToBank(e.target.checked)}
                        className="w-3.5 h-3.5 rounded accent-emerald-600"
                      />
                      <span>{t('lessonPlan.autoShareCheckbox')}</span>
                    </label>
                  )}
                  <button
                    type="submit"
                    disabled={isSaving}
                    title={t('lessonPlan.saveTitle')}
                    className="flex items-center bg-brand-primary text-white px-6 py-3 rounded-lg shadow hover:bg-brand-secondary transition-colors font-semibold disabled:bg-gray-400"
                  >
                    {isSaving ? (
                      <>
                        <ICONS.spinner className="w-5 h-5 mr-2 animate-spin" />
                        <span>{t('lessonPlan.saving')}</span>
                      </>
                    ) : (
                      <>
                        <ICONS.check className="w-5 h-5 mr-2" />
                        {isEditing ? t('lessonPlan.saveChanges') : t('lessonPlan.saveNew')}
                      </>
                    )}
                  </button>
                  {/* S98.1 — Start Class (inline overlay, no navigation) */}
                  {isEditing && id && (
                    <button
                      type="button"
                      onClick={() => modals.setExecOpen(true)}
                      title={t('lessonPlan.startClassTitle')}
                      className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-lg shadow transition-colors font-semibold"
                    >
                      <span>🏫</span>
                      <span className="hidden sm:inline">{t('lessonPlan.startClassButton')}</span>
                    </button>
                  )}
                </div>
              </form>
            </Card>
          </div>

          <LessonPlanSidebar
            plan={plan}
            ai={ai}
            setPlan={setPlan}
            firebaseUser={firebaseUser}
            navigate={navigate}
            onOpenMathTools={modals.openMathTools}
            onImportScenario={handleImportScenario}
          />
        </div>
      </div>

      <div id="printable-area" className="hidden print:block">
        <div className="mb-6 border-b pb-4">
          <p className="text-md text-gray-500">{t('lessonPlan.print.subject')} {plan.subject}</p>
          <p className="text-md text-gray-500">{t('lessonPlan.print.theme')} {plan.theme}</p>
          <h1 className="text-2xl font-bold text-brand-primary mt-2">{plan.title}</h1>
          <p className="text-lg text-gray-600">{plan.grade}. {t('lessonPlan.print.gradeSuffix')}</p>
        </div>
        <LessonPlanDisplay plan={plan as LessonPlan} />
      </div>

      {modals.showMathTools && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] md:h-[80vh] relative flex flex-col overflow-hidden border border-gray-200 mt-4 md:mt-0">
            <div className="bg-gray-100 px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-700 flex items-center justify-center gap-2"><ICONS.math className="w-5 h-5" />{t('lessonPlan.mathToolsHeader')}</h3>
              <button type="button" title={t('lessonPlan.closeToolsTitle')} onClick={() => modals.setShowMathTools(false)} className="text-gray-500 hover:text-red-500 bg-white border p-1 rounded-md transition-colors"><ICONS.close className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 relative overflow-hidden bg-slate-50">
              <MathToolsPanel
                defaultTab={modals.mathToolsTab}
                onClose={() => modals.setShowMathTools(false)}
                className="h-full"
                onExportImage={(dataUrl, tool) => {
                  setPlan(prev => ({
                    ...prev,
                    mathEmbeds: [
                      ...(prev.mathEmbeds ?? []),
                      { tool, dataUrl, createdAt: new Date().toISOString() },
                    ],
                  }));
                  addNotification(`${tool === 'geogebra' ? 'GeoGebra' : 'Desmos'} ${t('lessonPlan.imageAddedSuffix')}`, 'success');
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
        className="fixed bottom-6 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-2xl transition-all z-40 flex items-center justify-center group no-print hover:scale-110 active:scale-95"
        title={t('lessonPlan.mathToolsFabTitle')}
        onClick={() => modals.openMathTools('scratchpad')}
      >
        <ICONS.math className="w-6 h-6 group-hover:animate-pulse" />
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap pl-0 group-hover:pl-2 font-black tracking-wide text-sm">{t('lessonPlan.mathToolsFabLabel')}</span>
      </button>
      {modals.confirmDialog && (
        <ConfirmDialog
          message={modals.confirmDialog.message}
          title={modals.confirmDialog.title}
          variant={modals.confirmDialog.variant ?? 'warning'}
          onConfirm={modals.confirmDialog.onConfirm}
          onCancel={() => modals.setConfirmDialog(null)}
        />
      )}

      {/* ── Publish to Scenario Bank Dialog ─────────────────────────────── */}
      {modals.showPublishDialog && (
        <PublishScenarioDialog
          item={plan}
          isPro={user?.role === 'admin'}
          onPublish={handleConfirmPublish}
          onCancel={() => modals.setShowPublishDialog(false)}
          isLoading={modals.isPublishingToBank}
        />
      )}

      {/* ── Edit Scenario Metadata Dialog (pedagogical model on an already-published scenario) ── */}
      {modals.showEditMetadataDialog && (
        <PublishScenarioDialog
          item={plan}
          isPro={user?.role === 'admin'}
          mode="edit"
          onPublish={handleConfirmEditMetadata}
          onCancel={() => modals.setShowEditMetadataDialog(false)}
          isLoading={modals.isPublishingToBank}
        />
      )}

      {/* ── Official MoN Lesson Plan Form Modal ──────────────────────────── */}
      {modals.showOfficialLessonForm && (
        <OfficialLessonFormModal
          plan={plan}
          template={modals.officialLessonTemplate}
          setTemplate={modals.setOfficialLessonTemplate}
          orientation={modals.officialLessonOrientation}
          setOrientation={modals.setOfficialLessonOrientation}
          isEditable={modals.officialLessonEditing}
          setIsEditable={modals.setOfficialLessonEditing}
          onPrint={() => modals.handleLessonOfficialPrint()}
          onClose={() => modals.setShowOfficialLessonForm(false)}
          formRef={modals.lessonOfficialFormRef}
        />
      )}
      {/* C.3 — AI Lesson Execution overlay (inline, no navigation) */}
      {modals.execOpen && plan && (plan as LessonPlan).id && (
        <LessonExecutionOverlay
          plan={plan as LessonPlan}
          onClose={() => modals.setExecOpen(false)}
        />
      )}
    </div>
  );
};
