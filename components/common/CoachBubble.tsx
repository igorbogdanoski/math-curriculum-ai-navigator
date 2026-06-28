/**
 * CoachBubble — S93-E1 / S94-E2
 * Dismissable micro-feedback bubble from the AI Pedagogical Coach.
 * Auto-dismisses after AUTO_DISMISS_MS with a countdown progress bar.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X, Lightbulb, Sparkles } from 'lucide-react';
import type { CoachFeedback } from '../../services/gemini/reports';
import { reportsAPI } from '../../services/gemini/reports';
import type { LessonPlan, AIGeneratedThematicPlan } from '../../types';

interface Props {
  plan: LessonPlan | AIGeneratedThematicPlan;
  planType: 'lesson' | 'thematic';
  dismissKey: string;
  onDismiss?: () => void;
}

const STORAGE_PREFIX = 'coach_dismissed_';
const AUTO_DISMISS_MS = 8000;
const TICK_MS = 50;

export const CoachBubble: React.FC<Props> = ({ plan, planType, dismissKey, onDismiss }) => {
  const [feedback, setFeedback] = useState<CoachFeedback | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dismissedRef = useRef(false); // guard against double-dismiss
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const storageKey = `${STORAGE_PREFIX}${dismissKey}`;
    if (localStorage.getItem(storageKey)) {
      setIsDismissed(true);
      setIsLoading(false);
      return;
    }
    reportsAPI.generateCoachFeedback(plan, planType)
      .then(setFeedback)
      .catch(() => setFeedback({ message: 'Одличен план! Продолжи со следниот чекор.', type: 'praise' }))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissKey]);

  // Start countdown once feedback is ready
  useEffect(() => {
    if (isLoading || isDismissed || !feedback) return;
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      if (barRef.current) barRef.current.style.width = `${remaining}%`;
      if (elapsed >= AUTO_DISMISS_MS) {
        clearInterval(timerRef.current!);
        handleDismiss();
      }
    }, TICK_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isDismissed, feedback]);

  const handleDismiss = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    localStorage.setItem(`${STORAGE_PREFIX}${dismissKey}`, '1');
    setIsDismissed(true);
    onDismissRef.current?.();
  };

  if (isDismissed || (!isLoading && !feedback)) return null;

  const isPraise = feedback?.type === 'praise';

  return (
    <div
      className={`relative flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm ${
        isPraise ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
      }`}
      role="status"
      aria-live="polite"
    >
      {/* Countdown bar */}
      {!isLoading && (
        <div className="absolute bottom-0 left-0 h-0.5 rounded-b-xl overflow-hidden w-full">
          <div
            ref={barRef}
            className={`h-full w-full ${isPraise ? 'bg-emerald-300' : 'bg-amber-300'}`}
          />
        </div>
      )}

      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${isPraise ? 'text-emerald-500' : 'text-amber-500'}`}>
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isPraise ? (
          <Sparkles className="w-4 h-4" />
        ) : (
          <Lightbulb className="w-4 h-4" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-[10px] font-black uppercase tracking-wide mb-0.5 ${isPraise ? 'text-emerald-600' : 'text-amber-600'}`}>
          🤖 AI Педагошки Коуч
        </p>
        {isLoading ? (
          <div className="h-3 bg-current/10 rounded animate-pulse w-3/4" />
        ) : (
          <p className={`text-xs leading-relaxed font-medium ${isPraise ? 'text-emerald-800' : 'text-amber-800'}`}>
            {feedback?.message}
          </p>
        )}
      </div>

      {/* Dismiss */}
      {!isLoading && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Затвори совет"
          className={`flex-shrink-0 p-0.5 rounded hover:bg-black/5 transition-colors ${isPraise ? 'text-emerald-400' : 'text-amber-400'}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
