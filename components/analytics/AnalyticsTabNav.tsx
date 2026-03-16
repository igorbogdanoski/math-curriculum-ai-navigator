/**
 * AnalyticsTabNav — primary + secondary tab navigation with "More" dropdown.
 * Extracted from TeacherAnalyticsView for single-responsibility.
 */
import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export type AnalyticsTab =
  | 'overview' | 'trend' | 'students' | 'standards' | 'concepts' | 'grades'
  | 'alerts' | 'groups' | 'live' | 'classes' | 'questionBank' | 'coverage'
  | 'assignments' | 'league' | 'cohort';

interface AnalyticsTabNavProps {
  activeTab: AnalyticsTab;
  showMoreTabs: boolean;
  onTabChange: (tab: AnalyticsTab) => void;
  onToggleMore: () => void;
}

export const AnalyticsTabNav: React.FC<AnalyticsTabNavProps> = ({
  activeTab,
  showMoreTabs,
  onTabChange,
  onToggleMore,
}) => {
  const { t } = useLanguage();

  const PRIMARY_TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'overview', label: t('analytics.tabs.overview') },
    { id: 'students', label: t('analytics.tabs.students') },
    { id: 'concepts', label: t('analytics.tabs.concepts') },
    { id: 'alerts', label: '⚠️ ' + t('analytics.tabs.alerts') },
  ];

  const SECONDARY_TABS: { id: AnalyticsTab; label: string }[] = [
    { id: 'trend', label: t('analytics.tabs.trend') },
    { id: 'grades', label: t('analytics.tabs.grades') },
    { id: 'standards', label: t('analytics.tabs.standards') },
    { id: 'groups', label: '👥 ' + t('analytics.tabs.groups') },
    { id: 'live', label: '🔴 Live' },
    { id: 'classes', label: '🏫 Одделенија' },
    { id: 'questionBank', label: '📚 ' + t('analytics.tabs.questionBank') },
    { id: 'coverage', label: '📊 ' + t('analytics.tabs.coverage') },
    { id: 'assignments', label: '📋 ' + t('analytics.tabs.assignments') },
    { id: 'league', label: '🏆 ' + t('analytics.tabs.league') },
    { id: 'cohort', label: '📊 Кохортна анализа' },
  ];

  const activeSecondary = SECONDARY_TABS.find(tab => tab.id === activeTab);

  return (
    <div className="mb-6 -mx-1">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {PRIMARY_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { onTabChange(tab.id); if (showMoreTabs) onToggleMore(); }}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-slate-800 shadow'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMore}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-bold transition whitespace-nowrap ${
              activeSecondary
                ? 'bg-white text-slate-800 shadow'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {activeSecondary ? activeSecondary.label : '+ Повеќе'}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showMoreTabs ? 'rotate-180' : ''}`} />
          </button>
          {showMoreTabs && (
            <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[180px]">
              {SECONDARY_TABS.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { onTabChange(tab.id); onToggleMore(); }}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
