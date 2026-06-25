import { logger } from '../../utils/logger';
import React, { useState } from 'react';
import { Lightbulb, Loader2, Send, RotateCcw, CheckCircle2, AlertCircle, Target } from 'lucide-react';
import { AcademyLesson } from '../../data/academy/content';
import { callGeminiProxy, sanitizePromptInput, DEFAULT_MODEL } from '../../services/gemini/core';
import type { Quality } from '../../utils/sm2';

function feynmanToSM2Quality(total: number): Quality {
  if (total >= 85) return 5;
  if (total >= 70) return 4;
  if (total >= 55) return 3;
  if (total >= 40) return 2;
  if (total >= 20) return 1;
  return 0;
}

interface FeynmanFeedback {
  accuracy: number;      // 0-40
  simplicity: number;    // 0-25
  completeness: number;  // 0-25
  noJargon: number;      // 0-10
  total: number;
  summary: string;
  missing: string;
  praise: string;
}

const SCORE_BAR_COLORS: Record<string, { label: string; bar: string }> = {
  indigo: { label: 'text-indigo-700', bar: 'bg-indigo-500' },
  sky:    { label: 'text-sky-700',    bar: 'bg-sky-500' },
  violet: { label: 'text-violet-700', bar: 'bg-violet-500' },
  teal:   { label: 'text-teal-700',   bar: 'bg-teal-500' },
};

function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.round((score / max) * 100);
  const cls = SCORE_BAR_COLORS[color] ?? SCORE_BAR_COLORS['indigo'];
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className={`font-bold ${cls.label}`}>{score}/{max}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${cls.bar} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export const FeynmanChallenge: React.FC<{
  lesson: AcademyLesson;
  onGradeComplete?: (quality: Quality) => void;
}> = ({ lesson, onGradeComplete }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeynmanFeedback | null>(null);
  const [error, setError] = useState('');
  const [misconceptionTarget, setMisconceptionTarget] = useState<string | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const submit = async () => {
    if (text.trim().length < 20) {
      setError('Напиши барем неколку реченици пред да испратиш.');
      return;
    }
    setError('');
    setLoading(true);
    setFeedback(null);
    try {
      const safeTitle   = sanitizePromptInput(lesson.title, 120);
      const safeTheory  = sanitizePromptInput(lesson.theory.join(' '), 800);
      const safeText    = sanitizePromptInput(text, 1500);

      const prompt = `Ти си AI оценувач на Феинман техниката. Оцени го следниов студентски текст.

КОНЦЕПТ ОД ЛЕКЦИЈАТА: "${safeTitle}"
ТЕОРЕТСКА ПОЗАДИНА: ${safeTheory}

СТУДЕНТСКО ОБЈАСНУВАЊЕ (замислено дека е за 10-годишник):
"""
${safeText}
"""

Оцени по 4 критериуми и врати САМО валиден JSON:
{
  "accuracy":     <цел број 0–40, точност на суштинскиот концепт>,
  "simplicity":   <цел број 0–25, употреба на едноставен јазик без жаргон>,
  "completeness": <цел број 0–25, дали ги опфаќа клучните точки>,
  "noJargon":     <цел број 0–10, избегнување неразбирлив технички жаргон>,
  "total":        <збир 0–100>,
  "praise":       "<1 реченица — конкретна пофалба на нешто добро>",
  "missing":      "<1 реченица — главната ствар која недостасува или е неточна>",
  "summary":      "<2 реченици — целокупна оценка на македонски>"
}`;

      const response = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      });

      if (response?.text) {
        const parsed: FeynmanFeedback = JSON.parse(response.text);
        parsed.total = (parsed.accuracy ?? 0) + (parsed.simplicity ?? 0) + (parsed.completeness ?? 0) + (parsed.noJargon ?? 0);
        setFeedback(parsed);
        onGradeComplete?.(feynmanToSM2Quality(parsed.total));
      }
    } catch (err) {
      logger.error('FeynmanChallenge evaluation failed:', err);
      setError('Неуспешна оценка. Обиди се повторно.');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setText('');
    setFeedback(null);
    setError('');
    setMisconceptionTarget(null);
  };

  const handleTargetMisconception = async () => {
    if (!feedback?.missing) return;
    setLoadingTarget(true);
    setMisconceptionTarget(null);
    try {
      const safeMissing = sanitizePromptInput(feedback.missing, 300);
      const safeTitle   = sanitizePromptInput(lesson.title, 100);
      const prompt = `Ти си педагог-специјалист. Ученикот не го разбрал следниот концепт: "${safeMissing}" (во лекцијата "${safeTitle}").
Напиши 3 реченици (на македонски) кои директно го адресираат овој пропуст со конкретен пример или аналогија достапна за ученик.
Врати САМО 3 реченици без воведни зборови.`;
      const response = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (response?.text) setMisconceptionTarget(response.text.trim());
    } catch {
      setMisconceptionTarget('Неуспешно генерирање. Обиди се повторно.');
    } finally {
      setLoadingTarget(false);
    }
  };

  const totalKey = feedback
    ? (feedback.total >= 80 ? 'emerald' : feedback.total >= 55 ? 'amber' : 'red')
    : 'amber';

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
          <Lightbulb className="w-5 h-5 text-yellow-600" />
        </div>
        <div>
          <h3 className="text-lg font-black text-yellow-900">Феинман Предизвик</h3>
          <p className="text-xs text-yellow-700">Ако навистина го разбираш — можеш да го објасниш едноставно.</p>
        </div>
      </div>

      <p className="text-sm text-yellow-800 leading-relaxed bg-yellow-100 rounded-xl px-4 py-3">
        Замисли дека му/ѝ ја објаснуваш лекцијата <strong>„{lesson.title}"</strong> на дете од 10 години
        кое никогаш не слушнало за тоа. Напиши со свои зборови — без учебнички дефиниции.
      </p>

      {!feedback ? (
        <>
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError(''); }}
            placeholder="Пример: Па значи, замисли дека имаш кутии со топки..."
            rows={5}
            className="w-full rounded-xl border border-yellow-300 bg-white px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
          />
          <p className={`text-right text-xs mt-1 ${text.trim().length >= 20 ? 'text-green-600' : 'text-gray-400'}`}>
            {text.trim().length} / мин. 20 знаци
          </p>
          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={loading || text.trim().length < 20}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> AI го оценува...</>
              : <><Send className="w-4 h-4" /> Испрати за оценка</>
            }
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {/* Total score */}
          {totalKey === 'emerald' && (
            <div className="rounded-xl p-4 text-center bg-emerald-50 border border-emerald-200">
              <p className="text-4xl font-black text-emerald-700">{feedback.total}<span className="text-xl font-bold text-gray-400">/100</span></p>
              <p className="text-xs font-semibold text-emerald-600 mt-1">Одлично!</p>
            </div>
          )}
          {totalKey === 'amber' && (
            <div className="rounded-xl p-4 text-center bg-amber-50 border border-amber-200">
              <p className="text-4xl font-black text-amber-700">{feedback.total}<span className="text-xl font-bold text-gray-400">/100</span></p>
              <p className="text-xs font-semibold text-amber-600 mt-1">Добро — има простор за подобрување</p>
            </div>
          )}
          {totalKey === 'red' && (
            <div className="rounded-xl p-4 text-center bg-red-50 border border-red-200">
              <p className="text-4xl font-black text-red-700">{feedback.total}<span className="text-xl font-bold text-gray-400">/100</span></p>
              <p className="text-xs font-semibold text-red-600 mt-1">Потребна е повеќе практика</p>
            </div>
          )}

          {/* Rubric bars */}
          <div className="bg-white rounded-xl border border-yellow-200 p-4 space-y-3">
            <ScoreBar label="Точност на концептот" score={feedback.accuracy}     max={40} color="indigo" />
            <ScoreBar label="Едноставност на јазикот" score={feedback.simplicity}  max={25} color="sky"    />
            <ScoreBar label="Комплетност" score={feedback.completeness} max={25} color="violet" />
            <ScoreBar label="Без жаргон" score={feedback.noJargon}     max={10} color="teal"  />
          </div>

          {/* Text feedback */}
          <div className="space-y-2">
            {feedback.praise && (
              <div className="flex gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-green-600" />
                <span><strong>Добро:</strong> {feedback.praise}</span>
              </div>
            )}
            {feedback.missing && (
              <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                <div className="flex-1 space-y-2">
                  <p><strong>Недостасува:</strong> {feedback.missing}</p>
                  {feedback.total < 70 && !misconceptionTarget && (
                    <button
                      type="button"
                      onClick={handleTargetMisconception}
                      disabled={loadingTarget}
                      className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 disabled:opacity-50 transition-colors"
                    >
                      {loadingTarget
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> AI генерира целна помош...</>
                        : <><Target className="w-3 h-3" /> 🎯 Адресирај го пропустот со AI</>}
                    </button>
                  )}
                </div>
              </div>
            )}
            {misconceptionTarget && (
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 space-y-1">
                <p className="text-xs font-bold text-violet-700 flex items-center gap-1.5">
                  <Target className="w-3 h-3" /> AI Целна Надоградба
                </p>
                <p className="text-sm text-violet-900 leading-relaxed">{misconceptionTarget}</p>
              </div>
            )}
            <p className="text-sm text-gray-700 leading-relaxed px-1">{feedback.summary}</p>
          </div>

          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-2 text-sm text-yellow-700 hover:text-yellow-900 font-semibold transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Обиди се повторно
          </button>
        </div>
      )}
    </div>
  );
};
