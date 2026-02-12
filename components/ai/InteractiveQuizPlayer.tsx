import './InteractiveQuizPlayer.css';
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, CheckCircle, XCircle, RefreshCw, ArrowRight, Timer, Flame, Trophy } from 'lucide-react';
export interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
}
interface Props {
  title: string;
  questions: Question[];
  onComplete?: (score: number) => void;
}

const SECONDS_PER_QUESTION = 20;
export const InteractiveQuizPlayer: React.FC<Props> = ({ title, questions, onComplete }) => {
  // State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0); // 🔥 Бројач за серија
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  
  const [showResult, setShowResult] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0); // За анимација "+150 pts"
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Тајмер Логика
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      handleTimeUp();
    }
    return () => clearTimeout(timerRef.current!);
  }, [timeLeft, isTimerRunning]);

  const handleTimeUp = () => {
  setIsTimerRunning(false);
  setSelectedOption('TIME_UP');
  setIsCorrect(false);
    setStreak(0);
  };

  const handleAnswer = (option: string) => {
  if (selectedOption) return; // Спречи двојно кликање
    
  setIsTimerRunning(false); // Стоп тајмер
  const currentQ = questions[currentIndex];
  const correct = option === currentQ.answer;
    
  setSelectedOption(option);
  setIsCorrect(correct);

  if (correct) {
  // 🧠 Логика за поени: База (100) + Време (10 * секунди) + Серија (50 * streak)
  const timeBonus = timeLeft * 10;
  const streakBonus = streak * 50;
  const totalPoints = 100 + timeBonus + streakBonus;
      
  setScore(prev => prev + totalPoints);
  setPointsEarned(totalPoints);
  setStreak(prev => prev + 1);

  // Ефекти
      triggerConfetti(streak + 1);
    } else {
      setStreak(0);
      setPointsEarned(0);
    }
  };
  const triggerConfetti = (intensity: number) => {
    // Ако е голема серија (3+), пушти повеќе конфети
    const count = intensity > 2 ? 100 : 30;
    confetti({
      particleCount: count,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#10B981', '#F59E0B']
    });
  };

  const nextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
  setIsCorrect(null);
  setTimeLeft(SECONDS_PER_QUESTION); // Ресет на тајмер
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
  // --- ЕКРАН ЗА РЕЗУЛТАТИ ---
  if (showResult) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-lg mx-auto border-2 border-blue-100 mt-6 animate-fade-in">
        <div className="mb-6 flex justify-center">
            <div className="bg-yellow-100 p-6 rounded-full relative">
        <Trophy className="w-16 h-16 text-yellow-600" />
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
          NEW!
        </div>
      </div>
    </div>
  <h2 className="text-3xl font-extrabold text-gray-800 mb-2">Квизот е завршен!</h2>
  <p className="text-gray-500 mb-6">{title}</p>
        
    <div className="bg-blue-50 rounded-xl p-6 mb-8">
      <p className="text-sm text-blue-600 font-bold uppercase tracking-wider mb-1">Вкупно Поени</p>
      <div className="text-5xl font-black text-blue-900">{score.toLocaleString()}</div>
  </div>

  <button 
          onClick={resetQuiz}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Играј повторно
        </button>
      </div>
    );
  }
  // --- ЕКРАН ЗА ПРАШАЊА ---
  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const timePercentage = (timeLeft / SECONDS_PER_QUESTION) * 100;

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden max-w-2xl mx-auto mt-6 relative">
      
      {/* HEADER: Score & Streak */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Прашање {currentIndex + 1}/{questions.length}</span>
  </div>
        
  <div className="flex items-center gap-4">
      {/* Streak Counter */}
      {streak > 1 && (
        <div className="flex items-center gap-1 text-orange-500 font-bold animate-pulse">
          <Flame className="w-5 h-5 fill-orange-500" />
          <span>{streak}x</span>
        </div>
            )}
            
            {/* Score */}
      <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg font-mono font-bold text-sm">
        {score} pts
      </div>
        </div>
      </div>

      {/* TIMER BAR */}
      <div className="w-full bg-gray-200 h-1.5">
        <div 
          className={`h-full transition-all duration-1000 linear ${timeLeft < 5 ? 'bg-red-500' : 'bg-blue-500'} timer-bar`}
          style={{ '--timer-width': `${timePercentage}` } as React.CSSProperties}
        ></div>
      </div>

      <div className="p-6 md:p-8">
        {/* Прашање */}
        <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-8 leading-snug">
          {currentQ.question}
        </h3>

  {/* Опции */}
  <div className="space-y-3">
          {currentQ.options.map((option, idx) => {
            const isSelected = selectedOption === option;
            const isAnswerCorrect = option === currentQ.answer;
            const showCorrectness = selectedOption !== null;
            let btnClass = "border-gray-200 hover:border-blue-300 hover:bg-blue-50"; 
            
            if (showCorrectness) {
        if (isAnswerCorrect) {
          btnClass = "bg-green-100 border-green-500 text-green-800 ring-1 ring-green-500";
        } else if (isSelected && !isAnswerCorrect) {
          btnClass = "bg-red-100 border-red-500 text-red-800 ring-1 ring-red-500";
        } else {
          btnClass = "opacity-50 border-gray-100 grayscale"; 
        }
      }

      return (
              <button
                key={idx}
                disabled={selectedOption !== null}
        onClick={() => handleAnswer(option)}
        className={`w-full text-left p-4 rounded-xl border-2 font-medium transition-all duration-200 flex items-center justify-between group ${btnClass}`}
        >
        <span>{option}</span>
                
        {/* Индикатори */}
        {showCorrectness && isAnswerCorrect && <CheckCircle className="w-5 h-5 text-green-600" />}
        {showCorrectness && isSelected && !isAnswerCorrect && <XCircle className="w-5 h-5 text-red-600" />}
        {!showCorrectness && <div className="w-4 h-4 rounded-full border-2 border-gray-300 group-hover:border-blue-400"></div>}
        </button>
      );
      })}
    </div>

    {/* FEEDBACK Секција */}
    {selectedOption && (
      <div className="mt-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-300">
                
        {/* Popup за поени */}
        {isCorrect && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="text-4xl font-black text-yellow-500 animate-bounce drop-shadow-md">
              +{pointsEarned}
            </div>
          </div>
        )}

        <div className={`p-4 rounded-lg mb-4 ${isCorrect ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          <p className="font-bold flex items-center gap-2">
            {isCorrect ? '🎉 Точно!' : selectedOption === 'TIME_UP' ? '⏰ Времето истече!' : '🤔 Неточно.'}
          </p>
          {(!isCorrect || currentQ.explanation) && (
            <div className="text-sm mt-2 pt-2 border-t border-black/10 opacity-80">
              {!isCorrect && <p className="mb-1">Точниот одговор е: <strong>{currentQ.answer}</strong></p>}
              {currentQ.explanation && <p>💡 {currentQ.explanation}</p>}
            </div>
          )}
        </div>
                
        <button 
          onClick={nextQuestion}
          className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-bold flex items-center justify-center gap-2 transition shadow-lg hover:shadow-xl"
        >
          {currentIndex + 1 === questions.length ? 'Заврши Квиз' : 'Следно Прашање'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    )}
    </div>
  </div>
  );
};
import React, { useState, useMemo } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
import type { AIGeneratedAssessment, AssessmentQuestion } from '../../types';

interface InteractiveQuizPlayerProps {
  quiz: AIGeneratedAssessment;
  onComplete?: (results: { score: number; total: number; answers: any[] }) => void;
  onClose?: () => void;
}

export const InteractiveQuizPlayer: React.FC<InteractiveQuizPlayerProps> = ({ quiz, onComplete, onClose }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  const questions = quiz.questions;
  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const progress = useMemo(() => 
    ((currentQuestionIndex + 1) / questions.length) * 100
  , [currentQuestionIndex, questions.length]);

  const handleAnswerSelect = (answer: string) => {
    if (isFeedbackVisible) return;
    setSelectedAnswers(prev => ({ ...prev, [currentQuestionIndex]: answer }));
  };

  const checkAnswer = () => {
    setIsFeedbackVisible(true);
  };

  const nextQuestion = () => {
    if (isLastQuestion) {
      calculateResults();
    } else {
      setIsFeedbackVisible(false);
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const calculateResults = () => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answer) correctCount++;
    });

    setShowResults(true);
    if (onComplete) {
      onComplete({
        score: correctCount,
        total: questions.length,
        answers: Object.entries(selectedAnswers).map(([idx, ans]) => ({
          questionIndex: parseInt(idx),
          answer: ans,
          isCorrect: ans === questions[parseInt(idx)].answer
        }))
      });
    }
  };

  if (showResults) {
    const correctCount = questions.filter((q, idx) => selectedAnswers[idx] === q.answer).length;
    const percentage = Math.round((correctCount / questions.length) * 100);

    return (
      <Card className="max-w-2xl mx-auto text-center p-8 animate-fade-in">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary/10 text-brand-primary mb-4">
            <ICONS.check className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-gray-800">Квизот е завршен!</h2>
          <p className="text-gray-500 mt-2">{quiz.title}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Точни одговори</p>
            <p className="text-3xl font-black text-brand-primary">{correctCount} / {questions.length}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-sm text-gray-500 uppercase font-bold tracking-wider">Успешност</p>
            <p className="text-3xl font-black text-brand-secondary">{percentage}%</p>
          </div>
        </div>

        <div className="space-y-3">
          <button 
            onClick={() => {
              setCurrentQuestionIndex(0);
              setSelectedAnswers({});
              setShowResults(false);
              setIsFeedbackVisible(false);
            }}
            className="w-full py-3 bg-brand-primary text-white rounded-lg font-bold shadow-lg hover:bg-brand-secondary transition-colors"
          >
            Обиди се повторно
          </button>
          {onClose && (
            <button 
              onClick={onClose}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
            >
              Затвори
            </button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Quiz Header */}
      <div className="flex items-center justify-between px-2">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Прашање {currentQuestionIndex + 1} од {questions.length}</h3>
          <h2 className="text-lg font-bold text-brand-primary line-clamp-1">{quiz.title}</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
            <ICONS.close className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-brand-accent transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      {/* Question Card */}
      <Card className="p-6 md:p-8">
        <div className="text-xl md:text-2xl font-bold text-gray-800 mb-8 leading-relaxed">
          <MathRenderer text={currentQuestion.question} />
        </div>

        {/* Multiple Choice Options */}
        <div className="space-y-3">
          {currentQuestion.options?.map((option, idx) => {
            const isSelected = selectedAnswers[currentQuestionIndex] === option;
            const isCorrect = option === currentQuestion.answer;
            const showFeedback = isFeedbackVisible;
            
            let buttonClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex justify-between items-center group ";
            
            if (showFeedback) {
              if (isCorrect) buttonClass += "border-green-500 bg-green-50 text-green-800";
              else if (isSelected) buttonClass += "border-red-500 bg-red-50 text-red-800";
              else buttonClass += "border-gray-100 opacity-50";
            } else {
              if (isSelected) buttonClass += "border-brand-primary bg-brand-primary/5 text-brand-primary shadow-md";
              else buttonClass += "border-gray-100 hover:border-brand-primary/30 hover:bg-gray-50 text-gray-700";
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(option)}
                disabled={showFeedback}
                className={buttonClass}
              >
                <span className="flex-1 font-medium"><MathRenderer text={option} /></span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-4 ${
                  isSelected ? 'border-current bg-current' : 'border-gray-200 group-hover:border-brand-primary/50'
                }`}>
                  {isSelected && !showFeedback && <div className="w-2 h-2 rounded-full bg-white"></div>}
                  {showFeedback && isCorrect && <ICONS.check className="w-4 h-4 text-white" />}
                  {showFeedback && isSelected && !isCorrect && <ICONS.close className="w-4 h-4 text-white" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Short Answer (Fallback) */}
        {!currentQuestion.options && (
          <div className="space-y-4">
            <input 
              type="text"
              value={selectedAnswers[currentQuestionIndex] || ''}
              onChange={(e) => handleAnswerSelect(e.target.value)}
              disabled={isFeedbackVisible}
              placeholder="Внесете го вашиот одговор тука..."
              className="w-full p-4 border-2 border-gray-100 rounded-xl focus:border-brand-primary outline-none text-lg"
            />
            {isFeedbackVisible && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-800">
                <p className="font-bold mb-1">Точен одговор:</p>
                <MathRenderer text={currentQuestion.answer} />
              </div>
            )}
          </div>
        )}

        {/* Solution Feedback */}
        {isFeedbackVisible && currentQuestion.solution && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 animate-fade-in">
            <p className="font-bold flex items-center gap-2 mb-2">
              <ICONS.lightbulb className="w-5 h-5" />
              Објаснување:
            </p>
            <div className="text-sm prose prose-sm max-w-none">
              <MathRenderer text={currentQuestion.solution} />
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-10 flex gap-3">
          {!isFeedbackVisible ? (
            <button
              onClick={checkAnswer}
              disabled={!selectedAnswers[currentQuestionIndex]}
              className="flex-1 py-4 bg-brand-primary text-white rounded-xl font-bold shadow-lg hover:bg-brand-secondary transition-all disabled:opacity-50 disabled:shadow-none"
            >
              Провери одговор
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="flex-1 py-4 bg-brand-secondary text-white rounded-xl font-bold shadow-lg hover:bg-brand-primary transition-all flex items-center justify-center gap-2"
            >
              {isLastQuestion ? 'Види резултати' : 'Следно прашање'}
              {!isLastQuestion && <ICONS.chevronRight className="w-5 h-5" />}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};
