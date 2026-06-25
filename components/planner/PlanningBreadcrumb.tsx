import React from 'react';
import { usePlanning } from '../../contexts/PlanningContext';
import { useNavigation } from '../../contexts/NavigationContext';

interface Crumb {
  label: string;
  icon: string;
  path?: string;
  onClick?: () => void;
  active?: boolean;
}

export const PlanningBreadcrumb: React.FC = () => {
  const { annualPlanId, grade, themeName, topic } = usePlanning();
  const { navigate } = useNavigation();

  if (!annualPlanId && !grade && !themeName) return null;

  const crumbs: Crumb[] = [
    {
      label: 'Планирање',
      icon: '🗓',
      onClick: () => navigate('/annual-plan'),
    },
  ];

  if (annualPlanId) {
    crumbs.push({
      label: grade ? `${grade.level}. одделение` : 'Годишен план',
      icon: '📅',
      onClick: () => navigate('/annual-plan'),
    });
  }

  if (themeName || topic) {
    crumbs.push({
      label: themeName ?? topic?.title ?? '',
      icon: '📚',
      active: !grade,
    });
  }

  if (grade && topic && (themeName || topic)) {
    crumbs[crumbs.length - 1].active = true;
  }

  if (crumbs.length <= 1) return null;

  return (
    <nav
      aria-label="Planning hierarchy"
      className="flex items-center gap-1 text-xs text-gray-500 mb-3 flex-wrap print:hidden"
    >
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className="text-gray-300 select-none">›</span>
          )}
          {crumb.onClick && !crumb.active ? (
            <button
              type="button"
              onClick={crumb.onClick}
              className="flex items-center gap-1 hover:text-brand-primary transition font-medium"
            >
              <span>{crumb.icon}</span>
              <span className="underline underline-offset-2 decoration-dotted">{crumb.label}</span>
            </button>
          ) : (
            <span className={`flex items-center gap-1 ${crumb.active ? 'text-gray-900 font-semibold' : ''}`}>
              <span>{crumb.icon}</span>
              <span>{crumb.label}</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
