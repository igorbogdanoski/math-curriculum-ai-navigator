import React, { useState, useEffect } from 'react';
import { Route, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useMaturaStats } from '../../hooks/useMaturaStats';
import { useMaturaReadinessPath } from '../../hooks/useMaturaReadinessPath';

/**
 * Compact "Следен чекор кон матура" widget for HomeView > Today Focus.
 * Only renders when the student has matura attempts and ≥1 weak concept.
 * Lazy-loads stats to avoid blocking the dashboard cold path.
 */
export const MaturaNextStepWidget: React.FC = () => {
  const { navigate } = useNavigation();
  const [enabled, setEnabled] = useState(false);

  // Defer mount by one tick so it doesn't block hero render
  useEffect(() => {
    const t = setTimeout(() => setEnabled(true), 600);
    return () => clearTimeout(t);
  }, []);

  if (!enabled) return null;

  return <MaturaNextStepWidgetInner onNavigate={navigate} />;
};

const MaturaNextStepWidgetInner: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const stats = useMaturaStats();
  const readiness = useMaturaReadinessPath(stats.weakConcepts);

  if (stats.loading || !stats.hasAttempts || readiness.steps.length === 0) return null;

  const topStep = readiness.steps[0];
  const remaining = readiness.steps.length;

  return (
    <div className="flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-4 py-3">
      <Route className="w-4 h-4 text-violet-600 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-violet-900">
          Следен чекор кон матура
        </p>
        <p className="text-xs text-violet-700 mt-0.5 truncate">
          {readiness.hasExamDate
            ? `${readiness.daysUntilExam} дена до испит · `
            : ''}
          {remaining === 1
            ? `Фокусирај се на: `
            : `${remaining} концепти · прв: `}
          <strong>{topStep.conceptTitle}</strong>
          {' '}
          {topStep.status === 'uncovered' ? (
            <span className="inline-flex items-center gap-0.5 text-rose-600 font-semibold">
              <AlertTriangle className="w-3 h-3" /> непокриен
            </span>
          ) : (
            <span className="text-amber-600 font-semibold">{topStep.pct.toFixed(0)}%</span>
          )}
        </p>
      </div>
      {readiness.onTrack ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      )}
      <button
        type="button"
        onClick={() => onNavigate('/matura-stats')}
        className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition"
      >
        Патека <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
