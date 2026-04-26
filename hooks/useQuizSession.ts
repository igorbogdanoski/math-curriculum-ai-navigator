import { logger } from '../utils/logger';
/**
 * useQuizSession — quiz session state + business logic.
 * Manages: reducer, handleQuizComplete, generateRemediaQuiz.
 * Extracted from StudentPlayView for single-responsibility.
 */
import { useReducer, useRef, useEffect } from 'react';
import { firestoreService } from '../services/firestoreService';
import { geminiService } from '../services/geminiService';
import { QuestionType, type DifferentiationLevel, type Grade, type Topic, type Concept } from '../types';
import { getAdaptiveLevel } from '../utils/adaptiveDifficulty';
import { markQuestComplete } from '../utils/dailyQuests';
import { saveAICache, getAICache } from '../services/indexedDBService';
import {
  quizSessionReducer,
  QUIZ_SESSION_INITIAL,
  type QuizPlayData,
} from '../components/student/quizSessionReducer';

interface UseQuizSessionParams {
  quizData: QuizPlayData | null;
  quizId: string | undefined;
  studentName: string;
  deviceId: string;
  classId: string | null;
  sessionId: string | null;
  assignId: string | undefined;
  getConceptDetails: (id: string) => { grade?: Grade; topic?: Topic; concept?: Concept };
}

export function useQuizSession({
  quizData,
  quizId,
  studentName,
  deviceId,
  classId,
  sessionId,
  assignId,
  getConceptDetails,
}: UseQuizSessionParams) {
  const [session, dispatch] = useReducer(quizSessionReducer, QUIZ_SESSION_INITIAL);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const generateRemediaQuiz = async (
    meta: { conceptId?: string; topicId?: string; gradeLevel?: number; teacherUid?: string },
    percentage: number,
  ) => {
    if (!meta.conceptId || !quizId || window.__E2E_MODE__) return;
    const conceptId = meta.conceptId;
    try {
      dispatch({ type: 'SET_GENERATING_REMEDIA', loading: true });
      const adaptiveLevel: DifferentiationLevel = getAdaptiveLevel(percentage);
      const statusNote = `Ученикот штотуку заврши квиз за '${conceptId}' со резултат ${percentage}%.`;
      const customInstr = (
        adaptiveLevel === 'support'
          ? 'РЕМЕДИЈАЛНА ВЕЖБА: Поедноставени прашања, чекор-по-чекор упатства, помал вокабулар. Ученикот не ги положи стандардните прашања.'
          : adaptiveLevel === 'advanced'
          ? 'ЗБОГАТУВАЊЕ: Предизвикувачки прашања со критичко размислување, реален контекст и повеќекорачни решенија.'
          : 'ВЕЖБА: Стандардни прашања за дополнително вежбање на концептот.'
      ) + ' ' + statusNote;

      const { grade, topic, concept } = getConceptDetails(conceptId);
      const generationContext: import('../types').GenerationContext = {
        type: 'CONCEPT',
        grade: grade ?? { id: 'unknown', level: meta.gradeLevel ?? 6, title: '', topics: [] },
        topic,
        concepts: concept ? [concept] : [],
      };

      const result = await geminiService.generateAssessment(
        'QUIZ',
        [QuestionType.MULTIPLE_CHOICE],
        6,
        generationContext,
        undefined,
        adaptiveLevel,
        undefined,
        undefined,
        customInstr,
      );

      const newId = await firestoreService.saveRemediaQuiz(result, {
        conceptId: meta.conceptId,
        topicId: meta.topicId,
        gradeLevel: meta.gradeLevel,
        sourceQuizId: quizId,
      }, meta.teacherUid);
      if (newId) dispatch({ type: 'SET_REMEDIA_QUIZ', quizId: newId });
    } catch (err) {
      logger.error('Грешка при генерирање следен квиз:', err);
    } finally {
      dispatch({ type: 'SET_GENERATING_REMEDIA', loading: false });
    }
  };

  const handleQuizComplete = async (
    score: number,
    correctCount: number,
    totalQuestions: number,
    misconceptions?: { question: string; studentAnswer: string; misconception: string }[],
    answers?: Record<string, boolean>,
  ) => {
    const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const meta = quizData!._meta || {};
    const isE2E = typeof window !== 'undefined' && window.__E2E_MODE__;

    // 1. Save quiz result
    let savedDocId = '';
    if (isE2E) {
      savedDocId = 'mock-doc-id';
    } else {
      try {
        savedDocId = await firestoreService.saveQuizResult({
          quizId: quizId || 'unknown',
          quizTitle: quizData!.title || 'Квиз',
          score,
          correctCount,
          totalQuestions,
          percentage,
          conceptId: meta.conceptId,
          topicId: meta.topicId,
          gradeLevel: meta.gradeLevel,
          studentName: studentName || undefined,
          teacherUid: meta.teacherUid,
          deviceId,
          differentiationLevel: meta.differentiationLevel as DifferentiationLevel | undefined,
          misconceptions,
          classId: classId || undefined,
        });
      } catch (err) {
        logger.error('[Quiz] saveQuizResult failed:', err);
      }
    }

    // 2. Update concept mastery
    let freshMastery: import('../services/firestoreService').ConceptMastery | null = null;
    if (!isE2E && studentName && meta.conceptId) {
      try {
        const { concept } = getConceptDetails(meta.conceptId);
        freshMastery = await firestoreService.updateConceptMastery(
          studentName,
          meta.conceptId,
          percentage,
          {
            conceptTitle: concept?.title ?? quizData!.title,
            topicId: meta.topicId,
            gradeLevel: meta.gradeLevel,
          },
          meta.teacherUid,
          deviceId,
        );
      } catch (err) {
        logger.error('[Quiz] updateConceptMastery failed:', err);
      }
    }

    // P1 + P4 — Compute conceptTitle for prompt and AI feedback
    const conceptTitleForPrompt: string = (() => {
      if (meta.conceptId) {
        const { concept } = getConceptDetails(meta.conceptId);
        return concept?.title ?? quizData?.title ?? 'концептот';
      }
      return quizData?.title ?? 'концептот';
    })();

    // P4 — Metacognitive prompt based on score
    const lowPrompts = [
      `Со кое прашање од „${conceptTitleForPrompt}" имаше најмногу тешкотии?`,
      `Што точно ти беше тешко кај „${conceptTitleForPrompt}"?`,
      `Кој дел од „${conceptTitleForPrompt}" не го разбираш добро?`,
    ];
    const highPrompts = [
      `Со свои зборови, објасни го „${conceptTitleForPrompt}".`,
      `Кај кое прашање од „${conceptTitleForPrompt}" требаше најмногу да размислуваш?`,
      `Кој дел од „${conceptTitleForPrompt}" ти е сега најјасен?`,
    ];
    const midPrompts = [
      `Што би сакал/а уште да вежбаш кај „${conceptTitleForPrompt}"?`,
      `Кое прашање те изненади кај „${conceptTitleForPrompt}"?`,
      `Напиши едно прашање за „${conceptTitleForPrompt}" за кое сè уште не знаеш одговор.`,
    ];
    const pool = percentage >= 80 ? highPrompts : percentage < 60 ? lowPrompts : midPrompts;
    const chosenPrompt = pool[Math.floor(Math.random() * pool.length)];

    dispatch({
      type: 'QUIZ_COMPLETE',
      quizResult: { percentage, correctCount, totalQuestions, misconceptions },
      docId: savedDocId,
      mastery: freshMastery,
      metacognitivePrompt: chosenPrompt,
    });

    // P1 — Generate AI feedback asynchronously (non-blocking)
    if (meta.conceptId) {
      const feedbackCacheKey = `fb_${meta.conceptId}_${Math.round(percentage / 10) * 10}`;
      geminiService.generateQuizFeedback(
        studentName || 'Ученик',
        percentage,
        conceptTitleForPrompt,
        correctCount,
        totalQuestions,
        misconceptions,
      ).then(feedback => {
        if (isMountedRef.current) dispatch({ type: 'SET_AI_FEEDBACK', feedback });
        saveAICache(feedbackCacheKey, feedback).catch(() => {});
      }).catch(async () => {
        const cached = await getAICache(feedbackCacheKey).catch(() => null);
        if (isMountedRef.current) {
          const offlineMsg = cached
            ? cached
            : (navigator.onLine
              ? 'AI повратната информација е недостапна. Продолжи со вежбање!'
              : 'Нема интернет врска. Повратната информација ќе се прикаже кога ќе се поврзете.');
          dispatch({ type: 'SET_AI_FEEDBACK', feedback: offlineMsg });
        }
      });
    }

    // Mark assignment completed
    if (!isE2E && assignId && studentName) {
      firestoreService.markAssignmentCompleted(assignId, studentName).catch(() => {});
    }

    // Mark daily quest complete
    if (!isE2E && studentName && meta.conceptId) {
      markQuestComplete(studentName, meta.conceptId);
    }

    // 3. Gamification
    if (!isE2E && studentName) {
      const justMastered = !!(freshMastery?.mastered && freshMastery.consecutiveHighScores === 3);
      const allMastery = await firestoreService.fetchMasteryByStudent(studentName, deviceId).catch(() => []);
      if (!isMountedRef.current) return;
      const totalMastered = allMastery.filter(m => m.mastered).length;
      firestoreService.updateStudentGamification(studentName, percentage, justMastered, totalMastered, meta.teacherUid, deviceId)
        .then(({ xpGained, newAchievements, gamification }) => {
          if (isMountedRef.current) dispatch({ type: 'SET_GAMIFICATION', update: { xpGained, newAchievements, gamification } });
        })
        .catch(err => logger.warn('[Gamification] update failed:', err));
    }

    // 3b. Spaced Repetition
    if (!isE2E && meta.conceptId && deviceId) {
      firestoreService.updateSpacedRepRecord(deviceId, meta.conceptId, percentage)
        .catch(err => logger.warn('[SM-2] updateSpacedRepRecord failed:', err));
    }

    // 4. Live session response
    if (!isE2E && sessionId && studentName) {
      firestoreService.submitLiveResponse(sessionId, studentName, percentage, answers)
        .catch(err => logger.warn('[Live] submitLiveResponse failed:', err));
    }

    // P5 — Peer learning suggestions
    if (!isE2E && percentage < 85 && meta.conceptId) {
      firestoreService.fetchMasteryByConcept(meta.conceptId, meta.teacherUid)
        .then(masteries => {
          const peers = masteries
            .filter(m => m.mastered && m.studentName !== studentName)
            .map(m => m.studentName);
          const uniquePeers = Array.from(new Set(peers));
          const selected = uniquePeers.sort(() => 0.5 - Math.random()).slice(0, 2);
          if (isMountedRef.current && selected.length > 0) {
            dispatch({ type: 'SET_PEER_SUGGESTIONS', peers: selected });
          }
        })
        .catch(err => logger.warn('[Peer Learning] failed:', err));
    }

    // 5. Adaptive next quiz
    generateRemediaQuiz(meta, percentage);
  };

  return { session, dispatch, handleQuizComplete, isMountedRef };
}
