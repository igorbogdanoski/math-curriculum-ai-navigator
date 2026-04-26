import { logger } from '../utils/logger';
import React, { useState, useRef } from 'react';
import {
  ArrowDown,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Volume2,
  BrainCircuit,
  Loader2,
  Send,
  XCircle,
  PenLine,
} from 'lucide-react';
import { DrawingCanvas } from './solver/DrawingCanvas';

import { geminiService } from '../services/geminiService';
import { useVoice } from '../hooks/useVoice';
import { logStepEvent } from '../services/firestoreService.telemetry';
import { useAuth } from '../contexts/AuthContext';

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
  conceptId?: string;
  teacherUid?: string;
}

export const StepByStepSolver: React.FC<StepByStepSolverProps> = ({
  problem,
  strategy,
  steps,
  conceptId,
  teacherUid,
}) => {
  // States за менаџирање на интеракцијата
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [deepExplanations, setDeepExplanations] = useState<Record<number, string>>({});
  const [loadingStep, setLoadingStep] = useState<number | null>(null);

  // verifyUserStep state
  const [userAttempt, setUserAttempt] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ correct: boolean; feedback: string; hint: string } | null>(null);

  const [showCanvas, setShowCanvas] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  // Cognitive telemetry — per-step timing + hints + attempts
  const stepStartRef = useRef<number>(Date.now());
  const hintsRef = useRef(0);
  const attemptsRef = useRef(0);

  const { speak } = useVoice();
  const { firebaseUser } = useAuth();

  const flushTelemetry = (correct: boolean) => {
    if (!conceptId || currentStep >= steps.length) return;
    const studentId = firebaseUser?.uid ?? (localStorage.getItem('exam_device_id') ?? 'anon');
    logStepEvent({
      studentId,
      teacherUid: teacherUid ?? firebaseUser?.uid,
      conceptId,
      problemText: problem.slice(0, 200),
      stepIndex: currentStep,
      timeSpentMs: Date.now() - stepStartRef.current,
      hintsUsed: hintsRef.current,
      attempts: attemptsRef.current,
      correct,
    });
  };

  // Функција за активирање на Сократовиот метод (Зошто?)
  const handleAskWhy = async (index: number) => {
    if (deepExplanations[index]) return;
    // Hint used — increment counter for the current step
    if (index === currentStep) hintsRef.current += 1;

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
    // Flush telemetry for the completed step (no verify attempted = correct by progression)
    if (currentStep < steps.length && attemptsRef.current === 0) {
      flushTelemetry(true);
    }
    if (currentStep < steps.length) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsComplete(true);
    }
    // Reset per-step counters for next step
    stepStartRef.current = Date.now();
    hintsRef.current = 0;
    attemptsRef.current = 0;
    setUserAttempt('');
    setVerifyResult(null);
  };

  const reset = () => {
    setCurrentStep(0);
    setIsComplete(false);
    setDeepExplanations({});
    setUserAttempt('');
    setVerifyResult(null);
    stepStartRef.current = Date.now();
    hintsRef.current = 0;
    attemptsRef.current = 0;
  };

  const handleVerify = async () => {
    if (!userAttempt.trim() || currentStep >= steps.length) return;
    attemptsRef.current += 1;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await geminiService.verifyUserStep(
        problem,
        steps.slice(0, currentStep),
        userAttempt.trim(),
        steps[currentStep],
      );
      setVerifyResult(result);
      if (result.correct) flushTelemetry(true);
    } catch (e) {
      logger.error('verifyUserStep error', e);
    } finally {
      setVerifying(false);
    }
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

        {/* S45-A: verifyUserStep — ученикот го погодува следниот чекор */}
        {!isComplete && currentStep > 0 && currentStep < steps.length && (
          <div className="mt-8 rounded-2xl border border-indigo-100 bg-indigo-50 p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-indigo-500">
              🧠 Обиди се сам — каков е следниот чекор?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={userAttempt}
                onChange={e => { setUserAttempt(e.target.value); setVerifyResult(null); }}
                onKeyDown={e => { if (e.key === 'Enter') handleVerify(); }}
                placeholder="Напиши го твојот следен чекор..."
                className="flex-1 rounded-xl border border-indigo-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={handleVerify}
                disabled={verifying || !userAttempt.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:bg-indigo-700 transition"
              >
                {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Провери
              </button>
            </div>

            {verifyResult && (
              <div className={`rounded-xl p-4 text-sm ${verifyResult.correct ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="flex items-start gap-2">
                  {verifyResult.correct
                    ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    : <XCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />}
                  <div className="space-y-1">
                    <p className={`font-semibold ${verifyResult.correct ? 'text-emerald-800' : 'text-amber-800'}`}>
                      {verifyResult.feedback}
                    </p>
                    {verifyResult.hint && (
                      <p className="text-slate-600 text-xs italic">💡 {verifyResult.hint}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Drawing canvas toggle */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              setShowCanvas(v => !v);
              if (!showCanvas) setTimeout(() => canvasContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
            }}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <PenLine className="w-4 h-4" />
            {showCanvas ? 'Скриј платно' : 'Цртај / работи на хартија'}
          </button>

          {showCanvas && (
            <div ref={canvasContainerRef} className="mt-3">
              <DrawingCanvas />
            </div>
          )}
        </div>

        {/* Главно копче за навигација низ чекорите */}
        <div className="mt-6 pt-6 border-t border-slate-100 flex justify-center">
            {!isComplete ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black shadow-xl transition-all active:scale-95 flex items-center gap-2"
                >
                    {currentStep === 0 ? 'ЗАПОЧНИ РЕШАВАЊЕ' : 'СЛЕДЕН ЧЕКОР'}
                    <ArrowDown className="w-5 h-5" />
                </button>
            ) : (
                <button
                  type="button"
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
