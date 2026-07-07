import { logger } from '../../utils/logger';
import { useState } from 'react';
import { geminiService, isDailyQuotaKnownExhausted } from '../../services/geminiService';
import { AI_COSTS } from '../../services/gemini/core';
import { isUnlimitedProfile } from '../useSubscriptionStatus';
import { RateLimitError } from '../../services/apiErrors';
import { QuestionType } from '../../types';
import type {
  AIGeneratedAssessment, AIGeneratedIdeas, AIGeneratedRubric, TeachingProfile,
} from '../../types';
import type { GeneratorState } from '../useGeneratorState';
import type { BuildContextResult, GeneratedMaterial } from './useGeneratorContext';

export type BulkStep = 'SCENARIO' | 'QUIZ' | 'ASSESSMENT' | 'RUBRIC';
export type BulkResults = {
  scenario?: AIGeneratedIdeas;
  quiz?: AIGeneratedAssessment;
  assessment?: AIGeneratedAssessment;
  rubric?: AIGeneratedRubric;
};

interface UseBulkGenerateParams {
  state: GeneratorState;
  user: TeachingProfile | null;
  isOnline: boolean;
  buildContext: () => BuildContextResult | null;
  buildEffectiveInstruction: () => string;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setGeneratedMaterial: (m: GeneratedMaterial) => void;
  setQuotaBannerFromStorage: () => void;
  deductCredits?: (costKeys?: string[]) => Promise<void>;
  openUpgradeModal?: (reason: string) => void;
}

export function useBulkGenerate({
  state,
  user,
  isOnline,
  buildContext,
  buildEffectiveInstruction,
  addNotification,
  setGeneratedMaterial,
  setQuotaBannerFromStorage,
  deductCredits,
  openUpgradeModal,
}: UseBulkGenerateParams) {
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [bulkStep, setBulkStep] = useState<BulkStep | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResults | null>(null);

  const handleBulkGenerate = async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const cost = AI_COSTS.BULK;
    if (user && user.role !== 'admin' && !isUnlimitedProfile(user)) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        openUpgradeModal?.(`Останавте без AI кредити! Пакетот чини ${cost} кредити. Надградете на Pro за неограничено генерирање.`);
        return;
      }
    }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context, tempActivityTitle } = built;
    const effectiveInstruction = buildEffectiveInstruction();

    setIsGeneratingBulk(true);
    setBulkResults(null);
    setGeneratedMaterial(null);
    const acc: BulkResults = {};

    // The client gates/discloses this whole bundle at AI_COSTS.BULK (one bundle price) — only
    // the first step (SCENARIO) actually carries that cost; the other three ride for free
    // (BUNDLE_PART=0) so the server doesn't silently charge IDEAS+ASSESSMENT+ASSESSMENT+TEXT_BASIC
    // on top of it (previously ~9 credits actual vs. 5 disclosed/gated).
    const steps: Array<{ key: BulkStep; fn: () => Promise<void> }> = [
      { key: 'SCENARIO', fn: async () => {
        const ideas = await geminiService.generateLessonPlanIdeas(
          context.concepts || [], context.topic!, context.grade.level,
          user ?? undefined,
          { focus: state.activityFocus, tone: state.scenarioTone, learningDesign: state.learningDesignModel },
          effectiveInstruction,
          'BULK',
        );
        ideas.generationContext = context;
        acc.scenario = ideas;
      } },
      { key: 'QUIZ', fn: async () => {
        acc.quiz = await geminiService.generateAssessment(
          'QUIZ', [QuestionType.MULTIPLE_CHOICE], 5, context, user ?? undefined,
          undefined, undefined, undefined, effectiveInstruction, false,
          undefined, undefined, undefined, 'BUNDLE_PART',
        );
      } },
      { key: 'ASSESSMENT', fn: async () => {
        acc.assessment = await geminiService.generateAssessment(
          'ASSESSMENT',
          state.questionTypes.length ? state.questionTypes : [QuestionType.MULTIPLE_CHOICE, QuestionType.SHORT_ANSWER],
          10, context, user ?? undefined,
          undefined, undefined, undefined, effectiveInstruction, false,
          undefined, undefined, undefined, 'BUNDLE_PART',
        );
      } },
      { key: 'RUBRIC', fn: async () => {
        acc.rubric = await geminiService.generateRubric(
          context.grade.level,
          tempActivityTitle || `Активност за ${context.topic?.title ?? ''}`,
          state.activityType, '', user ?? undefined, effectiveInstruction,
          'BUNDLE_PART',
        );
      } },
    ];

    for (const step of steps) {
      setBulkStep(step.key);
      try {
        await step.fn();
        setBulkResults({ ...acc });
      } catch (error) {
        if (error instanceof RateLimitError) { setQuotaBannerFromStorage(); break; }
        logger.error(`[Bulk] ${step.key} failed:`, error);
      }
    }
    setBulkStep(null);
    setIsGeneratingBulk(false);

    if (typeof deductCredits === 'function' && Object.keys(acc).length > 0) {
      try { await deductCredits(['BULK']); } catch (e) { logger.error('[Bulk] deductCredits failed:', e); }
    }
  };

  return {
    isGeneratingBulk,
    bulkStep,
    bulkResults,
    setBulkResults,
    handleBulkGenerate,
  };
}
