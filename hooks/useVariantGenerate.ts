import { logger } from '../utils/logger';
import { useState } from 'react';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
import { AI_COSTS } from '../services/gemini/core';
import { RateLimitError } from '../services/apiErrors';
import type { AIGeneratedAssessment, GenerationContext, TeachingProfile } from '../types';
import type { GeneratorState } from './useGeneratorState';

interface UseVariantGenerateParams {
  state: GeneratorState;
  isOnline: boolean;
  isGenerateDisabled: boolean;
  teacherNote: string;
  user: TeachingProfile | null;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setQuotaBannerFromStorage: () => void;
  buildContext: () => any | null;
  buildAiPersonalizationSnippet: (state: any) => string;
  MACEDONIAN_CONTEXT_HINT: string;
    setGeneratedMaterial: (material: any) => void;
    deductCredits?: (amount?: number) => Promise<void>;
    openUpgradeModal?: (reason: string) => void;
}

export function useVariantGenerate({
    state,
    isOnline,
    isGenerateDisabled,
    teacherNote,
    user,
    addNotification,
    setQuotaBannerFromStorage,
    buildContext,
    buildAiPersonalizationSnippet,
    MACEDONIAN_CONTEXT_HINT,
    setGeneratedMaterial,
    deductCredits,
    openUpgradeModal,
}: UseVariantGenerateParams) {
  const [variants, setVariants] = useState<Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment> | null>(null);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [activeVariantTab, setActiveVariantTab] = useState<'support' | 'standard' | 'advanced'>('standard');

  const handleGenerateVariants = async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isGeneratingVariants || isGenerateDisabled) return;
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const cost = AI_COSTS.VARIANTS;
    // Upfront credit gate (cost: 3 credits for variants)
    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        openUpgradeModal?.(`Останавте без AI кредити! Варијантите чинат ${cost} кредити. Надградете на Pro за неограничено генерирање.`);
        return;
      }
    }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext } = built;
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', buildAiPersonalizationSnippet(state), teacherNoteInstruction, state.customInstruction].filter(Boolean).join(' ');

    setIsGeneratingVariants(true);
    setVariants(null);
    setGeneratedMaterial(null);

    try {
      // S45-B: parallel A/B/C generation via generateABCTest (3× faster than sequential)
      const { a, b, c } = await geminiService.generateABCTest(
        state.numQuestions,
        finalContext,
        user ?? undefined,
      );
      setVariants({ support: a, standard: b, advanced: c });
      if (typeof deductCredits === 'function') {
        await deductCredits(cost);
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        setQuotaBannerFromStorage();
      } else {
        logger.warn('Failed to generate differentiated variants:', error);
        addNotification('Не можеше да се генерираат варијантите. Обидете се повторно.', 'error');
      }
    }
    setIsGeneratingVariants(false);
  };

  return {
    variants,
    setVariants,
    isGeneratingVariants,
    activeVariantTab,
    setActiveVariantTab,
    handleGenerateVariants,
  };
}
