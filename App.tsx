import React, { Suspense, useEffect } from 'react';

// Providers
import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlannerProvider } from './contexts/PlannerContext';
import { ModalProvider } from './contexts/ModalContext';
import { UserPreferencesProvider } from './contexts/UserPreferencesContext';
import { NavigationContext, useNavigation } from './contexts/NavigationContext';
import { LastVisitedProvider } from './contexts/LastVisitedContext';
import { CurriculumProvider, useCurriculum } from './hooks/useCurriculum';
import { UIProvider, useUI } from './contexts/UIContext';
import { GeneratorPanelProvider, useGeneratorPanel } from './contexts/GeneratorPanelContext';
import { NetworkStatusProvider } from './contexts/NetworkStatusContext';


// Hooks
import { useRouter } from './hooks/useRouter';
import { useBreadcrumbs } from './hooks/useBreadcrumbs';

// Components
import { Sidebar } from './components/Sidebar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Breadcrumbs } from './components/common/Breadcrumbs';
import { GlobalSearchBar } from './components/common/GlobalSearchBar';
import { Card } from './components/common/Card';
import { ICONS } from './constants';
import { AppSkeleton } from './components/common/AppSkeleton';
import { ContextualFAB } from './components/common/ContextualFAB';
import { AIGeneratorPanel } from './components/ai/AIGeneratorPanel';
import { OfflineBanner } from './components/common/OfflineBanner';

// Helper for safe lazy loading to prevent module resolution crashes
const safeLazy = (importFunc: () => Promise<any>) => {
  return React.lazy(() =>
    importFunc().catch((error) => {
      console.error("Failed to load view:", error);
      return {
        default: () => (
          <div className="p-8 text-center">
            <Card className="border-red-200 bg-red-50">
              <h2 className="text-xl font-bold text-red-600 mb-2">Грешка при вчитување</h2>
              <p className="text-gray-700">Оваа страница моментално не е достапна. Ве молиме освежете ја апликацијата.</p>
              <pre className="mt-4 text-xs text-left bg-white p-2 rounded border text-red-500 overflow-auto">
                {error instanceof Error ? error.message : 'Unknown module error'}
              </pre>
            </Card>
          </div>
        )
      };
    })
  );
};

// Views (lazy loaded with safety)
const LoginView = safeLazy(() => import('./views/LoginView').then(module => ({ default: module.LoginView })));
const HomeView = safeLazy(() => import('./views/HomeView').then(module => ({ default: module.HomeView })));
const ExploreView = safeLazy(() => import('./views/ExploreView').then(module => ({ default: module.ExploreView })));
const TopicView = safeLazy(() => import('./views/TopicView').then(module => ({ default: module.TopicView })));
const ConceptDetailView = safeLazy(() => import('./views/ConceptDetailView').then(module => ({ default: module.ConceptDetailView })));
const PlannerView = safeLazy(() => import('./views/PlannerView').then(module => ({ default: module.PlannerView })));
const AssistantView = safeLazy(() => import('./views/AssistantView').then(module => ({ default: module.AssistantView })));
const MaterialsGeneratorView = safeLazy(() => import('./views/MaterialsGeneratorView').then(module => ({ default: module.MaterialsGeneratorView })));
const SettingsView = safeLazy(() => import('./views/SettingsView').then(module => ({ default: module.SettingsView })));
const NotFoundView = safeLazy(() => import('./views/NotFoundView').then(module => ({ default: module.NotFoundView })));
const ProgressionView = safeLazy(() => import('./views/ProgressionView').then(module => ({ default: module.ProgressionView })));
const ExamplesGalleryView = safeLazy(() => import('./views/ExamplesGalleryView').then(module => ({ default: module.ExamplesGalleryView })));
const LessonPlanEditorView = safeLazy(() => import('./views/LessonPlanEditorView').then(module => ({ default: module.LessonPlanEditorView })));
const LessonPlanLibraryView = safeLazy(() => import('./views/LessonPlanLibraryView').then(module => ({ default: module.LessonPlanLibraryView })));
const LessonPlanDetailView = safeLazy(() => import('./views/LessonPlanDetailView').then(module => ({ default: module.LessonPlanDetailView })));
const SharedPlanView = safeLazy(() => import('./views/SharedPlanView').then(module => ({ default: module.SharedPlanView })));
const SharedAnnualPlanView = safeLazy(() => import('./views/SharedAnnualPlanView').then(module => ({ default: module.SharedAnnualPlanView })));
const FavoritesView = safeLazy(() => import('./views/FavoritesView').then(module => ({ default: module.FavoritesView })));
const CurriculumGraphView = safeLazy(() => import('./views/CurriculumGraphView').then(module => ({ default: module.CurriculumGraphView })));
const CoverageAnalyzerView = safeLazy(() => import('./views/CoverageAnalyzerView').then(module => ({ default: module.CoverageAnalyzerView })));
const MindMapView = safeLazy(() => import('./views/MindMapView').then(module => ({ default: module.MindMapView })));
const RoadmapView = safeLazy(() => import('./views/RoadmapView').then(module => ({ default: module.RoadmapView })));

const GeneratorRouteHandler: React.FC<any> = (props) => {
    const { openGeneratorPanel } = useGeneratorPanel();
    const { navigate } = useNavigation();
    useEffect(() => {
        openGeneratorPanel(props);
        // Redirect to home page to avoid a blank page and keep the URL clean
        navigate('/');
    }, [props, openGeneratorPanel, navigate]);

    return <AppSkeleton />; // Show a skeleton while the panel opens and redirects
};

const routes = [
    { path: '/', component: HomeView },
    { path: '/explore', component: ExploreView },
    { path: '/topic/:id', component: TopicView },
    { path: '/concept/:id', component: ConceptDetailView },
    { path: '/planner', component: PlannerView },
    { path: '/planner/lesson/view/:id', component: LessonPlanDetailView },
    { path: '/planner/lesson/:id', component: LessonPlanEditorView },
    { path: '/planner/lesson/new', component: LessonPlanEditorView },
    { path: '/assistant', component: AssistantView },
    { path: '/generator', component: GeneratorRouteHandler },
    { path: '/my-lessons', component: LessonPlanLibraryView },
    { path: '/gallery', component: ExamplesGalleryView },
    { path: '/settings', component: SettingsView },
    { path: '/progression', component: ProgressionView },
    { path: '/graph', component: CurriculumGraphView },
    { path: '/roadmap', component: RoadmapView },
    { path: '/favorites', component: FavoritesView },
    { path: '/reports/coverage', component: CoverageAnalyzerView },
    { path: '/share/:data', component: SharedPlanView },
    { path: '/share/annual/:data', component: SharedAnnualPlanView },
    { path: '/mindmap/:topicId', component: MindMapView },
];

const AppContent: React.FC = () => {
    const { path, navigate, Component, params } = useRouter(routes);
    const breadcrumbs = useBreadcrumbs(path);
    const { isSidebarOpen, openSidebar, closeSidebar } = useUI();

    const RenderComponent = Component || NotFoundView;

    return (
        <NavigationContext.Provider value={{ navigate }}>
            <div className="flex h-screen bg-brand-bg">
                <Sidebar currentPath={path} isOpen={isSidebarOpen} onClose={closeSidebar} />
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
                            aria-label="Отвори мени"
                        >
                            <ICONS.menu className="w-6 h-6" />
                        </button>
                        <GlobalSearchBar />
                    </header>
                    <Breadcrumbs crumbs={breadcrumbs} />
                    <div className="flex-1 overflow-y-auto pb-12">
                        <ErrorBoundary>
                            <Suspense fallback={<AppSkeleton />}>
                                <RenderComponent {...params} />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                    <OfflineBanner />
                </main>
                <ContextualFAB path={path} params={params} />
            </div>
            <AIGeneratorPanel />
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
                    <h1 className="text-xl font-bold text-red-600">Грешка при вчитување на податоци</h1>
                    <p className="mt-2 text-gray-700">{error}</p>
                </Card>
            </div>
        );
    }

    return <AppContent />;
}

const AppCore: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) {
        return <AppSkeleton />;
    }

    if (!isAuthenticated) {
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


const App: React.FC = () => {
  return (
    <NetworkStatusProvider>
        <NotificationProvider>
        <AuthProvider>
            <UserPreferencesProvider>
            <CurriculumProvider>
                <PlannerProvider>
                    <ModalProvider>
                        <LastVisitedProvider>
                            <UIProvider>
                            <GeneratorPanelProvider>
                                <AppCore />
                            </GeneratorPanelProvider>
                            </UIProvider>
                        </LastVisitedProvider>
                    </ModalProvider>
                </PlannerProvider>
            </CurriculumProvider>
            </UserPreferencesProvider>
        </AuthProvider>
        </NotificationProvider>
    </NetworkStatusProvider>
  );
};

export default App;