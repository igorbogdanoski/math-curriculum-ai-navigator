import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStats } from '../hooks/useDashboardStats';

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
import { usePlanner } from '../contexts/PlannerContext';
import { useLastVisited } from '../contexts/LastVisitedContext';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { dashboardTourSteps } from '../tours/tour-steps';
import { useProactiveSuggestions } from '../hooks/useProactiveSuggestions';
import { ProactiveSuggestionCard } from '../components/ai/ProactiveSuggestionCard';
import { useGeneratorPanel } from '../contexts/GeneratorPanelContext';
import { ICONS } from '../constants';

declare var introJs: any;

const ChartTabs: React.FC<{ 
    monthlyActivity: any; 
    topicCoverage: any; 
    isLoading: boolean 
}> = ({ monthlyActivity, topicCoverage, isLoading }) => {
    const [activeTab, setActiveTab] = useState<'activity' | 'topics'>('activity');

    return (
        <Card className="h-full flex flex-col min-h-[320px]">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-1">
                <div className="flex space-x-6">
                    <button 
                        onClick={() => setActiveTab('activity')}
                        className={`text-sm font-semibold pb-3 -mb-1.5 transition-all duration-200 flex items-center gap-2 ${activeTab === 'activity' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <ICONS.chart className="w-4 h-4" />
                        Месечна Активност
                    </button>
                    <button 
                        onClick={() => setActiveTab('topics')}
                        className={`text-sm font-semibold pb-3 -mb-1.5 transition-all duration-200 flex items-center gap-2 ${activeTab === 'topics' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <ICONS.mindmap className="w-4 h-4" />
                        Покриеност на Теми
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
  const { getLessonPlan, todaysLesson, tomorrowsLesson } = usePlanner();
  const { lastVisited } = useLastVisited();
  const { monthlyActivity, topicCoverage, overallStats, isLoading: isStatsLoading } = useDashboardStats();
  const { recommendations, isLoading: isRecsLoading, error: recsError } = usePersonalizedRecommendations();
  const { toursSeen, markTourAsSeen } = useUserPreferences();
  const { suggestion, isLoading: isSuggestionLoading, dismissSuggestion } = useProactiveSuggestions();
  const { openGeneratorPanel } = useGeneratorPanel();
  
  useEffect(() => {
    // Only start tour if data is loaded and user hasn't seen it
    if (toursSeen.dashboard === true || typeof introJs === 'undefined' || isStatsLoading || isRecsLoading) return;

    // Short timeout to ensure DOM paint is complete after loading becomes false
    const timer = setTimeout(() => {
        const tour = introJs();
        tour.setOptions({
            steps: dashboardTourSteps,
            showProgress: true,
            showBullets: true,
            showStepNumbers: true,
            nextLabel: 'Следно',
            prevLabel: 'Претходно',
            doneLabel: 'Готово',
        });
        tour.oncomplete(() => markTourAsSeen('dashboard'));
        tour.onexit(() => markTourAsSeen('dashboard'));
        tour.start();
    }, 500); 

    return () => clearTimeout(timer);
  }, [toursSeen, markTourAsSeen, isStatsLoading, isRecsLoading]);

  const handleSuggestionGenerate = () => {
    if (suggestion) {
        openGeneratorPanel({
            grade: String(suggestion.target.grade),
            topicId: suggestion.target.topicId,
            conceptId: suggestion.target.concept.id,
            contextType: 'CONCEPT',
            materialType: 'ASSESSMENT',
            customInstruction: `Generate materials based on this proactive suggestion: "${suggestion.text}"`
        });
        dismissSuggestion();
    }
  };

  const firstName = user?.name.split(' ')[0];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto animate-fade-in space-y-6">
      
      {/* Modern Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <header data-tour="dashboard-header">
            <h1 className="text-3xl md:text-4xl font-extrabold text-brand-primary tracking-tight">
                Здраво, <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-accent">{firstName}</span>! 👋
            </h1>
            <p className="text-gray-500 text-md mt-1">Подготвени за нов продуктивен ден?</p>
        </header>
      </div>

      {/* Proactive AI Suggestion Banner */}
      {!isSuggestionLoading && suggestion && (
        <div className="animate-slide-in-from-right">
            <ProactiveSuggestionCard
                suggestionText={suggestion.text}
                onDismiss={dismissSuggestion}
                onGenerate={handleSuggestionGenerate}
            />
        </div>
      )}

      {/* BENTO GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* CELL 1: Launchpad (Tall on desktop) */}
        <div className="md:col-span-1 lg:col-span-1 row-span-2 h-full" data-tour="dashboard-quick-start">
             <QuickAIStart todaysLesson={todaysLesson} tomorrowsLesson={tomorrowsLesson} getLessonPlan={getLessonPlan} />
        </div>

        {/* CELL 2: Stats Overview (Wide on desktop) */}
        <div className="md:col-span-2 lg:col-span-2 h-full" data-tour="dashboard-progress">
             {isStatsLoading ? (
                <Card><SkeletonLoader type="paragraph" /></Card>
            ) : (
                <OverallProgress stats={overallStats} />
            )}
        </div>

         {/* CELL 3: Schedule (Tall column on large screens) */}
         <div className="md:col-span-3 lg:col-span-1 md:row-span-2 h-full min-h-[300px]" data-tour="dashboard-schedule">
             <WeeklySchedule />
        </div>

        {/* CELL 4: Charts (Combined Tabbed Interface) */}
        <div className="md:col-span-2 lg:col-span-2 h-80">
            <ChartTabs monthlyActivity={monthlyActivity} topicCoverage={topicCoverage} isLoading={isStatsLoading} />
        </div>
        
         {/* CELL 5: Continue Browsing */}
         <div className="md:col-span-1">
            <ContinueBrowsing lastVisited={lastVisited} />
         </div>

         {/* CELL 6: Recommendations (Wide Bottom) */}
         <div className="md:col-span-2 lg:col-span-3" data-tour="dashboard-recommendations">
            {isRecsLoading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Card><SkeletonLoader type="paragraph"/></Card><Card><SkeletonLoader type="paragraph"/></Card></div>
            ) : recsError || recommendations.length === 0 ? (
                <Card className="h-full flex items-center justify-center bg-gray-50 border-dashed border-2 border-gray-200 py-8">
                    <div className="text-center">
                        <ICONS.check className="w-8 h-8 text-green-500 mx-auto mb-2" />
                        <p className="text-gray-500 font-medium">Сите препораки се завршени за денес!</p>
                    </div>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
                    {recommendations.slice(0, 3).map((rec, index) => (
                        <RecommendationCard key={index} recommendation={rec} />
                    ))}
                </div>
            )}
         </div>
      </div>
    </div>
  );
};