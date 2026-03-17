import React, { useState } from 'react';
import { CheckCircle2, XCircle, Brain, HelpCircle, ArrowRight, Loader2, Award } from 'lucide-react';
import { AcademyLesson } from '../../data/academy/content';
import { callGeminiProxy } from '../../services/gemini/core';
import { useAcademyProgress } from '../../contexts/AcademyProgressContext';
import confetti from 'canvas-confetti';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export const AcademyQuiz: React.FC<{ lesson: AcademyLesson }> = ({ lesson }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const { markQuizAsCompleted, progress } = useAcademyProgress();

  const isAlreadyCompleted = progress.completedQuizzes.includes(lesson.id);

  const generateQuiz = async () => {
    setIsGenerating(true);
    try {
      const prompt = `Генерирај краток квиз од 3 прашања за наставник по математика базиран на лекцијата: "${lesson.title}".
Лекцијата покрива: ${lesson.theory.join(' ')}

Форматот на одговорот МОРА да биде валиден JSON низа од објекти:
[
  {
    "question": "прашање",
    "options": ["опција 1", "опција 2", "опција 3", "опција 4"],
    "correctAnswer": 0, // индекс на точната опција
    "explanation": "кратко објаснување зошто е тоа точно"
  }
]
Одговорите да бидат на македонски јазик.`;

      const response = await callGeminiProxy({
        model: 'gemini-2.5-pro',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        setQuestions(parsed);
      }
    } catch (error) {
      console.error('Quiz generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOptionSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
  };

  const handleSubmitAnswer = () => {
    if (selectedOption === null || isAnswered) return;
    
    setIsAnswered(true);
    if (selectedOption === questions[currentQuestionIdx].correctAnswer) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
      if (score >= questions.length - 1) { // 2/3 or better
        markQuizAsCompleted(lesson.id);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  };

  if (isAlreadyCompleted && !isFinished && questions.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-green-900 mb-2">Квизот е успешно завршен!</h3>
        <p className="text-green-800/70 mb-6">Веќе го покажавте вашето познавање за оваа тема.</p>
        <button 
          onClick={generateQuiz}
          className="text-green-700 font-bold hover:underline"
        >
          Пробај го квизот повторно
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center shadow-sm">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Проверете го вашето знаење</h3>
        <p className="text-gray-500 mb-8 max-w-md mx-auto">
          Генерирајте брз квиз за да го потврдите вашето разбирање на овој педагошки модел и освојте 50 XP.
        </p>
        <button
          onClick={generateQuiz}
          disabled={isGenerating}
          className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-all flex items-center gap-2 mx-auto disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Генерирање...
            </>
          ) : (
            <>
              <HelpCircle className="w-5 h-5" />
              Започни квиз
            </>
          )}
        </button>
      </div>
    );
  }

  if (isFinished) {
    const passed = score >= questions.length - 1;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center shadow-lg animate-in zoom-in-95 duration-300">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${passed ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
          {passed ? <Award className="w-10 h-10" /> : <Brain className="w-10 h-10" />}
        </div>
        <h3 className="text-3xl font-black text-gray-900 mb-2">
          {score}/{questions.length} Точни одговори
        </h3>
        <p className="text-gray-500 mb-8 text-lg">
          {passed 
            ? 'Одлично! Потврдивте дека ја владеете оваа наставна стратегија.' 
            : 'Добар обид! Прочитајте ја лекцијата уште еднаш и обидете се повторно.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => {
              setQuestions([]);
              setIsFinished(false);
              setScore(0);
              setCurrentQuestionIdx(0);
            }}
            className="px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
          >
            Затвори
          </button>
          {!passed && (
            <button
              onClick={generateQuiz}
              className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-all"
            >
              Обиди се повторно
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIdx];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm animate-in slide-in-from-right-4">
      <div className="flex items-center justify-between mb-8">
        <span className="text-sm font-bold text-brand-primary uppercase tracking-widest">
          Прашање {currentQuestionIdx + 1} од {questions.length}
        </span>
        <div className="h-2 w-32 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-brand-primary transition-all duration-500" 
            style={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <h3 className="text-xl font-bold text-gray-900 mb-8 leading-relaxed">
        {currentQ.question}
      </h3>

      <div className="grid gap-3 mb-8">
        {currentQ.options.map((option, idx) => {
          let style = "border-gray-100 bg-gray-50 text-gray-700 hover:border-brand-primary/30";
          if (selectedOption === idx) {
            style = "border-brand-primary bg-brand-primary/5 text-brand-primary ring-2 ring-brand-primary/20";
          }
          if (isAnswered) {
            if (idx === currentQ.correctAnswer) {
              style = "border-green-500 bg-green-50 text-green-700 ring-2 ring-green-100";
            } else if (selectedOption === idx) {
              style = "border-red-500 bg-red-50 text-red-700 ring-2 ring-red-100";
            } else {
              style = "border-gray-100 bg-gray-50 text-gray-400 opacity-50";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionSelect(idx)}
              disabled={isAnswered}
              className={`w-full p-4 rounded-xl border text-left font-medium transition-all flex items-center justify-between group ${style}`}
            >
              <span>{option}</span>
              {isAnswered && idx === currentQ.correctAnswer && <CheckCircle2 className="w-5 h-5 text-green-500" />}
              {isAnswered && selectedOption === idx && idx !== currentQ.correctAnswer && <XCircle className="w-5 h-5 text-red-500" />}
            </button>
          );
        })}
      </div>

      {isAnswered && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm leading-relaxed animate-in fade-in duration-300">
          <strong className="block mb-1">Објаснување:</strong>
          {currentQ.explanation}
        </div>
      )}

      <div className="flex justify-end">
        {!isAnswered ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedOption === null}
            className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-all disabled:opacity-50"
          >
            Потврди одговор
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-all flex items-center gap-2"
          >
            {currentQuestionIdx < questions.length - 1 ? 'Следно прашање' : 'Заврши квиз'}
            <ArrowRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
