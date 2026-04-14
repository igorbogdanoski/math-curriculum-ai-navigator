import { logger } from '../utils/logger';
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

// Интерфејси за целосна TypeScript безбедност
export interface SolverStep {
  explanation: string;
  expression: string;
}

interface StepByStepSolverProps {
  problem: string;
  strategy?: string;
  steps: SolverStep[];
  mentalMap?: any;
}

export const StepByStepSolver: React.FC<StepByStepSolverProps> = ({ 
  problem, 
  strategy, 
  steps 
}) => {
  // States за менаџирање на интеракцијата
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [deepExplanations, setDeepExplanations] = useState<Record<number, string>>({});
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  const { speak } = useVoice();

  // Функција за активирање на Сократовиот метод (Зошто?)
  const handleAskWhy = async (index: number) => {
    if (deepExplanations[index]) return; // Веќе е вчитано
    
    setLoadingStep(index);
    try {
      const why = await geminiService.explainSpecificStep(
        problem, 
        steps[index].explanation, 
        steps[index].expression
      );
      setDeepExplanations(prev => ({ ...prev, [index]: why }));
    } catch (error) {
      logger.error("Грешка при преземање на објаснување:", error);
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
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mt-6 transition-all">
      {/* Header со AI брендирање */}
      <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-white text-sm leading-none">AI Решавач (ToT)</h3>
            <p className="text-blue-400 text-[10px] uppercase font-black tracking-widest mt-1">
              Чекор-по-чекор Логика
            </p>
          </div>
        </div>
        {strategy && (
          <div className="bg-amber-500/20 text-amber-400 text-[10px] px-2 py-1 rounded font-bold border border-amber-500/30">
            ToT СТРАТЕГИЈА АКТИВИРАНА
          </div>
        )}
      </div>

      <div className="p-6 md:p-8">
        {/* ToT Стратегија */}
        {strategy && (
          <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-xl flex gap-3">
            <HelpCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-900 italic leading-relaxed text-left">
              <strong>Размислување:</strong> {strategy}
            </p>
          </div>
        )}

        {/* Приказ на главната задача */}
        <div className="text-center mb-8 p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <span className="text-[10px] text-slate-400 uppercase font-black block mb-2 tracking-widest">Проблем за решавање</span>
            <div className="text-2xl font-mono font-bold text-slate-800 tracking-tight">
              {problem}
            </div>
        </div>

        {/* Интерактивни чекори */}
        <div className="space-y-6">
            {steps.map((step: SolverStep, index: number) => (
                index < currentStep && (
                  <div key={index} className="animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="flex justify-center mb-4 text-slate-300">
                        <ArrowDown className="w-5 h-5" />
                      </div>
                      
                      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-200 transition-colors">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div className="flex-1 text-left">
                                  <div className="flex items-center gap-2 mb-1">
                                      <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase">Чекор {index + 1}</span>
                                      <p className="text-sm text-slate-600 font-semibold">{step.explanation}</p>
                                  </div>
                                  <p className="text-xl font-mono font-bold text-blue-600 tracking-tight">{step.expression}</p>
                              </div>
                              
                              <div className="flex items-center gap-2 w-full md:w-auto">
                                  <button 
                                    onClick={() => handleAskWhy(index)}
                                    className="flex-1 md:flex-none flex items-center justify-center gap-1.5 text-[11px] font-black bg-indigo-50 text-indigo-600 px-3 py-2 rounded-xl hover:bg-indigo-100 transition shadow-sm"
                                  >
                                      {loadingStep === index ? <Loader2 className="w-3 h-3 animate-spin" /> : <HelpCircle className="w-3 h-3" />}
                                      ЗОШТО?
                                  </button>
                                  <button 
                                    onClick={() => speak(step.explanation)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded-full transition"
                                  >
                                      <Volume2 className="w-5 h-5" />
                                  </button>
                              </div>
                          </div>

                          {/* Длабоко објаснување (Deep-dive) */}
                          {deepExplanations[index] && (
                              <div className="mt-4 p-4 bg-indigo-600 text-white text-sm rounded-xl animate-in zoom-in-95 duration-300 shadow-inner text-left">
                                  <p className="leading-relaxed font-medium">💡 {deepExplanations[index]}</p>
                              </div>
                          )}
                      </div>
                  </div>
                )
            ))}
        </div>

        {/* Завршна порака */}
        {isComplete && (
            <div className="mt-10 text-center animate-in zoom-in duration-500">
                <div className="inline-flex items-center gap-2 bg-green-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg">
                    <CheckCircle className="w-6 h-6" />
                    БРАВО! РЕШЕНО ЦЕЛОСНО.
                </div>
            </div>
        )}

        {/* Главно копче за навигација низ чекорите */}
        <div className="mt-10 pt-6 border-t border-slate-100 flex justify-center">
            {!isComplete ? (
                <button 
                  onClick={nextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 flex items-center gap-2"
                >
                    {currentStep === 0 ? 'ЗАПОЧНИ РЕШАВАЊЕ' : 'СЛЕДЕН ЧЕКОР'}
                    <ArrowDown className="w-5 h-5" />
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
