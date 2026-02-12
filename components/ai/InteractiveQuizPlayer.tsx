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
