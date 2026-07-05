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
import { PlanningProvider } from './contexts/PlanningContext';


// Hooks
import { useRouter } from './hooks/useRouter';
import { useBreadcrumbs } from './hooks/useBreadcrumbs';

// Components
import { ICONS } from './constants';
import { Sidebar } from './components/Sidebar';
import { SilentErrorBoundary } from './components/common/SilentErrorBoundary';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PlanningErrorBoundary } from './components/common/PlanningErrorBoundary';
import { Breadcrumbs } from './components/common/Breadcrumbs';
import { RelatedTools } from './components/common/RelatedTools';
import { GlobalSearchBar } from './components/common/GlobalSearchBar';
import { Card } from './components/common/Card';
import { OfflineBanner } from './components/common/OfflineBanner';
import { QuotaBanner } from './components/common/QuotaBanner';
import { CurriculumGapBanner } from './components/common/CurriculumGapBanner';
import { BottomNavBar } from './components/common/BottomNavBar';
import { ContextualFAB } from './components/common/ContextualFAB';
import { UpgradeModal } from './components/common/UpgradeModal';
import { CookieConsent } from './components/common/CookieConsent';
import { DemoBanner } from './components/common/DemoBanner';
import { ModalManager } from './components/common/ModalManager';
import { WhatsNewModal } from './components/common/WhatsNewModal';

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
// On chunk-load failures (stale HTML after a new Vercel deploy with new chunk hashes),
// emit a custom event so a banner can prompt the user to refresh voluntarily.
const CHUNK_RELOAD_KEY = '__chunk_reload_attempted__';

/** Dispatched when a lazy chunk 404s after a deployment — banner listens to this. */
const NEW_VERSION_EVENT = 'app:new-version';

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
      if (isChunkLoadError) {
        // Signal to the NewVersionBanner — do NOT auto-reload silently
        window.dispatchEvent(new CustomEvent(NEW_VERSION_EVENT));
        return {
          default: () => (
            <div className="p-8 text-center">
              <Card className="border-amber-200 bg-amber-50 max-w-md mx-auto">
                <p className="text-2xl mb-2">🔄</p>
                <h2 className="text-lg font-bold text-amber-800 mb-1">Нова верзија на апликацијата</h2>
                <p className="text-amber-700 text-sm mb-4">Достапно е ажурирање. Освежи за да ја вчиташ новата верзија.</p>
                <button
                  type="button"
                  onClick={() => { sessionStorage.removeItem(CHUNK_RELOAD_KEY); window.location.reload(); }}
                  className="px-5 py-2 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 transition-colors"
                >
                  Освежи сега
                </button>
              </Card>
            </div>
          )
        };
      }
      return {
        default: () => (
          <div className="p-8 text-center">
            <Card className="border-red-200 bg-red-50">
              <h2 className="text-xl font-bold text-red-600 mb-2">Грешка при вчитување</h2>
              <p className="text-gray-700">Оваа страница моментално не е достапна. Ве молиме освежете ја апликацијата.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
              >
                Освежи
              </button>
            </Card>
          </div>
        )
      };
    })
  );
};

/** Floating banner shown when a new app version is detected (chunk-hash mismatch after deploy). */
const NewVersionBanner: React.FC = () => {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener(NEW_VERSION_EVENT, handler);
    return () => window.removeEventListener(NEW_VERSION_EVENT, handler);
  }, []);
  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium animate-fade-in">
      <span>🔄 Нова верзија достапна</span>
      <button
        type="button"
        onClick={() => { sessionStorage.removeItem(CHUNK_RELOAD_KEY); window.location.reload(); }}
        className="bg-white text-slate-800 px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-100 transition-colors"
      >
        Освежи
      </button>
      <button type="button" onClick={() => setVisible(false)} className="opacity-60 hover:opacity-100 text-lg leading-none">×</button>
    </div>
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
const SchoolPricingView = safeLazy(() => import('./views/SchoolPricingView').then(module => ({ default: module.SchoolPricingView })));
const GammaJoinView = safeLazy(() => import('./views/GammaJoinView').then(module => ({ default: module.GammaJoinView })));
const GammaStudentView = safeLazy(() => import('./views/GammaStudentView').then(module => ({ default: module.GammaStudentView })));
const EmbedConceptView = safeLazy(() => import('./views/EmbedConceptView').then(module => ({ default: module.EmbedConceptView })));
const EmbedQuizView = safeLazy(() => import('./views/EmbedQuizView').then(module => ({ default: module.EmbedQuizView })));

const ClassroomView = safeLazy(() => import('./views/ClassroomView').then(module => ({ default: module.ClassroomView })));
const LessonStudyView = safeLazy(() => import('./views/LessonStudyView').then(module => ({ default: module.LessonStudyView })));
const LoginView = safeLazy(() => import('./views/LoginView').then(module => ({ default: module.LoginView })));
const StudentLoginView = safeLazy(() => import('./views/StudentLoginView').then(module => ({ default: module.StudentLoginView })));
const StudentDashboardView = safeLazy(() => import('./views/StudentDashboardView').then(module => ({ default: module.StudentDashboardView })));
const StudentSRSView = safeLazy(() => import('./views/StudentSRSView').then(module => ({ default: module.StudentSRSView })));
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
const SmartOCRView = safeLazy(() => import('./views/SmartOCRView').then(module => ({ default: module.SmartOCRView })));
const ExtractionHubView = safeLazy(() => import('./views/ExtractionHubView').then(module => ({ default: module.ExtractionHubView })));
const FlashcardPlayerView = safeLazy(() => import('./views/FlashcardPlayerView').then(module => ({ default: module.FlashcardPlayerView })));
const ContentReviewView = safeLazy(() => import('./views/ContentReviewView').then(module => ({ default: module.ContentReviewView })));
const NotFoundView = safeLazy(() => import('./views/NotFoundView').then(module => ({ default: module.NotFoundView })));
const ProgressionView = safeLazy(() => import('./views/ProgressionView').then(module => ({ default: module.ProgressionView })));
const ExamplesGalleryView = safeLazy(() => import('./views/ExamplesGalleryView').then(module => ({ default: module.ExamplesGalleryView })));
const LessonPlanEditorView = safeLazy(() => import('./views/LessonPlanEditorView').then(module => ({ default: module.LessonPlanEditorView })));
const LessonPlanLibraryView = safeLazy(() => import('./views/LessonPlanLibraryView').then(module => ({ default: module.LessonPlanLibraryView })));
const ContentLibraryView = safeLazy(() => import('./views/ContentLibraryView').then(module => ({ default: module.ContentLibraryView })));
// Redirect /library → /scenario-bank (One Hub consolidation)
const LibraryRedirect: React.FC = () => {
  const { navigate } = useNavigation();
  useEffect(() => { navigate('/scenario-bank'); }, [navigate]);
  return null;
};
const LessonPlanDetailView = safeLazy(() => import('./views/LessonPlanDetailView').then(module => ({ default: module.LessonPlanDetailView })));
const SharedPlanView = safeLazy(() => import('./views/SharedPlanView').then(module => ({ default: module.SharedPlanView })));
const SharedAnnualPlanView = safeLazy(() => import('./views/SharedAnnualPlanView').then(module => ({ default: module.SharedAnnualPlanView })));
const SharedMaturaRecoveryView = safeLazy(() => import('./views/SharedMaturaRecoveryView').then(module => ({ default: module.SharedMaturaRecoveryView })));
const ShareVisualView = safeLazy(() => import('./views/ShareVisualView').then(module => ({ default: module.ShareVisualView })));
const AnnualPlanGeneratorView = safeLazy(() => import('./views/AnnualPlanGeneratorView').then(module => ({ default: module.AnnualPlanGeneratorView })));
const AnnualPlanGalleryView = safeLazy(() => import('./views/AnnualPlanGalleryView').then(module => ({ default: module.AnnualPlanGalleryView })));
const WeeklyPlanView = safeLazy(() => import('./views/WeeklyPlanView').then(module => ({ default: module.WeeklyPlanView })));
const SharedQuizView = safeLazy(() => import('./views/SharedQuizView').then(module => ({ default: module.SharedQuizView })));
const FavoritesView = safeLazy(() => import('./views/FavoritesView').then(module => ({ default: module.FavoritesView })));
const ScenarioBankView = safeLazy(() => import('./views/ScenarioBankView').then(module => ({ default: module.ScenarioBankView })));
const OlympiadArchiveView = safeLazy(() => import('./views/OlympiadArchiveView').then(module => ({ default: module.OlympiadArchiveView })));
const MathEditorView = safeLazy(() => import('./views/MathEditorView').then(module => ({ default: module.MathEditorView })));
const DuggaBuilderView = safeLazy(() => import('./views/DuggaBuilderView').then(module => ({ default: module.DuggaBuilderView })));
const DuggaPlayerView = safeLazy(() => import('./views/DuggaPlayerView').then(module => ({ default: module.DuggaPlayerView })));
const DuggaLibraryView = safeLazy(() => import('./views/DuggaLibraryView').then(module => ({ default: module.DuggaLibraryView })));
const AIModelCompareView = safeLazy(() => import('./views/AIModelCompareView').then(module => ({ default: module.AIModelCompareView })));
const AICodeOfConductView = safeLazy(() => import('./views/AICodeOfConductView').then(module => ({ default: module.AICodeOfConductView })));
const UsageDashboardView = safeLazy(() => import('./views/UsageDashboardView').then(module => ({ default: module.UsageDashboardView })));
const TeacherForumView = safeLazy(() => import('./views/TeacherForumView').then(module => ({ default: module.TeacherForumView })));
const ProfDevView = safeLazy(() => import('./views/ProfDevView').then(module => ({ default: module.ProfDevView })));
const CurriculumGraphView = safeLazy(() => import('./views/CurriculumGraphView').then(module => ({ default: module.CurriculumGraphView })));
const DataVizStudioView = safeLazy(() => import('./views/DataVizStudioView').then(module => ({ default: module.DataVizStudioView })));
const MathToolsView = safeLazy(() => import('./views/MathToolsView').then(module => ({ default: module.MathToolsView })));
const CoverageAnalyzerView = safeLazy(() => import('./views/CoverageAnalyzerView').then(module => ({ default: module.CoverageAnalyzerView })));
const MindMapView = safeLazy(() => import('./views/MindMapView').then(module => ({ default: module.MindMapView })));
const AIMindMapView = safeLazy(() => import('./views/AIMindMapView').then(module => ({ default: module.AIMindMapView })));
const RoadmapView = safeLazy(() => import('./views/RoadmapView').then(module => ({ default: module.RoadmapView })));
const TeacherAnalyticsView = safeLazy(() => import('./views/TeacherAnalyticsView').then(module => ({ default: module.TeacherAnalyticsView })));
const StandardsCoverageView = safeLazy(() => import('./views/StandardsCoverageView').then(module => ({ default: module.StandardsCoverageView })));
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
const MaturaPracticeView   = safeLazy(() => import('./views/MaturaPracticeView').then(module => ({ default: module.MaturaPracticeView })));
const MaturaAnalyticsView  = safeLazy(() => import('./views/MaturaAnalyticsView').then(module => ({ default: module.MaturaAnalyticsView })));
const MaturaImportView     = safeLazy(() => import('./views/MaturaImportView').then(module => ({ default: module.MaturaImportView })));
const MaturaPortalView        = safeLazy(() => import('./views/MaturaPortalView').then(module => ({ default: module.MaturaPortalView })));
const MaturaAssignmentView    = safeLazy(() => import('./views/MaturaAssignmentView').then(module => ({ default: module.MaturaAssignmentView })));
const StudentHomeworkView     = safeLazy(() => import('./views/StudentHomeworkView').then(module => ({ default: module.StudentHomeworkView })));
const SolutionUploadPage      = safeLazy(() => import('./views/SolutionUploadPage').then(module => ({ default: module.SolutionUploadPage })));
const ExamBuilderView      = safeLazy(() => import('./views/ExamBuilderView').then(module => ({ default: module.ExamBuilderView })));
const ExamPlayerView       = safeLazy(() => import('./views/ExamPlayerView').then(module => ({ default: module.ExamPlayerView })));
const ExamPresenterView    = safeLazy(() => import('./views/ExamPresenterView').then(module => ({ default: module.ExamPresenterView })));
const ExamResultsView      = safeLazy(() => import('./views/ExamResultsView').then(module => ({ default: module.ExamResultsView })));
const PrintExamView        = safeLazy(() => import('./views/PrintExamView').then(module => ({ default: module.PrintExamView })));
const StudentTelemetryView = safeLazy(() => import('./views/StudentTelemetryView').then(module => ({ default: module.StudentTelemetryView })));
const KahootMakerView = safeLazy(() => import('./views/KahootMakerView').then(module => ({ default: module.KahootMakerView })));
const AIGeneratorPanel = safeLazy(() => import('./components/ai/AIGeneratorPanel').then(module => ({ default: module.AIGeneratorPanel })));
const TutorAvatarWidget = safeLazy(() => import('./components/common/TutorAvatarWidget').then(module => ({ default: module.TutorAvatarWidget })));
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
    '#/school-pricing',
    '#/privacy',
    '#/terms',
    '#/share/',
    '#/quiz/',
    '#/school/register',
    '#/gamma/join',
    '#/gamma/student/',
    '#/embed/',
    '#/exam/play',
    '#/upload/',
    '#/student',
    '#/dugga/play',
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
    { path: '/parent', component: ParentPortalView }, // Parent Portal — public
    { path: '/portfolio', component: StudentPortfolioView }, // Ж7.5 Student Portfolio
    { path: '/pricing', component: PricingView }, // Н2 Pricing page — public
    { path: '/school-pricing', component: SchoolPricingView }, // School B2B inquiry — public
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
    { path: '/weekly-plan', component: WeeklyPlanView },
    { path: '/planner', component: PlannerView },
    { path: '/classroom/:lessonPlanId', component: ClassroomView },
    { path: '/lesson-study', component: LessonStudyView },
    { path: '/planner/lesson/view/:id', component: LessonPlanDetailView },
    { path: '/planner/lesson/:id', component: LessonPlanEditorView },
    { path: '/planner/lesson/new', component: LessonPlanEditorView },
    { path: '/assistant', component: AssistantView },
    { path: '/vision-assessment', component: AIVisionGraderView },
    { path: '/smart-ocr', component: SmartOCRView },
    { path: '/extraction', component: ExtractionHubView },
    { path: '/flashcard-player', component: FlashcardPlayerView },
    { path: '/generator', component: GeneratorRouteHandler },
    { path: '/my-lessons', component: LessonPlanLibraryView },
    { path: '/library', component: LibraryRedirect },
    { path: '/gallery', component: ExamplesGalleryView },
    { path: '/settings', component: SettingsView },      { path: '/school-admin', component: SchoolAdminView }, { path: '/school-admin/curriculum', component: CurriculumEditorView },    { path: '/system-admin', component: SystemAdminView }, { path: '/progression', component: ProgressionView },
    { path: '/reviews', component: ContentReviewView },
    { path: '/graph', component: CurriculumGraphView },
    { path: '/roadmap', component: RoadmapView },
    { path: '/favorites', component: FavoritesView },
    { path: '/scenario-bank', component: ScenarioBankView },
    { path: '/content-library', component: ContentLibraryView },
    { path: '/olympiad', component: OlympiadArchiveView },
    { path: '/math-editor', component: MathEditorView },
    { path: '/dugga/build', component: DuggaBuilderView },
    { path: '/dugga/play', component: DuggaPlayerView },
    { path: '/dugga', component: DuggaLibraryView },
    { path: '/ai/compare', component: AIModelCompareView },
    { path: '/ai/conduct', component: AICodeOfConductView },
    { path: '/usage', component: UsageDashboardView },
    { path: '/data-viz', component: DataVizStudioView },
    { path: '/math-tools', component: MathToolsView },
    { path: '/forum', component: TeacherForumView },
    { path: '/pro-dev', component: ProfDevView },
    { path: '/reports/coverage', component: CoverageAnalyzerView },
    { path: '/analytics', component: TeacherAnalyticsView },
    { path: '/standards-coverage', component: StandardsCoverageView },
    { path: '/test-generator', component: TestGeneratorView },
    { path: '/grade-book', component: GradeBookView },
    { path: '/test-review', component: WrittenTestReviewView },
    { path: '/my-profile', component: TeacherProfileView },
    { path: '/matura', component: MaturaSimulationView },
    { path: '/matura-library', component: MaturaLibraryView },
    { path: '/matura-practice', component: MaturaPracticeView },
    { path: '/matura-stats', component: MaturaAnalyticsView },
    { path: '/matura-import', component: MaturaImportView },
    { path: '/matura-portal', component: MaturaPortalView },
    { path: '/matura-assignments', component: MaturaAssignmentView },
    { path: '/homework', component: StudentHomeworkView },
    { path: '/exam/build', component: ExamBuilderView },
    { path: '/exam/play', component: ExamPlayerView },
    { path: '/exam/presenter/:id', component: ExamPresenterView },
    { path: '/exam/results/:id', component: ExamResultsView },
    { path: '/exam/print/:id', component: PrintExamView },
    { path: '/exam/print', component: PrintExamView },
    { path: '/analytics/telemetry', component: StudentTelemetryView },
    { path: '/kahoot/make', component: KahootMakerView },
    { path: '/slo', component: SLODashboardView }, // L1 — admin-only SLO dashboard
    { path: '/share/:data', component: SharedPlanView },
    { path: '/share/annual/:data', component: SharedAnnualPlanView },
    { path: '/share/matura/:data', component: SharedMaturaRecoveryView },
    { path: '/share/visual', component: ShareVisualView }, // C2.4/C3.4 — AlgebraTiles + Shape3D shareable URLs
    { path: '/quiz/:data', component: SharedQuizView },
    { path: '/mindmap/:topicId', component: MindMapView },
    { path: '/ai-mindmap', component: AIMindMapView },
    { path: '/gamma/presenter', component: React.lazy(() => import('./views/GammaPresenterView').then(m => ({ default: m.GammaPresenterView }))) },
    { path: '/gamma/join', component: GammaJoinView },
    { path: '/gamma/student/:pin', component: GammaStudentView },
    { path: '/embed/concept/:id', component: EmbedConceptView },
    { path: '/embed/quiz/:data', component: EmbedQuizView },
    { path: '/student/login', component: StudentLoginView }, // S65 P2-A — Student login
    { path: '/student/srs', component: StudentSRSView },     // S65 P2-D — Student SRS
    { path: '/student', component: StudentDashboardView },   // S65 P2-B — Student dashboard
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
                        className="fixed inset-0 bg-black/50 z-20 md:hidden"
                        onClick={closeSidebar}
                        aria-hidden="true"
                    />
                )}
                <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col md:pl-64 overflow-hidden relative">
                    <header className="sticky top-0 bg-brand-bg/80 backdrop-blur-sm z-10 px-4 md:px-8 pt-4 pb-2 border-b no-print flex items-center gap-2">
                        <button
                            type="button"
                            className="p-1 text-gray-600 md:hidden"
                            onClick={openSidebar}
                            aria-label="Отвори мени"
                        >
                            <ICONS.menu className="w-6 h-6" />
                        </button>
                        <GlobalSearchBar />
                    </header>
                    <Breadcrumbs crumbs={breadcrumbs} />
                    <RelatedTools path={path} />
                    <div className="flex-1 overflow-y-auto pb-16 md:pb-0">
                        <ErrorBoundary>
                            <Suspense fallback={<AppSkeleton />}>
                                <div key={path} className="animate-fade-in-up origin-top">
                                    {(path.startsWith('/annual-planner') || path.startsWith('/weekly-plan') || path.startsWith('/planner/lesson')) ? (
                                      <PlanningErrorBoundary>
                                        <RenderComponent {...params} />
                                      </PlanningErrorBoundary>
                                    ) : (
                                      <RenderComponent {...params} />
                                    )}
                                </div>
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                    <OfflineBanner />
                    <QuotaBanner />
                    <CurriculumGapBanner />
                    <BottomNavBar currentPath={path} />
                </main>
                <SilentErrorBoundary name="ContextualFAB">
                    <ContextualFAB path={path} params={params} />
                </SilentErrorBoundary>
            </div>
            <Suspense fallback={null}>
              <AIGeneratorPanelWithBoundary />
            </Suspense>
            <Suspense fallback={null}>
              <SilentErrorBoundary name="TutorAvatarWidget">
                <TutorAvatarWidget />
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
    const { firebaseUser } = useAuth();

    // B5-1: silently refresh FCM token on every login so stale tokens are replaced
    useEffect(() => {
        if (!firebaseUser?.uid) return;
        import('./services/pushService').then(({ silentRefreshFCMToken }) => {
            void silentRefreshFCMToken(firebaseUser.uid);
        }).catch(() => { /* non-critical */ });
    }, [firebaseUser?.uid]);

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

const AIGeneratorPanelFallback: React.FC = () => {
    const { closeGeneratorPanel, isOpen } = useGeneratorPanel();
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-gray-900/40 z-50 flex items-center justify-center no-print">
            <div className="bg-white rounded-2xl p-8 max-w-sm shadow-xl text-center mx-4">
                <p className="text-red-600 text-xl font-bold mb-2">⚠️ Грешка во генераторот</p>
                <p className="text-gray-500 text-sm mb-6">Настана неочекувана грешка. Ве молиме затворете и обидете се повторно.</p>
                <button
                    type="button"
                    onClick={closeGeneratorPanel}
                    className="px-5 py-2.5 bg-brand-primary text-white rounded-xl hover:bg-brand-secondary font-bold"
                >
                    Затвори
                </button>
            </div>
        </div>
    );
};

/** Wrapper so the SilentErrorBoundary resets when the panel is reopened */
const AIGeneratorPanelWithBoundary: React.FC = () => {
    const { isOpen } = useGeneratorPanel();
    return (
        <SilentErrorBoundary key={isOpen ? 'open' : 'closed'} name="AIGeneratorPanel" fallback={<AIGeneratorPanelFallback />}>
            <AIGeneratorPanel />
        </SilentErrorBoundary>
    );
};

const AppCore: React.FC = () => {
    const { isAuthenticated, isLoading } = useAuth();

    useEffect(() => {
        const splash = document.getElementById('app-splash');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 200);
        }
    }, []);

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

    // QR solution upload — standalone mobile page, no sidebar required
    if (window.location.hash.startsWith('#/upload/')) {
        const token = window.location.hash.replace('#/upload/', '').split('/')[0];
        return (
            <Suspense fallback={<AppSkeleton />}>
                <SolutionUploadPage token={token} />
            </Suspense>
        );
    }

    // Dugga student player — fullscreen standalone, no teacher sidebar/nav
    if (window.location.hash.startsWith('#/dugga/play')) {
        return (
            <Suspense fallback={<AppSkeleton />}>
                <DuggaPlayerView />
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
        <>
            <AuthenticatedApp />
            <NewVersionBanner />
        </>
    );
}


import { HelmetProvider } from 'react-helmet-async';

const AppProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <HelmetProvider>
  <ErrorBoundary>
    <NetworkStatusProvider>
      <NotificationProvider>
        <AuthProvider>
          <LanguageProvider>
          <UserPreferencesProvider>
            <CurriculumProvider>
              <PlannerProvider>
                <PlanningProvider>
                <ModalProvider>
                  <ModalManager />
                  <LastVisitedProvider>
                    <AcademyProgressProvider>
                      <UIProvider>
                        <GeneratorPanelProvider>
                          {children}
                          <GlobalTour />
                          <OnboardingGate />
                          <CookieConsent />
                          <DemoBanner />
                          <WhatsNewModal />
                          <Suspense fallback={null}>
                            <CommandPalette />
                          </Suspense>
                        </GeneratorPanelProvider>
                      </UIProvider>
                    </AcademyProgressProvider>
                  </LastVisitedProvider>
                </ModalProvider>
                </PlanningProvider>
              </PlannerProvider>
            </CurriculumProvider>
          </UserPreferencesProvider>
        </LanguageProvider>
        </AuthProvider>
      </NotificationProvider>
    </NetworkStatusProvider>
  </ErrorBoundary>
  </HelmetProvider>
);

// E2.2 — Apply global accessibility settings from localStorage on startup
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


