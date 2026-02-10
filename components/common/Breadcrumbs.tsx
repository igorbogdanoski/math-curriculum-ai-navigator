import React from 'react';
import { ICONS } from '../../constants';
import { useNavigation } from '../../contexts/NavigationContext';

export interface Breadcrumb {
  label: string;
  path: string;
}

interface BreadcrumbsProps {
  crumbs: Breadcrumb[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ crumbs }) => {
  const { navigate } = useNavigation();
  if (crumbs.length <= 1) {
    return null; // Don't render breadcrumbs on the home page
  }

  return (
    <nav aria-label="breadcrumb" className="px-8 pt-6 pb-2 no-print">
      <ol className="flex items-center space-x-2 text-sm text-gray-500">
        {crumbs.map((crumb: Breadcrumb, index: number) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center">
              {index > 0 && (
                <ICONS.chevronRight className="w-4 h-4 text-gray-400 mr-2" />
              )}
              {isLast ? (
                <span className="font-semibold text-brand-text truncate max-w-xs" aria-current="page" title={crumb.label}>
                  {crumb.label}
                </span>
              ) : (
                <a
                  href={`#${crumb.path}`}
                  onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    e.preventDefault();
                    navigate(crumb.path);
                  }}
                  className="hover:underline hover:text-brand-secondary"
                  title={crumb.label}
                >
                  {crumb.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
