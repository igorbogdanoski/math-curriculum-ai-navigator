import React, { useState, useEffect, useMemo } from 'react';
import type { AssessmentQuestion } from '../../types';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';

interface FlashcardViewerProps {
  questions: AssessmentQuestion[];
  title: string;
  onClose: () => void;
}

type CardStatus = 'unseen' | 'correct' | 'incorrect';

export const FlashcardViewer: React.FC<FlashcardViewerProps> = ({ questions, title, onClose }) => {
  const [sessionQuestions, setSessionQuestions] = useState(questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardStatuses, setCardStatuses] = useState<CardStatus[]>(() => Array(sessionQuestions.length).fill('unseen'));
  const [isFinished, setIsFinished] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  const currentQuestion = sessionQuestions[currentIndex];

  const handleNavigation = (direction: 'next' | 'prev') => {
    if (animationClass) return; // Prevent navigation during animation

    setAnimationClass(direction === 'next' ? 'animate-slide-out-left' : 'animate-slide-out-right');

    setTimeout(() => {
      setIsFlipped(false);
      const newIndex = direction === 'next'
          ? (currentIndex + 1) % sessionQuestions.length
          : (currentIndex - 1 + sessionQuestions.length) % sessionQuestions.length;
      setCurrentIndex(newIndex);
      
      setAnimationClass(direction === 'next' ? 'animate-slide-in-from-right' : 'animate-slide-in-from-left');

      setTimeout(() => setAnimationClass(''), 250);
    }, 250);
  };

  const handleSetStatus = (status: 'correct' | 'incorrect') => {
    const newStatuses = [...cardStatuses];
    newStatuses[currentIndex] = status;
    setCardStatuses(newStatuses);

    const unseenCardsLeft = newStatuses.filter(s => s === 'unseen').length;
    if (unseenCardsLeft === 0 && newStatuses.every(s => s !== 'unseen')) {
        setIsFinished(true);
    } else {
        handleNavigation('next');
    }
  };
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if(isFinished) return;
        
        switch(e.key) {
            case 'ArrowLeft':
                handleNavigation('prev');
                break;
            case 'ArrowRight':
                handleNavigation('next');
                break;
            case ' ':
                e.preventDefault();
                setIsFlipped(f => !f);
                break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFinished, animationClass, sessionQuestions.length]);
  
  
  const progress = useMemo(() => {
      const counts = cardStatuses.reduce((acc, status) => {
          acc[status] = (acc[status] || 0) + 1;
          return acc;
      }, {} as Record<CardStatus, number>);
      return {
          correct: counts.correct || 0,
          incorrect: counts.incorrect || 0,
          unseen: counts.unseen || 0,
      };
  }, [cardStatuses]);

  const handleRetryIncorrect = () => {
    const incorrectQuestions = sessionQuestions.filter((_, i) => cardStatuses[i] === 'incorrect');
    if (incorrectQuestions.length === 0) return;
    setSessionQuestions(incorrectQuestions);
    setCurrentIndex(0);
    setIsFlipped(false);
    setCardStatuses(Array(incorrectQuestions.length).fill('unseen'));
    setIsFinished(false);
  };
  
  const handleRetryAll = () => {
    setSessionQuestions(questions);
    setCurrentIndex(0);
    setIsFlipped(false);
    setCardStatuses(Array(questions.length).fill('unseen'));
    setIsFinished(false);
  };

  if (isFinished) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in no-print" onClick={onClose} role="dialog">
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full text-center p-8" onClick={e => e.stopPropagation()}>
                <ICONS.check className="w-16 h-16 mx-auto bg-green-100 text-green-600 rounded-full p-2 mb-4" />
                <h2 className="text-2xl font-bold text-brand-primary">Сесијата е завршена!</h2>
                <p className="text-lg text-gray-600 mt-2">Вашиот резултат:</p>
                <div className="flex justify-center items-baseline gap-4 my-4">
                    <p className="text-5xl font-bold text-green-600">{progress.correct}</p>
                    <p className="text-3xl font-bold text-red-500">{progress.incorrect}</p>
                </div>
                 <div className="flex justify-center items-baseline gap-4 text-sm font-semibold">
                    <span className="text-green-600">Точни</span>
                    <span className="text-red-500">За повторување</span>
                </div>
                <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                    {progress.incorrect > 0 && (
                        <button onClick={handleRetryIncorrect} className="px-6 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600">Повтори ги неточните</button>
                    )}
                    <button onClick={handleRetryAll} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Обиди се повторно</button>
                    <button onClick={onClose} className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-secondary">Затвори</button>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in printable-root" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="flashcard-title">
        <div className="bg-gray-100 rounded-lg shadow-xl max-w-2xl w-full flex flex-col h-[90vh] max-h-[700px] no-print" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-lg flex-shrink-0">
                <h2 id="flashcard-title" className="text-xl font-bold text-brand-primary">Флеш-картички</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="p-2 rounded-full hover:bg-gray-200" aria-label="Печати">
                        <ICONS.printer className="w-6 h-6 text-gray-600" />
                    </button>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200" aria-label="Затвори">
                        <ICONS.close className="w-6 h-6 text-gray-600" />
                    </button>
                </div>
            </div>

            <div className="p-4 md:p-8 flex-1 flex flex-col items-center justify-center overflow-hidden">
                <p className="text-gray-500 mb-4 flex-shrink-0">Картичка {currentIndex + 1} од {sessionQuestions.length}</p>
                
                <div className="w-full h-full rounded-lg cursor-pointer" style={{ perspective: '1200px' }} onClick={() => setIsFlipped(!isFlipped)} role="button">
                    <div 
                        className={`relative w-full h-full transition-transform duration-500 ${animationClass}`}
                        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'}}
                    >
                        {/* Front of card */}
                        <div className="absolute w-full h-full flex items-center justify-center p-6 text-center text-xl bg-white shadow-xl rounded-lg" style={{ backfaceVisibility: 'hidden' }}>
                            <div className="space-y-4">
                                <p className="text-sm font-semibold text-brand-secondary">Прашање:</p>
                                <div className="text-2xl md:text-3xl font-medium"><MathRenderer text={currentQuestion.question} /></div>
                            </div>
                        </div>
                        {/* Back of card */}
                        <div className="absolute w-full h-full flex flex-col items-center justify-center p-6 text-center text-xl bg-white shadow-xl rounded-lg" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                            <div className="space-y-4 flex-1 flex flex-col justify-center">
                                <p className="text-sm font-semibold text-green-600">Одговор:</p>
                                <div className="text-2xl md:text-3xl font-medium"><MathRenderer text={currentQuestion.answer} /></div>
                            </div>
                            <div className="w-full flex justify-around items-center pt-4 mt-auto border-t">
                                <button onClick={(e) => { e.stopPropagation(); handleSetStatus('incorrect'); }} className="flex items-center gap-2 text-red-600 font-semibold hover:bg-red-50 p-2 rounded-lg">
                                    <ICONS.close className="w-6 h-6"/> Треба да повторам
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleSetStatus('correct'); }} className="flex items-center gap-2 text-green-600 font-semibold hover:bg-green-50 p-2 rounded-lg">
                                    <ICONS.check className="w-6 h-6"/> Знаев
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-white rounded-b-lg flex flex-col gap-4 flex-shrink-0">
                {/* Progress Bar */}
                <div className="w-full flex h-3 rounded-full overflow-hidden">
                    <div className="bg-green-500 transition-all duration-300" style={{ width: `${(progress.correct / sessionQuestions.length) * 100}%` }}></div>
                    <div className="bg-red-500 transition-all duration-300" style={{ width: `${(progress.incorrect / sessionQuestions.length) * 100}%` }}></div>
                    <div className="bg-gray-200 transition-all duration-300" style={{ width: `${(progress.unseen / sessionQuestions.length) * 100}%` }}></div>
                </div>
                {/* Navigation */}
                <div className="flex justify-between items-center">
                    <button onClick={() => handleNavigation('prev')} className="flex items-center bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300">
                        <ICONS.chevronRight className="w-5 h-5 mr-2 rotate-180" />
                        Претходна
                    </button>
                    <button onClick={() => setIsFlipped(!isFlipped)} className="font-semibold text-brand-secondary hover:underline">
                        {isFlipped ? 'Види прашање' : 'Преврти'} (Space)
                    </button>
                    <button onClick={() => handleNavigation('next')} className="flex items-center bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary">
                        Следна
                        <ICONS.chevronRight className="w-5 h-5 ml-2" />
                    </button>
                </div>
            </div>
        </div>

        {/* Printable View */}
        <div id="printable-flashcards" className="hidden print:block bg-white p-4">
            <h1 className="text-2xl font-bold mb-4">{title}</h1>
            <h2 className="text-lg font-semibold mb-6">Флеш-картички</h2>
            <div className="space-y-4">
                {sessionQuestions.map((q, index) => (
                    <div key={index} className="printable-flashcard">
                        <p className="font-semibold">Прашање {index + 1}:</p>
                        <div className="pl-2 mb-2"><MathRenderer text={q.question} /></div>
                        <p className="font-semibold">Одговор:</p>
                        <div className="pl-2 text-gray-800"><MathRenderer text={q.answer} /></div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};