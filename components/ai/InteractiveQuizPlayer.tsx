import { logger } from '../../utils/logger';
import './InteractiveQuizPlayer.css';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { ChartPreview } from '../dataviz/ChartPreview';
import type { ChartType, ChartConfig } from '../dataviz/ChartPreview';
import { Sparkles, CheckCircle, XCircle, RefreshCw, ArrowRight, Flame, Trophy, X, Lightbulb, Loader2, PenTool, Calculator, Eye } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { MathInput } from '../common/MathInput';
import { GeometryDiagramRenderer } from '../common/GeometryDiagramRenderer';
import { StatisticsWorkspace } from '../data/StatisticsWorkspace';
import { checkMathEquivalence } from '../../utils/mathEvaluator';
import { GradeBadge } from '../common/GradeBadge';
import { MathToolsPanel } from '../common/MathToolsPanel';
import { MathScratchpad } from '../common/MathScratchpad';
import { ReadingModeBar, defaultReadingMode, type ReadingModeState } from '../common/ReadingModeBar';
import { ReadingModeQuestion, getChunkCount } from '../common/ReadingModeQuestion';
import { QuestionType, type AIGeneratedAssessment, type AIGeneratedPracticeMaterial, type AssessmentQuestion } from '../../types';
import { StepByStepSolver } from '../StepByStepSolver';
import { geminiService } from '../../services/geminiService';

export interface Question {
  id?: number;
  question: string;
  options?: string[];
  answer: string;
  imageUrl?: string;
  /** Inline SVG diagram for geometry questions */
  svgDiagram?: string;
  /** Structured data table for statistics questions */
  tableData?: import('../../types').QuestionTableData;
  explanation?: string;
  type?: QuestionType | string;
  isWorkedExample?: boolean;
  workedExampleType?: 'full' | 'partial';
  cognitiveLevel?: string;
  /** Embedded DataViz chart for statistics/data questions */
  chartData?: { headers: string[]; rows: (string | number)[][] };
  chartConfig?: { type?: string; title?: string; xLabel?: string; yLabel?: string; unit?: string; colorPalette?: string[]; bins?: number };
}

export interface QuizCompletionResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  misconceptions?: { question: string; studentAnswer: string; misconception: string }[];
}

interface Props {
  title?: string;
  questions?: Question[];
  quiz?: AIGeneratedAssessment | AIGeneratedPracticeMaterial;
  onComplete?: (result: QuizCompletionResult) => void;
  onClose?: () => void;
}

const SECONDS_PER_QUESTION = 20;

export const InteractiveQuizPlayer: React.FC<Props> = ({ title, questions: propQuestions, quiz, onComplete, onClose }) => {
  // State for Step 1.3: Dynamic parallel generation
  const [dynamicQuestions, setDynamicQuestions] = useState<Question[] | null>(null);
  const [isGeneratingParallel, setIsGeneratingParallel] = useState(false);

  // Normalize all input shapes to the local Question interface
  const normalizedQuestions = useMemo((): Question[] => {
    if (dynamicQuestions) return dynamicQuestions;
    if (propQuestions) return propQuestions;
    if (quiz) {
      if ('questions' in quiz) return quiz.questions as unknown as Question[];
      if ('items' in quiz) {
        return quiz.items.map((item, idx) => ({
          id: idx,
          question: item.text,
          options: (item as { options?: string[] }).options ?? [],
          answer: item.answer ?? '',
          imageUrl: (item as { imageUrl?: string }).imageUrl,
          explanation: (item as { solution?: string; explanation?: string }).solution
            || (item as { explanation?: string }).explanation,
          type: item.type === 'problem' ? QuestionType.SHORT_ANSWER : QuestionType.MULTIPLE_CHOICE,
          cognitiveLevel: (item as { cognitiveLevel?: string }).cognitiveLevel,
          isWorkedExample: (item as { isWorkedExample?: boolean }).isWorkedExample,
          workedExampleType: (item as { workedExampleType?: 'full' | 'partial' }).workedExampleType,
          chartData: (item as { chartData?: Question['chartData'] }).chartData,
          chartConfig: (item as { chartConfig?: Question['chartConfig'] }).chartConfig,
        }));
      }
    }
    return [];
  }, [propQuestions, quiz]);

  const quizTitle = title || quiz?.title || 'Квиз';

  // Guard against state updates after unmount (async misconception diagnosis)
  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Scaffolding / Hint State (post-answer full step-by-step)
  const [scaffoldData, setScaffoldData] = useState<any>(null);
  const [isGeneratingScaffold, setIsGeneratingScaffold] = useState(false);

  // Socratic pre-answer hints (level 1 → 2 → 3, never reveals answer)
  const [socraticHint, setSocraticHint] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [isLoadingHint, setIsLoadingHint] = useState(false);

  // Misconception tracking state
  const [misconceptions, setMisconceptions] = useState<{ question: string; studentAnswer: string; misconception: string }[]>([]);

  // S27-A2: Personalized result feedback
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);

    // Math tools state
    const [showMathTools, setShowMathTools] = useState(false);
    // Short answer state
  const [shortAnswer, setShortAnswer] = useState('');
  // Scratchpad state
  const [showScratchpad, setShowScratchpad] = useState(false);
  // Reading mode state
  const [readingMode, setReadingMode] = useState<ReadingModeState>(defaultReadingMode);
  const patchReadingMode = (patch: Partial<ReadingModeState>) =>
    setReadingMode(prev => ({ ...prev, ...patch }));
  
  // Timer Logic
  useEffect(() => {
    const isWorkedExample = normalizedQuestions[currentIndex]?.isWorkedExample;
    if (isTimerRunning && timeLeft > 0 && !showResult && !isWorkedExample) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning && !showResult && !isWorkedExample) {
      handleTimeUp();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isTimerRunning, showResult, currentIndex, normalizedQuestions]);

  // Reset sequential step when question changes
  useEffect(() => {
    setReadingMode(prev => ({ ...prev, sequentialStep: 0 }));
  }, [currentIndex]);

  // Load OpenDyslexic font on demand
  useEffect(() => {
    if (!readingMode.dyslexicFont) return;
    const id = 'opendyslexic-font';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `@font-face { font-family: 'OpenDyslexic'; src: url('https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-regular.woff2') format('woff2'); }`;
    document.head.appendChild(style);
  }, [readingMode.dyslexicFont]);

  const currentQ = normalizedQuestions[currentIndex];

  const handleTimeUp = () => {
    setIsTimerRunning(false);
    setSelectedOption('TIME_UP');
    setIsCorrect(false);
    setStreak(0);
  };

  const handleAnswer = (option: string) => {
    if (selectedOption || showResult || !currentQ) return;

    setIsTimerRunning(false);
    setSelectedOption(option);

    // Use math equivalence checker for smart validation
    const correct = checkMathEquivalence(option, currentQ.answer ?? '');

    setIsCorrect(correct);

    if (correct) {
      const timeBonus = timeLeft * 10;
      const streakBonus = streak * 50;
      const totalPoints = 100 + timeBonus + streakBonus;

      setScore(prev => prev + totalPoints);
      setCorrectCount(prev => prev + 1);
      setPointsEarned(totalPoints);
      setStreak(prev => prev + 1);
      triggerConfetti(streak + 1);
    } else {
      setStreak(0);
      setPointsEarned(0);
      
      // Diagnose misconception asynchronously
      if (option !== 'TIME_UP') {
        geminiService.diagnoseMisconception(currentQ.question, currentQ.answer ?? '', option, title)
          .then(misconception => {
            if (!isMounted.current) return;
            setMisconceptions(prev => [...prev, {
              question: currentQ.question,
              studentAnswer: option,
              misconception
            }]);
          })
          .catch(err => logger.error("Error diagnosing misconception", err));
      }
    }
  };

  const triggerConfetti = (intensity: number) => {
    const count = intensity > 2 ? 100 : 30;
    confetti({
      particleCount: count,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#10B981', '#F59E0B']
    });
  };

  const handleRequestSocraticHint = async () => {
    if (isLoadingHint || !currentQ) return;
    const nextLevel = Math.min(3, hintLevel + 1) as 1 | 2 | 3;
    setIsLoadingHint(true);
    try {
      const hint = await geminiService.generateSocraticHint(currentQ.question, nextLevel);
      setSocraticHint(hint);
      setHintLevel(nextLevel);
    } catch {
      // non-fatal — hint is best-effort
    } finally {
      setIsLoadingHint(false);
    }
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < normalizedQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShortAnswer('');
      setIsCorrect(null);
      setTimeLeft(SECONDS_PER_QUESTION);
      setIsTimerRunning(true);
      setScaffoldData(null);
      setSocraticHint(null);
      setHintLevel(0);
    } else {
      finishQuiz();
    }
  };

  const prevQuestion = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setSelectedOption(null);
      setIsCorrect(null);
      setTimeLeft(SECONDS_PER_QUESTION);
      setIsTimerRunning(true);
      setScaffoldData(null);
      setSocraticHint(null);
      setHintLevel(0);
    }
  };

  const finishQuiz = () => {
    setShowResult(true);
    if (onComplete) onComplete({
      score,
      correctCount,
      totalQuestions: normalizedQuestions.length,
      misconceptions: misconceptions.length > 0 ? misconceptions : undefined
    });
    confetti({ particleCount: 200, spread: 100 });

    // S27-A2: Generate personalized AI feedback asynchronously
    const pct = normalizedQuestions.length > 0
      ? Math.round((correctCount / normalizedQuestions.length) * 100)
      : 0;
    setIsFeedbackLoading(true);
    setAiFeedback(null);
    geminiService.generateQuizFeedback('Ученик', pct, quizTitle, correctCount, normalizedQuestions.length, misconceptions.length > 0 ? misconceptions : undefined)
      .then(fb => { if (isMounted.current) setAiFeedback(fb); })
      .catch(() => { if (isMounted.current) setAiFeedback(null); })
      .finally(() => { if (isMounted.current) setIsFeedbackLoading(false); });
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setShowResult(false);
    setSelectedOption(null);
    setIsCorrect(null);
    setTimeLeft(SECONDS_PER_QUESTION);
    setIsTimerRunning(true);
    setScaffoldData(null);
    setSocraticHint(null);
    setHintLevel(0);
    setAiFeedback(null);
    setIsFeedbackLoading(false);
  };

  const handleGenerateParallel = async () => {
    if (isGeneratingParallel) return;
    setIsGeneratingParallel(true);
    try {
      const parentQuestions = propQuestions || (quiz && ('questions' in quiz ? quiz.questions : quiz.items)) || [];
      if (!parentQuestions || parentQuestions.length === 0) return;
      const newQuestions = await geminiService.generateParallelQuestions(parentQuestions as AssessmentQuestion[]);
      if (newQuestions && newQuestions.length > 0) {
        setDynamicQuestions(newQuestions as unknown as Question[]);
        resetQuiz();
      }
    } catch (err) {
      logger.error("Грешка при генерирање паралелни прашања:", err);
    } finally {
      setIsGeneratingParallel(false);
    }
  };

  const handleRequestHint = async () => {
    if (isGeneratingScaffold) return;
    setIsGeneratingScaffold(true);
    try {
      const data = await geminiService.solveSpecificProblemStepByStep(currentQ.question);
      setScaffoldData(data);
    } catch (err) {
      logger.error("Грешка при генерирање хинт:", err);
    } finally {
      setIsGeneratingScaffold(false);
    }
  };

  if (normalizedQuestions.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-lg">
        <p className="text-gray-500">Ова прашање не може да се вчита.</p>
        {onClose && (
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg">Затвори</button>
        )}
      </div>
    );
  }

  // --- RESULT SCREEN ---
  if (showResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 text-center max-w-lg w-full border border-blue-100 relative overflow-hidden my-auto">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          
          <div className="mb-6 flex justify-center">
            <div className="bg-yellow-100 p-6 rounded-full relative">
              <Trophy className="w-16 h-16 text-yellow-600" />
              <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-500 animate-pulse" />
            </div>
          </div>

          <h2 className="text-3xl font-black text-gray-800 mb-2">Квизот е завршен!</h2>
          <p className="text-gray-500 mb-6 font-medium">{quizTitle}</p>
          
          <div className="bg-blue-50 rounded-2xl p-6 mb-8 border border-blue-100">
            <p className="text-xs text-blue-600 font-black uppercase tracking-widest mb-1">Вкупно поени</p>
            <div className="text-6xl font-black text-blue-900">{score.toLocaleString()}</div>
            <p className="text-sm text-blue-500 font-bold mt-2">
              {correctCount} / {normalizedQuestions.length} точни одговори
              ({Math.round((correctCount / normalizedQuestions.length) * 100)}%)
            </p>
            <div className="mt-3">
              <GradeBadge
                pct={Math.round((correctCount / normalizedQuestions.length) * 100)}
                showLabel={true}
                className="text-sm px-3 py-1"
              />
            </div>
          </div>

          {/* S27-A2: Personalized AI Feedback */}
          {(isFeedbackLoading || aiFeedback) && (
            <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-left">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                <p className="text-xs font-black text-indigo-600 uppercase tracking-wide">Персонализирана повратна информација</p>
              </div>
              {isFeedbackLoading ? (
                <div className="flex items-center gap-2 text-sm text-indigo-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Анализирам ги твоите одговори...</span>
                </div>
              ) : (
                <p className="text-sm text-indigo-900 leading-relaxed">{aiFeedback}</p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={resetQuiz}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" />
              Обиди се повторно
            </button>
            <button
              type="button"
              onClick={handleGenerateParallel}
              disabled={isGeneratingParallel}
              className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              <Sparkles className={`w-5 h-5 ${isGeneratingParallel ? 'animate-spin' : ''}`} />
              {isGeneratingParallel ? 'Генерирам...' : 'Помини на ново ниво (Mastery)'}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
              >
                Затвори
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- QUIZ SCREEN ---
  const timePercentage = (timeLeft / SECONDS_PER_QUESTION) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center md:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className={`bg-white md:rounded-3xl shadow-2xl md:border border-gray-200 overflow-y-auto overflow-x-hidden w-full relative flex flex-col md:flex-row transition-[max-width,min-width] duration-300 ease-in-out min-h-screen md:min-h-[auto] md:max-h-[90vh] my-auto ${(showMathTools || showScratchpad) ? 'max-w-[80rem]' : 'max-w-2xl'}`}>
        {/* Main Quiz Area */}
        <div className="flex-1 flex flex-col min-w-0 pb-10 md:pb-0">
          {/* HEADER */}
          <div className="bg-gray-50 px-4 md:px-6 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2 sticky top-0 z-10">
            <div className="flex flex-col flex-1 min-w-[120px] gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Прашање {currentIndex + 1}/{normalizedQuestions.length}</span>
                {currentQ?.cognitiveLevel && (
                  <span className={`text-[9px] uppercase font-black px-1.5 py-0.5 rounded-sm ${currentQ.cognitiveLevel === 'Remembering' ? 'bg-slate-100 text-slate-600' : currentQ.cognitiveLevel === 'Understanding' ? 'bg-green-100 text-green-700' : currentQ.cognitiveLevel === 'Applying' ? 'bg-blue-100 text-blue-700' : currentQ.cognitiveLevel === 'Analyzing' ? 'bg-purple-100 text-purple-700' : currentQ.cognitiveLevel === 'Evaluating' ? 'bg-pink-100 text-pink-700' : currentQ.cognitiveLevel === 'Creating' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {currentQ.cognitiveLevel}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-bold text-gray-700 line-clamp-1">{quizTitle}</h2>
            </div>

            <div className="flex items-center gap-1.5 md:gap-4 flex-wrap justify-end">
              <button
                    onClick={() => { setShowScratchpad(!showScratchpad); setShowMathTools(false); }}
                  title="Работна табла (Scratchpad)"
                  className={`p-2.5 md:p-1.5 rounded-lg transition-colors border-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center ${showScratchpad ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-transparent hover:bg-gray-200 text-gray-500'}`}                >
                    <PenTool className="w-5 h-5" />              </button>
              <button
                onClick={() => { setShowMathTools(!showMathTools); setShowScratchpad(false); }}
                title="Математички Алатки (GeoGebra / Desmos)"
                className={`p-2.5 md:p-1.5 rounded-lg transition-colors border-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center ${showMathTools ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-transparent hover:bg-gray-200 text-gray-500'}`}
              >
                <Calculator className="w-5 h-5" />
              </button>
              <button
                onClick={() => patchReadingMode({ active: !readingMode.active })}
                title="Фокус за читање (сокриј сè друго)"
                className={`p-2.5 md:p-1.5 rounded-lg transition-colors border-2 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center ${readingMode.active ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-transparent hover:bg-gray-200 text-gray-500'}`}
              >
                <Eye className="w-5 h-5" />
              </button>

              {streak > 1 && (
                <div className="flex items-center gap-1 text-orange-500 font-black animate-pulse px-2">
                  <Flame className="w-5 h-5 fill-orange-500" />
                  <span className="hidden sm:inline">{streak}x</span>
              </div>
            )}
            
            <div className="bg-blue-600 text-white px-2.5 py-1.5 md:px-3 md:py-1 rounded-full font-mono font-black text-xs shadow-md">
              {score} pts
            </div>

            {onClose && (
              <button onClick={onClose} className="p-2.5 md:p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-400 min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 flex items-center justify-center">
                <X className="w-6 h-6 md:w-5 md:h-5" />
              </button>
            )}
          </div>
        </div>

        {/* TIMER BAR */}
        <div className="w-full bg-gray-200 h-2">
          <div
            className={`h-full transition-all duration-1000 linear ${timeLeft < 5 ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}
            style={{ width: `${timePercentage}%` }}
          ></div>
        </div>

        {/* READING MODE BAR */}
        {readingMode.active && (
          <ReadingModeBar
            mode={readingMode}
            onChange={patchReadingMode}
            totalChunks={getChunkCount(currentQ.question)}
          />
        )}

        <div className="p-6 md:p-10">
          {/* Question and Illustration */}
          <div className="flex flex-col md:flex-row gap-8 mb-10">
            <div className="flex-1">
              <ReadingModeQuestion text={currentQ.question} mode={readingMode} />
            </div>
            {currentQ.imageUrl && (
              <div className="w-full md:w-64 flex-shrink-0 animate-in fade-in zoom-in duration-500">
                <div className="rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white rotate-1 hover:rotate-0 transition-transform">
                  <img src={currentQ.imageUrl} alt="Илустрација на задачата" className="w-full h-auto" />
                  <div className="p-2 bg-gray-50 text-[10px] text-gray-400 text-center font-bold uppercase tracking-wider">
                    AI Контекст
                  </div>
                </div>
              </div>
            )}
            {currentQ.svgDiagram && (
              <div className="w-full md:w-72 flex-shrink-0 animate-in fade-in duration-300">
                <GeometryDiagramRenderer svg={currentQ.svgDiagram} caption="Геометриски дијаграм" />
              </div>
            )}
          </div>

          {/* Statistics data table */}
          {currentQ.tableData && (
            <div className="mb-6">
              <StatisticsWorkspace
                initialData={currentQ.tableData}
                readOnly
                compact
                title={currentQ.tableData.caption}
              />
            </div>
          )}

          {/* Embedded DataViz chart */}
          {currentQ.chartData && (
            <div className="mb-6 rounded-2xl border-2 border-teal-200 bg-teal-50/40 p-3 shadow-sm">
              <ChartPreview
                data={currentQ.chartData}
                config={{
                  type: (currentQ.chartConfig?.type as ChartType) ?? 'bar',
                  title: currentQ.chartConfig?.title,
                  xLabel: currentQ.chartConfig?.xLabel,
                  yLabel: currentQ.chartConfig?.yLabel,
                  unit: currentQ.chartConfig?.unit,
                  colorPalette: currentQ.chartConfig?.colorPalette,
                  bins: currentQ.chartConfig?.bins,
                } as ChartConfig}
              />
            </div>
          )}

          {/* ── Socratic Hint Panel (pre-answer) ─────────────────────────── */}
          {!selectedOption && !currentQ?.isWorkedExample && (
            <div className="mb-5">
              {socraticHint ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-start gap-2.5 mb-3">
                    <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-black text-amber-700 uppercase tracking-wide">
                      Насока {hintLevel}/3
                    </p>
                  </div>
                  <p className="text-sm text-amber-900 leading-relaxed">{socraticHint}</p>
                  {hintLevel < 3 && (
                    <button
                      type="button"
                      onClick={handleRequestSocraticHint}
                      disabled={isLoadingHint}
                      className="mt-3 text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      {isLoadingHint
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Генерирам...</>
                        : <><Lightbulb className="w-3.5 h-3.5" /> Уште насока →</>}
                    </button>
                  )}
                  {hintLevel === 3 && (
                    <p className="mt-2 text-xs text-amber-600 italic">Ова е последната насока — пробај сега!</p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestSocraticHint}
                  disabled={isLoadingHint}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50 py-1"
                >
                  {isLoadingHint
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Генерирам насока...</>
                    : <><Lightbulb className="w-3.5 h-3.5" /> Дај ми насока</>}
                </button>
              )}
            </div>
          )}

          {/* Options */}
          {currentQ?.isWorkedExample ? (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-2xl mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6 text-blue-500" />
                <h3 className="text-lg font-bold text-blue-900">Решен пример</h3>
              </div>
              <div className="prose prose-sm max-w-none text-blue-800 break-words overflow-hidden max-w-full">
                <MathRenderer text={currentQ.explanation || currentQ.answer || ''} />
              </div>
              <button
                onClick={nextQuestion}
                className="mt-6 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
              >
                <span>Разбрав, оди понатаму</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          ) : (
          <div className="grid gap-3">
            {currentQ.options && currentQ.options.length > 0 ? (
              currentQ.options.map((option: string, idx: number) => {
                const isSelected = selectedOption === option;
                const isAnswerCorrect = option.trim() === currentQ.answer.trim();
                const showCorrectness = selectedOption !== null;
                
                let btnClass = "border-gray-200 hover:border-blue-400 hover:bg-blue-50/50"; 
                
                if (showCorrectness) {
                  if (isAnswerCorrect) {
                    btnClass = "bg-green-100 border-green-500 text-green-800 ring-2 ring-green-500/20";
                  } else if (isSelected && !isAnswerCorrect) {
                    btnClass = "bg-red-100 border-red-500 text-red-800 ring-2 ring-red-500/20";
                  } else {
                    btnClass = "opacity-40 border-gray-100 grayscale-[0.5]"; 
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={selectedOption !== null}
                    onClick={() => handleAnswer(option)}
                    className={`w-full text-left p-4 rounded-xl border-2 font-bold transition-all duration-200 flex items-center justify-between group text-sm md:text-base ${btnClass}`}
                  >
                    <span><MathRenderer text={option} /></span>
                    {showCorrectness && isAnswerCorrect && <CheckCircle className="w-6 h-6 text-green-600" />}
                    {showCorrectness && isSelected && !isAnswerCorrect && <XCircle className="w-6 h-6 text-red-600" />}
                    {!showCorrectness && <div className="w-5 h-5 rounded-full border-2 border-gray-300 group-hover:border-blue-400 transition-colors"></div>}
                  </button>
                );
              })
            ) : (
              // Short Answer Fallback
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-stretch">
                    <MathInput
                      value={shortAnswer}
                      onChange={setShortAnswer}
                      placeholder="Внесете го вашиот одговор..."
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleAnswer(shortAnswer)}
                      disabled={selectedOption !== null || !shortAnswer.trim()}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors whitespace-nowrap"
                    >
                      Провери
                    </button>
                  </div>
                  {!selectedOption && (
                    <p className="text-xs text-gray-400 italic">Користете ги математичките алатки за помош при решавањето.</p>
                  )}
                </div>
            )}
          </div>
          )}

          {/* FEEDBACK SECTION */}
          {selectedOption && !currentQ?.isWorkedExample && (
            <div className="mt-10 pt-8 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isCorrect && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
                  <div className="text-6xl font-black text-yellow-500 animate-bounce drop-shadow-2xl">
                    +{pointsEarned}
                  </div>
                </div>
              )}

              <div className={`p-5 rounded-2xl mb-6 ${isCorrect ? 'bg-green-50 text-green-800 border border-green-100' : 'bg-red-50 text-red-800 border border-red-100'}`}>
                <p className="font-black flex items-center gap-2 text-lg">
                  {isCorrect ? 'Точно!' : selectedOption === 'TIME_UP' ? 'Времето истече!' : 'Неточно.'}
                </p>
                {(!isCorrect || currentQ.explanation) && (
                  <div className="text-sm mt-3 pt-3 border-t border-black/5 font-medium leading-relaxed">
                    {!isCorrect && <p className="mb-2">Точен одговор: <strong className="underline decoration-red-200 decoration-2 underline-offset-4">{currentQ.answer}</strong></p>}
                    {currentQ.explanation && (
                      <div className="flex gap-2 bg-white/50 p-3 rounded-xl mt-2">
                        <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="italic text-gray-600">{currentQ.explanation}</p>
                      </div>
                    )}
                    
                    {!isCorrect && (
                      <div className="mt-4 pt-3 border-t border-red-200/50">
                        {!scaffoldData ? (
                          <button
                            onClick={handleRequestHint}
                            disabled={isGeneratingScaffold}
                            className="bg-white text-indigo-600 hover:bg-indigo-50 border whitespace-nowrap border-indigo-200 px-4 py-3 md:py-2 min-h-[44px] md:min-h-0 font-bold rounded-lg text-sm flex items-center justify-center w-full sm:w-auto gap-2 transition disabled:opacity-50"
                          >
                            {isGeneratingScaffold ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                            {isGeneratingScaffold ? 'AI Објаснување...' : 'Помогни ми да решам'}
                          </button>
                        ) : (
                          <div className="mt-2 text-left">
                            <StepByStepSolver 
                              problem={scaffoldData.problem}
                              strategy={scaffoldData.strategy}
                              steps={scaffoldData.steps}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                {currentIndex > 0 && (
                  <button
                    onClick={prevQuestion}
                    className="w-1/3 py-5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-2xl font-black text-xl transition-all shadow-xl hover:shadow-gray-300 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    Претходно
                  </button>
                )}
                <button
                  onClick={nextQuestion}
                  className={`${currentIndex > 0 ? 'w-2/3' : 'w-full'} py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xl transition-all shadow-xl hover:shadow-slate-200 flex items-center justify-center gap-3 active:scale-[0.98]`}
                >
                  {currentIndex + 1 === normalizedQuestions.length ? 'Заврши' : 'Следно'}
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </div>
        </div>

          {/* SCRATCHPAD PANEL */}
          {showScratchpad && (
            <div className="w-full md:w-[600px] border-t md:border-t-0 md:border-l border-gray-200 bg-slate-50 flex flex-col shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 relative z-20 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] md:shadow-none p-4">
              <MathScratchpad isOpen={showScratchpad} onClose={() => setShowScratchpad(false)} />
            </div>
          )}

        {/* MATH TOOLS PANEL */}
        {showMathTools && (
          <div className="w-full md:w-[450px] border-t md:border-t-0 md:border-l border-gray-200 bg-slate-50 flex flex-col shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 relative z-20 shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)] md:shadow-none">
            <MathToolsPanel onClose={() => setShowMathTools(false)} className="h-full" />
          </div>
        )}

      </div>
    </div>
  );
};


