import { GlobalTour } from './components/GlobalTour';
import { OnboardingGate } from './components/onboarding/OnboardingGate';
import React, { Suspense, useEffect } from 'react';

// Providers
import { LanguageProvider } from './i18n/LanguageContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlannerProvider } from './contexts/PlannerContext';
import { ModalProvider } from './contexts/ModalContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { NavigationContext, useNavigation } from './contexts/NavigationContext';
import { LastVisitedProvider } from './contexts/LastVisitedContext';
import { AcademyProgressProvider } from './contexts/AcademyProgressContext';
import { CurriculumProvider, useCurriculum } from './hooks/useCurriculum';
import { UIProvider, useUI } from './contexts/UIContext';
import { GeneratorPanelProvider, useGeneratorPanel } from './contexts/GeneratorPanelContext';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext';


// Hooks
import { useRouter } from './hooks/useRouter';
import { useBreadcrumbs } from './hooks/useBreadcrumbs';

// Components
import { ICONS } from './constants';
import { Sidebar } from './components/Sidebar';
import { SilentErrorBoundary } from './components/common/SilentErrorBoundary';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Breadcrumbs } from './components/common/Breadcrumbs';
import { GlobalSearchBar } from './components/common/GlobalSearchBar';
import { Card } from './components/common/Card';
import { OfflineBanner } from './components/common/OfflineBanner';
import { QuotaBanner } from './components/common/QuotaBanner';
import { ContextualFAB } from './components/common/ContextualFAB';
import { UpgradeModal } from './components/common/UpgradeModal';
import { CookieConsent } from './components/common/CookieConsent';
import { DemoBanner } from './components/common/DemoBanner';

// --- LOADING SKELETON ---
const AppSkeleton = () => (
  <div className="flex h-screen bg-brand-bg items-center justify-center p-8">
    <div className="w-full max-w-4xl space-y-8 animate-pulse">
      <div className="h-12 bg-gray-200 rounded-2xl w-1/3"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 h-64 bg-gray-100 rounded-[2.5rem]"></div>
        <div className="h-64 bg-gray-100 rounded-[2.5rem]"></div>
      </div>
      <div className="h-32 bg-gray-50 rounded-[2rem]"></div>
    </div>
  </div>
);

// Helper for safe lazy loading to prevent module resolution crashes.
// On chunk-load failures (stale HTML after new deploy with new hashes),
// force a hard reload so the browser fetches fresh index.html + new chunks.
const CHUNK_RELOAD_KEY = '__chunk_reload_attempted__';
const safeLazy = (importFunc: () => Promise<any>) => {
  return React.lazy(() =>
    importFunc().catch((error) => {
      console.error("Failed to load view:", error);
      const msg = error instanceof Error ? error.message : String(error);
      const isChunkLoadError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('dynamically imported module') ||
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError');
      if (isChunkLoadError && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return { default: () => null as any };
      }
      return {
        default: () => (
          <div className="p-8 text-center">
            <Card className="border-red-200 bg-red-50">
              <h2 className="text-xl font-bold text-red-600 mb-2">Грешка при вчитување</h2>
              <p className="text-gray-700">Оваа страница моментално не е достапна. Ве молиме освежете ја апликацијата.</p>
              <button
                type="button"
                onClick={() => { sessionStorage.removeItem(CHUNK_RELOAD_KEY); window.location.reload(); }}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                Освежи
              </button>
              <pre className="mt-4 text-xs text-left bg-white p-2 rounded border text-red-500 overflow-auto">
                {msg}
              </pre>
            </Card>
          </div>
        )
      };
    })
  );
};

// Views (lazy loaded with safety)
const StudentPlayView = safeLazy(() => import('./views/StudentPlayView').then(module => ({ default: module.StudentPlayView })));
const PrivacyPolicy = safeLazy(() => import('./components/common/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })));
const TermsOfUse = safeLazy(() => import('./components/common/TermsOfUse').then(module => ({ default: module.TermsOfUse })));
const StudentProgressView = safeLazy(() => import('./views/StudentProgressView').then(module => ({ default: module.StudentProgressView })));
const StudentLiveView = safeLazy(() => import('./views/StudentLiveView').then(module => ({ default: module.StudentLiveView })));
const HostLiveQuizView = safeLazy(() => import('./views/HostLiveQuizView').then(module => ({ default: module.HostLiveQuizView })));
const LiveDisplayView = safeLazy(() => import('./views/LiveDisplayView').then(module => ({ default: module.LiveDisplayView })));
const StudentTutorView = safeLazy(() => import('./views/StudentTutorView').then(module => ({ default: module.StudentTutorView })));
const ParentPortalView = safeLazy(() => import('./views/ParentPortalView').then(module => ({ default: module.ParentPortalView })));
const StudentPortfolioView = safeLazy(() => import('./views/StudentPortfolioView').then(module => ({ default: module.StudentPortfolioView })));
const PricingView = safeLazy(() => import('./views/PricingView').then(module => ({ default: module.PricingView })));

const LoginView = safeLazy(() => import('./views/LoginView').then(module => ({ default: module.LoginView })));
const AcademyLessonView = safeLazy(() => import('./views/AcademyLessonView').then(module => ({ default: module.AcademyLessonView })));
const AcademyView = safeLazy(() => import('./views/AcademyView').then(module => ({ default: module.AcademyView })));
const HomeView = safeLazy(() => import('./views/HomeView').then(module => ({ default: module.HomeView })));
const ExploreView = safeLazy(() => import('./views/ExploreView').then(module => ({ default: module.ExploreView })));
const TopicView = safeLazy(() => import('./views/TopicView').then(module => ({ default: module.TopicView })));
const ConceptDetailView = safeLazy(() => import('./views/ConceptDetailView').then(module => ({ default: module.ConceptDetailView })));
const PlannerView = safeLazy(() => import('./views/PlannerView').then(module => ({ default: module.PlannerView })));
const AssistantView = safeLazy(() => import('./views/AssistantView').then(module => ({ default: module.AssistantView })));
const SettingsView = safeLazy(() => import('./views/SettingsView').then(module => ({ default: module.SettingsView })));
const AIVisionGraderView = safeLazy(() => import('./views/AIVisionGraderView').then(module => ({ default: module.AIVisionGraderView })));
const ContentReviewView = safeLazy(() => import('./views/ContentReviewView').then(module => ({ default: module.ContentReviewView })));
const NotFoundView = safeLazy(() => import('./views/NotFoundView').then(module => ({ default: module.NotFoundView })));
const ProgressionView = safeLazy(() => import('./views/ProgressionView').then(module => ({ default: module.ProgressionView })));
const ExamplesGalleryView = safeLazy(() => import('./views/ExamplesGalleryView').then(module => ({ default: module.ExamplesGalleryView })));
const LessonPlanEditorView = safeLazy(() => import('./views/LessonPlanEditorView').then(module => ({ default: module.LessonPlanEditorView })));
const LessonPlanLibraryView = safeLazy(() => import('./views/LessonPlanLibraryView').then(module => ({ default: module.LessonPlanLibraryView })));
const ContentLibraryView = safeLazy(() => import('./views/ContentLibraryView').then(module => ({ default: module.ContentLibraryView })));
const LessonPlanDetailView = safeLazy(() => import('./views/LessonPlanDetailView').then(module => ({ default: module.LessonPlanDetailView })));
const SharedPlanView = safeLazy(() => import('./views/SharedPlanView').then(module => ({ default: module.SharedPlanView })));
const SharedAnnualPlanView = safeLazy(() => import('./views/SharedAnnualPlanView').then(module => ({ default: module.SharedAnnualPlanView })));
const ShareVisualView = safeLazy(() => import('./views/ShareVisualView').then(module => ({ default: module.ShareVisualView })));
const AnnualPlanGeneratorView = safeLazy(() => import('./views/AnnualPlanGeneratorView').then(module => ({ default: module.AnnualPlanGeneratorView })));
const AnnualPlanGalleryView = safeLazy(() => import('./views/AnnualPlanGalleryView').then(module => ({ default: module.AnnualPlanGalleryView })));
const SharedQuizView = safeLazy(() => import('./views/SharedQuizView').then(module => ({ default: module.SharedQuizView })));
const FavoritesView = safeLazy(() => import('./views/FavoritesView').then(module => ({ default: module.FavoritesView })));
const NationalLibraryView = safeLazy(() => import('./views/NationalLibraryView').then(module => ({ default: module.NationalLibraryView })));
const TeacherForumView = safeLazy(() => import('./views/TeacherForumView').then(module => ({ default: module.TeacherForumView })));
const CurriculumGraphView = safeLazy(() => import('./views/CurriculumGraphView').then(module => ({ default: module.CurriculumGraphView })));
const DataVizStudioView = safeLazy(() => import('./views/DataVizStudioView').then(module => ({ default: module.DataVizStudioView })));
const CoverageAnalyzerView = safeLazy(() => import('./views/CoverageAnalyzerView').then(module => ({ default: module.CoverageAnalyzerView })));
const MindMapView = safeLazy(() => import('./views/MindMapView').then(module => ({ default: module.MindMapView })));
const RoadmapView = safeLazy(() => import('./views/RoadmapView').then(module => ({ default: module.RoadmapView })));
const TeacherAnalyticsView = safeLazy(() => import('./views/TeacherAnalyticsView').then(module => ({ default: module.TeacherAnalyticsView })));
const SystemAdminView = safeLazy(() => import('./views/SystemAdminView').then(module => ({ default: module.SystemAdminView })));
const SLODashboardView = safeLazy(() => import('./views/SLODashboardView').then(module => ({ default: module.SLODashboardView })));
const TestGeneratorView = safeLazy(() => import('./views/TestGeneratorView').then(module => ({ default: module.TestGeneratorView })));
const GradeBookView = safeLazy(() => import('./views/GradeBookView').then(module => ({ default: module.GradeBookView })));
const WrittenTestReviewView = safeLazy(() => import('./views/WrittenTestReviewView').then(module => ({ default: module.WrittenTestReviewView })));
const SchoolAdminView = safeLazy(() => import('./views/SchoolAdminView').then(module => ({ default: module.SchoolAdminView })));
const CurriculumEditorView = safeLazy(() => import('./views/CurriculumEditorView').then(module => ({ default: module.CurriculumEditorView })));
const SchoolOnboardingView = safeLazy(() => import('./views/SchoolOnboardingView').then(module => ({ default: module.SchoolOnboardingView })));
const TeacherProfileView = safeLazy(() => import('./views/TeacherProfileView').then(module => ({ default: module.TeacherProfileView })));
const MaturaSimulationView = safeLazy(() => import('./views/MaturaSimulationView').then(module => ({ default: module.MaturaSimulationView })));
const MaturaLibraryView    = safeLazy(() => import('./views/MaturaLibraryView').then(module => ({ default: module.MaturaLibraryView })));
const AIGeneratorPanel = safeLazy(() => import('./components/ai/AIGeneratorPanel').then(module => ({ default: module.AIGeneratorPanel })));
const AIChatPanel = safeLazy(() => import('./components/ai/AIChatPanel').then(module => ({ default: module.AIChatPanel })));
const CommandPalette = safeLazy(() => import('./components/common/CommandPalette').then(module => ({ default: module.CommandPalette })));

const GeneratorRouteHandler: React.FC<any> = (props: any) => {
    const { openGeneratorPanel } = useGeneratorPanel();
    const { navigate } = useNavigation();
    useEffect(() => {
        openGeneratorPanel(props);
        // Redirect to home page to avoid a blank page and keep the URL clean
        navigate('/');
    }, [props, openGeneratorPanel, navigate]);

    return <AppSkeleton />; // Show a skeleton while the panel opens and redirects
};

  const PUBLIC_HASH_ROUTE_PREFIXES = [
    '#/play/',
    '#/my-progress',
    '#/live',
    '#/tutor',
    '#/portfolio',
    '#/parent',
    '#/pricing',
    '#/privacy',
    '#/terms',
    '#/share/',
    '#/quiz/',
    '#/school/register',
  ];

  const isPublicHashRoute = (hash: string): boolean =>
    PUBLIC_HASH_ROUTE_PREFIXES.some((prefix) => hash.startsWith(prefix));

const routes = [      { path: '/privacy', component: PrivacyPolicy },
      { path: '/terms', component: TermsOfUse },    { path: '/play/:id', component: StudentPlayView }, // Student Mode route
    { path: '/my-progress', component: StudentProgressView }, // Student Progress route
    { path: '/live/host', component: HostLiveQuizView }, // Live session host route
    { path: '/live/display', component: LiveDisplayView }, // Fullscreen projector display
    { path: '/live', component: StudentLiveView }, // Live session join route
    { path: '/tutor', component: StudentTutorView }, // AI Tutor for Students
    { path: '/parent', component: ParentPortalView }, // Parent Portal â€” public
    { path: '/portfolio', component: StudentPortfolioView }, // Ж7.5 Student Portfolio
    { path: '/pricing', component: PricingView }, // Н2 Pricing page — public
    { path: '/school/register', component: SchoolOnboardingView }, // Н3 School self-registration — public
    { path: '/academy/lesson/:id', component: AcademyLessonView },
    { path: '/academy', component: AcademyView },
    { path: '/', component: HomeView },
    { path: '/explore', component: ExploreView },
    { path: '/topic/:id', component: TopicView },
    { path: '/concept/:id', component: ConceptDetailView },
    { path: '/annual-gallery', component: AnnualPlanGalleryView },
    { path: '/annual-planner/:planId', component: AnnualPlanGeneratorView },
    { path: '/annual-planner', component: AnnualPlanGeneratorView },
    { path: '/planner', component: PlannerView },
    { path: '/planner/lesson/view/:id', component: LessonPlanDetailView },
    { path: '/planner/lesson/:id', component: LessonPlanEditorView },
    { path: '/planner/lesson/new', component: LessonPlanEditorView },
    { path: '/assistant', component: AssistantView },
    { path: '/vision-assessment', component: AIVisionGraderView },
    { path: '/generator', component: GeneratorRouteHandler },
    { path: '/my-lessons', component: LessonPlanLibraryView },
    { path: '/library', component: ContentLibraryView },
    { path: '/gallery', component: ExamplesGalleryView },
    { path: '/settings', component: SettingsView },      { path: '/school-admin', component: SchoolAdminView }, { path: '/school-admin/curriculum', component: CurriculumEditorView },    { path: '/system-admin', component: SystemAdminView }, { path: '/progression', component: ProgressionView },
    { path: '/reviews', component: ContentReviewView },
    { path: '/graph', component: CurriculumGraphView },
    { path: '/roadmap', component: RoadmapView },
    { path: '/favorites', component: FavoritesView },
    { path: '/national-library', component: NationalLibraryView },
    { path: '/data-viz', component: DataVizStudioView },
    { path: '/forum', component: TeacherForumView },
    { path: '/reports/coverage', component: CoverageAnalyzerView },
    { path: '/analytics', component: TeacherAnalyticsView },
    { path: '/test-generator', component: TestGeneratorView },
    { path: '/grade-book', component: GradeBookView },
    { path: '/test-review', component: WrittenTestReviewView },
    { path: '/my-profile', component: TeacherProfileView },
    { path: '/matura', component: MaturaSimulationView },
    { path: '/matura-library', component: MaturaLibraryView },
    { path: '/slo', component: SLODashboardView }, // L1 — admin-only SLO dashboard
    { path: '/share/:data', component: SharedPlanView },
    { path: '/share/annual/:data', component: SharedAnnualPlanView },
    { path: '/share/visual', component: ShareVisualView }, // C2.4/C3.4 — AlgebraTiles + Shape3D shareable URLs
    { path: '/quiz/:data', component: SharedQuizView },
    { path: '/mindmap/:topicId', component: MindMapView },
];

const AppContent: React.FC = () => {
    const { path, navigate, Component, params } = useRouter(routes);
    const breadcrumbs = useBreadcrumbs(path);
    const { isSidebarOpen, openSidebar, closeSidebar } = useUI();
    const [upgradeModalOpen, setUpgradeModalOpen] = React.useState(false);
    const [upgradeReason, setUpgradeReason] = React.useState<string | undefined>();

    React.useEffect(() => {
      const handleOpenUpgrade = (e: Event) => {
        const customEvent = e as CustomEvent;
        setUpgradeReason(customEvent.detail?.reason);
        setUpgradeModalOpen(true);
      };
      window.addEventListener('openUpgradeModal', handleOpenUpgrade);
      return () => window.removeEventListener('openUpgradeModal', handleOpenUpgrade);
    }, []);

    const RenderComponent = Component || NotFoundView;

    return (
        <NavigationContext.Provider value={{ navigate }}>
            <div className="flex h-screen bg-brand-bg">
                <SilentErrorBoundary name="Sidebar">
                    <Sidebar currentPath={path} isOpen={isSidebarOpen} onClose={closeSidebar} />
                </SilentErrorBoundary>
                 {isSidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
                        onClick={closeSidebar}
                        aria-hidden="true"
                    />
                )}
                <main className="flex-1 flex flex-col md:pl-64 overflow-hidden relative">
                    <header className="sticky top-0 bg-brand-bg/80 backdrop-blur-sm z-10 px-4 md:px-8 pt-4 pb-2 border-b no-print flex items-center gap-2">
                        <button
                            className="p-1 text-gray-600 md:hidden"
                            onClick={openSidebar}
                            aria-label="ÐžÑ‚Ð²Ð¾Ñ€Ð¸ Ð¼ÐµÐ½Ð¸"
                        >
                            <ICONS.menu className="w-6 h-6" />
                        </button>
                        <GlobalSearchBar />
                    </header>
                    <Breadcrumbs crumbs={breadcrumbs} />
                    <div className="flex-1 overflow-y-auto pb-12">
                        <ErrorBoundary>
                            <Suspense fallback={<AppSkeleton />}>
                                <div key={path} className="animate-fade-in-up origin-top">
                                    <RenderComponent {...params} />
                                </div>
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                    <OfflineBanner />
                    <QuotaBanner />
                </main>
                <SilentErrorBoundary name="ContextualFAB">
                    <ContextualFAB path={path} params={params} />
                </SilentErrorBoundary>
            </div>
            <Suspense fallback={null}>
              <SilentErrorBoundary name="AIGeneratorPanel" fallback={<AIGeneratorPanelFallback />}>
                <AIGeneratorPanel />
              </SilentErrorBoundary>
            </Suspense>
            <Suspense fallback={null}>
              <SilentErrorBoundary name="AIChatPanel">
                <AIChatPanel />
              </SilentErrorBoundary>
            </Suspense>

            <UpgradeModal 
              isOpen={upgradeModalOpen} 
              onClose={() => setUpgradeModalOpen(false)} 
              reason={upgradeReason} 
            />
        </NavigationContext.Provider>
    );
};

const AuthenticatedApp: React.FC = () => {
    const { isLoading: isCurriculumLoading, error: curriculumError } = useCurriculum();

    const isLoading = isCurriculumLoading;
    const error = curriculumError;

    if (isLoading) {
        return <AppSkeleton />;
    }
    
    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-brand-bg">
                <Card className="text-center max-w-lg">
                    <h1 className="text-xl font-bold text-red-600">Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ Ð²Ñ‡Ð¸Ñ‚ÑƒÐ²Ð°ÑšÐµ Ð½Ð° Ð¿Ð¾Ð´Ð°Ñ‚Ð¾Ñ†Ð¸</h1>
                    <p className="mt-2 text-gray-700">{error}</p>
                </Card>
            </div>
        );
    }

    return <AppContent />;
}

const AIGeneratorPanelFallback: React.FC = () => {
    const { closeGeneratorPanel } = useGeneratorPanel();
    return (
        <div className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center no-print">
            <div className="bg-white rounded-2xl p-8 max-w-sm shadow-xl text-center mx-4">
                <p className="text-red-600 text-xl font-bold mb-2">âš ï¸ Ð“Ñ€ÐµÑˆÐºÐ° Ð²Ð¾ Ð³ÐµÐ½ÐµÑ€Ð°Ñ‚Ð¾Ñ€Ð¾Ñ‚</p>
                <p className="text-gray-500 text-sm mb-6">ÐÐ°ÑÑ‚Ð°Ð½Ð° Ð½ÐµÐ¾Ñ‡ÐµÐºÑƒÐ²Ð°Ð½Ð° Ð³Ñ€ÐµÑˆÐºÐ°. Ð’Ðµ Ð¼Ð¾Ð»Ð¸Ð¼Ðµ Ð·Ð°Ñ‚Ð²Ð¾Ñ€ÐµÑ‚Ðµ Ð¸ Ð¾Ð±Ð¸Ð´ÐµÑ‚Ðµ ÑÐµ Ð¿Ð¾Ð²Ñ‚Ð¾Ñ€Ð½Ð¾.</p>
                <button
                    type="button"
                    onClick={closeGeneratorPanel}
                    className="px-5 py-2.5 bg-brand-primary text-white rounded-xl hover:bg-brand-secondary font-bold"
                >
                    Ð—Ð°Ñ‚Ð²Ð¾Ñ€Ð¸
                </button>
            </div>
        </div>
    );
};

const AppCore: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) {
        return <AppSkeleton />;
    }

    const isPublicRoute = isPublicHashRoute(window.location.hash);

    // School self-registration is always standalone (no sidebar/auth required)
    if (window.location.hash.startsWith('#/school/register')) {
        return (
            <Suspense fallback={<AppSkeleton />}>
                <SchoolOnboardingView />
            </Suspense>
        );
    }

    if (!isAuthenticated && !isPublicRoute) {
        return (
            <Suspense fallback={<AppSkeleton />}>
                <LoginView />
            </Suspense>
        );
    }
    return (
        <AuthenticatedApp />
    );
}


const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary>
    <NetworkStatusProvider>
      <NotificationProvider>
        <AuthProvider>
          <LanguageProvider>
          <UserPreferencesProvider>
            <CurriculumProvider>
              <PlannerProvider>
                <ModalProvider>
                  <LastVisitedProvider>
                    <AcademyProgressProvider>
                      <UIProvider>
                        <GeneratorPanelProvider>
                          {children}
                          <GlobalTour />
                          <OnboardingGate />
                          <CookieConsent />
                          <DemoBanner />
                          <Suspense fallback={null}>
                            <CommandPalette />
                          </Suspense>
                        </GeneratorPanelProvider>
                      </UIProvider>
                    </AcademyProgressProvider>
                  </LastVisitedProvider>
                </ModalProvider>
              </PlannerProvider>
            </CurriculumProvider>
          </UserPreferencesProvider>
        </LanguageProvider>
        </AuthProvider>
      </NotificationProvider>
    </NetworkStatusProvider>
  </ErrorBoundary>
);

// E2.2 â€” Apply global accessibility settings from localStorage on startup
function applyAccessibilityOnStartup() {
  try {
    if (localStorage.getItem('accessibility_dyslexic') === 'true') {
      if (!document.getElementById('opendyslexic-global')) {
        const link = document.createElement('link');
        link.id = 'opendyslexic-global';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-all.min.css';
        document.head.appendChild(link);
      }
      document.documentElement.classList.add('dyslexic-font');
    }
    if (localStorage.getItem('accessibility_contrast') === 'true') {
      document.documentElement.classList.add('high-contrast');
    }
  } catch { /* incognito / blocked localStorage */ }
}
applyAccessibilityOnStartup();

const App: React.FC = () => (
  <AppProviders>
    <AppCore />
  </AppProviders>
);

export default App;


