import './InteractiveQuizPlayer.css';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, CheckCircle, XCircle, RefreshCw, ArrowRight, Timer, Flame, Trophy, X, Lightbulb, Loader2, PenTool } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { MathInput } from '../common/MathInput';
import { checkMathEquivalence } from '../../utils/mathEvaluator';
import { GradeBadge } from '../common/GradeBadge';
import { MathToolsPanel } from '../common/MathToolsPanel';
import { type AssessmentQuestion, QuestionType, type AIGeneratedAssessment, type AIGeneratedPracticeMaterial } from '../../types';
import { StepByStepSolver } from '../StepByStepSolver';
import { geminiService } from '../../services/geminiService';

export interface Question {
  id?: number;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  type?: QuestionType | string;
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
  quiz?: AIGeneratedAssessment | AIGeneratedPracticeMaterial | any;
  onComplete?: (result: QuizCompletionResult) => void;
  onClose?: () => void;
}

const SECONDS_PER_QUESTION = 20;

export const InteractiveQuizPlayer: React.FC<Props> = ({ title, questions: propQuestions, quiz, onComplete, onClose }) => {
  // State for Step 1.3: Dynamic parallel generation
  const [dynamicQuestions, setDynamicQuestions] = useState<any[] | null>(null);
  const [isGeneratingParallel, setIsGeneratingParallel] = useState(false);

  // Normalize data from props
  const normalizedQuestions = useMemo(() => {
    if (dynamicQuestions) return dynamicQuestions;
    if (propQuestions) return propQuestions;
    if (quiz) {
      if ('questions' in quiz) return quiz.questions;
      if ('items' in quiz) {
        return quiz.items.map((item: any, idx: number) => ({
          id: idx,
          question: item.text,
          options: item.options || [], // Fallback if no options
          answer: item.answer,
          explanation: item.solution || item.explanation,
          type: item.type === 'problem' ? QuestionType.SHORT_ANSWER : QuestionType.MULTIPLE_CHOICE
        }));
      }
    }
    return [];
  }, [propQuestions, quiz]);

  const quizTitle = title || quiz?.title || 'Квиз';

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

  // Scaffolding / Hint State
  const [scaffoldData, setScaffoldData] = useState<any>(null);
  const [isGeneratingScaffold, setIsGeneratingScaffold] = useState(false);

  // Misconception tracking state
  const [misconceptions, setMisconceptions] = useState<{ question: string; studentAnswer: string; misconception: string }[]>([]);

    // Math tools state
    const [showMathTools, setShowMathTools] = useState(false);
    // Short answer state
    const [shortAnswer, setShortAnswer] = useState('');  // Timer Logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0 && !showResult) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning && !showResult) {
      handleTimeUp();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timeLeft, isTimerRunning, showResult]);

  const handleTimeUp = () => {
    setIsTimerRunning(false);
    setSelectedOption('TIME_UP');
    setIsCorrect(false);
    setStreak(0);
  };

  const handleAnswer = (option: string) => {
    if (selectedOption || showResult) return;
    
    setIsTimerRunning(false);
      // Use math equivalence checker for smart validation
      const correct = checkMathEquivalence(option, currentQ.answer);

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
        geminiService.diagnoseMisconception(currentQ.question, currentQ.answer, option)
          .then(misconception => {
             setMisconceptions(prev => [...prev, {
                question: currentQ.question,
                studentAnswer: option,
                misconception
             }]);
          })
          .catch(err => console.error("Error diagnosing misconception", err));
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

  const nextQuestion = () => {
    if (currentIndex + 1 < normalizedQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setShortAnswer('');
      setIsCorrect(null);
      setTimeLeft(SECONDS_PER_QUESTION);
      setIsTimerRunning(true);
      setScaffoldData(null);
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
  };

  const handleGenerateParallel = async () => {
    if (isGeneratingParallel) return;
    setIsGeneratingParallel(true);
    try {
      const parentQuestions = propQuestions || (quiz && ('questions' in quiz ? quiz.questions : quiz.items)) || [];
      if (!parentQuestions || parentQuestions.length === 0) return;
      const newQuestions = await geminiService.generateParallelQuestions(parentQuestions);
      if (newQuestions && newQuestions.length > 0) {
        setDynamicQuestions(newQuestions);
        resetQuiz();
      }
    } catch (err) {
      console.error("Грешка при генерирање паралелен квиз:", err);
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
      console.error("Грешка при генерирање помош:", err);
    } finally {
      setIsGeneratingScaffold(false);
    }
  };

  if (normalizedQuestions.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl shadow-lg">
        <p className="text-gray-500">Нема прашања за овој квиз.</p>
        {onClose && (
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg">Затвори</button>
        )}
      </div>
    );
  }

  // --- RESULT SCREEN ---
  if (showResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-lg w-full border border-blue-100 relative overflow-hidden">
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
            <p className="text-xs text-blue-600 font-black uppercase tracking-widest mb-1">Вкупно Поени</p>
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

          <div className="flex flex-col gap-3">
            <button
              onClick={resetQuiz}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" />
              Играј повторно
            </button>
            <button
              onClick={handleGenerateParallel}
              disabled={isGeneratingParallel}
              className="w-full py-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-200 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              <Sparkles className={`w-5 h-5 ${isGeneratingParallel ? 'animate-spin' : ''}`} />
              {isGeneratingParallel ? 'Генерирање...' : 'Вежбај со нови бројки (Mastery)'}
            </button>
            {onClose && (
              <button
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
  const progress = ((currentIndex + 1) / normalizedQuestions.length) * 100;
  const timePercentage = (timeLeft / SECONDS_PER_QUESTION) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className={`bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden w-full relative flex flex-col md:flex-row transition-[max-width,min-width] duration-300 ease-in-out ${showMathTools ? 'max-w-[70rem]' : 'max-w-xl'}`}>
        
        {/* Main Quiz Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* HEADER */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Прашање {currentIndex + 1}/{normalizedQuestions.length}</span>
              <h2 className="text-sm font-bold text-gray-700 line-clamp-1">{quizTitle}</h2>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setshowMathTools(!showMathTools)}
                title="Табла за пресметки"
                className={`p-1.5 rounded-lg transition-colors border-2 ${showMathTools ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-transparent hover:bg-gray-200 text-gray-500'}`}
              >
                <PenTool className="w-5 h-5" />
              </button>

              {streak > 1 && (
                <div className="flex items-center gap-1 text-orange-500 font-black animate-pulse">
                  <Flame className="w-5 h-5 fill-orange-500" />
                  <span>{streak}x</span>
              </div>
            )}
            
            <div className="bg-blue-600 text-white px-3 py-1 rounded-full font-mono font-black text-xs shadow-md">
              {score} pts
            </div>

            {onClose && (
              <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                <X className="w-5 h-5" />
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

        <div className="p-6 md:p-10">
          {/* Question */}
          <div className="text-xl md:text-2xl font-black text-gray-800 mb-10 leading-snug">
            <MathRenderer text={currentQ.question} />
          </div>

          {/* Options */}
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
                      placeholder="Внеси го твојот одговор овде..."
                      className="flex-1"
                    />
                    <button
                      onClick={() => handleAnswer(shortAnswer)}
                      disabled={selectedOption !== null || !shortAnswer.trim()}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors whitespace-nowrap"
                    >
                      Потврди
                    </button>
                  </div>
                  {!selectedOption && (
                    <p className="text-xs text-gray-400 italic">Користи ја виртуелната тастатура за дропки, корени и формули.</p>
                  )}
                </div>
            )}
          </div>

          {/* FEEDBACK SECTION */}
          {selectedOption && (
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
                  {isCorrect ? '🎉 ТОЧНО!' : selectedOption === 'TIME_UP' ? '⏰ ВРЕМЕТО ИСТЕЧЕ!' : '🤔 НЕТОЧНО.'}
                </p>
                {(!isCorrect || currentQ.explanation) && (
                  <div className="text-sm mt-3 pt-3 border-t border-black/5 font-medium leading-relaxed">
                    {!isCorrect && <p className="mb-2">Точниот одговор е: <strong className="underline decoration-red-200 decoration-2 underline-offset-4">{currentQ.answer}</strong></p>}
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
                            className="bg-white text-indigo-600 hover:bg-indigo-50 border whitespace-nowrap border-indigo-200 px-4 py-2 font-bold rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50"
                          >
                            {isGeneratingScaffold ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
                            {isGeneratingScaffold ? 'AI анализира...' : 'Објасни чекор по чекор'}
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
                    НАЗАД
                  </button>
                )}
                <button
                  onClick={nextQuestion}
                  className={`${currentIndex > 0 ? 'w-2/3' : 'w-full'} py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xl transition-all shadow-xl hover:shadow-slate-200 flex items-center justify-center gap-3 active:scale-[0.98]`}
                >
                  {currentIndex + 1 === normalizedQuestions.length ? 'ЗАВРШИ' : 'СЛЕДНО'}
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}
        </div>
        </div>

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


