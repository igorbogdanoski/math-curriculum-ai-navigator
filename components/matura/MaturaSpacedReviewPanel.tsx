/**
 * MaturaSpacedReviewPanel (T3.1)
 *
 * Shows a compact "Денешно повторување — N прашања" CTA inside MaturaPortalView.
 * The count comes from `useMaturaSpacedQueue` and the click navigates to
 * /matura-practice?mode=spaced where the practice view (when wired) filters
 * its question pool down to the due queue.
 */
import React from 'react';
import { Repeat, ArrowRight } from 'lucide-react';
import { Card } from '../common/Card';
import { useNavigation } from '../../contexts/NavigationContext';
import { useMaturaSpacedQueue } from '../../hooks/useMaturaSpacedQueue';

export interface MaturaSpacedReviewPanelProps {
  /** Optional override path. Defaults to /matura-practice?mode=spaced. */
  practicePath?: string;
}

export const MaturaSpacedReviewPanel: React.FC<MaturaSpacedReviewPanelProps> = ({
  practicePath = '/matura-practice?mode=spaced',
}) => {
  const { navigate } = useNavigation();
  const { count, loading } = useMaturaSpacedQueue();

  if (loading) {
    return (
      <div data-testid="matura-spaced-panel-loading">
        <Card className="p-4 animate-pulse">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-3 w-56 bg-gray-100 rounded mt-2" />
        </Card>
      </div>
    );
  }

  if (count === 0) {
    return (
      <div data-testid="matura-spaced-panel-empty">
        <Card className="p-4 flex items-center gap-3 border-dashed border-2 border-emerald-200">
          <Repeat className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-gray-700 text-sm">Нема активни повторувања</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Кога ќе добиеш задача погрешно, автоматски ќе ја закажеме за повторување (SM-2 алгоритам).
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="matura-spaced-panel">
    <Card className="p-4 border-2 border-rose-200 bg-rose-50/40">
      <button
        type="button"
        onClick={() => navigate(practicePath)}
        className="w-full flex items-center gap-3 text-left"
      >
        <Repeat className="w-7 h-7 text-rose-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-rose-700">
            Денешно повторување — {count} {count === 1 ? 'прашање' : 'прашања'}
          </p>
          <p className="text-xs text-rose-600/80 mt-0.5">
            Spaced Repetition (SM-2): повтори ги задачите што ги пропуштил/а — пред да исчезнат од меморијата.
          </p>
        </div>
        <ArrowRight className="w-4 h-4 text-rose-400 shrink-0" />
      </button>
    </Card>
    </div>
  );
};
