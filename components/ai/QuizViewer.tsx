import React, { useState } from 'react';
import type { AssessmentQuestion } from '../../types';
import { ICONS } from '../../constants';
import { Card } from '../common/Card';
import { MathRenderer } from '../common/MathRenderer';

interface QuizViewerProps {
  questions: AssessmentQuestion[];
  onClose: () => void;
}

export const QuizViewer: React.FC<QuizViewerProps> = ({ questions, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  const currentQuestion = questions[currentIndex];

  const handleAnswer = (userAnswer: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(userAnswer);
    setIsAnswered(true);

    // Only score gradable questions
    if (currentQuestion.type !== 'ESSAY') {
        if (userAnswer.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim()) {
            setScore(s => s + 1);
        }
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsAnswered(false);
      setSelectedAnswer(null);
    } else {
      setIsFinished(true);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setIsFinished(false);
  };
  
  const renderOptions = () => {
    const { type, options, answer } = currentQuestion;
    
    const getButtonClass = (option: string) => {
      if (!isAnswered) {
        return "bg-white hover:bg-gray-100 border-gray-300";
      }
      const isCorrect = option.toLowerCase().trim() === answer.toLowerCase().trim();
      const isSelected = option.toLowerCase().trim() === selectedAnswer?.toLowerCase().trim();

      if (isCorrect) return "bg-green-500 text-white border-green-500";
      if (isSelected && !isCorrect) return "bg-red-500 text-white border-red-500";
      
      return "bg-white border-gray-300 opacity-60";
    };

    switch(type) {
        case 'MULTIPLE_CHOICE':
            return options?.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(opt)} disabled={isAnswered} className={`w-full text-left p-3 border rounded-lg transition-colors ${getButtonClass(opt)}`}>
                    <MathRenderer text={opt} />
                </button>
            ));
        case 'TRUE_FALSE':
            return ['true', 'false'].map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(opt)} disabled={isAnswered} className={`w-full p-3 border rounded-lg transition-colors ${getButtonClass(opt)}`}>
                    {opt === 'true' ? 'Точно' : 'Неточно'}
                </button>
            ));
        case 'SHORT_ANSWER':
        case 'FILL_IN_THE_BLANK':
            return (
                <form onSubmit={(e) => { e.preventDefault(); handleAnswer((e.currentTarget.elements.namedItem('shortAnswer') as HTMLInputElement).value); }}>
                    <div className="flex gap-2">
                        <input name="shortAnswer" type="text" disabled={isAnswered} className="flex-1 p-2 border rounded-md" placeholder="Внесете го одговорот..."/>
                        <button type="submit" disabled={isAnswered} className="px-4 py-2 bg-brand-primary text-white rounded-lg disabled:bg-gray-400">Провери</button>
                    </div>
                    {isAnswered && (
                        <div className={`mt-2 p-2 rounded-md text-sm ${selectedAnswer?.toLowerCase().trim() === answer.toLowerCase().trim() ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                           {selectedAnswer?.toLowerCase().trim() === answer.toLowerCase().trim() ? 'Точно!' : `Неточно.`} Точниот одговор е: <MathRenderer text={answer} />
                        </div>
                    )}
                </form>
            );
        case 'ESSAY':
             return (
                <div>
                    <textarea
                        name="essayAnswer"
                        rows={4}
                        disabled={isAnswered}
                        className="w-full p-2 border rounded-md"
                        placeholder="Напишете го вашиот одговор овде..."
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                    />
                    {!isAnswered && (
                        <button
                            onClick={() => handleAnswer(selectedAnswer || '')}
                            className="mt-2 px-4 py-2 bg-brand-primary text-white rounded-lg"
                        >
                            Види предлог одговор
                        </button>
                    )}
                    {isAnswered && (
                        <div className="mt-2 p-3 bg-gray-100 border rounded-md">
                            <p className="text-sm font-semibold text-gray-700">Предлог одговор:</p>
                            <MathRenderer text={answer} />
                        </div>
                    )}
                </div>
            );
        default:
            return <p className="text-sm text-gray-500 italic">Овој тип на прашање не е поддржан во интерактивниот квиз.</p>;
    }
  }
  
  const progressPercentage = (currentIndex / questions.length) * 100;

  if (isFinished) {
    const percentage = questions.length > 0 ? (score / questions.length) * 100 : 0;
    let feedbackMessage = '';
    let Icon = ICONS.check;
    let iconColor = 'text-green-500 bg-green-100';

    if (percentage >= 80) {
        feedbackMessage = 'Одлична работа!';
    } else if (percentage >= 50) {
        feedbackMessage = 'Добро направено! Продолжете со вежбање.';
        Icon = ICONS.lightbulb;
        iconColor = 'text-yellow-500 bg-yellow-100';
    } else {
        feedbackMessage = 'Потребно е уште малку вежбање. Не се откажувајте!';
        Icon = ICONS.arrowPath;
        iconColor = 'text-red-500 bg-red-100';
    }
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
        <div onClick={e => e.stopPropagation()}>
            <Card className="max-w-md w-full text-center">
                <Icon className={`w-16 h-16 mx-auto ${iconColor} rounded-full p-2`} />
                <h2 className="text-2xl font-bold mt-4">{feedbackMessage}</h2>
                <p className="text-lg text-gray-600 mt-2">Вашиот резултат е:</p>
                <p className="text-5xl font-bold text-brand-primary my-4">{score} / {questions.length}</p>
                <div className="flex justify-center gap-4 mt-6">
                    <button onClick={handleRetry} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Обиди се повторно</button>
                    <button onClick={onClose} className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary">Затвори</button>
                </div>
            </Card>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quiz-title"
    >
      <div 
        className="bg-gray-100 rounded-lg shadow-xl max-w-2xl w-full flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-lg">
          <h2 id="quiz-title" className="text-xl font-bold text-brand-primary">Интерактивен Квиз</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200" aria-label="Затвори">
            <ICONS.close className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        
        <div className="p-2 bg-white">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-brand-accent h-2.5 rounded-full transition-all duration-300" style={{ width: `${progressPercentage}%` }}></div>
            </div>
        </div>

        <div className="p-8 flex-1">
          <p className="text-sm text-gray-500 mb-2">Прашање {currentIndex + 1} од {questions.length}</p>
          <div className="text-xl font-semibold mb-6 min-h-[6rem]">
            <MathRenderer text={currentQuestion.question} />
          </div>
          <div className="space-y-3">
            {renderOptions()}
          </div>
        </div>

        {isAnswered && (
             <div className="p-4 bg-white rounded-b-lg flex justify-end">
                <button onClick={handleNext} className="flex items-center bg-brand-primary text-white px-6 py-2 rounded-lg shadow hover:bg-brand-secondary">
                    {currentIndex < questions.length - 1 ? 'Следно прашање' : 'Види резултати'}
                    <ICONS.chevronRight className="w-5 h-5 ml-2" />
                </button>
             </div>
        )}
      </div>
    </div>
  );
};