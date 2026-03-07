import { useState } from 'react';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
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
}: UseVariantGenerateParams) {
  const [variants, setVariants] = useState<Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment> | null>(null);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [activeVariantTab, setActiveVariantTab] = useState<'support' | 'standard' | 'advanced'>('standard');

  const handleGenerateVariants = async () => {
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isGeneratingVariants || isGenerateDisabled) return;
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext } = built;
    const teacherNoteInstruction = teacherNote.trim() ? `БЕЛЕШКИ НА НАСТАВНИКОТ: ${teacherNote.trim()}` : '';
    const effectiveInstruction = [state.useMacedonianContext ? MACEDONIAN_CONTEXT_HINT : '', buildAiPersonalizationSnippet(state), teacherNoteInstruction, state.customInstruction].filter(Boolean).join(' ');

    setIsGeneratingVariants(true);
    setVariants(null);
    setGeneratedMaterial(null);

    const levels = ['support', 'standard', 'advanced'] as const;
    const newVariants: Partial<Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment>> = {};
    let quotaHit = false;
    for (const level of levels) {
      if (quotaHit) break;
      try {
        newVariants[level] = await geminiService.generateAssessment(
          state.materialType as 'ASSESSMENT' | 'QUIZ' | 'FLASHCARDS',
          state.questionTypes, state.numQuestions, finalContext,
          user ?? undefined, level, undefined, undefined, effectiveInstruction, state.includeSelfAssessment
        );
      } catch (error) {
        if (error instanceof RateLimitError) {
          setQuotaBannerFromStorage();
          quotaHit = true;
        } else {
          console.warn(`Failed to generate ${level} variant:`, error);
        }
      }
    }
    if (!quotaHit && Object.keys(newVariants).length > 0) {
      setVariants(newVariants as Record<'support' | 'standard' | 'advanced', AIGeneratedAssessment>);        
        // Deduct 3 credits for variants generation if deductCredits is provided
        if (typeof deductCredits === 'function') {
            await deductCredits(3);
        }    } else if (!quotaHit) {
      addNotification('Не можеше да се генерираат варијантите. Обидете се повторно.', 'error');
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
