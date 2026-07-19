import React from 'react';
import { usePlanning } from '../../contexts/PlanningContext';
import { useNavigation } from '../../contexts/NavigationContext';

type PlanStep = 'annual' | 'thematic' | 'weekly' | 'lesson';

interface Step {
  key: PlanStep;
  label: string;
  shortLabel: string;
  icon: string;
  route: string;
}

const STEPS: Step[] = [
  { key: 'annual',   label: 'Годишна програма', shortLabel: 'Годишна',  icon: '📅', route: '/annual-planner' },
  { key: 'thematic', label: 'Тематски план',     shortLabel: 'Тематска', icon: '📚', route: '/annual-planner' },
  { key: 'weekly',   label: 'Неделен план',      shortLabel: 'Неделна',  icon: '🗓', route: '/weekly-plan' },
  { key: 'lesson',   label: 'Подготовка за час', shortLabel: 'Час',      icon: '✏️', route: '/planner/lesson/new' },
];

const STEP_INDEX: Record<PlanStep, number> = {
  annual: 0, thematic: 1, weekly: 2, lesson: 3,
};

interface Props {
  currentStep: PlanStep;
}

export const PlanningChainBar: React.FC<Props> = ({ currentStep }) => {
  const { annualPlanId, themeName, weekRange } = usePlanning();
  const { navigate } = useNavigation();

  const currentIdx = STEP_INDEX[currentStep];

  const isDone = (step: PlanStep): boolean => {
    switch (step) {
      case 'annual':   return !!annualPlanId;
      case 'thematic': return !!themeName;
      case 'weekly':   return !!weekRange;
      case 'lesson':   return false; // lesson is always "current" or "upcoming"
    }
  };

  const getStatus = (stepKey: PlanStep, stepIdx: number): 'done' | 'current' | 'skipped' | 'upcoming' => {
    if (stepIdx === currentIdx) return 'current';
    if (stepIdx < currentIdx) return isDone(stepKey) ? 'done' : 'skipped';
    return 'upcoming';
  };

  return (
    <nav
      aria-label="Планирачки синџир"
      className="print:hidden mb-4 overflow-x-auto"
    >
      <div className="flex items-center min-w-max sm:min-w-0 gap-0">
        {STEPS.map((step, idx) => {
          const status = getStatus(step.key, idx);
          const isLast = idx === STEPS.length - 1;

          const stepClasses = {
            done:     'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
            current:  'bg-blue-50 border-blue-400 text-blue-700 ring-2 ring-blue-300 ring-offset-1',
            skipped:  'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
            upcoming: 'bg-gray-50 border-gray-200 text-gray-400 cursor-default',
          }[status];

          const iconClasses = {
            done:     'bg-emerald-100',
            current:  'bg-blue-100',
            skipped:  'bg-amber-100',
            upcoming: 'bg-gray-100',
          }[status];

          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                onClick={() => status !== 'upcoming' && navigate(step.route)}
                disabled={status === 'upcoming'}
                aria-current={status === 'current' ? 'step' : undefined}
                title={status === 'skipped' ? `${step.label} (не е зачувано)` : step.label}
                className={`
                  flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200
                  ${stepClasses}
                `}
              >
                {/* Status dot */}
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${iconClasses}`}>
                  {status === 'done'
                    ? '✓'
                    : status === 'current'
                    ? <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse block" />
                    : status === 'skipped'
                    ? '?'
                    : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 block" />}
                </span>
                <span className="hidden sm:inline">{step.shortLabel}</span>
                <span className="sm:hidden">{step.icon}</span>
              </button>

              {/* Connector arrow */}
              {!isLast && (
                <svg className="flex-shrink-0 w-4 h-4 text-gray-300 mx-0.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
};
