import { useTour } from '../hooks/useTour';
import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, CalendarDays, BarChart2, BookOpen, Radio, Library, Camera, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import type { AIRecommendation } from '../types';
import { RecommendationCard } from '../components/ai/RecommendationCard';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { usePersonalizedRecommendations } from '../hooks/usePersonalizedRecommendations';
import { isDailyQuotaKnownExhausted } from '../services/geminiService';

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

const DAILY_QUOTES = [
  {
    text: 'Суштината на математиката не е да ги направи едноставните работи комплицирани, туку комплицираните работи едноставни.',
    author: 'Стенли Гудер',
  },
  {
    text: 'Математиката е јазикот со кој учиме да размислуваме јасно.',
    author: 'Хуан Луна',
  },
  {
    text: 'Секој тежок проблем станува полесен кога го поделиш на мали чекори.',
    author: 'Џорџ Полиа',
  },
  {
    text: 'Учењето не е трка; важно е секој ден да се движиш напред.',
    author: 'Карол Двек',
  },
  {
    text: 'Добро поставено прашање е половина од решението.',
    author: 'Рене Декарт',
  },
];



const ChartTabs: React.FC<{
    monthlyActivity: any;
    topicCoverage: any;
    isLoading: boolean;
}> = ({ monthlyActivity, topicCoverage, isLoading }) => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'activity' | 'topics'>('activity');

    return (
        <Card className="flex h-full min-h-[360px] flex-col overflow-hidden">
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

            <div className="flex min-h-[280px] flex-1 w-full">
                {isLoading ? (
                <div className="flex h-full w-full items-center justify-center">
                        <SkeletonLoader type="paragraph" />
                    </div>
                ) : (
                <div className="h-full w-full overflow-hidden">
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
  // Lazy-load recommendations — not critical path, fetch after first render
  const [recsEnabled, setRecsEnabled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setRecsEnabled(true), 800);
    return () => clearTimeout(timer);
  }, []);
  const { recommendations, isLoading: isRecsLoading, error: recsError } = usePersonalizedRecommendations(recsEnabled);
  const isQuotaExhausted = isDailyQuotaKnownExhausted();
  useTour('dashboard', dashboardTourSteps, !isStatsLoading);
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

  const quickActions = useMemo(() => getQuickActions(t), [t]);

  const featuredTools = useMemo(
    () => [
      {
        title: 'Матура',
        description: 'Симулирај го ДИМ испитот, вежбај адаптивно по концепти и следи го напредокот со M5 аналитика.',
        cta: 'Отвори матура',
        action: () => navigate('/matura'),
        icon: ICONS.education,
        accent: 'text-rose-700 bg-rose-50 border-rose-100',
      },
      {
        title: 'Екстракција од Видео',
        description: 'Внеси YouTube/Vimeo линк и извлечи наставно сценарио со AI preview чекор.',
        cta: 'Отвори алатка',
        action: () => openGeneratorPanel({ materialType: 'VIDEO_EXTRACTOR', contextType: 'SCENARIO' }),
        icon: ICONS.gallery,
        accent: 'text-blue-700 bg-blue-50 border-blue-100',
      },
      {
        title: 'Дигитална Библиотека',
        description: 'Прегледај, филтрирај и организирај ги зачуваните материјали по тема, DoK и тежина.',
        cta: 'Отвори библиотека',
        action: () => navigate('/library'),
        icon: ICONS.bookOpen,
        accent: 'text-indigo-700 bg-indigo-50 border-indigo-100',
      },
      {
        title: 'Генератор на Тестови',
        description: 'Селектирај задачи од библиотека и генерирај печатлив тест со професионален изглед.',
        cta: 'Креирај тест',
        action: () => navigate('/test-generator'),
        icon: ICONS.quiz,
        accent: 'text-purple-700 bg-purple-50 border-purple-100',
      },
    ],
    [navigate, openGeneratorPanel]
  );

  const teacherToolboxCards = useMemo(
    () => [
      { title: 'Assessment', subtitle: 'Прашања со DoK/Bloom', pedagogy: 'Формативна проверка', impact: '5-10 мин', icon: ICONS.assessment, action: () => openGeneratorPanel({ materialType: 'ASSESSMENT' }), accent: 'text-cyan-700 bg-cyan-50 border-cyan-100' },
      { title: 'Quiz', subtitle: 'Брз квиз за час', pedagogy: 'Exit ticket', impact: '3-5 мин', icon: ICONS.quiz, action: () => openGeneratorPanel({ materialType: 'QUIZ' }), accent: 'text-blue-700 bg-blue-50 border-blue-100' },
      { title: 'Presentation', subtitle: 'Слајдови за настава', pedagogy: 'Визуелно објаснување', impact: '10-15 мин', icon: ICONS.document, action: () => openGeneratorPanel({ materialType: 'PRESENTATION' }), accent: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
      { title: 'Flashcards', subtitle: 'Повторување и вежба', pedagogy: 'Spaced practice', impact: '5-8 мин', icon: ICONS.flashcards, action: () => openGeneratorPanel({ materialType: 'FLASHCARDS' }), accent: 'text-violet-700 bg-violet-50 border-violet-100' },
      { title: 'Worked Example', subtitle: 'Чекор по чекор модел', pedagogy: 'I do → We do', impact: '8-12 мин', icon: ICONS.lightbulb, action: () => openGeneratorPanel({ materialType: 'WORKED_EXAMPLE' }), accent: 'text-amber-700 bg-amber-50 border-amber-100' },
      { title: 'Learning Path', subtitle: 'Персонализирана патека', pedagogy: 'Диференцирана настава', impact: '15+ мин', icon: ICONS.mindmap, action: () => openGeneratorPanel({ materialType: 'LEARNING_PATH' }), accent: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
    ],
    [openGeneratorPanel]
  );

  const hasWeakSignals = (weakConcepts?.length ?? 0) > 0 || (spacedRepDue?.length ?? 0) > 0;

  const dailyQuote = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / 86400000);
    return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
  }, []);

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

      {/* ── МИСЛА НА ДЕНОТ + FEATURED TOOLS ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* Quote bubble — 1/4 width on lg+ */}
        <div className="lg:col-span-1 relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-cyan-500 p-5 shadow-md text-white flex flex-col justify-between min-h-[220px]">
          {/* decorative circles */}
          <div className="pointer-events-none absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute bottom-2 -left-6 w-20 h-20 rounded-full bg-white/5" />
          {/* label */}
          <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">Мисла на денот</p>
          {/* big quote mark */}
          <span className="absolute top-4 right-5 text-7xl font-serif text-white/10 leading-none select-none" aria-hidden="true">"</span>
          {/* quote text */}
          <p className="relative text-sm font-semibold leading-relaxed text-white/95 italic flex-1 min-h-[80px]">
            {dailyQuote.text}
          </p>
          {/* tail bubble */}
          <div className="mt-3 flex flex-col items-start gap-2">
            <span className="text-xs font-bold text-white/70 leading-tight">— {dailyQuote.author}</span>
            <button
              type="button"
              onClick={() => navigate('/academy')}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-2 rounded-full transition"
            >
              <ICONS.play className="w-3 h-3" />
              Академија
            </button>
          </div>
          {/* speech bubble tail */}
          <div className="absolute -bottom-2.5 left-8 w-4 h-4 bg-cyan-500 rotate-45 rounded-sm" />
        </div>

        {/* Featured tools grid — 3/4 width on lg+ */}
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featuredTools.map((tool) => {
              const ToolIcon = tool.icon;
              return (
                <button
                  key={tool.title}
                  type="button"
                  onClick={tool.action}
                  className={`group flex flex-col gap-3 p-4 bg-white border rounded-xl hover:shadow-md hover:border-brand-primary/30 transition-all duration-200 text-left min-h-[140px] ${tool.accent}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${tool.accent}`}>
                      <ToolIcon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 group-hover:text-brand-primary transition-colors leading-tight mb-1">{tool.title}</p>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{tool.description}</p>
                  </div>
                  <span className="text-xs font-bold text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity">→ {t('common.learn_more') || 'Отвори'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="space-y-3" aria-label="Today Focus">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2.5 py-1">Today Focus</span>
          <p className="text-xs text-slate-500">Најважните сигнали и обврски за денес.</p>
        </div>

        {/* ── AI QUOTA BANNER ──────────────────────────────────────────── */}
        {isQuotaExhausted && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-800 text-sm">
            <Zap className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span><strong>Дневниот AI лимит е достигнат.</strong> Генерирањето ќе се обнови во <strong>09:00 часот</strong> (МКВ). Во меѓувреме можеш да ги прегледуваш зачуваните материјали.</span>
          </div>
        )}

        {/* ── П2: TEACHER DAILY BRIEF ──────────────────────────────────── */}
        {(isBriefLoading || brief) && (
          <DailyBriefCard brief={brief} isLoading={isBriefLoading} onRefresh={refreshBrief} />
        )}

        {/* ── П-А: FORMATIVE NEXT STEP ─────────────────────────────────── */}
        <FormativeNextStepCard weakConcepts={weakConcepts} />

        {/* ── П-Д: SPACED REP DUE ──────────────────────────────────────── */}
        <SpacedRepDueCard due={spacedRepDue} />
      </section>

      <section className="space-y-3" aria-label="Priority Actions">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2.5 py-1">Priority Actions</span>
          <p className="text-xs text-slate-500">Најбрзи патеки до генерација, assignment и акција.</p>
        </div>

        {/* ── QUICK ACTIONS STRIP ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map(({ label, desc, icon: Icon, color, action }) => (
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

        <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm md:text-base font-extrabold text-slate-800 tracking-tight">Teacher Toolbox</h2>
            <span className="text-xs font-semibold text-slate-500">Wave A</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">Избери алатка според педагошка цел: формативна проверка, повторување или диференцирана поддршка.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {teacherToolboxCards.map((tool, index) => {
              const ToolIcon = tool.icon;
              const isRecommended = hasWeakSignals && index < 2;
              return (
                <button
                  key={tool.title}
                  type="button"
                  onClick={tool.action}
                  className={`group text-left rounded-xl border p-3.5 bg-white hover:shadow-md transition-all min-h-[128px] ${isRecommended ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200 hover:border-brand-primary/30'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex w-9 h-9 items-center justify-center rounded-lg border ${tool.accent}`}>
                      <ToolIcon className="w-4 h-4" />
                    </span>
                    {isRecommended && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Препорачано денес</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-800 group-hover:text-brand-primary transition-colors">{tool.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{tool.subtitle}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">{tool.pedagogy}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">{tool.impact}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

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

        <div className="animate-fade-in">
          <WeakConceptsWidget />
        </div>
      </section>

      <section className="space-y-3" aria-label="Deep Work">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-slate-200 text-slate-700 text-[11px] font-bold px-2.5 py-1">Deep Work</span>
          <p className="text-xs text-slate-500">Детална анализа, планирање и препораки.</p>
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
        <div className="md:col-span-2 lg:col-span-2 min-h-[360px]">
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
      </section>
    </div>
  );
};
