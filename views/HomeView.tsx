import { useTour } from '../hooks/useTour';
import React, { useEffect, useState } from 'react';
import { Sparkles, CalendarDays, BarChart2, BookOpen, Radio, Library, Camera } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import type { AIRecommendation } from '../types';
import { RecommendationCard } from '../components/ai/RecommendationCard';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { usePersonalizedRecommendations } from '../hooks/usePersonalizedRecommendations';

import { QuickAIStart } from '../components/home/QuickAIStart';
import { ContinueBrowsing } from '../components/home/ContinueBrowsing';
import { Card } from '../components/common/Card';
import { MonthlyActivityChart } from '../components/dashboard/MonthlyActivityChart';
import { TopicCoverageChart } from '../components/dashboard/TopicCoverageChart';
import { OverallProgress } from '../components/dashboard/OverallProgress';
import { WeeklySchedule } from '../components/dashboard/WeeklySchedule';
import { StandardsCoverageCard } from '../components/dashboard/StandardsCoverageCard';
import { WeakConceptsWidget } from '../components/dashboard/WeakConceptsWidget';
import { usePlanner } from '../contexts/PlannerContext';
import { useLastVisited } from '../contexts/LastVisitedContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { dashboardTourSteps } from '../tours/tour-steps';
import { useProactiveSuggestions } from '../hooks/useProactiveSuggestions';
import { ProactiveSuggestionCard } from '../components/ai/ProactiveSuggestionCard';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { useNavigation } from '../contexts/NavigationContext';
import { ICONS } from '../constants';
import { useLanguage } from '../i18n/LanguageContext';
import { useDailyBrief } from '../hooks/useDailyBrief';
import { DailyBriefCard } from '../components/dashboard/DailyBriefCard';
import { FormativeNextStepCard } from '../components/dashboard/FormativeNextStepCard';
import { SpacedRepDueCard } from '../components/dashboard/SpacedRepDueCard';

// ── Quick Actions strip — 5 most-used teacher actions ────────────────────────
const getQuickActions = (t: any) => [
  { label: t('home.quick.generator'), desc: t('home.quick.generatorDesc'), icon: Sparkles, color: 'bg-indigo-600 hover:bg-indigo-700', action: 'generator' },
  { label: t('home.quick.planner'), desc: t('home.quick.plannerDesc'), icon: CalendarDays, color: 'bg-blue-600 hover:bg-blue-700', action: 'planner' },
  { label: t('home.quick.analytics'), desc: t('home.quick.analyticsDesc'), icon: BarChart2, color: 'bg-violet-600 hover:bg-violet-700', action: 'analytics' },
  { label: t('home.quick.mylessons'), desc: t('home.quick.mylessonsDesc'), icon: Library, color: 'bg-emerald-600 hover:bg-emerald-700', action: 'my-lessons' },
  { label: t('home.quick.livequiz'), desc: t('home.quick.livequizDesc'), icon: Radio, color: 'bg-rose-600 hover:bg-rose-700', action: 'live' },
  { label: t('home.quick.vision'), desc: t('home.quick.visionDesc'), icon: Camera, color: 'bg-teal-600 hover:bg-teal-700', action: 'vision-assessment' },
];



const ChartTabs: React.FC<{
    monthlyActivity: any;
    topicCoverage: any;
    isLoading: boolean;
}> = ({ monthlyActivity, topicCoverage, isLoading }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'activity' | 'topics'>('activity');

    return (
        <Card className="h-full flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-1">
                <div className="flex space-x-6">
                    <button
                        type="button"
                        onClick={() => setActiveTab('activity')}
                        className={`text-sm font-semibold pb-3 -mb-1.5 transition-all duration-200 flex items-center gap-2 ${activeTab === 'activity' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <ICONS.chart className="w-4 h-4" />
                        {t('home.tabs.activity')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('topics')}
                        className={`text-sm font-semibold pb-3 -mb-1.5 transition-all duration-200 flex items-center gap-2 ${activeTab === 'topics' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <ICONS.mindmap className="w-4 h-4" />
                        {t('home.tabs.topics')}
                    </button>
                </div>
            </div>

            <div className="flex-1 relative w-full">
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <SkeletonLoader type="paragraph" />
                    </div>
                ) : (
                    <div className="absolute inset-0 w-full h-full">
                        {activeTab === 'activity' ? (
                            <MonthlyActivityChart data={monthlyActivity} />
                        ) : (
                            <TopicCoverageChart data={topicCoverage} />
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
};

export const HomeView: React.FC = () => {
  const { user } = useAuth();
  const { navigate } = useNavigation();
  const { t } = useLanguage();
  const { getLessonPlan, todaysLesson, tomorrowsLesson } = usePlanner();
  const { lastVisited } = useLastVisited();
  const { monthlyActivity, topicCoverage, overallStats, isLoading: isStatsLoading } = useDashboardStats();
  const { recommendations, isLoading: isRecsLoading, error: recsError } = usePersonalizedRecommendations();
  useTour('dashboard', dashboardTourSteps, !isStatsLoading && !isRecsLoading);
  const { toursSeen, markTourAsSeen } = useUserPreferences();
  const { suggestion, isLoading: isSuggestionLoading, dismissSuggestion } = useProactiveSuggestions();
  const { openGeneratorPanel } = useGeneratorPanel();
  const { brief, isLoading: isBriefLoading, refresh: refreshBrief, weakConcepts, spacedRepDue } = useDailyBrief();

  const handleSuggestionGenerate = () => {
    if (suggestion) {
        openGeneratorPanel({
            selectedGrade: String(suggestion.target.grade),
            selectedTopic: suggestion.target.topicId,
            selectedConcepts: [suggestion.target.concept.id],
            contextType: 'CONCEPT',
            materialType: 'ASSESSMENT',
            customInstruction: `Generate materials based on this proactive suggestion: "${suggestion.text}"`
        });
        dismissSuggestion();
    }
  };

  const firstName = user?.name?.split(' ')[0] || 'Корисник';

  // Macedonian date, first letter capitalised
  const todayFormatted = new Date().toLocaleDateString('mk-MK', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="min-h-full bg-slate-50/70 p-4 md:p-6 max-w-[1600px] mx-auto animate-fade-in space-y-5">

      {/* ── HERO HEADER ──────────────────────────────────────────── */}
      <div
        data-tour="dashboard-header"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-primary via-blue-700 to-indigo-700 px-6 py-6 shadow-lg text-white"
      >
        {/* dot-grid texture overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle,white_1.5px,transparent_0)] [background-size:22px_22px]" />

        <div className="relative flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Date + greeting + today's lesson */}
          <div>
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <ICONS.planner className="w-3.5 h-3.5" />
              {todayFormatted}
            </p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
              Здраво, {firstName}
            </h1>
            {todaysLesson ? (
              <p className="mt-1.5 text-white/80 text-sm flex items-center gap-1.5">
                <ICONS.bookOpen className="w-4 h-4 flex-shrink-0" />
                <span>Денес: <span className="text-white font-semibold">{todaysLesson.title}</span></span>
              </p>
            ) : (
              <p className="mt-1.5 text-white/60 text-sm">
                Нема закажани лекции денес —{' '}
                <button
                  type="button"
                  onClick={() => navigate('/planner')}
                  className="underline hover:text-white transition-colors"
                >
                  додај во планерот
                </button>
              </p>
            )}
          </div>

          {/* Primary CTAs */}
          <div className="flex flex-row sm:flex-col gap-2 sm:items-end flex-shrink-0">
            <button
              type="button"
              onClick={() => openGeneratorPanel({})}
              className="flex items-center gap-2 bg-white text-brand-primary text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-white/90 transition shadow-md active:scale-95 whitespace-nowrap"
            >
              <ICONS.sparkles className="w-4 h-4" />
              AI Генератор
            </button>
            <button
              type="button"
              onClick={() => navigate('/planner/lesson/new')}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition border border-white/20 whitespace-nowrap"
            >
              <ICONS.plus className="w-4 h-4" />
              Нова подготовка
            </button>
          </div>
        </div>
      </div>

      {/* ── П2: TEACHER DAILY BRIEF ──────────────────────────────────── */}
      {(isBriefLoading || brief) && (
        <DailyBriefCard brief={brief} isLoading={isBriefLoading} onRefresh={refreshBrief} />
      )}

      {/* ── П-А: FORMATIVE NEXT STEP ─────────────────────────────────── */}
      <FormativeNextStepCard weakConcepts={weakConcepts} />

      {/* ── П-Д: SPACED REP DUE ──────────────────────────────────────── */}
      <SpacedRepDueCard due={spacedRepDue} />

      {/* ── QUICK ACTIONS STRIP ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {getQuickActions(t).map(({ label, desc, icon: Icon, color, action }) => (
          <button
            key={action}
            type="button"
            onClick={() => {
              if (action === 'generator') openGeneratorPanel({});
              else if (action === 'live') navigate('/live/host');
              else navigate(`/${action}`);
            }}
            className={`${color} text-white rounded-xl p-4 text-left transition-all duration-300 ease-out shadow-sm hover:shadow-lg hover:-translate-y-1 active:scale-[0.97] group`}
          >
            <Icon className="w-5 h-5 mb-2 opacity-90 group-hover:scale-110 group-hover:opacity-100 transition-all duration-300" />
            <p className="font-bold text-sm leading-tight">{label}</p>
            <p className="text-white/70 text-xs mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {/* Proactive AI Suggestion */}
      {!isSuggestionLoading && suggestion && (
        <div className="animate-slide-in-from-right">
            <ProactiveSuggestionCard
                suggestionText={suggestion.text}
                onDismiss={dismissSuggestion}
                onGenerate={handleSuggestionGenerate}
            />
        </div>
      )}
      
      <div className="mb-6 animate-fade-in">
        <WeakConceptsWidget />
      </div>

      {/* ── BENTO GRID ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">

        {/* CELL 1: Quick AI Start */}
        <div className="md:col-span-1 lg:col-span-1 row-span-2 h-full" data-tour="dashboard-quick-start">
            <QuickAIStart todaysLesson={todaysLesson} tomorrowsLesson={tomorrowsLesson} getLessonPlan={getLessonPlan} />
        </div>

        {/* CELL 2: Stats Overview */}
        <div className="md:col-span-2 lg:col-span-2 h-full" data-tour="dashboard-progress">
            {isStatsLoading ? (
                <Card><SkeletonLoader type="paragraph" /></Card>
            ) : (
                <OverallProgress stats={overallStats} />
            )}
        </div>

        {/* CELL 3: Weekly Schedule */}
        <div className="md:col-span-3 lg:col-span-1 md:row-span-2 h-full min-h-[300px]" data-tour="dashboard-schedule">
            <WeeklySchedule />
        </div>

        {/* CELL 4: Charts */}
        <div className="md:col-span-2 lg:col-span-2 h-80">
            <ChartTabs monthlyActivity={monthlyActivity} topicCoverage={topicCoverage} isLoading={isStatsLoading} />
        </div>

        {/* CELL 5: Standards Coverage */}
        <div className="md:col-span-1" data-tour="dashboard-standards">
            {isStatsLoading ? (
                <Card><SkeletonLoader type="paragraph" /></Card>
            ) : (
                <StandardsCoverageCard data={overallStats.gradePercentages} />
            )}
        </div>

        {/* CELL 6: Continue Browsing */}
        <div className="md:col-span-1">
            <ContinueBrowsing lastVisited={lastVisited} />
        </div>

        {/* CELL 7: AI Recommendations */}
        <div className="md:col-span-2 lg:col-span-3" data-tour="dashboard-recommendations">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-brand-primary flex items-center gap-2">
                    <ICONS.sparkles className="w-5 h-5 text-brand-accent" />
                    AI Препораки
                </h2>
                <button
                    type="button"
                    onClick={() => window.location.hash = '#/explore'}
                    className="text-xs font-bold text-brand-secondary hover:bg-blue-50 px-3 py-1.5 rounded-full transition-colors"
                >
                    Истражи сè &rarr;
                </button>
            </div>
            {isRecsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card><SkeletonLoader type="paragraph"/></Card>
                    <Card><SkeletonLoader type="paragraph"/></Card>
                </div>
            ) : recsError ? (
                <Card className="flex items-center justify-center bg-red-50 border-dashed border-2 border-red-200 py-8">
                    <div className="text-center">
                        <ICONS.alertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                        <p className="text-red-600 font-medium">Препораките не може да се вчитаат</p>
                        <p className="text-red-400 text-sm mt-1">Проверете ја врската и обновете ја страницата.</p>
                    </div>
                </Card>
            ) : recommendations.length === 0 ? (
                <Card className="flex items-center justify-center bg-gray-50 border-dashed border-2 border-gray-200 py-8">
                    <div className="text-center">
                        <ICONS.sparkles className="w-8 h-8 text-brand-accent mx-auto mb-2 opacity-50" />
                        <p className="text-gray-500 font-medium">{t('dashboard_no_recommendations')}</p>
                        <p className="text-gray-400 text-sm mt-1">{t('dashboard_add_lessons_for_suggestions')}</p>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recommendations.slice(0, 3).map((rec: AIRecommendation, index: number) => (
                        <RecommendationCard key={`${rec.category}-${rec.title}-${index}`} recommendation={rec} />
                    ))}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};
