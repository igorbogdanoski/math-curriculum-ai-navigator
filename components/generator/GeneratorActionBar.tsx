import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { ICONS } from '../../constants';
import type { MaterialType } from '../../types';

interface GeneratorActionBarProps {
  currentStep: number;
  setCurrentStep: (fn: (prev: number) => number) => void;
  materialType: MaterialType | null;
  isGenerateDisabled: boolean;
  isGenerating: boolean;
  isGeneratingVariants: boolean;
  isGeneratingBulk: boolean;
  isOnline: boolean;
  verifiedCount: number;
  requirePremiumOrCredits: (action: () => void, costMultiplier?: number, isPremiumOnly?: boolean, featureName?: string) => void;
  onGenerateVariants: () => void;
  onBulkGenerate: () => void;
  onGenerateFromBank: () => void;
}

export const GeneratorActionBar: React.FC<GeneratorActionBarProps> = ({
  currentStep,
  setCurrentStep,
  materialType,
  isGenerateDisabled,
  isGenerating,
  isGeneratingVariants,
  isGeneratingBulk,
  isOnline,
  verifiedCount,
  requirePremiumOrCredits,
  onGenerateVariants,
  onBulkGenerate,
  onGenerateFromBank,
}) => {
  const showVariantsButton =
    materialType !== null &&
    (['ASSESSMENT', 'QUIZ', 'FLASHCARDS'] as MaterialType[]).includes(materialType);

  return (
    <div data-tour="generator-generate-button" className="flex items-center justify-between pt-6 border-t mt-auto gap-3">
      {currentStep > 1 ? (
        <button
          type="button"
          onClick={() => setCurrentStep(prev => prev - 1)}
          className="px-5 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:text-gray-900 font-bold transition-all flex items-center gap-2"
        >
          <ICONS.chevronDown className="w-5 h-5 rotate-90" /> Назад
        </button>
      ) : (
        <div></div>
      )}

      {currentStep < 3 ? (
        <button
          type="button"
          onClick={() => setCurrentStep(prev => prev + 1)}
          className="px-6 py-2.5 bg-brand-primary text-white rounded-xl hover:bg-brand-secondary font-bold shadow-md transition-all flex items-center gap-2"
        >
          Следно <ICONS.chevronDown className="w-5 h-5 -rotate-90" />
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {showVariantsButton && (
            <button
              type="button"
              onClick={() => requirePremiumOrCredits(() => onGenerateVariants(), 3, false, '3x Варијанти')}
              disabled={isGenerateDisabled || isGeneratingVariants || isGenerating}
              title="3 варијанти: Поддршка, Основно и Збогатување"
              className="flex items-center gap-2 border-2 border-brand-primary text-brand-primary px-4 py-2.5 rounded-xl hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-bold"
            >
              {isGeneratingVariants ? (
                <><ICONS.spinner className="w-4 h-4 animate-spin" />Пресметувам...</>
              ) : (
                <><ICONS.sparkles className="w-4 h-4" /><span className="hidden sm:inline">3× Варијанти</span><span className="sm:hidden">3×</span></>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => requirePremiumOrCredits(() => onBulkGenerate(), 5, false, 'Пакет материјали')}
            disabled={isGenerateDisabled || isGenerating || isGeneratingVariants || isGeneratingBulk}
            title="Квиз + Тест + Рубрика одеднаш"
            className="flex items-center gap-2 border-2 border-purple-500 text-purple-700 px-4 py-2.5 rounded-xl hover:bg-purple-50 disabled:opacity-40 transition-all font-bold"
          >
            {isGeneratingBulk ? (
              <><ICONS.spinner className="w-4 h-4 animate-spin" />Пакет...</>
            ) : (
              <><ICONS.sparkles className="w-4 h-4" /><span className="hidden sm:inline">Пакет материјали</span><span className="sm:hidden">Пакет</span></>
            )}
          </button>
          {verifiedCount > 0 && (
            <button
              type="button"
              onClick={onGenerateFromBank}
              disabled={isGenerating || isGeneratingVariants || isGeneratingBulk}
              title={`Создај квиз од ${verifiedCount} верификувани прашања (без AI)`}
              className="flex items-center gap-2 border-2 border-green-500 text-green-700 px-4 py-2.5 rounded-xl hover:bg-green-50 disabled:opacity-40 transition-all font-bold"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Од банката ({verifiedCount})</span>
              <span className="sm:hidden">Банка ({verifiedCount})</span>
            </button>
          )}
          <button
            type="submit"
            disabled={isGenerateDisabled || isGeneratingVariants || isGeneratingBulk}
            title={!isOnline ? 'Нема интернет' : 'Генерирај'}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-primary to-blue-700 text-white px-8 py-2.5 rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold transform hover:-translate-y-0.5"
          >
            {isGenerating ? (
              <><ICONS.spinner className="w-5 h-5 animate-spin" /> Генерирам...</>
            ) : (
              <><ICONS.sparkles className="w-5 h-5" /> Генерирај AI</>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
