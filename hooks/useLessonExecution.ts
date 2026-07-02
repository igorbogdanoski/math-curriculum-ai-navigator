import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { getGradeHoursInfo } from '../services/gemini/plans';
import { saveClassroomExecution } from '../services/firestoreService.classroom';
import { buildPhases, formatTime } from '../views/ClassroomView';
import type { PhaseConfig } from '../views/ClassroomView';
import type { LessonPlan } from '../types';

export type { PhaseConfig } from '../views/ClassroomView';
export { formatTime } from '../views/ClassroomView';

export interface LessonExecutionState {
  phases: PhaseConfig[];
  activePhaseIdx: number;
  timerRunning: boolean;
  secondsLeft: number;
  completedPhases: Set<number>;
  classStarted: boolean;
  classEnded: boolean;
  isSavingExecution: boolean;
  aiSuggestion: string;
  loadingAI: boolean;
  progressPct: number;
  handleStart: () => void;
  handlePauseResume: () => void;
  handleNextPhase: () => void;
  handleActivatePhase: (idx: number) => void;
  handleEndClass: () => Promise<void>;
}

export function useLessonExecution(
  plan: LessonPlan | null | undefined,
  teacherUid: string | null | undefined,
): LessonExecutionState {
  const { lessonMinutes } = getGradeHoursInfo(plan?.grade ?? 8);
  const phases = useMemo(() => buildPhases(lessonMinutes), [lessonMinutes]);

  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(phases[0].minutes * 60);
  const [completedPhases, setCompletedPhases] = useState<Set<number>>(new Set());
  const [classStarted, setClassStarted] = useState(false);
  const [classEnded, setClassEnded] = useState(false);
  const [isSavingExecution, setIsSavingExecution] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  const isMounted = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { isMounted.current = false; }, []);

  useEffect(() => {
    setSecondsLeft(phases[activePhaseIdx].minutes * 60);
  }, [activePhaseIdx, phases]);

  // Countdown tick
  useEffect(() => {
    if (!timerRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          setCompletedPhases(cp => new Set([...cp, activePhaseIdx]));
          if (activePhaseIdx < phases.length - 1) {
            setActivePhaseIdx(i => i + 1);
          } else {
            setTimerRunning(false);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning, activePhaseIdx, phases.length]);

  const totalElapsed = classStarted
    ? phases.slice(0, activePhaseIdx).reduce((s, p) => s + p.minutes * 60, 0) +
      (phases[activePhaseIdx].minutes * 60 - secondsLeft)
    : 0;
  const totalSeconds = phases.reduce((s, p) => s + p.minutes * 60, 0);
  const progressPct = Math.round((totalElapsed / totalSeconds) * 100);

  const handleStart = useCallback(() => {
    setClassStarted(true);
    setTimerRunning(true);
  }, []);

  const handlePauseResume = useCallback(() => {
    setTimerRunning(r => !r);
  }, []);

  const handleNextPhase = useCallback(() => {
    setCompletedPhases(cp => new Set([...cp, activePhaseIdx]));
    if (activePhaseIdx < phases.length - 1) {
      setActivePhaseIdx(i => i + 1);
      setTimerRunning(true);
    }
  }, [activePhaseIdx, phases.length]);

  const handleActivatePhase = useCallback((idx: number) => {
    setActivePhaseIdx(idx);
    setSecondsLeft(phases[idx].minutes * 60);
    if (classStarted) setTimerRunning(true);
  }, [phases, classStarted]);

  const handleEndClass = useCallback(async () => {
    setTimerRunning(false);
    setClassEnded(true);

    const topic = plan?.theme || plan?.title || '';
    const grade = plan?.grade ?? 8;

    if (plan?.id && teacherUid) {
      setIsSavingExecution(true);
      try {
        await saveClassroomExecution({
          lessonPlanId: plan.id,
          teacherUid,
          grade,
          topic,
          phasesCompleted: completedPhases.size,
          totalPhases: phases.length,
        });
      } catch { /* non-critical */ }
      finally { setIsSavingExecution(false); }
    }

    if (!topic) return;
    setLoadingAI(true);
    try {
      const { geminiService } = await import('../services/geminiService');
      const completion = completedPhases.size === phases.length
        ? 'целосно'
        : `${completedPhases.size}/${phases.length} фази`;

      let gapContext = '';
      const gradeNum = Number(grade);
      if (!isNaN(gradeNum) && gradeNum <= 9) {
        const { detectCurriculumGaps } = await import('../utils/curriculumGapDetector');
        const topicTitles = [plan?.theme, plan?.title, plan?.topicId].filter(Boolean) as string[];
        if (topicTitles.length > 0) {
          const gaps = detectCurriculumGaps(topicTitles, gradeNum);
          if (gaps.uncovered.length > 0) {
            const topGaps = gaps.uncovered.slice(0, 3).map(s => s.description).join('; ');
            gapContext = `\nНепокриени БРО стандарди (топ 3): ${topGaps}.`;
          }
        }
      }

      const prompt = `Наставникот го заврши часот по "${topic}" (${grade}. одделение). Реализирано: ${completion}.${gapContext}
Дај точно 3 краткорочни препораки за следниот час (до 150 збора, на македонски). Форматирај со: "1. … 2. … 3. …". Препораките треба да покриваат: (а) што да се повтори или задлабочи врз основа на непокриените стандарди, (б) каква брза проверка (Exit ticket / Dugga тест / Kahoot), (в) еден нов педагошки пристап или активност.`;

      let text = '';
      for await (const chunk of geminiService.getChatResponseStream([{ role: 'user', text: prompt }])) {
        text += chunk;
        if (isMounted.current) setAiSuggestion(text);
      }
    } catch {
      if (isMounted.current) setAiSuggestion('Не можев да генерирам препораки. Обиди се повторно.');
    } finally {
      if (isMounted.current) setLoadingAI(false);
    }
  }, [plan, teacherUid, completedPhases, phases]);

  return {
    phases, activePhaseIdx, timerRunning, secondsLeft,
    completedPhases, classStarted, classEnded,
    isSavingExecution, aiSuggestion, loadingAI, progressPct,
    handleStart, handlePauseResume, handleNextPhase,
    handleActivatePhase, handleEndClass,
  };
}
