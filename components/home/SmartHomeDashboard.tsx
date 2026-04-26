import React from 'react';
import { Target } from 'lucide-react';
import { useSmartDashboard } from '../../hooks/useSmartDashboard';
import { ActionablePriorityCard } from './ActionablePriorityCard';
import { ClassHealthSummary } from './ClassHealthSummary';
import { SkeletonLoader } from '../common/SkeletonLoader';
import type { WeakConcept } from '../../hooks/useDailyBrief';

interface SmartHomeDashboardProps {
  weakConcepts: WeakConcept[];
}

export const SmartHomeDashboard: React.FC<SmartHomeDashboardProps> = ({ weakConcepts }) => {
  const { actions, criticalCount, highCount, isLoading } = useSmartDashboard(weakConcepts);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
        <SkeletonLoader type="paragraph" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-brand-primary" />
          <span className="text-sm font-extrabold text-slate-800">Приоритети на класот</span>
        </div>
        <ClassHealthSummary
          criticalCount={criticalCount}
          highCount={highCount}
          totalActions={actions.length}
        />
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-slate-500 py-1">
          Нема итни акции — продолжи со планираните активности.
        </p>
      ) : (
        <div className="space-y-2">
          {actions.map(action => (
            <ActionablePriorityCard key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
};
