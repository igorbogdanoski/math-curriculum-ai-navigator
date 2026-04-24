import { logger } from '../../utils/logger';
import { useState, useRef } from 'react';
import type { User } from 'firebase/auth';
import { geminiService, isDailyQuotaKnownExhausted } from '../../services/geminiService';
import { AI_COSTS, sanitizePromptInput } from '../../services/gemini/core';
import { RateLimitError } from '../../services/apiErrors';
import { ValidationError } from '../../utils/errors';
import { buildExtractionBundle, evaluateExtractionQuality } from '../../utils/extractionBundle';
import { inferConceptIdsFromExtraction } from '../../utils/extractionConceptMap';
import { buildPedagogicalVideoSegments } from '../../utils/videoSegmentation';
import { trackFirstTimeEvent, trackEvent } from '../../services/telemetryService';
import type {
  AIGeneratedIdeas, Concept, MaterialType, TeachingProfile,
} from '../../types';
import type { GeneratorState, GeneratorAction } from '../useGeneratorState';
import type { BuildContextResult, GeneratedMaterial } from './useGeneratorContext';
import type { PersistExtractionArtifactParams } from './generatorHelpers';

interface UseMainGenerateParams {
  state: GeneratorState;
  dispatch: React.Dispatch<GeneratorAction>;
  user: TeachingProfile | null;
  firebaseUser: User | null;
  isOnline: boolean;
  allConcepts: Concept[];
  isGeneratingBulk: boolean;
  isGeneratingVariants: boolean;
  buildContext: () => BuildContextResult | null;
  buildEffectiveInstruction: () => string;
  persistExtractionArtifact: (p: PersistExtractionArtifactParams) => Promise<void>;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setQuotaBannerFromStorage: () => void;
  setVariants: (v: null) => void;
  deductCredits?: (amount?: number) => Promise<void>;
  openUpgradeModal?: (reason: string) => void;
}

export function useMainGenerate({
  state,
  dispatch,
  user,
  firebaseUser,
  isOnline,
  allConcepts,
  isGeneratingBulk,
  isGeneratingVariants,
  buildContext,
  buildEffectiveInstruction,
  persistExtractionArtifact,
  addNotification,
  setQuotaBannerFromStorage,
  setVariants,
  deductCredits,
  openUpgradeModal,
}: UseMainGenerateParams) {
  const [isGenerating, setIsLoading] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<GeneratedMaterial>(null);
  const cancelRef = useRef(false);

  const handleCancel = () => {
    cancelRef.current = true;
    setIsLoading(false);
  };

  const handleGenerate = async () => {
    if (isGenerating || isGeneratingBulk || isGeneratingVariants) return;
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const { materialType, includeIllustration } = state;
    let cost = AI_COSTS.TEXT_BASIC;
    if (materialType === 'ILLUSTRATION') cost = AI_COSTS.ILLUSTRATION;
    else if (materialType === 'PRESENTATION') cost = AI_COSTS.PRESENTATION;
    else if (materialType === 'LEARNING_PATH') cost = AI_COSTS.LEARNING_PATH;
    if (includeIllustration && materialType !== 'ILLUSTRATION') cost += AI_COSTS.ILLUSTRATION;

    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        openUpgradeModal?.(`Останавте без AI кредити! Оваа опција чини ${cost} кредити. Надградете на Pro пакет за неограничено генерирање.`);
        return;
      }
    }
    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext, imageParam, studentProfilesToPass, tempActivityTitle } = built;
    const effectiveInstruction = buildEffectiveInstruction();
    const { questionTypes, numQuestions, differentiationLevel, generateAllLevels, exitTicketQuestions, exitTicketFocus, activityType, criteriaHints, activityFocus, scenarioTone, learningDesignModel } = state;

    setIsLoading(true);
    setGeneratedMaterial(null);
    setVariants(null);

    try {
      let result: GeneratedMaterial = null;
      if (materialType === 'ILLUSTRATION') {
        if (!state.illustrationPrompt && !state.imageFile) {
          addNotification('Ве молиме внесете опис или прикачете слика за илустрацијата.', 'error');
          setIsLoading(false);
          return;
        }
        const res = await geminiService.generateIllustration(state.illustrationPrompt, imageParam, user ?? undefined);
        result = { ...res, prompt: state.illustrationPrompt };
      } else if (materialType === 'LEARNING_PATH') {
        if (!studentProfilesToPass || studentProfilesToPass.length === 0) {
          addNotification('Ве молиме изберете барем еден профил на ученик.', 'error');
          setIsLoading(false);
          return;
        }
        result = await geminiService.generateLearningPaths(finalContext, studentProfilesToPass, user ?? undefined, effectiveInstruction);
      } else if (materialType) {
        switch (materialType) {
          case 'SCENARIO':
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за генерирање на сценарио');
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за генерирање на сценарио');
            result = await geminiService.generateLessonPlanIdeas(
              finalContext.concepts || [], finalContext.topic, finalContext.grade.level,
              user ?? undefined, { focus: activityFocus, tone: scenarioTone, learningDesign: learningDesignModel }, effectiveInstruction,
            );
            (result as AIGeneratedIdeas).generationContext = finalContext;
            break;
          case 'ASSESSMENT':
          case 'FLASHCARDS':
          case 'QUIZ':
            if (generateAllLevels && (materialType === 'ASSESSMENT' || materialType === 'QUIZ') && !studentProfilesToPass?.length) {
              const [standard, support, advanced] = await Promise.all([
                geminiService.generateAssessment(materialType, questionTypes, numQuestions, finalContext, user ?? undefined, 'standard', undefined, imageParam, effectiveInstruction, state.includeSelfAssessment, state.includeWorkedExamples),
                geminiService.generateAssessment(materialType, questionTypes, numQuestions, finalContext, user ?? undefined, 'support', undefined, imageParam, effectiveInstruction, false, false),
                geminiService.generateAssessment(materialType, questionTypes, numQuestions, finalContext, user ?? undefined, 'advanced', undefined, imageParam, effectiveInstruction, false, false),
              ]);
              result = {
                ...standard,
                differentiatedVersions: [
                  { profileName: 'Поддршка', questions: support.questions },
                  { profileName: 'Предизвик', questions: advanced.questions },
                ],
              };
            } else {
              result = await geminiService.generateAssessment(
                materialType, questionTypes, numQuestions, finalContext,
                user ?? undefined, differentiationLevel, studentProfilesToPass, imageParam, effectiveInstruction, state.includeSelfAssessment, state.includeWorkedExamples, state.dokTarget,
              );
            }
            break;
          case 'WORKED_EXAMPLE': {
            const conceptObj = finalContext.concepts?.[0];
            const conceptTitle = conceptObj?.title ?? finalContext.topic?.title ?? 'Математика';
            const gradeLevel = finalContext.grade?.level ?? 1;
            const workedExSecondaryTrack = finalContext.grade?.secondaryTrack ?? user?.secondaryTrack;
            result = await geminiService.generateWorkedExample(conceptTitle, gradeLevel, workedExSecondaryTrack);
            break;
          }
          case 'EXIT_TICKET':
            result = await geminiService.generateExitTicket(exitTicketQuestions, exitTicketFocus, finalContext, user ?? undefined, effectiveInstruction);
            break;
          case 'RUBRIC':
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за генерирање на рубрика');
            result = await geminiService.generateRubric(finalContext.grade.level, tempActivityTitle, activityType, criteriaHints, user ?? undefined, effectiveInstruction);
            break;
          case 'PRESENTATION':
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за генерирање на презентација');
            result = await geminiService.generatePresentation(
              finalContext.topic.title,
              finalContext.grade?.level ?? 1,
              finalContext.concepts?.map(c => c.title) || [],
              effectiveInstruction,
              user ?? undefined,
            );
            break;
          case 'IMAGE_EXTRACTOR': {
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за Image Extractor');
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за Image Extractor');
            if (!state.imageFile) throw new ValidationError('Слика', 'прикачете слика за извлекување');
            {
              const { base64, file } = state.imageFile;
              const mimeType = file.type || 'image/jpeg';
              const topicTitle = sanitizePromptInput(finalContext.topic?.title ?? 'Математика', 120);
              const gradeLevel = finalContext.grade?.level ?? 1;
              const conceptsList = finalContext.concepts?.map(c => c.title).join(', ') || '';

              const extractionContext = [
                `РЕЖИМ: Извлекување на задачи (не оценување)`,
                `Тема: ${topicTitle}`,
                conceptsList ? `Концепти: ${conceptsList}` : '',
                `Одделение: ${gradeLevel}`,
                `ЗАДАЧА: Извлечи ги ТОЧНО сите математички задачи, формули и теорија од сликата. Потоа генерирај структуриран наставен план со: цел на часот, клучни концепти, чекор-по-чекор решавање на 1-2 задачи, и 3 нови вежби на исто ниво.`,
              ].filter(Boolean).join('\n');

              const rawAnalysis = await geminiService.analyzeHandwriting(base64, mimeType, extractionContext);
              const extractionBundle = buildExtractionBundle(rawAnalysis);
              const extractionQuality = evaluateExtractionQuality(extractionBundle, {
                textLength: rawAnalysis.length,
              });
              const mappedConceptIds = inferConceptIdsFromExtraction(
                extractionBundle,
                allConcepts,
                finalContext.concepts?.map(c => c.id) ?? [],
              );

              dispatch({ type: 'SET_FIELD', payload: { field: 'extractedText', value: rawAnalysis } });

              result = {
                title: `Извлечен материјал: ${topicTitle}`,
                openingActivity: 'Прочитај ја извлечената содржина и означи ги клучните поими.',
                mainActivity: [
                  {
                    text: rawAnalysis,
                    bloomsLevel: 'Applying',
                  },
                ],
                differentiation: 'Понуди дополнителни примери за ученици што побрзо решаваат.',
                assessmentIdea: 'Кратка усна проверка за формули и чекори.',
                concepts: finalContext.concepts?.map(c => c.title) ?? [],
                extractionBundle,
                sourceMeta: {
                  sourceType: 'image',
                  conceptIds: mappedConceptIds,
                  topicId: finalContext.topic?.id,
                  gradeLevel,
                  secondaryTrack: user?.secondaryTrack,
                  extractionQuality,
                },
              } as unknown as GeneratedMaterial;

              await persistExtractionArtifact({
                sourceType: 'image',
                extractedText: rawAnalysis,
                extractionBundle,
                quality: {
                  score: extractionQuality.score,
                  label: extractionQuality.label,
                  truncated: false,
                },
                gradeLevel,
                topicId: finalContext.topic?.id,
                conceptIds: mappedConceptIds,
              });
            }
            break;
          }
          case 'WEB_EXTRACTOR': {
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за Web Extractor');
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за Web Extractor');
            if (!state.webpageUrl.trim()) throw new ValidationError('URL', 'внесете URL на веб страна');
            {
              const safeUrl = sanitizePromptInput(state.webpageUrl, 300);
              const rawWebText = state.webpageText;
              const webMeta = state.webpageExtractMeta;
              const topicTitle = sanitizePromptInput(finalContext.topic?.title ?? 'Математика', 120);
              const gradeLevel = finalContext.grade?.level ?? 1;
              const conceptsList = finalContext.concepts?.map(c => c.title).join(', ') || '';

              const safeWebText = rawWebText
                ? sanitizePromptInput(rawWebText.slice(0, 6000), 6000)
                : null;

              const webContext = [
                '=== ВЕБ ИЗВОР ===',
                `URL: ${safeUrl}`,
                webMeta?.sourceUrls?.length ? `BATCH URLs: ${webMeta.sourceUrls.join(' | ')}` : '',
                `Тема: ${topicTitle}`,
                conceptsList ? `Концепти: ${conceptsList}` : '',
                safeWebText
                  ? `\n=== ИЗВЛЕЧЕНА СОДРЖИНА ОД ВЕБ СТРАНА ===\n${safeWebText}\n=== КРАЈ НА СОДРЖИНА ===\n\nИнструкција: анализирај ја извлечената содржина погоре и идентификувај ги математичките концепти, задачи и теорија. Креирај детален наставен материјал базиран на ВИСТИНСКАТА содржина.`
                  : '\nИнструкција: нема извлечена содржина — генерирај материјал врз основа на темата и URL.',
              ].filter(Boolean).join('\n');

              const combinedInstruction = [effectiveInstruction, webContext].filter(Boolean).join('\n\n');
              result = await geminiService.generateLessonPlanIdeas(
                finalContext.concepts || [],
                finalContext.topic,
                gradeLevel,
                user ?? undefined,
                { focus: activityFocus, tone: scenarioTone, learningDesign: learningDesignModel },
                combinedInstruction,
              );
              if (result && 'openingActivity' in result) {
                const extractionBundle = buildExtractionBundle(safeWebText ?? '');
                const mappedConceptIds = inferConceptIdsFromExtraction(
                  extractionBundle,
                  allConcepts,
                  finalContext.concepts?.map(c => c.id) ?? [],
                );
                const extractionQuality = evaluateExtractionQuality(extractionBundle, {
                  textLength: safeWebText?.length ?? 0,
                  truncated: webMeta?.truncated,
                  extractionMode: webMeta?.extractionModes?.includes('pdf-ocr-fallback')
                    ? 'pdf-ocr-fallback'
                    : (webMeta?.extractionModes?.[0] as 'html-static' | 'html-reader-fallback' | 'pdf-native' | 'pdf-ocr-fallback' | undefined),
                });
                (result as AIGeneratedIdeas).extractionBundle = extractionBundle;
                (result as AIGeneratedIdeas).sourceMeta = {
                  sourceType: 'web',
                  sourceUrl: safeUrl,
                  sourceUrls: webMeta?.sourceUrls,
                  conceptIds: mappedConceptIds,
                  topicId: finalContext.topic?.id,
                  gradeLevel,
                  secondaryTrack: user?.secondaryTrack,
                  extractionQuality,
                };

                await persistExtractionArtifact({
                  sourceType: 'web',
                  sourceUrl: safeUrl,
                  sourceUrls: webMeta?.sourceUrls,
                  extractedText: safeWebText ?? '',
                  extractionBundle,
                  quality: {
                    score: extractionQuality.score,
                    label: extractionQuality.label,
                    truncated: webMeta?.truncated,
                  },
                  gradeLevel,
                  topicId: finalContext.topic?.id,
                  conceptIds: mappedConceptIds,
                });
              }
            }
            break;
          }
          case 'VIDEO_EXTRACTOR':
            if (!finalContext.grade) throw new ValidationError('Одделение', 'потребно за Video Extractor');
            if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за Video Extractor');
            if (!state.videoUrl.trim()) throw new ValidationError('Видео URL', 'внесете валиден YouTube/Vimeo линк');
            {
              const safeVideoUrl = sanitizePromptInput(state.videoUrl, 300);
              const preview = state.videoPreview;
              const rawTranscript = state.videoTranscript;
              const rawSegments = state.videoTranscriptSegments;

              const safeTranscript = rawTranscript
                ? sanitizePromptInput(rawTranscript.slice(0, 6000), 6000)
                : null;
              const pedagogicalSegments = buildPedagogicalVideoSegments(rawSegments, 24);
              const timelineContext = pedagogicalSegments.length > 0
                ? pedagogicalSegments
                    .slice(0, 12)
                    .map((s, i) => `${i + 1}. [${s.startSec}s-${s.endSec}s] (${s.segmentType}) ${s.text}`)
                    .join('\n')
                : '';

              const videoContext = [
                '=== ВИДЕО ИЗВОР ===',
                `URL: ${safeVideoUrl}`,
                preview?.title ? `Наслов: ${sanitizePromptInput(preview.title, 180)}` : '',
                preview?.authorName ? `Канал:  ${sanitizePromptInput(preview.authorName, 120)}` : '',
                safeTranscript
                  ? `\n=== ВИСТИНСКИ ТРАНСКРИПТ (извлечен од субтитли) ===\n${safeTranscript}\n=== КРАЈ НА ТРАНСКРИПТ ===\n\nИнструкција: анализирај го транскриптот погоре и извлечи ги математичките концепти, примери и чекори. Креирај детален план за час базиран на ВИСТИНСКАТА содржина на видеото.`
                  : '\nИнструкција: нема достапен транскрипт — извлечи наставни идеи врз основа на наслов и тема.',
                timelineContext ? `\n=== TIMESTAMP SEGMENTS ===\n${timelineContext}\n=== КРАЈ НА SEGMENTS ===` : '',
              ].filter(Boolean).join('\n');

              const combinedInstruction = [effectiveInstruction, videoContext].filter(Boolean).join('\n\n');
              result = await geminiService.generateLessonPlanIdeas(
                finalContext.concepts || [],
                finalContext.topic,
                finalContext.grade.level,
                user ?? undefined,
                { focus: activityFocus, tone: scenarioTone, learningDesign: learningDesignModel },
                combinedInstruction,
              );
              if (result && 'openingActivity' in result) {
                const extractionBundle = buildExtractionBundle(safeTranscript ?? '');
                const mappedConceptIds = inferConceptIdsFromExtraction(
                  extractionBundle,
                  allConcepts,
                  finalContext.concepts?.map(c => c.id) ?? [],
                );
                const extractionQuality = evaluateExtractionQuality(extractionBundle, {
                  textLength: safeTranscript?.length ?? 0,
                });
                (result as AIGeneratedIdeas).extractionBundle = extractionBundle;
                (result as AIGeneratedIdeas).sourceMeta = {
                  sourceType: 'video',
                  sourceUrl: safeVideoUrl,
                  videoSegments: pedagogicalSegments,
                  conceptIds: mappedConceptIds,
                  topicId: finalContext.topic?.id,
                  gradeLevel: finalContext.grade.level,
                  secondaryTrack: user?.secondaryTrack,
                  extractionQuality,
                };

                await persistExtractionArtifact({
                  sourceType: 'video',
                  sourceUrl: safeVideoUrl,
                  extractedText: safeTranscript ?? '',
                  extractionBundle,
                  quality: {
                    score: extractionQuality.score,
                    label: extractionQuality.label,
                    truncated: false,
                  },
                  gradeLevel: finalContext.grade.level,
                  topicId: finalContext.topic?.id,
                  conceptIds: mappedConceptIds,
                });
              }
            }
            break;
        }
      }

      if (deductCredits && result) await deductCredits(cost);

      if (includeIllustration && result && materialType !== 'ILLUSTRATION') {
        try {
          const contextTitle = finalContext.concepts?.[0]?.title || finalContext.topic?.title || 'Математика';
          const gradeLevel = finalContext.grade?.level || 1;
          let illustrationPrompt = `Визуелен приказ за ${contextTitle} (${gradeLevel}. одд).`;
          if (materialType === 'SCENARIO') {
            illustrationPrompt = `Креативен визуелен приказ за наставен час по математика на тема "${contextTitle}" за ${gradeLevel}. одделение.`;
          } else if (materialType === 'ASSESSMENT' || materialType === 'QUIZ') {
            illustrationPrompt = `Илустрација за работен лист или квиз по математика за "${contextTitle}" (${gradeLevel}. одд).`;
          }
          const illRes = await geminiService.generateIllustration(illustrationPrompt, undefined, user ?? undefined);
          if (illRes?.imageUrl) (result as { illustrationUrl?: string }).illustrationUrl = illRes.imageUrl;
        } catch (illErr) {
          logger.warn('Failed to generate contextual illustration:', illErr);
        }
      }

      setGeneratedMaterial(result);

      if (result && firebaseUser?.uid) {
        const mt = materialType;
        if (mt === 'QUIZ' || mt === 'ASSESSMENT') {
          trackFirstTimeEvent(firebaseUser.uid, 'first_quiz_generated', { materialType: mt });
        }
        if (mt === 'IMAGE_EXTRACTOR' || mt === 'WEB_EXTRACTOR' || mt === 'VIDEO_EXTRACTOR') {
          trackFirstTimeEvent(firebaseUser.uid, 'first_extraction_run', { sourceType: mt });
        }
        trackEvent(`feature_open_generator_${String(mt ?? 'unknown').toLowerCase()}`);
      }
    } catch (error) {
      if (cancelRef.current) { cancelRef.current = false; return; }
      logger.error('[AI Generator]', error);
      if (error instanceof RateLimitError) {
        setQuotaBannerFromStorage();
      } else {
        const msg = (error instanceof Error && error.message) ? error.message : 'Грешка при генерирање. Обидете се повторно.';
        addNotification(msg, 'error');
      }
      setGeneratedMaterial(null);
    } finally {
      cancelRef.current = false;
      setIsLoading(false);
    }
  };

  const handleGenerateFromExtraction = async (targetType: MaterialType) => {
    if (isGenerating || isGeneratingBulk || isGeneratingVariants) return;
    if (!isOnline) { addNotification('Нема интернет конекција.', 'error'); return; }
    if (isDailyQuotaKnownExhausted()) { setQuotaBannerFromStorage(); return; }

    const sourceType = state.materialType;
    let extractionContent = '';
    if (sourceType === 'VIDEO_EXTRACTOR') {
      extractionContent = state.videoTranscript
        ? sanitizePromptInput(state.videoTranscript.slice(0, 6000), 6000)
        : (state.videoPreview?.title ?? '');
    } else if (sourceType === 'WEB_EXTRACTOR') {
      extractionContent = state.webpageText
        ? sanitizePromptInput(state.webpageText.slice(0, 6000), 6000)
        : '';
    } else if (sourceType === 'IMAGE_EXTRACTOR') {
      extractionContent = state.extractedText
        ? sanitizePromptInput(state.extractedText.slice(0, 6000), 6000)
        : '';
    }

    const built = buildContext();
    if (!built) { addNotification('Ве молиме пополнете ги сите задолжителни полиња.', 'error'); return; }
    const { context: finalContext, studentProfilesToPass } = built;

    const extractionSnippet = extractionContent
      ? `\n\n=== ИЗВЛЕЧЕНА СОДРЖИНА (извор за генерирање) ===\n${extractionContent}\n=== КРАЈ НА ИЗВОРОТ ===\n\nГенерирај го материјалот врз основа на оваа изворна содржина.`
      : '';
    const effectiveInstruction = buildEffectiveInstruction() + extractionSnippet;

    dispatch({ type: 'SET_FIELD', payload: { field: 'materialType', value: targetType } });
    setIsLoading(true);
    setGeneratedMaterial(null);

    const { questionTypes, numQuestions, differentiationLevel, exitTicketQuestions, exitTicketFocus, activityFocus, scenarioTone, learningDesignModel } = state;

    try {
      let result: GeneratedMaterial = null;

      switch (targetType) {
        case 'QUIZ':
        case 'ASSESSMENT':
        case 'FLASHCARDS':
          result = await geminiService.generateAssessment(
            targetType, questionTypes, numQuestions, finalContext,
            user ?? undefined, differentiationLevel, studentProfilesToPass, undefined, effectiveInstruction,
          );
          break;
        case 'SCENARIO':
          if (!finalContext.topic) throw new ValidationError('Тема', 'потребна за генерирање на сценарио');
          result = await geminiService.generateLessonPlanIdeas(
            finalContext.concepts || [], finalContext.topic, finalContext.grade.level,
            user ?? undefined, { focus: activityFocus, tone: scenarioTone, learningDesign: learningDesignModel },
            effectiveInstruction,
          );
          break;
        case 'EXIT_TICKET':
          result = await geminiService.generateExitTicket(
            exitTicketQuestions, exitTicketFocus, finalContext, user ?? undefined, effectiveInstruction,
          );
          break;
        default:
          throw new Error(`Unsupported target type: ${targetType}`);
      }

      if (deductCredits && result) await deductCredits(AI_COSTS.TEXT_BASIC);
      setGeneratedMaterial(result);

      if (result && firebaseUser?.uid) {
        if (targetType === 'QUIZ' || targetType === 'ASSESSMENT') {
          trackFirstTimeEvent(firebaseUser.uid, 'first_quiz_generated', {
            materialType: targetType, fromExtraction: true,
          });
        }
        trackEvent(`feature_open_extraction_to_${String(targetType).toLowerCase()}`);
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        setQuotaBannerFromStorage();
      } else {
        const msg = error instanceof Error ? error.message : 'Грешка при генерирање.';
        addNotification(msg, 'error');
      }
      setGeneratedMaterial(null);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isGenerating,
    generatedMaterial,
    setGeneratedMaterial,
    handleCancel,
    handleGenerate,
    handleGenerateFromExtraction,
  };
}
