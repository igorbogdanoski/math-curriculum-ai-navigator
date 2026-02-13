import './InteractiveQuizPlayer.css';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, CheckCircle, XCircle, RefreshCw, ArrowRight, Timer, Flame, Trophy, X } from 'lucide-react';
import { MathRenderer } from '../common/MathRenderer';
import { type AssessmentQuestion, QuestionType, type AIGeneratedAssessment, type AIGeneratedPracticeMaterial } from '../../types';

export interface Question {
  id?: number;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  type?: QuestionType | string;
}

interface Props {
  title?: string;
  questions?: Question[];
  quiz?: AIGeneratedAssessment | AIGeneratedPracticeMaterial | any;
  onComplete?: (score: number) => void;
  onClose?: () => void;
}

const SECONDS_PER_QUESTION = 20;

export const InteractiveQuizPlayer: React.FC<Props> = ({ title, questions: propQuestions, quiz, onComplete, onClose }) => {
  // Normalize data from props
  const normalizedQuestions = useMemo(() => {
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
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentQ = normalizedQuestions[currentIndex];

  // Timer Logic
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
    const correct = option.trim() === currentQ.answer.trim();
    
    setSelectedOption(option);
    setIsCorrect(correct);

    if (correct) {
      const timeBonus = timeLeft * 10;
      const streakBonus = streak * 50;
      const totalPoints = 100 + timeBonus + streakBonus;
      
      setScore(prev => prev + totalPoints);
      setPointsEarned(totalPoints);
      setStreak(prev => prev + 1);
      triggerConfetti(streak + 1);
    } else {
      setStreak(0);
      setPointsEarned(0);
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
      setIsCorrect(null);
      setTimeLeft(SECONDS_PER_QUESTION);
      setIsTimerRunning(true);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    setShowResult(true);
    if (onComplete) onComplete(score);
    confetti({ particleCount: 200, spread: 100 });
  };

  const resetQuiz = () => {
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setShowResult(false);
    setSelectedOption(null);
    setIsCorrect(null);
    setTimeLeft(SECONDS_PER_QUESTION);
    setIsTimerRunning(true);
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
          </div>

          <div className="flex flex-col gap-3">
            <button 
              onClick={resetQuiz}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-lg transition-all shadow-lg hover:shadow-blue-200 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <RefreshCw className="w-5 h-5" />
              Играј повторно
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
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden max-w-2xl w-full relative">
        
        {/* HEADER */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Прашање {currentIndex + 1}/{normalizedQuestions.length}</span>
            <h2 className="text-sm font-bold text-gray-700 line-clamp-1">{quizTitle}</h2>
          </div>
          
          <div className="flex items-center gap-4">
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
              currentQ.options.map((option, idx) => {
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
                    className={`w-full text-left p-5 rounded-2xl border-2 font-bold transition-all duration-200 flex items-center justify-between group ${btnClass}`}
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
                <input 
                  type="text"
                  placeholder="Внесете одговор..."
                  className="w-full p-5 bg-gray-50 border-2 border-gray-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-lg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAnswer(e.currentTarget.value);
                  }}
                  disabled={selectedOption !== null}
                />
                {!selectedOption && (
                  <p className="text-xs text-gray-400 italic">Притиснете Enter за да го испратите одговорот.</p>
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
                  </div>
                )}
              </div>
              
              <button 
                onClick={nextQuestion}
                className="w-full py-5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xl transition-all shadow-xl hover:shadow-slate-200 flex items-center justify-center gap-3 active:scale-[0.98]"
              >
                {currentIndex + 1 === normalizedQuestions.length ? 'ЗАВРШИ' : 'СЛЕДНО ПРАШАЊЕ'}
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
