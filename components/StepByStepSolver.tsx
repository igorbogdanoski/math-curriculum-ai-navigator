import React, { useState } from 'react';
import { 
  ArrowDown, 
  CheckCircle, 
  HelpCircle, 
  RefreshCw, 
  Volume2, 
  BrainCircuit,
  Loader2 
} from 'lucide-react';

import { geminiService } from '../services/geminiService';
import { useVoice } from '../hooks/useVoice';

// Дефинирање на интерфејси
export interface SolverStep {
  explanation: string;
  expression: string;
}

interface StepByStepSolverProps {
  problem: string;
  strategy?: string;
  steps: SolverStep[];
}

export const StepByStepSolver: React.FC<StepByStepSolverProps> = ({ 
  problem, 
  strategy, 
  steps 
}) => {
  // Внатрешни состојби
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [deepExplanations, setDeepExplanations] = useState<Record<number, string>>({});
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  const { speak } = useVoice();

  // Логика за "Зошто?" копчето
  const handleAskWhy = async (index: number) => {
    if (deepExplanations[index]) return;
    setLoadingStep(index);
    try {
      // Ова бара explainSpecificStep да постои во geminiService
      const why = await geminiService.explainSpecificStep(
        problem, 
        steps[index].explanation, 
        steps[index].expression
      );
      setDeepExplanations(prev => ({ ...prev, [index]: why }));
    } catch (error) {
      console.error("Грешка при објаснување:", error);
    } finally {
      setLoadingStep(null);
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsComplete(true);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setIsComplete(false);
    setDeepExplanations({});
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mt-8">
      {/* HEADER СЕКЦИЈА */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white leading-none">AI Решавач</h3>
            <p className="text-blue-400 text-[10px] uppercase font-black tracking-widest mt-1">
              Чекор-по-чекор Логика
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {/* ПРИКАЗ НА ЗАДАЧАТА */}
        <div className="text-center mb-8 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-black block mb-2 tracking-widest">Проблем</span>
            <div className="text-2xl font-mono font-bold text-slate-800 tracking-tight">
              {problem}
            </div>
        </div>

        {/* ЧЕКОРИ */}
        <div className="space-y-6">
            {steps.map((step: SolverStep, index: number) => (
                index < currentStep && (
                  <div key={index} className="animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex justify-center mb-4 text-slate-300">
                        <ArrowDown className="w-5 h-5" />
                      </div>
                      
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                              <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Чекор {index + 1}</span>
                                      <p className="text-sm text-slate-600 font-medium">{step.explanation}</p>
                                  </div>
                                  <p className="text-xl font-mono font-bold text-blue-600">{step.expression}</p>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => handleAskWhy(index)}
                                    className="flex items-center gap-1.5 text-[11px] font-black bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition"
                                  >
                                      {loadingStep === index ? <Loader2 className="w-3 h-3 animate-spin" /> : <HelpCircle className="w-3 h-3" />}
                                      ЗОШТО?
                                  </button>
                                  <button 
                                    onClick={() => speak(step.explanation)}
                                    className="p-2 text-slate-400 hover:text-blue-600 rounded-full transition"
                                  >
                                      <Volume2 className="w-5 h-5" />
                                  </button>
                              </div>
                          </div>

                          {/* ДЛАБИНСКО ОБЈАСНУВАЊЕ */}
                          {deepExplanations[index] && (
                              <div className="mt-4 p-4 bg-blue-600 text-white text-sm rounded-xl animate-in zoom-in-95 duration-200 shadow-inner">
                                  <p className="leading-relaxed font-medium">💡 {deepExplanations[index]}</p>
                              </div>
                          )}
                      </div>
                  </div>
                )
            ))}
        </div>

        {/* РЕЗУЛТАТ */}
        {isComplete && (
            <div className="mt-10 text-center animate-in zoom-in duration-500">
                <div className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl font-black shadow-lg">
                    <CheckCircle className="w-6 h-6" />
                    БРАВО! РЕШЕНО.
                </div>
            </div>
        )}

        {/* КОНТРОЛНИ КОПЧИЊА */}
        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-center">
            {!isComplete ? (
                <button 
                  onClick={nextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-xl font-black shadow-lg transition-all active:scale-95"
                >
                    {currentStep === 0 ? 'ЗАПОЧНИ' : 'СЛЕДЕН ЧЕКОР'}
                </button>
            ) : (
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 text-slate-400 font-bold hover:text-blue-600 transition"
                >
                    <RefreshCw className="w-4 h-4" /> РЕСТАРТИРАЈ
                </button>
            )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { ArrowDown, CheckCircle, HelpCircle, RefreshCw, Volume2, BrainCircuit, Loader2 } from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { useVoice } from '../hooks/useVoice';

// 1. Дефинирање на интерфејси за цврста типизација
export interface SolverStep {
  explanation: string;
  expression: string;
}

export interface MentalMapData {
  nodes: Array<{ id: number; label: string }>;
  edges: Array<{ from: number; to: number; label: string }>;
}

interface StepByStepSolverProps {
  problem: string;
  strategy?: string;
  steps: SolverStep[];
  mentalMap?: MentalMapData;
}

  problem,
  strategy,
  steps,
  mentalMap
}) => {
  // States со експлицитни типови
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [deepExplanations, setDeepExplanations] = useState<Record<number, string>>({});
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  const { speak } = useVoice();

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsComplete(true);
    }
  };

  const handleAskWhy = async (index: number) => {
    if (deepExplanations[index]) return;

    setLoadingStep(index);
    try {
      // Тука го повикуваме сервисот - осигурај се дека патеката е точна
      const why = await geminiService.explainSpecificStep(
        problem,
        steps[index].explanation,
        steps[index].expression
      );
      setDeepExplanations(prev => ({ ...prev, [index]: why }));
    } catch (error) {
      console.error('Грешка при преземање објаснување:', error);
    } finally {
      setLoadingStep(null);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setIsComplete(false);
    setDeepExplanations({});
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-indigo-900 leading-none">AI Тутор</h3>
            <p className="text-xs text-indigo-600 mt-1 uppercase tracking-wider font-bold">Чекор-по-чекор логика</p>
          </div>
        </div>
        {strategy && (
          <div className="hidden md:block bg-amber-100 text-amber-800 text-[10px] px-2 py-1 rounded-full font-bold">
            ToT СТРАТЕГИЈА АКТИВИРАНА
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Стратегија (ToT) */}
        {strategy && (
          <div className="mb-6 p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg flex gap-3">
            <HelpCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-900 italic leading-relaxed">
              <strong>Размислување:</strong> {strategy}
            </p>
          </div>
        )}

        {/* Проблем */}
        <div className="text-center mb-8 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <span className="text-xs text-slate-400 uppercase font-black block mb-2">Задача за решавање</span>
          <div className="text-2xl md:text-3xl font-mono font-bold text-slate-800 tracking-tight">
            {problem}
          </div>
        </div>

        {/* Чекори */}
        <div className="space-y-6">
          {steps.map((step: SolverStep, index: number) => (
            <div
              key={index}
              className={`transition-all duration-500 transform ${
                index < currentStep ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 absolute pointer-events-none'
              }`}
            >
              <div className="flex justify-center mb-4">
                <ArrowDown className="w-5 h-5 text-slate-300" />
              </div>

              <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded">ЧЕКОР {index + 1}</span>
                      <p className="text-sm text-slate-600 font-medium">{step.explanation}</p>
                    </div>
                    <p className="text-xl font-mono font-bold text-indigo-600">{step.expression}</p>
                  </div>

                  <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                    <button
                      onClick={() => handleAskWhy(index)}
                      className="flex items-center gap-1.5 text-[11px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
                    >
                      {loadingStep === index ? <Loader2 className="w-3 h-3 animate-spin" /> : <HelpCircle className="w-3 h-3" />}
                      ЗОШТО?
                    </button>
                    <button
                      onClick={() => speak(step.explanation)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Длабоко објаснување (Follow-up) */}
                {deepExplanations[index] && (
                  <div className="bg-indigo-600 p-4 text-white text-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex gap-2">
                      <BrainCircuit className="w-5 h-5 flex-shrink-0 opacity-50" />
                      <p className="leading-relaxed"><span className="font-bold text-indigo-200 tracking-wider uppercase text-[10px] block mb-1">Длабинска Анализа</span>{deepExplanations[index]}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Финале */}
        {isComplete && (
          <div className="mt-10 text-center animate-in zoom-in duration-500">
            <div className="inline-flex items-center gap-3 bg-green-500 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-xl shadow-green-200">
              <CheckCircle className="w-7 h-7" />
              РЕШЕНО!
            </div>
          </div>
        )}

        {/* Контроли */}
        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-center">
          {!isComplete ? (
            <button
              onClick={nextStep}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center gap-3"
            >
              {currentStep === 0 ? 'ЗАПОЧНИ' : 'СЛЕДЕН ЧЕКОР'}
              <ArrowDown className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={reset}
              className="text-slate-400 hover:text-indigo-600 font-bold flex items-center gap-2 px-6 py-3 transition"
            >
              <RefreshCw className="w-4 h-4" />
              РЕСТАРТ
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
