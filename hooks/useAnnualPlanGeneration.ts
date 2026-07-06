import { logger } from '../utils/logger';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { fetchAnnualPlanById, updateAnnualPlan, createAnnualPlan, toggleAnnualPlanPublic } from '../services/firestoreService.materials';
import { useCurriculum } from './useCurriculum';
import { useCollabPlan } from './useCollabPlan';
import { buildOfficialCurriculumContext } from '../data/official/grade8Official';
import { geminiService } from '../services/geminiService';
import { trackCreditConsumed } from '../services/telemetryService';
import { resolveGradeByLabel } from '../utils/gradeMatch';
import type { AIGeneratedAnnualPlan, AIGeneratedAnnualPlanTopic } from '../types';

interface ParallelProgress {
  done: number;
  total: number;
  results: { topic: string; status: 'ok' | 'error' }[];
}

interface UseAnnualPlanGenerationOptions {
  planId?: string;
}

export function useAnnualPlanGeneration({ planId }: UseAnnualPlanGenerationOptions) {
  const { curriculum } = useCurriculum();
  const { user, firebaseUser, updateLocalProfile } = useAuth();
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();

  const [selectedGradeId, setSelectedGradeId] = useState<string>('grade-6');
  const [subject, setSubject] = useState<string>('Математика');
  const [weeks, setWeeks] = useState<number>(36);
  const [currentStep, setCurrentStep] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [plan, setPlan] = useState<AIGeneratedAnnualPlan | null>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);
  const [parallelProgress, setParallelProgress] = useState<ParallelProgress | null>(null);
  const [isGeneratingParallel, setIsGeneratingParallel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState('');

  // Correct default grade when curriculum loads (secondary teachers don't have grade-6)
  useEffect(() => {
    if (!curriculum) return;
    const ids = curriculum.grades.map(g => g.id);
    if (!ids.includes(selectedGradeId)) {
      setSelectedGradeId(ids[0] ?? 'grade-6');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curriculum]);

  // Edit mode — load existing plan by planId
  useEffect(() => {
    if (!planId) return;
    setIsLoadingExisting(true);
    fetchAnnualPlanById(planId)
      .then(doc => {
        if (doc) {
          setPlan(doc.planData);
          setSubject(doc.planData.subject);
          setWeeks(doc.planData.totalWeeks);
          setSavedId(planId);
          setCurrentStep(3);
          setIsPublic(doc.isPublic ?? false);
        } else {
          addNotification('Планот не е пронајден.', 'error');
        }
      })
      .catch(() => addNotification('Грешка при вчитување на планот.', 'error'))
      .finally(() => setIsLoadingExisting(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  // Sync selectedGradeId from loaded plan title (edit mode)
  useEffect(() => {
    if (!planId || !plan || !curriculum) return;
    const match = resolveGradeByLabel(curriculum.grades, plan.grade);
    if (match) setSelectedGradeId(match.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, plan?.grade, curriculum]);

  const handleSave = async () => {
    if (!user || !plan || !firebaseUser?.uid) return;
    setIsSaving(true);
    try {
      if (planId) {
        await updateAnnualPlan(planId, plan);
        setSavedId(planId);
        addNotification('Промените се успешно зачувани!', 'success');
      } else {
        const newId = await createAnnualPlan(firebaseUser.uid, plan);
        setSavedId(newId);
        addNotification('Програмата е успешно зачувана во облак!', 'success');
      }
    } catch (error) {
      logger.error('Грешка при зачувување:', error);
      addNotification('Грешка при зачувување на програмата.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Keep ref in sync so the Cmd+S effect always calls the latest version
  const handleSaveRef = useRef<() => void>(() => {});
  handleSaveRef.current = handleSave;

  // Cmd+S / Ctrl+S — save annual plan from anywhere in the view
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []); // runs once; ref keeps value fresh

  const handleTogglePublic = async () => {
    if (!savedId) {
      addNotification('Прво зачувајте го планот за да го споделите.', 'warning');
      return;
    }
    setIsTogglingPublic(true);
    try {
      const next = !isPublic;
      await toggleAnnualPlanPublic(savedId, next);
      setIsPublic(next);
      addNotification(
        next ? '🌐 Планот е споделен во Библиотеката!' : 'Планот е отстранет од Библиотеката.',
        'success',
      );
    } catch {
      addNotification('Грешка при промена на статусот.', 'error');
    } finally {
      setIsTogglingPublic(false);
    }
  };

  const handleGenerateAllThematic = async () => {
    if (!plan || !curriculum) return;
    const gradeMatch = resolveGradeByLabel(curriculum.grades, plan.grade) ?? curriculum.grades[0];
    if (!gradeMatch) {
      addNotification('Не е пронајдено одделение во curriculum.', 'error');
      return;
    }

    const total = plan.topics.length;
    setParallelProgress({ done: 0, total, results: [] });
    setIsGeneratingParallel(true);

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const promises = plan.topics.map((annualTopic: AIGeneratedAnnualPlanTopic, idx: number) => {
      const topicMatch =
        gradeMatch.topics.find(
          t =>
            t.title.toLowerCase().includes(annualTopic.title.toLowerCase().slice(0, 5)) ||
            annualTopic.title.toLowerCase().includes(t.title.toLowerCase().slice(0, 5)),
        ) ?? gradeMatch.topics[0];

      return delay(idx * 200).then(() =>
        geminiService
          .generateThematicPlan(gradeMatch, topicMatch, user ?? undefined)
          .then(() => {
            setParallelProgress(prev =>
              prev
                ? { ...prev, done: prev.done + 1, results: [...prev.results, { topic: annualTopic.title, status: 'ok' as const }] }
                : null,
            );
          })
          .catch(() => {
            setParallelProgress(prev =>
              prev
                ? { ...prev, done: prev.done + 1, results: [...prev.results, { topic: annualTopic.title, status: 'error' as const }] }
                : null,
            );
          })
      );
    });

    await Promise.allSettled(promises);
    setIsGeneratingParallel(false);
    addNotification(`⚡ ${total} тематски планови загреани — отвори Gantt за брз пристап!`, 'success');
  };

  const handleGenerate = async () => {
    const cost = 10;

    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance || 0) < cost) {
        window.dispatchEvent(
          new CustomEvent('openUpgradeModal', {
            detail: { reason: `Останавте без AI кредити! Генерирањето на годишна програма чини ${cost} кредити. Надградете на Pro пакет.` },
          }),
        );
        return;
      }
    }

    setIsGenerating(true);
    try {
      const gradeData = curriculum?.grades.find(g => g.id === selectedGradeId);
      const gradeName = gradeData?.title || gradeData?.id || selectedGradeId;
      let curriculumContext = '';

      const gradeNum = gradeData?.level ?? 0;
      const officialContext = gradeNum === 8 ? buildOfficialCurriculumContext(8) : '';

      if (officialContext) {
        curriculumContext = officialContext;
      } else if (gradeData && gradeData.topics && gradeData.topics.length > 0) {
        curriculumContext = gradeData.topics
          .map((t, idx) => {
            let desc = `- Тема ${idx + 1}: ${t.title}`;
            if (t.suggestedHours) desc += ` (Препорачани часови: ${t.suggestedHours} часа)`;
            if (t.topicLearningOutcomes && t.topicLearningOutcomes.length > 0) {
              desc += `\n  Очекувани резултати: ${t.topicLearningOutcomes.slice(0, 3).join('; ')}...`;
            }
            return desc;
          })
          .join('\n\n');
      } else {
        curriculumContext = 'Нема специфични теми во системот за ова одделение. Генерирајте општи теми по математика.';
      }

      const generated = await geminiService.generateAnnualPlan(gradeName, subject, weeks, curriculumContext, user || undefined);
      setPlan(generated);

      // Credit deduction now happens server-side (api/gemini.ts, costKey: 'ANNUAL_PLAN'
      // threaded through generateAnnualPlan) — no separate client-side call needed.
      // Local balance is refreshed optimistically only, for immediate UI feedback.
      if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
        const previousBalance = user.aiCreditsBalance || 0;
        const newBalance = Math.max(0, previousBalance - cost);
        updateLocalProfile({ aiCreditsBalance: newBalance });
        trackCreditConsumed({
          uid: firebaseUser?.uid,
          amount: cost,
          previousBalance,
          newBalance,
          reason: 'annual_plan_generator',
        });
      }
    } catch (error) {
      logger.error('Failed to generate plan:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Collaboration
  const { viewers, remoteUpdatedBy } = useCollabPlan(planId, firebaseUser?.uid, user?.name);

  return {
    // Curriculum
    curriculum,
    selectedGradeId,
    setSelectedGradeId,
    subject,
    setSubject,
    weeks,
    setWeeks,
    subjectError,
    setSubjectError,
    // Wizard
    currentStep,
    setCurrentStep,
    // Plan state
    plan,
    setPlan,
    isLoadingExisting,
    isGenerating,
    // Save
    isSaving,
    savedId,
    // Public sharing
    isPublic,
    isTogglingPublic,
    // Parallel thematic
    parallelProgress,
    setParallelProgress,
    isGeneratingParallel,
    // Collaboration
    viewers,
    remoteUpdatedBy,
    // Handlers
    handleSave,
    handleTogglePublic,
    handleGenerateAllThematic,
    handleGenerate,
    // Auth (view needs these for conditionals)
    user,
    firebaseUser,
    navigate,
  };
}
