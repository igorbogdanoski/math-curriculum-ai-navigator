import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { ClipboardList, BookmarkPlus, CheckCircle, Globe, Lock, X } from 'lucide-react';
import { ICONS } from '../../constants';
import { logger } from '../../utils/logger';
import { AILoadingIndicator } from '../common/AILoadingIndicator';
import { StreamingTextPreview } from './StreamingTextPreview';
import { DokDistributionBar } from '../common/DokBadge';
import { GeneratedIllustration } from '../ai/GeneratedIllustration';
import { GeneratedIdeas } from '../ai/GeneratedIdeas';
import { GeneratedAssessment } from '../ai/GeneratedAssessment';
import { GeneratedRubric } from '../ai/GeneratedRubric';
import { GeneratedPresentation } from '../ai/GeneratedPresentation';
import { GeneratedLearningPaths } from '../ai/GeneratedLearningPaths';
import { WorkedExample } from '../materials/WorkedExample';
import { StatisticsWorkspace } from '../data/StatisticsWorkspace';
import { AIFeedbackBar } from '../ai/AIFeedbackBar';
import { QuizShareButton } from '../common/QuizShareButton';
import { RefineGenerationChat } from './RefineGenerationChat';
import type {
  AIGeneratedAssessment,
  AIGeneratedIdeas,
  AIGeneratedRubric,
  AIGeneratedIllustration,
  AIGeneratedLearningPaths,
  AIGeneratedWorkedExample,
  MaterialType,
  NationalStandard,
  Grade,
} from '../../types';
import type { GeneratorState } from '../../hooks/useGeneratorState';

// Local error boundary — catches render errors in result components without crashing the whole panel
export class ResultErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { logger.error('[ResultErrorBoundary]', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="mt-6 p-5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <p className="font-bold mb-1">⚠️ Грешка при прикажување на резултатот</p>
          <p className="text-xs text-red-500 mb-3">{(this.state.error as Error).message}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition"
            >
              ↺ Обиди се повторно
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 transition"
            >
              ⟳ Освежи страна
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type AnyMaterial =
  | AIGeneratedAssessment
  | AIGeneratedIdeas
  | AIGeneratedRubric
  | AIGeneratedIllustration
  | AIGeneratedLearningPaths
  | AIGeneratedWorkedExample;

interface GeneratorResultPanelProps {
  state: GeneratorState;
  curriculum: { grades: Grade[] } | null;
  relevantStandards: NationalStandard[];
  isGenerating: boolean;
  isGeneratingVariants: boolean;
  isGeneratingBulk: boolean;
  isStreaming?: boolean;
  streamingText?: string;
  bulkStep: MaterialType | null;
  bulkResults: { scenario?: any; quiz?: AIGeneratedAssessment; assessment?: AIGeneratedAssessment; rubric?: AIGeneratedRubric } | null;
  generatedMaterial: any;
  setGeneratedMaterial: (m: any) => void;
  variants: { support: AIGeneratedAssessment; standard: AIGeneratedAssessment; advanced: AIGeneratedAssessment } | null;
  activeVariantTab: 'support' | 'standard' | 'advanced';
  setActiveVariantTab: (v: 'support' | 'standard' | 'advanced') => void;
  savedToLibrary: Set<string>;
  isPro: boolean;
  saveIsPublic: boolean;
  setSaveIsPublic: React.Dispatch<React.SetStateAction<boolean>>;
  setAssignTarget: (target: AIGeneratedAssessment | null) => void;
  handleCancel: () => void;
  handleSaveAsNote: () => void;
  handleSaveQuestion: (...args: any[]) => void;
  handleSaveToLibrary: (material: any, key: string) => void;
  handleSavePackage: () => void;
  handleMaterialRate: (rating: 'up' | 'down', reportText?: string) => void;
  handleGenerateFromExtraction: (type: MaterialType) => void;
}

export const GeneratorResultPanel: React.FC<GeneratorResultPanelProps> = ({
  state,
  curriculum,
  relevantStandards,
  isGenerating,
  isGeneratingVariants,
  isGeneratingBulk,
  isStreaming = false,
  streamingText = '',
  bulkStep,
  bulkResults,
  generatedMaterial,
  setGeneratedMaterial,
  variants,
  activeVariantTab,
  setActiveVariantTab,
  savedToLibrary,
  isPro,
  saveIsPublic,
  setSaveIsPublic,
  setAssignTarget,
  handleCancel,
  handleSaveAsNote,
  handleSaveQuestion,
  handleSaveToLibrary,
  handleSavePackage,
  handleMaterialRate,
  handleGenerateFromExtraction,
}) => {
  const gradeLevel = curriculum?.grades.find((g: Grade) => g.id === state.selectedGrade)?.level;
  const quizLikeType: 'QUIZ' | 'ASSESSMENT' =
    state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT' ? state.materialType : 'QUIZ';

  return (
    <ResultErrorBoundary>
      {/* Empty State */}
      {!isGenerating && !isGeneratingVariants && !isGeneratingBulk && !generatedMaterial && !variants && (!bulkResults || Object.keys(bulkResults).length === 0) && (
        <div className="m-auto flex flex-col items-center justify-center text-gray-400 opacity-60 max-w-md text-center">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-gray-100">
            <ICONS.generator className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-600 mb-2">Тука ќе се појави материјалот</h3>
          <p className="text-sm leading-relaxed">Пополнете ги опциите лево и кликнете <strong>Генерирај AI</strong>. Резултатот и сите алатки за уредување ќе бидат прикажани на овој широк простор.</p>
        </div>
      )}

      {/* Smart Loading Indicator + Cancel button */}
      {isGenerating && !generatedMaterial && (
        <div className="mt-6 w-full">
          {isStreaming && streamingText ? (
            <StreamingTextPreview text={streamingText} onCancel={handleCancel} />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <AILoadingIndicator />
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition"
              >
                <X className="w-3.5 h-3.5" />
                Откажи генерирање
              </button>
            </div>
          )}
        </div>
      )}

      {isGeneratingBulk && (
        <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-200">
          <p className="text-sm font-bold text-purple-800 mb-3">Генерирам пакет материјали...</p>
          {(['QUIZ', 'ASSESSMENT', 'RUBRIC'] as const).map((step, i) => {
            const labels = { QUIZ: 'Квиз', ASSESSMENT: 'Тест/Лист', RUBRIC: 'Рубрика' };
            const done = !!bulkResults?.[step === 'QUIZ' ? 'quiz' : step === 'ASSESSMENT' ? 'assessment' : 'rubric'];
            const active = bulkStep === step;
            return (
              <div key={step} className="flex items-center gap-2 py-1">
                {done
                  ? <ICONS.check className="w-4 h-4 text-green-500" />
                  : active
                    ? <ICONS.spinner className="w-4 h-4 animate-spin text-purple-600" />
                    : <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                }
                <span className={`text-sm ${done ? 'text-green-700 font-semibold' : active ? 'text-purple-700 font-bold' : 'text-gray-400'}`}>
                  {i + 1}. {labels[step]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!isGenerating && generatedMaterial && (
        <div className="mt-6 flex flex-col gap-4">

          {/* B5: Extraction → Generator pre-fill panel */}
          {(state.materialType === 'VIDEO_EXTRACTOR' || state.materialType === 'IMAGE_EXTRACTOR' || state.materialType === 'WEB_EXTRACTOR') && (
            <div className="p-4 bg-gradient-to-r from-cyan-50 to-teal-50 border border-cyan-200 rounded-2xl">
              <p className="text-xs font-black text-cyan-800 uppercase tracking-widest mb-1">Содржината е извлечена!</p>
              <p className="text-sm text-cyan-700 mb-3">Избери тип на материјал за да генерираш врз основа на оваа содржина:</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { type: 'QUIZ' as MaterialType,        emoji: '❓', label: 'Квиз' },
                  { type: 'ASSESSMENT' as MaterialType,   emoji: '📄', label: 'Тест' },
                  { type: 'SCENARIO' as MaterialType,     emoji: '🎭', label: 'Сценарио' },
                  { type: 'FLASHCARDS' as MaterialType,   emoji: '🃏', label: 'Картички' },
                  { type: 'EXIT_TICKET' as MaterialType,  emoji: '🎟️', label: 'Exit Ticket' },
                ] as const).map(({ type, emoji, label }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleGenerateFromExtraction(type)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-cyan-300 text-cyan-800 rounded-xl text-sm font-bold hover:bg-cyan-100 hover:border-cyan-500 transition-all shadow-sm"
                  >
                    <span>{emoji}</span>{label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {'imageUrl' in generatedMaterial && <GeneratedIllustration material={generatedMaterial} />}
          {'openingActivity' in generatedMaterial && (
            <>
              <GeneratedIdeas material={generatedMaterial} onSaveAsNote={handleSaveAsNote} />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveToLibrary(generatedMaterial, 'main')}
                  disabled={savedToLibrary.has('main')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${savedToLibrary.has('main') ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {savedToLibrary.has('main') ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                  {savedToLibrary.has('main') ? 'Зачувано' : 'Зачувај во библиотека'}
                </button>
              </div>
            </>
          )}
          {'questions' in generatedMaterial && (state.materialType === 'QUIZ' || state.materialType === 'ASSESSMENT') && (
            <div className="bg-white border border-indigo-100 rounded-2xl p-4">
              <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">Webb's DoK — Распределба на генерираните прашања</p>
              <DokDistributionBar questions={(generatedMaterial as AIGeneratedAssessment).questions} />
            </div>
          )}
          {'questions' in generatedMaterial && (generatedMaterial as AIGeneratedAssessment).questions?.some(q => q.tableData) && (
            <div className="flex flex-col gap-3">
              {(generatedMaterial as AIGeneratedAssessment).questions
                .filter(q => q.tableData)
                .map((q) => (
                  <StatisticsWorkspace key={q.tableData?.caption ?? ''} initialData={q.tableData} title={q.tableData?.caption} />
                ))}
            </div>
          )}
          {'questions' in generatedMaterial && (
            <div className="flex flex-col gap-2">
              <GeneratedAssessment material={generatedMaterial} onSaveQuestion={handleSaveQuestion} />
              <div className="flex justify-end gap-2 flex-wrap items-center">
                {isPro && !savedToLibrary.has('main') && (
                  <button
                    type="button"
                    onClick={() => setSaveIsPublic(v => !v)}
                    title={saveIsPublic ? 'Материјалот ќе биде јавен во Библиотеката' : 'Материјалот е приватен — само за тебе (PRO)'}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
                      saveIsPublic
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {saveIsPublic ? <><Globe className="w-3.5 h-3.5" /> Јавно</> : <><Lock className="w-3.5 h-3.5" /> Приватно (PRO)</>}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveToLibrary(generatedMaterial, 'main')}
                  disabled={savedToLibrary.has('main')}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${savedToLibrary.has('main') ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {savedToLibrary.has('main') ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                  {savedToLibrary.has('main') ? 'Зачувано' : 'Зачувај'}
                </button>
                <QuizShareButton
                  material={generatedMaterial as AIGeneratedAssessment}
                  materialType={quizLikeType}
                  conceptId={state.selectedConcepts[0]}
                  gradeLevel={gradeLevel}
                />
                <button
                  type="button"
                  onClick={() => setAssignTarget(generatedMaterial as AIGeneratedAssessment)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  <ClipboardList className="w-4 h-4" />Задај на одделение
                </button>
              </div>
            </div>
          )}
          {'criteria' in generatedMaterial && <GeneratedRubric material={generatedMaterial} />}
          {'slides' in generatedMaterial && <GeneratedPresentation data={generatedMaterial as import('../../types').AIGeneratedPresentation} conceptId={state.selectedConcepts[0]} />}
          {'paths' in generatedMaterial && <GeneratedLearningPaths material={generatedMaterial} />}
          {'steps' in generatedMaterial && <WorkedExample example={generatedMaterial as AIGeneratedWorkedExample} />}

          <AIFeedbackBar
            materialKey={('title' in generatedMaterial ? (generatedMaterial as { title?: string }).title ?? '' : '') + String(state.materialType)}
            onRate={handleMaterialRate}
          />
          <RefineGenerationChat
            material={generatedMaterial}
            onUpdateMaterial={setGeneratedMaterial}
            materialType={state.materialType || 'IDEAS'}
          />
        </div>
      )}

      {/* 3× Variants loading indicator */}
      {isGeneratingVariants && (
        <div className="mt-6">
          <AILoadingIndicator />
          <p className="text-center text-sm text-gray-500 mt-3">Генерирам 3 варијанти — Поддршка, Основно и Збогатување...</p>
        </div>
      )}

      {/* 3× Variants result tabs */}
      {!isGeneratingVariants && variants && (
        <div className="mt-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-3">
            <ICONS.sparkles className="w-5 h-5 text-brand-primary" />
            <h3 className="text-lg font-bold text-gray-800">3 Нивоа на диференцијација</h3>
          </div>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-4 shadow-sm">
            {([
              { value: 'support' as const, label: '🔵 Поддршка' },
              { value: 'standard' as const, label: '⚪ Основно' },
              { value: 'advanced' as const, label: '🔴 Збогатување' },
            ]).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setActiveVariantTab(opt.value)}
                className={`flex-1 py-2.5 px-4 font-semibold text-sm transition-colors border-r last:border-r-0 border-gray-200 ${activeVariantTab === opt.value ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {variants[activeVariantTab] && (
            <div className="flex flex-col gap-2">
              <GeneratedAssessment material={variants[activeVariantTab]} onSaveQuestion={handleSaveQuestion} />
              <div className="flex justify-end gap-2 flex-wrap items-center">
                {isPro && !savedToLibrary.has(`variant-${activeVariantTab}`) && (
                  <button
                    type="button"
                    onClick={() => setSaveIsPublic(v => !v)}
                    title={saveIsPublic ? 'Материјалот ќе биде јавен во Библиотеката' : 'Материјалот е приватен — само за тебе (PRO)'}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
                      saveIsPublic
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {saveIsPublic ? <><Globe className="w-3.5 h-3.5" /> Јавно</> : <><Lock className="w-3.5 h-3.5" /> Приватно (PRO)</>}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSaveToLibrary(variants[activeVariantTab], `variant-${activeVariantTab}`)}
                  disabled={savedToLibrary.has(`variant-${activeVariantTab}`)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${savedToLibrary.has(`variant-${activeVariantTab}`) ? 'bg-green-100 text-green-700' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {savedToLibrary.has(`variant-${activeVariantTab}`) ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                  {savedToLibrary.has(`variant-${activeVariantTab}`) ? 'Зачувано' : 'Зачувај'}
                </button>
                <QuizShareButton
                  material={variants[activeVariantTab]}
                  materialType={quizLikeType}
                  conceptId={state.selectedConcepts[0]}
                  gradeLevel={gradeLevel}
                />
                <button
                  type="button"
                  onClick={() => setAssignTarget(variants[activeVariantTab])}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                >
                  <ClipboardList className="w-4 h-4" />Задај на одделение
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk results — full lesson package */}
      {!isGeneratingBulk && bulkResults && Object.keys(bulkResults).length > 0 && (
        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-purple-800 flex items-center gap-2">
              <ICONS.sparkles className="w-5 h-5" />
              Генериран пакет материјали
            </h3>
            <div className="flex items-center gap-2">
              {isPro && !savedToLibrary.has('package') && (
                <button
                  type="button"
                  onClick={() => setSaveIsPublic(v => !v)}
                  title={saveIsPublic ? 'Пакетот ќе биде јавен' : 'Пакетот е приватен (PRO)'}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${saveIsPublic ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                >
                  {saveIsPublic ? <><Globe className="w-3.5 h-3.5" /> Јавно</> : <><Lock className="w-3.5 h-3.5" /> Приватно</>}
                </button>
              )}
              <button
                type="button"
                onClick={handleSavePackage}
                disabled={savedToLibrary.has('package')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors ${savedToLibrary.has('package') ? 'bg-green-100 text-green-700' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
              >
                {savedToLibrary.has('package') ? <CheckCircle className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
                {savedToLibrary.has('package') ? 'Пакетот зачуван' : '💾 Зачувај цел пакет'}
              </button>
            </div>
          </div>

          {bulkResults.quiz && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-2">❓ Квиз</p>
              <GeneratedAssessment material={bulkResults.quiz} onSaveQuestion={handleSaveQuestion} />
            </div>
          )}

          {bulkResults.assessment && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-500 mb-2">📄 Писмена работа</p>
              <GeneratedAssessment material={bulkResults.assessment} onSaveQuestion={handleSaveQuestion} />
            </div>
          )}

          {bulkResults.rubric && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-500 mb-2">📊 Рубрика</p>
              <GeneratedRubric material={bulkResults.rubric} />
            </div>
          )}
        </div>
      )}

      {/* National standards alignment — shown after any result */}
      {!isGenerating && !isGeneratingVariants && (generatedMaterial || variants) && relevantStandards.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ICONS.check className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Усогласеност со Национални стандарди</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {relevantStandards.map((s: NationalStandard) => (
              <div key={s.id} className="group relative">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 cursor-default border border-blue-200 hover:bg-blue-200 transition-colors">
                  {s.code}
                </span>
                <div className="absolute bottom-full left-0 mb-1.5 w-72 bg-gray-900 text-white text-xs rounded-lg p-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                  <span className="font-semibold text-blue-300">{s.code}</span>
                  <p className="mt-0.5">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ResultErrorBoundary>
  );
};
